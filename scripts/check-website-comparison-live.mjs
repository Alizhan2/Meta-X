import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
import {dialogContract,dialogTask} from './dialog-comparison-site.mjs';
import {dispatchTask,dispatchContract,releases,dispatchPage,cancelRegression} from './dispatch-site.mjs';
import {createHash} from 'node:crypto';
import {checkOfflineDownload} from './check-offline-helper.mjs';
const discovery=process.argv[4]==='dispatch';
const origin=process.argv[2]||'http://127.0.0.1:3000',site=process.argv[3]||'http://127.0.0.1:4207';
const beforeUrl=site+(discovery?releases.before:'/before'),afterUrl=site+(discovery?releases.after:'/after'),task=discovery?dispatchTask:dialogTask,contract=discovery?dispatchContract:dialogContract;
const root=resolve('output/playwright',`${discovery?'discovery':'website-comparison'}-live-${Date.now()}`);await mkdir(root,{recursive:true});
const api=async path=>fetch(origin+path).then(r=>r.json());
const state=await api('/api/runs');assert.equal(state.configured,true);assert.equal(state.activeId,null,'main workbench must be idle');
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',error=>errors.push(error.message));let id;
async function until(fn,label){const end=Date.now()+480000;while(Date.now()<end){const value=await fn();if(value)return value;await delay(300);}throw new Error('Timeout: '+label);}
try{
  await page.goto(origin);await page.locator('#target-mode').selectOption('compare');
  for(const [field,value] of Object.entries({'before-url':beforeUrl,'after-url':afterUrl,'comparison-task':task,'trigger-selector':contract.triggerSelector,'dialog-selector':contract.dialogSelector}))await page.locator('#'+field).fill(value);
  if(discovery)await page.locator('#route-mode').selectOption('agent-route');
  await page.locator('#comparison-method').selectOption('agent');await until(()=>page.locator('#start').isEnabled(),'ready');
  await page.locator('#start').click();id=await until(async()=>(await api('/api/runs')).activeId,'live comparison started');
  console.log(JSON.stringify({event:'started',id,output:root}));
  const run=await until(async()=>{const r=(await api('/api/runs/'+id)).run;return r.reportUrl&&['completed','failed','stopped'].includes(r.state)?r:false;},'live comparison finished');
  await writeFile(resolve(root,'run-summary.json'),JSON.stringify(run,null,2)+'\n');
  assert.equal(run.executionMode,'meta-live');assert.equal(run.state,'completed',JSON.stringify({reason:run.reason,comparison:run.comparison}));assert.equal(run.comparison.verified,true);assert.equal(run.comparison.agentComparability.verified,true);
  assert.equal(run.comparison.original.agent.contract.passed,false);assert.equal(run.comparison.corrected.agent.contract.passed,true);
  assert.equal(run.comparison.original.failed,3);assert.equal(run.comparison.corrected.passed,3);
  if(discovery){
    const route=run.comparison.discovery;assert.ok(route.steps.length>10);assert.equal(route.sourceRunId,run.comparison.original.agent.runId);assert.equal(route.executionMode,'meta-live');
    for(const side of ['original','corrected'])for(const probe of run.comparison[side].probes){assert.equal(probe.routeSourceRunId,route.sourceRunId);assert.deepEqual(probe.actions.slice(0,route.steps.length).map(s=>s.action),route.steps.map(s=>s.action));assert.ok(probe.beforeEscape.focus.name.includes('NS-2841'));assert.ok(probe.beforeEscape.focus.name.includes('November 6'));}
    for(const side of ['original','corrected'])assert.ok(!run.comparison[side].steps.some(step=>step.focusBefore?.id==='apply-change'&&['Enter','Space'].includes(step.action?.arguments?.key)),'no apply action');
    assert.equal(dispatchPage({broken:true}).replace(cancelRegression,''),dispatchPage({broken:false}));
  }
  await until(()=>page.locator('#comparison-download').isVisible(),'download');
  await page.screenshot({path:resolve(root,'main-workbench.png'),fullPage:true});
  await page.locator('#comparison-view').screenshot({path:resolve(root,'comparison.png')});
  if(discovery){await page.locator('#comparison-discovery summary').click();await page.locator('#comparison-discovery').screenshot({path:resolve(root,'discovered-route.png')});}
  const exported=await checkOfflineDownload({page,browser,button:page.locator('#comparison-download'),path:resolve(root,'TabProof-website-before-after.html'),id,expectedText:'Dialog contract improvement verified',minimumImages:2,screenshot:resolve(root,'offline-report.png')});
  await page.reload();await until(()=>page.locator('#comparison-download').isVisible(),'history reload');assert.equal(await page.locator('#before-url').inputValue(),beforeUrl);assert.deepEqual(errors,[]);
  const summary={discovery:discovery?run.comparison.discovery:undefined,sourceHashes:discovery?{before:createHash('sha256').update(dispatchPage({broken:true})).digest('hex'),after:createHash('sha256').update(dispatchPage({broken:false})).digest('hex'),onlyDifference:cancelRegression}:undefined,scope:'Real main-console buttons → two actual Meta agent sessions → six independent keyboard probes → persisted comparison → offline download. No scripted decisions.',id,verified:run.comparison.verified,original:{actions:run.comparison.original.steps.length,contract:run.comparison.original.agent.contract,independentFailed:run.comparison.original.failed},corrected:{actions:run.comparison.corrected.steps.length,contract:run.comparison.corrected.agent.contract,independentPassed:run.comparison.corrected.passed},exported,pageErrors:errors};
  await writeFile(resolve(root,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({result:'PASS',output:root,id,originalActions:summary.original.actions,correctedActions:summary.corrected.actions}));
}catch(error){console.log(JSON.stringify({result:'FAIL',id,output:root,reason:error.message.slice(0,1500)}));throw error;}
finally{
  if(id&&(await api('/api/runs')).activeId===id)await fetch(origin+'/api/runs/'+id+'/stop',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  await browser.close();
}
