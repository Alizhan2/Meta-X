import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
import {createRunManager} from '../src/runs.mjs';
import {createFixtureServer} from '../src/server.mjs';
import {executeWebsiteComparison} from '../src/website-comparison.mjs';
import {probeDialogContract} from '../src/dialog-contract.mjs';
import {createDispatchSite,dispatchTask,dispatchContract,releases,dispatchPage,cancelRegression} from './dispatch-site.mjs';
import {checkOfflineDownload} from './check-offline-helper.mjs';
const root=resolve('output/playwright',`discovery-check-${Date.now()}`);await mkdir(root,{recursive:true});
assert.equal(dispatchPage({broken:true}).replace(cancelRegression,''),dispatchPage({broken:false}),'host pages differ only by the cancel regression');
const site=await createDispatchSite();let wrongDate=false,cancelReplay=false;
const actions=['Tab','Tab','Enter','Tab',{name:'type_text',arguments:{text:'Northstar Studio'}},'Enter','Tab','ArrowDown','Tab','Tab','Enter','Tab','Tab','Enter','Tab','Space','Tab','Enter','Escape'];
const sourceHashes={before:createHash('sha256').update(dispatchPage({broken:true})).digest('hex'),after:createHash('sha256').update(dispatchPage({broken:false})).digest('hex'),onlyDifference:cancelRegression};
const manager=await createRunManager({root,configured:()=>true,executeComparison:options=>executeWebsiteComparison({...options,onUpdate:update=>{
  options.onUpdate(update);if(cancelReplay&&update.report.comparison.original.activeProbe?.actions.length>=4){cancelReplay=false;queueMicrotask(()=>manager.stop(update.report.runId));}
},decideFor:condition=>{
  let cursor=0;const plan=wrongDate?[...actions.slice(0,16),'ArrowDown',...actions.slice(16)]:actions;
  return async(history,observation,task)=>{
    assert.equal(task,dispatchTask);assert.ok(!task.includes('NS-2841'));assert.ok(!task.includes(dispatchContract.triggerSelector));assert.ok(!observation.semantics.includes(cancelRegression));
    if(cursor<plan.length){const action=typeof plan[cursor]==='string'?{name:'press_key',arguments:{key:plan[cursor]}}:plan[cursor];cursor++;return {action,model:'scripted-discovery-test',continueWith:()=>[]};}
    return {kind:condition==='original'?'stop':'done',reason:'Observed preview state',model:'scripted-discovery-test'};
  };
}})});
const app=await createFixtureServer({runs:manager,artifactRoot:root}),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
const body={beforeUrl:site.origin+releases.before,afterUrl:site.origin+releases.after,task:dispatchTask,checkMode:'agent',contract:dispatchContract};
const api=async(path,body)=>{const response=await fetch(app.origin+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});return {status:response.status,data:await response.json()};};
async function until(fn,label){const end=Date.now()+90000;while(Date.now()<end){const result=await fn();if(result)return result;await delay(80);}throw new Error('Timeout: '+label);}
async function finished(id){return until(async()=>{const r=(await api('/api/runs/'+id)).data.run;return r.reportUrl?r:false;},'finished '+id);}
try{
  assert.equal((await api('/api/runs',{...body,checkMode:'deterministic'})).status,400);
  await page.goto(app.origin);await page.locator('#target-mode').selectOption('compare');
  for(const [id,value] of Object.entries({'before-url':body.beforeUrl,'after-url':body.afterUrl,'comparison-task':dispatchTask,'trigger-selector':dispatchContract.triggerSelector,'dialog-selector':dispatchContract.dialogSelector}))await page.locator('#'+id).fill(value);
  await page.locator('#route-mode').selectOption('agent-route');assert.equal(await page.locator('#comparison-method').inputValue(),'agent');
  await until(()=>page.locator('#start').isEnabled(),'ready');await page.locator('#start').click();const id=await until(async()=>(await api('/api/runs')).data.activeId,'start');
  const run=await finished(id);assert.equal(run.state,'completed',JSON.stringify(run));assert.equal(run.executionMode,'scripted-test');assert.equal(run.comparison.verified,true);
  const route=run.comparison.discovery;assert.equal(route.steps.length,18);assert.equal(route.sourceRunId,run.comparison.original.agent.runId);
  assert.equal(run.comparison.original.failed,3);assert.equal(run.comparison.corrected.passed,3);
  for(const side of ['original','corrected'])for(const probe of run.comparison[side].probes){assert.equal(probe.actions.length,19);assert.equal(probe.routeSourceRunId,route.sourceRunId);assert.deepEqual(probe.actions.slice(0,18).map(s=>s.action),route.steps.map(s=>s.action));assert.ok(probe.beforeEscape.focus.name.includes('NS-2841'));assert.ok(probe.beforeEscape.focus.name.includes('November 6'));}
  await page.locator('#comparison-discovery').waitFor({state:'visible'});assert.equal(await page.locator('#discovery-title').textContent(),'Scripted test route');
  await checkOfflineDownload({page,browser,button:page.locator('#comparison-download'),path:resolve(root,'dispatch-offline.html'),id,expectedText:'Scripted test route',minimumImages:2,screenshot:resolve(root,'dispatch-offline.png')});
  await page.reload();await until(()=>page.locator('#comparison-download').isVisible(),'reload');assert.equal(await page.locator('#route-mode').inputValue(),'agent-route');
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  const drift=await probeDialogContract({targetUrl:site.origin+'/releases/drift/',contract:dispatchContract,route});assert.equal(drift.valid,false);assert.equal(drift.reason,'discovered_route_diverged');
  const noRoute=await probeDialogContract({targetUrl:body.beforeUrl,contract:dispatchContract});assert.equal(noRoute.valid,false);assert.equal(noRoute.passed,null);
  wrongDate=true;const wrong=await api('/api/runs',body);assert.equal(wrong.status,202);const wrongResult=await finished(wrong.data.run.id);assert.equal(wrongResult.reason,'agent_route_not_found');assert.equal(wrongResult.comparison.verified,false);assert.equal(wrongResult.comparison.corrected.agent,undefined);
  wrongDate=false;cancelReplay=true;const cancel=await api('/api/runs',body);const cancelled=await finished(cancel.data.run.id);assert.equal(cancelled.state,'stopped');assert.equal(cancelled.comparison.verified,false);assert.ok(cancelled.comparison.original.activeProbe.actions.length>=4);assert.equal(cancelled.comparison.corrected.completed,0);
  assert.deepEqual(errors,[]);const summary={scope:'Actual multistep site and Chromium/UI/API/replay checks. Agent decisions are injected and explicitly labelled scripted-test; no Meta calls.',id,sourceHashes,routeActions:route.steps.length,agentActions:run.comparison.original.steps.length,originalFailures:3,correctedPasses:3,drift:{valid:drift.valid,reason:drift.reason,divergence:drift.divergence},withoutDiscoveredRoute:{valid:noRoute.valid,passed:noRoute.passed,reason:noRoute.reason},wrongDestinationId:wrongResult.id,cancelledReplayId:cancelled.id,pageErrors:errors};await writeFile(resolve(root,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({result:'PASS',output:root,...summary}));
}catch(error){await page.screenshot({path:resolve(root,'failure.png'),fullPage:true}).catch(()=>{});console.log(JSON.stringify({output:root,error:error.message.slice(0,4000),pageErrors:errors}));throw error;}
finally{await manager.close();await browser.close();await app.close();await site.close();}
