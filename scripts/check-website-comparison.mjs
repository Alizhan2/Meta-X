import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
import {createRunManager} from '../src/runs.mjs';
import {createFixtureServer} from '../src/server.mjs';
import {executeWebsiteComparison} from '../src/website-comparison.mjs';
import {createDialogComparisonSite,dialogTask,dialogContract} from './dialog-comparison-site.mjs';
import {checkOfflineDownload} from './check-offline-helper.mjs';
const root=resolve('output/playwright',`website-comparison-check-${Date.now()}`);await mkdir(root,{recursive:true});
const site=await createDialogComparisonSite(),other=await createDialogComparisonSite();
let configured=false,script='normal',modelCalls=0,cancelOnFinalize=false;
let runs=await createRunManager({root,configured:()=>configured,executeComparison:options=>executeWebsiteComparison({...options,onUpdate:update=>{
  options.onUpdate(update);
  if(cancelOnFinalize&&update.phase==='checking'&&['original','corrected'].every(side=>update.report.comparison[side].state==='finished')){cancelOnFinalize=false;queueMicrotask(()=>runs.stop(update.report.runId));}
},decideFor:condition=>{
  let cursor=0;const keys=script==='no-escape'?['Tab','Enter']:['Tab','Enter','Escape'];
  return async(history,observation,task)=>{
    modelCalls++;assert.equal(task,dialogTask);assert.ok(!task.includes(dialogContract.triggerSelector));
    if(script==='error')throw new Error('scripted_api_failure');
    if(cursor<keys.length)return {action:{name:'press_key',arguments:{key:keys[cursor++]}},model:'scripted-comparison-test',continueWith:()=>[]};
    return {kind:condition==='corrected'||script==='no-escape'?'done':'stop',reason:'Observed dialog result',model:'scripted-comparison-test'};
  };
}})});
let app=await createFixtureServer({runs,artifactRoot:root});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
const api=async(path,body,origin)=>{const response=await fetch(app.origin+path,body?{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)}:{});return {status:response.status,data:await response.json()};};
const get=async id=>(await api('/api/runs/'+id)).data.run;
const input=(before='/before',after='/after',mode='deterministic')=>({beforeUrl:site.origin+before,afterUrl:site.origin+after,task:dialogTask,checkMode:mode,contract:dialogContract});
async function until(fn,label){const end=Date.now()+90000;while(Date.now()<end){const value=await fn();if(value)return value;await delay(70);}throw new Error('Timeout: '+label);}
async function finished(id){return until(async()=>{const run=await get(id);return run.reportUrl&&['completed','failed','stopped'].includes(run.state)?run:false;},'finished '+id);}
const results=[];
async function start(body){const result=await api('/api/runs',body);assert.equal(result.status,202,JSON.stringify(result.data));return result.data.run.id;}
try{
  await page.goto(app.origin);await page.locator('#target-mode').selectOption('compare');
  await until(()=>page.locator('#start').isEnabled(),'free comparison enabled');assert.deepEqual(errors,[]);
  const values={'before-url':site.origin+'/before','after-url':other.origin+'/after','comparison-task':dialogTask,'trigger-selector':'#open-details','dialog-selector':'#details-dialog'};
  for(const [id,value] of Object.entries(values))await page.locator('#'+id).fill(value);
  await page.locator('#comparison-method').selectOption('agent');assert.equal(await page.locator('#start').isDisabled(),true);await page.locator('#comparison-method').selectOption('deterministic');
  assert.equal((await api('/api/runs',{...input(),checkMode:'agent'})).status,503);
  assert.equal((await api('/api/runs',input(),'https://unrelated.test')).status,403);
  assert.equal((await api('/api/runs',{...input(),afterUrl:app.origin})).status,400);
  assert.equal((await api('/api/runs',{...input(),contract:{...dialogContract,script:'document.body.click()'}})).status,400);
  await page.locator('#start').click();const first=await until(async()=>(await api('/api/runs')).data.activeId,'UI run started');
  assert.equal((await api('/api/runs',input())).status,409);assert.equal((await api('/api/runs',{variant:'correct'})).status,409);
  const verified=await finished(first);assert.equal(verified.comparison.verified,true);assert.equal(verified.comparison.original.failed,3);assert.equal(verified.comparison.corrected.passed,3);assert.equal(modelCalls,0);
  await until(async()=>(await page.locator('#comparison-result').textContent()).includes('verifies only'),'verified UI');
  const exported=await checkOfflineDownload({page,browser,button:page.locator('#comparison-download'),path:resolve(root,'website-offline.html'),id:first,expectedText:'Dialog contract improvement verified',minimumImages:2,screenshot:resolve(root,'website-offline.png')});
  await page.screenshot({path:resolve(root,'website-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:resolve(root,'website-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1100});
  await page.reload();await until(()=>page.locator('#comparison-download').isVisible(),'reload');assert.equal(await page.locator('#before-url').inputValue(),values['before-url']);assert.equal(await page.locator('#dialog-selector').inputValue(),'#details-dialog');
  results.push({case:'different-origin original/fixed',id:first,verified:true,originalFailed:3,correctedPassed:3});
  for(const [name,body,reason] of [
    ['both clean',input('/after','/delayed'),'original_failure_not_reproduced'],
    ['still broken',input('/before','/still-broken'),'corrected_contract_failed'],
    ['focus restoration defect',input('/bad-focus','/after'),'dialog_contract_improvement'],
    ['invalid CSS', {...input(),contract:{...dialogContract,dialogSelector:'['}},'independent_checks_incomplete']
  ]){
    const id=await start(body),run=await finished(id);assert.equal(run.reason,reason,name);assert.equal(run.comparison.verified,name==='focus restoration defect',name);
    if(name==='invalid CSS'){assert.equal(run.state,'failed');assert.equal(run.comparison.original.probes[0].actions.length,0);assert.equal(run.comparison.original.probes[0].passed,null);}
    results.push({case:name,id,verified:run.comparison.verified,reason:run.reason});
  }
  const cancel=await start(input());await page.goto(app.origin+'/?run='+cancel);
  await until(async()=>(await get(cancel)).comparison.original.steps.length>=1,'first probe action');await page.locator('#stop').click();
  const stopped=await finished(cancel);assert.equal(stopped.state,'stopped');assert.equal(stopped.comparison.verified,false);assert.equal(stopped.comparison.corrected.completed,0);
  const stoppedRaw=JSON.parse(await readFile(resolve(root,cancel,'report.json'),'utf8'));assert.equal(stoppedRaw.cancelled,true);
  cancelOnFinalize=true;const finalStop=await finished(await start(input()));assert.equal(finalStop.state,'stopped');assert.equal(finalStop.comparison.verified,false);assert.equal(finalStop.reason,'user_stopped');
  configured=true;script='normal';const agent=await finished(await start(input('/before','/after','agent')));assert.equal(agent.comparison.verified,true);assert.equal(agent.comparison.original.agent.contract.passed,false);assert.equal(agent.comparison.corrected.agent.contract.passed,true);
  results.push({case:'scripted agent plus independent Chromium checks',id:agent.id,verified:true});
  script='no-escape';const unexercised=await finished(await start(input('/before','/after','agent')));assert.equal(unexercised.comparison.independent.verified,true);assert.equal(unexercised.comparison.verified,false);assert.equal(unexercised.comparison.corrected.agent.contract.passed,null);
  script='error';const failed=await finished(await start(input('/before','/after','agent')));assert.equal(failed.state,'failed');assert.equal(failed.comparison.verified,false);assert.equal(failed.comparison.corrected.agent,undefined);
  await runs.close();await app.close();runs=await createRunManager({root,configured:()=>false});app=await createFixtureServer({runs,artifactRoot:root});await page.goto(app.origin+'/?run='+first);await until(()=>page.locator('#comparison-download').isVisible(),'restart history');assert.equal((await get(first)).comparison.verified,true);assert.deepEqual(errors,[]);
  const summary={scope:'Real UI/API/Chromium comparison of arbitrary user URLs and CSS contracts. Deterministic checks are real; agent decisions are injected and labelled scripted-test. No Meta calls.',results,exported,cancelledId:cancel,cancelledDuringFinalWriteId:finalStop.id,unexercisedAgentId:unexercised.id,failedAgentId:failed.id,scriptedModelCalls:modelCalls,pageErrors:errors};
  await writeFile(resolve(root,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({result:'PASS',output:root,...summary}));
}catch(error){await page.screenshot({path:resolve(root,'failure.png'),fullPage:true}).catch(()=>{});console.log(JSON.stringify({output:root,error:error.message,pageErrors:errors}));throw error;}
finally{await runs.close();await browser.close();await app.close();await site.close();await other.close();}
