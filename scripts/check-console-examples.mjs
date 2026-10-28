import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
import {createFixtureServer} from '../src/server.mjs';
import {createRunManager} from '../src/runs.mjs';

const root=resolve('output/playwright',`console-examples-check-${Date.now()}`);await mkdir(root,{recursive:true});
let runs=await createRunManager({root,configured:()=>false});
let app=await createFixtureServer({runs,artifactRoot:root});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const list=()=>fetch(app.origin+'/api/runs').then(r=>r.json());
const get=id=>fetch(app.origin+'/api/runs/'+id).then(r=>r.json()).then(r=>r.run);
const post=(body,origin)=>fetch(app.origin+'/api/runs',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
async function until(predicate,label){const end=Date.now()+60000;while(Date.now()<end){const value=await predicate();if(value)return value;await delay(80);}throw new Error('Timeout: '+label);}
const completed=[];
try{
  await page.goto(app.origin);await page.locator('#target-mode').selectOption('examples');
  await until(()=>page.locator('#start').isEnabled(),'free checks enabled without Meta key');
  assert.equal((await list()).configured,false);assert.equal((await list()).runs.length,0);
  await until(async()=>((await page.locator('#comparison-kind').textContent()).includes('Saved reference')),'published reference label');
  assert.equal((await post({exampleId:'radix-toast',checkMode:'deterministic'},'https://unrelated.test')).status,403);
  assert.equal((await post({exampleId:'other',checkMode:'deterministic'})).status,400);
  assert.equal((await post({exampleId:'radix-toast',checkMode:'agent'})).status,503);
  await page.locator('#example-check-mode').selectOption('agent');assert.equal(await page.locator('#start').isDisabled(),true);
  await page.locator('#example-check-mode').selectOption('deterministic');
  for(const exampleId of ['react-aria-scroll','radix-toast']){
    await page.locator('#example-id').selectOption(exampleId);
    await until(()=>page.locator('#start').isEnabled(),'start '+exampleId);
    await until(async()=>await page.locator('#original-image').evaluate(image=>image.complete&&image.naturalWidth>0),'reference image');
    await page.locator('#start').click();
    const id=await until(async()=>(await list()).activeId,'active '+exampleId);
    await until(()=>page.url().includes(id),'new run selection persisted in URL');
    assert.equal((await post({exampleId:'radix-toast',checkMode:'deterministic'})).status,409);
    assert.equal((await post({variant:'correct'})).status,409);
    const result=await until(async()=>{const run=await get(id);return run.state==='completed'||run.state==='failed'?run:false;},'complete '+exampleId);
    assert.equal(result.state,'completed',JSON.stringify(result));assert.equal(result.outcome,'comparison_verified');assert.equal(result.comparison.verified,true);
    assert.equal(result.comparison.original.failed,3);assert.equal(result.comparison.corrected.passed,3);
    assert.equal(result.comparison.original.state,'finished');assert.equal(result.comparison.corrected.state,'finished');
    await until(async()=>((await page.locator('#comparison-result').innerText()).includes('reproduce the expected difference')),'verified UI '+exampleId);
    for(const condition of ['original','corrected']){
      const image=page.locator('#'+condition+'-image');await until(async()=>await image.evaluate(el=>el.complete&&el.naturalWidth>0),'fresh '+condition+' image');
      assert.ok((await image.getAttribute('src')).startsWith('/reports/'+id+'/'));
      assert.equal((await fetch(app.origin+result.comparison[condition].screenshot)).status,200);
      assert.ok(result.comparison[condition].steps.length>0);
    }
    const href=await page.locator('#comparison-report').getAttribute('href');assert.equal(href,result.reportUrl);
    const report=await fetch(app.origin+href).then(r=>r.text());assert.ok(report.includes('Before/after comparison verified'));
    assert.equal((await fetch(app.origin+'/reports/'+id+'/details.json')).status,200);
    await page.screenshot({path:resolve(root,exampleId+'-desktop.png'),fullPage:true});
    await page.reload();await until(async()=>((await page.locator('#comparison-kind').textContent()).includes('Fresh deterministic')),'fresh run restored');
    assert.ok((await page.locator('#comparison-report').getAttribute('href')).includes(id));
    completed.push({id,exampleId,original:result.comparison.original.failed,corrected:result.comparison.corrected.passed});
  }
  await page.locator('#example-id').selectOption('react-aria-scroll');
  await until(()=>page.locator('#start').isEnabled(),'start cancellable example');await page.locator('#start').click();
  const cancelledId=await until(async()=>(await list()).activeId,'cancellable active id');
  await until(async()=>(await get(cancelledId)).comparison.original.completed>=1,'first original repeat');
  await page.locator('#stop').click();
  const stopped=await until(async()=>{const run=await get(cancelledId);return run.state==='stopped'&&run.reportUrl?run:false;},'partial comparison saved');
  assert.equal(stopped.comparison.verified,false);assert.equal(stopped.comparison.corrected.completed,0);assert.equal(stopped.comparison.corrected.screenshot,null);
  const raw=JSON.parse(await readFile(resolve(root,cancelledId,'report.json'),'utf8'));assert.equal(raw.cancelled,true);assert.equal(raw.outcome,'agent_inconclusive');
  const report=await fetch(app.origin+stopped.reportUrl).then(r=>r.text());assert.ok(report.includes('Comparison stopped'));assert.ok(report.includes('partial'));
  await until(async()=>((await page.locator('#comparison-result').innerText()).includes('partial')),'stopped UI');
  const snapshot=JSON.stringify(stopped.comparison);await delay(250);assert.equal(JSON.stringify((await get(cancelledId)).comparison),snapshot,'no background progress after Stop');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(root,'stopped-mobile.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.setViewportSize({width:1440,height:1100});
  const restoredId=completed[1].id;
  await runs.close();await app.close();
  runs=await createRunManager({root,configured:()=>false});app=await createFixtureServer({runs,artifactRoot:root});
  await page.goto(app.origin+'/?run='+restoredId);
  await until(async()=>((await page.locator('#comparison-kind').textContent()).includes('Fresh deterministic')),'history after server restart');
  assert.equal(await page.locator('#example-id').inputValue(),'radix-toast');
  assert.equal((await get(cancelledId)).state,'stopped');assert.equal((await get(restoredId)).comparison.verified,true);
  const unsafe=await fetch(app.origin+'/examples/radix-toast/reference/%2e%2e%2f.env');assert.equal(unsafe.status,404);
  assert.deepEqual(errors,[]);
  const summary={scope:'Real UI/API/Chromium checks of both third-party examples; configured=false and no Meta calls.',checks:['published reference labels','free checks without key','Meta mode requires key','cross-origin rejection','invalid example rejection','shared run lock','both real deterministic comparisons','fresh screenshots and reports','URL reload restoration','cancel after first repeat','no corrected attempt after stop','partial persistence','server restart','mobile390','reference traversal rejection'],completed,stoppedId:cancelledId,pageErrors:errors};
  await writeFile(resolve(root,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({result:'PASS',output:root,...summary}));
}catch(error){
  await page.screenshot({path:resolve(root,'failure.png'),fullPage:true}).catch(()=>{});
  console.log(JSON.stringify({failed:error.message,output:root,pageErrors:errors,dom:await page.locator('body').innerText().catch(()=>''),mode:await page.locator('#target-mode').inputValue().catch(()=>null)},null,2));
  throw error;
}finally{await runs.close();await browser.close();await app.close();}
