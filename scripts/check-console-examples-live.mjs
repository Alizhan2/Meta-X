import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';

// Explicitly paid end-to-end verification against an already-running local
// workbench. No model decisions, oracle outcomes or browser worker are mocked.
const origin=process.argv[2]||'http://127.0.0.1:3000';
assert.equal(new URL(origin).hostname,'127.0.0.1');
const cases=process.argv.slice(3).length?process.argv.slice(3):['react-aria-scroll','radix-toast'];
assert.ok(cases.every(id=>['react-aria-scroll','radix-toast'].includes(id)));
const output=resolve('output/playwright',`console-examples-live-${Date.now()}`);await mkdir(output,{recursive:true});
const state=()=>fetch(origin+'/api/runs').then(r=>r.json());
assert.equal((await state()).activeId,null,'Do not interrupt an existing user run');assert.equal((await state()).configured,true);
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
const errors=[],attempts=[];page.on('pageerror',error=>errors.push(error.message));
async function until(predicate,label,timeout=60000){const end=Date.now()+timeout;while(Date.now()<end){const value=await predicate();if(value)return value;await delay(150);}throw new Error('Timeout: '+label);}
try{
  await page.goto(origin);await page.locator('#target-mode').selectOption('examples');await page.locator('#example-check-mode').selectOption('agent');
  for(const exampleId of cases){
    await page.locator('#example-id').selectOption(exampleId);await until(()=>page.locator('#start').isEnabled(),'ready '+exampleId);
    await page.locator('#start').click();
    const id=await until(async()=>(await state()).activeId,'started '+exampleId);
    let signature='';
    const run=await until(async()=>{
      const run=await fetch(origin+'/api/runs/'+id).then(r=>r.json()).then(r=>r.run);
      const current=JSON.stringify([run.state,run.comparison?.phase,run.comparison?.original?.steps?.length,run.comparison?.corrected?.steps?.length]);
      if(current!==signature){signature=current;console.log(JSON.stringify({exampleId,id,state:run.state,phase:run.comparison?.phase,originalActions:run.comparison?.original?.steps?.length,correctedActions:run.comparison?.corrected?.steps?.length}));}
      return ['completed','failed','stopped'].includes(run.state)?run:false;
    },'real Meta comparison '+exampleId,8*60*1000);
    attempts.push(run);await writeFile(resolve(output,'attempts.json'),JSON.stringify(attempts,null,2)+'\n');
    assert.equal(run.state,'completed',JSON.stringify({id,reason:run.reason,comparison:run.comparison}));assert.equal(run.comparison.verified,true);
    assert.equal(run.comparison.original.passed,0);assert.equal(run.comparison.corrected.passed,1);
    assert.ok(run.comparison.original.steps.length>0&&run.comparison.corrected.steps.length>0);
    await until(async()=>(await page.locator('#comparison-result').innerText()).includes('reproduce the expected difference'),'verified UI '+exampleId);
    for(const condition of ['original','corrected']){
      await until(async()=>await page.locator('#'+condition+'-image').evaluate(el=>el.complete&&el.naturalWidth>0),'live '+condition+' screenshot');
      assert.ok((await page.locator('#'+condition+'-image').getAttribute('src')).includes('/reports/'+id+'/'));
    }
    await page.screenshot({path:resolve(output,exampleId+'-desktop.png'),fullPage:true});
    assert.ok((await page.locator('#comparison-report').getAttribute('href')).includes(id));
    await page.reload();await until(async()=>(await page.locator('#comparison-kind').textContent()).includes('Fresh Meta'),'restored Meta comparison');
  }
  assert.deepEqual(errors,[]);
  const summary={scope:'Actual main-console buttons → local API → real Meta/Chromium paired runs → independent example-specific audits → fresh comparison UI and reports. Both examples checked; no scripted model decisions.',attempts:attempts.map(run=>({id:run.id,exampleId:run.exampleId,state:run.state,verified:run.comparison.verified,originalActions:run.comparison.original.steps.length,correctedActions:run.comparison.corrected.steps.length})),pageErrors:errors};
  await writeFile(resolve(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({result:'PASS',output,...summary}));
}catch(error){await page.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});console.log(JSON.stringify({result:'FAILED',output,reason:error.message,pageErrors:errors}));throw error;}
finally{await browser.close();}
