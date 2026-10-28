import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
import {createFixtureServer} from '../src/server.mjs';
import {createRunManager} from '../src/runs.mjs';
import {executeRun} from '../src/runner.mjs';
const root=resolve('output/playwright',`custom-check-${Date.now()}`);await mkdir(root,{recursive:true});
let submissions=0,queries=[],forbiddenHits=0;
const forbidden=http.createServer((req,res)=>{forbiddenHits++;res.end('should not reach');});
await new Promise(resolve=>forbidden.listen(0,'127.0.0.1',resolve));
const forbiddenOrigin=`http://127.0.0.1:${forbidden.address().port}`;
const target=http.createServer(async(req,res)=>{
  if(req.url==='/search'){
    const data=[];for await(const chunk of req)data.push(chunk);queries.push(Buffer.concat(data).toString());submissions++;
    await delay(120);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({result:'Ceramics workshop is available'}));return;
  }
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Workshop search</title><h1>Find a workshop</h1><form><label for="query">Search workshops</label><input id="query"><button>Search</button></form><p id="result" role="status"></p><a href="/next">More workshops</a><script>fetch('${forbiddenOrigin}/secret').catch(()=>{});document.querySelector('form').onsubmit=async e=>{e.preventDefault();const r=await fetch('/search',{method:'POST',body:document.querySelector('input').value});document.querySelector('#result').textContent=(await r.json()).result};</script></html>`);
});
await new Promise(resolve=>target.listen(0,'127.0.0.1',resolve));
const targetUrl=`http://127.0.0.1:${target.address().port}/`;
const actions=[{name:'press_key',arguments:{key:'Tab'}},{name:'type_text',arguments:{text:'керамика'}},{name:'press_key',arguments:{key:'Tab'}},{name:'press_key',arguments:{key:'Enter'}}];
const task='Найди мастер-класс по керамике через поиск.';
const runs=await createRunManager({root,configured:()=>true,execute:options=>{
  let cursor=0;
  return executeRun({...options,controlOrigins:[...options.controlOrigins,forbiddenOrigin],decide:async(history,observation,task,options)=>{
    assert.equal(options.allowCompletion,true);await delay(120,null,{signal:options.signal});
    if(cursor===0)assert.equal(observation.focus.name,'Page','page focus must not expose inline script text');
    if(cursor<actions.length)return {action:actions[cursor++],model:'scripted-custom-test',continueWith:()=>[]};
    assert.ok(observation.semantics.includes('Ceramics workshop is available'),'asynchronous response visible before next decision');
    return {kind:'done',reason:'Ceramics workshop result is visible',model:'scripted-custom-test'};
  }});
}});
const app=await createFixtureServer({runs,artifactRoot:root});
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function until(predicate,label){const end=Date.now()+30000;while(Date.now()<end){const r=await predicate();if(r)return r;await delay(80);}throw new Error('Timeout: '+label);}
const api=async(path,body)=>{const r=await fetch(app.origin+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});return {status:r.status,data:await r.json()};};
try{
  await page.goto(app.origin);await until(()=>page.locator('#start').isEnabled(),'configured');
  await page.locator('#target-mode').selectOption('custom');
  assert.equal(await page.locator('#condition').isDisabled(),true);assert.equal(await page.locator('#site-url').isVisible(),true);
  await page.locator('#site-url').fill(targetUrl);await page.locator('#custom-task').fill(task);
  await page.locator('#site-url').fill('http://192.168.1.2/');await page.locator('#start').click();
  await until(async()=>!(await page.locator('#notice').isHidden()),'invalid URL notice');await delay(3200);
  assert.ok((await page.locator('#notice-text').textContent()).includes('public website'),'validation error persists across polling');
  await page.locator('#site-url').fill(targetUrl);
  await page.screenshot({path:resolve(root,'custom-input.png'),fullPage:true});
  assert.equal((await api('/api/runs',{targetUrl:app.origin,task})).status,400,'control plane target rejected');
  assert.equal((await api('/api/runs',{targetUrl:'file:///tmp/test',task})).status,400);
  assert.equal((await api('/api/runs',{targetUrl,task:'  '})).status,400);
  assert.equal((await api('/api/runs',{targetUrl,task,variant:'correct'})).status,400);
  await page.locator('#start').click();
  const finished=await until(async()=>{const s=(await api('/api/runs')).data;const r=s.runs[0];return r?.state==='completed'?r:false;},'custom completed');
  assert.equal(finished.targetKind,'custom');assert.equal(finished.task,task);assert.equal(finished.targetUrl,targetUrl);
  assert.equal(finished.outcome,'agent_reported_complete');assert.equal(finished.taskCompleted,false);assert.equal(finished.stepCount,4);assert.equal(finished.steps,undefined);
  const detail=(await api(`/api/runs/${finished.id}`)).data.run;assert.equal(detail.steps.length,4);
  assert.equal(submissions,1,'no automatic probe/replay can repeat a real form submission');assert.deepEqual(queries,['керамика']);assert.equal(forbiddenHits,0,'loopback subrequest must pass proxy and be rejected');
  await until(()=>page.locator('#report-link').isVisible(),'report link');
  assert.equal(await page.locator('#fixture-schedule').isHidden(),true);
  assert.equal(await page.locator('#task-description').textContent(),task);
  assert.ok((await page.locator('#run-detail').textContent()).includes('not been independently verified'));
  const report=JSON.parse(await readFile(resolve(root,finished.id,'report.json'),'utf8'));
  assert.equal(report.evidence,undefined);assert.equal(report.replays,undefined);assert.equal(report.evidenceSkipped,'custom_target');assert.equal(report.requests.length,5);
  const html=await fetch(app.origin+finished.reportUrl).then(r=>r.text());assert.ok(html.includes('Model reported completion'));assert.ok(!html.includes('Independent stored booking matches'));
  await page.screenshot({path:resolve(root,'custom-finished.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:resolve(root,'custom-mobile.png'),fullPage:true});
  await page.reload();await until(()=>page.locator('#report-link').isVisible(),'restored custom run');assert.equal(await page.locator('#task-description').textContent(),task);
  await page.locator('#target-mode').selectOption('custom');await page.locator('#site-url').fill(targetUrl);await page.locator('#custom-task').fill(task);await page.locator('#start').click();
  await until(async()=>!!(await api('/api/runs')).data.activeId,'second active');await page.locator('#stop').click();
  const stopped=await until(async()=>{const s=(await api('/api/runs')).data;return s.runs.find(r=>r.id!==finished.id&&r.state==='stopped');},'custom stop');assert.ok(stopped.reportUrl);assert.equal(stopped.taskCompleted,false);
  assert.equal(submissions,1);assert.deepEqual(errors,[]);
  const summary={scope:'Custom URL/task UI and real HTTP browser/proxy integration; scripted decisions, no Meta API calls.',targetUrl,task,completed:{id:finished.id,actions:finished.stepCount,outcome:finished.outcome,independentlyVerified:false},cancelled:{id:stopped.id,actions:stopped.stepCount},formSubmissions:submissions,blockedPrivateRequests:forbiddenHits===0,pageErrors:errors};
  await writeFile(resolve(root,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify({result:'PASS',output:root,...summary}));
}finally{await runs.close();await browser.close();await app.close();await new Promise(resolve=>target.close(resolve));await new Promise(resolve=>forbidden.close(resolve));}
