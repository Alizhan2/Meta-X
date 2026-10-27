import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {openWebsiteSession,observe} from '../src/browser.mjs';
import {focusMatches} from '../src/evidence.mjs';

// Explicit, read-only audit of the two public Python-docs scenarios. This is
// never called by the generic runner and cannot replay arbitrary custom forms.
const reportPath=resolve(process.argv[2]||'');
const scenario=process.argv[3];
assert.ok(['tutorial','search'].includes(scenario),'Expected scenario tutorial or search');
const report=JSON.parse(await readFile(reportPath,'utf8'));
assert.equal(report.targetUrl,'https://docs.python.org/3/');
assert.equal(report.executionMode,'meta-live');assert.equal(report.agentResult.valid,true);
assert.equal(report.outcome,'agent_reported_complete');
assert.ok(report.steps.length>0&&report.steps.length<=25);
const originalUrl=new URL(report.finalUrl);
if(scenario==='tutorial')assert.ok(/^\/3\/tutorial\/(?:index\.html)?$/.test(originalUrl.pathname),'original run must reach tutorial');
else {assert.equal(originalUrl.pathname,'/3/search.html');assert.equal(originalUrl.searchParams.get('q'),'venv');}
const output=resolve('output/playwright',report.runId,'public-verification');await mkdir(output,{recursive:true});
const session=await openWebsiteSession(report.targetUrl);
const focusPath=[],requests=[];
try{
  await session.page.route('**/*',route=>['GET','HEAD'].includes(route.request().method())?route.fallback():route.abort());
  session.page.on('request',request=>requests.push({method:request.method(),url:request.url()}));
  for(const step of report.steps){
    await session.executor.execute(step.action);
    const current=await observe(session.page);
    focusPath.push({index:step.index,matches:focusMatches(step.focusAfter,current.focus)});
  }
  if(scenario==='search')await session.page.locator('a[href*="library/venv.html"]').first().waitFor({state:'visible',timeout:15000});
  const final=await observe(session.page,resolve(output,'final-page.png'));
  const headings=await session.page.getByRole('heading',{level:1}).allTextContents();
  assert.equal(final.url,report.finalUrl);
  if(scenario==='tutorial')assert.ok(headings.some(text=>text.includes('The Python Tutorial')));
  else assert.ok((await session.page.locator('a[href*="library/venv.html"]').first().innerText()).includes('venv'));
  assert.ok(requests.every(request=>['GET','HEAD'].includes(request.method)));
  const verification={scope:'Separate read-only exact-key replay and DOM/URL audit on official public Python documentation. No model calls; original raw report is unchanged.',verifiedAt:new Date().toISOString(),runId:report.runId,scenario,originalFinalUrl:report.finalUrl,replayFinalUrl:final.url,headings,goalVerified:true,focusPathMatches:focusPath.every(item=>item.matches),focusPath,httpMethods:[...new Set(requests.map(request=>request.method))]};
  await writeFile(resolve(output,'verification.json'),JSON.stringify(verification,null,2)+'\n');
  console.log(JSON.stringify({result:'PASS',output,...verification}));
}finally{await session.close();}
