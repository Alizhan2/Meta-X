import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
import {dialogContract,dialogTask} from './dialog-comparison-site.mjs';
import {checkOfflineDownload} from './check-offline-helper.mjs';
const origin=process.argv[2]||'http://127.0.0.1:3000',site=process.argv[3]||'http://127.0.0.1:4207';
const root=resolve('output/playwright',`website-comparison-live-${Date.now()}`);await mkdir(root,{recursive:true});
const api=async path=>fetch(origin+path).then(r=>r.json());
const state=await api('/api/runs');assert.equal(state.configured,true);assert.equal(state.activeId,null,'main workbench must be idle');
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',error=>errors.push(error.message));let id;
async function until(fn,label){const end=Date.now()+480000;while(Date.now()<end){const value=await fn();if(value)return value;await delay(300);}throw new Error('Timeout: '+label);}
try{
  await page.goto(origin);await page.locator('#target-mode').selectOption('compare');
  for(const [field,value] of Object.entries({'before-url':site+'/before','after-url':site+'/after','comparison-task':dialogTask,'trigger-selector':dialogContract.triggerSelector,'dialog-selector':dialogContract.dialogSelector}))await page.locator('#'+field).fill(value);
  await page.locator('#comparison-method').selectOption('agent');await until(()=>page.locator('#start').isEnabled(),'ready');
  await page.locator('#start').click();id=await until(async()=>(await api('/api/runs')).activeId,'live comparison started');
  console.log(JSON.stringify({event:'started',id,output:root}));
  const run=await until(async()=>{const r=(await api('/api/runs/'+id)).run;return r.reportUrl&&['completed','failed','stopped'].includes(r.state)?r:false;},'live comparison finished');
  await writeFile(resolve(root,'run-summary.json'),JSON.stringify(run,null,2)+'\n');
  assert.equal(run.executionMode,'meta-live');assert.equal(run.state,'completed',JSON.stringify({reason:run.reason,comparison:run.comparison}));assert.equal(run.comparison.verified,true);assert.equal(run.comparison.agentComparability.verified,true);
  assert.equal(run.comparison.original.agent.contract.passed,false);assert.equal(run.comparison.corrected.agent.contract.passed,true);
  assert.equal(run.comparison.original.failed,3);assert.equal(run.comparison.corrected.passed,3);
  await until(()=>page.locator('#comparison-download').isVisible(),'download');
  await page.screenshot({path:resolve(root,'main-workbench.png'),fullPage:true});
  const exported=await checkOfflineDownload({page,browser,button:page.locator('#comparison-download'),path:resolve(root,'TabProof-website-before-after.html'),id,expectedText:'Dialog contract improvement verified',minimumImages:2,screenshot:resolve(root,'offline-report.png')});
  await page.reload();await until(()=>page.locator('#comparison-download').isVisible(),'history reload');assert.equal(await page.locator('#before-url').inputValue(),site+'/before');assert.deepEqual(errors,[]);
  const summary={scope:'Real main-console buttons → two actual Meta agent sessions → six independent keyboard probes → persisted comparison → offline download. No scripted decisions.',id,verified:run.comparison.verified,original:{actions:run.comparison.original.steps.length,contract:run.comparison.original.agent.contract,independentFailed:run.comparison.original.failed},corrected:{actions:run.comparison.corrected.steps.length,contract:run.comparison.corrected.agent.contract,independentPassed:run.comparison.corrected.passed},exported,pageErrors:errors};
  await writeFile(resolve(root,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({result:'PASS',output:root,id,originalActions:summary.original.actions,correctedActions:summary.corrected.actions}));
}catch(error){console.log(JSON.stringify({result:'FAIL',id,output:root,reason:error.message.slice(0,1500)}));throw error;}
finally{
  if(id&&(await api('/api/runs')).activeId===id)await fetch(origin+'/api/runs/'+id+'/stop',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  await browser.close();
}
