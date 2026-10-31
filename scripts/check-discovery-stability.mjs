import assert from 'node:assert/strict';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createHash} from 'node:crypto';
import {dispatchTask,dispatchContract,releases,dispatchPage,cancelRegression} from './dispatch-site.mjs';
const origin='http://127.0.0.1:3000',site='http://127.0.0.1:4217';
const root=resolve(process.argv[2]||`output/playwright/discovery-stability-${Date.now()}`);
await mkdir(root,{recursive:true});
const api=async(path,body)=>{const r=await fetch(origin+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});if(!r.ok)throw new Error(`HTTP ${r.status}: ${path}`);return r.json();};
const state=await api('/api/runs');assert.equal(state.configured,true);assert.equal(state.activeId,null);
assert.equal(dispatchPage({broken:true}).replace(cancelRegression,''),dispatchPage({broken:false}));
const cohort={scope:'Three new sequential real-Meta pairs on the same controlled DispatchDesk task. Prior pilot excluded. Replays are independent keyboard checks, not extra model attempts. Whole-task completion remains unverified.',startedAt:new Date().toISOString(),plannedPairs:3,task:dispatchTask,contract:dispatchContract,records:[],sourceHashes:{}};
for(const [side,path] of Object.entries(releases)){
 const response=await fetch(site+path);assert.equal(response.status,200);const html=await response.text();assert.equal(html,dispatchPage({broken:side==='before'}));cohort.sourceHashes[side]=createHash('sha256').update(html).digest('hex');
}
const persist=async()=>{await writeFile(resolve(root,'summary.json.tmp'),JSON.stringify(cohort,null,2)+'\n');await rename(resolve(root,'summary.json.tmp'),resolve(root,'summary.json'));};
await persist();
for(let pair=1;pair<=3;pair++){
 const started=await api('/api/runs',{beforeUrl:site+releases.before,afterUrl:site+releases.after,task:dispatchTask,checkMode:'agent',contract:dispatchContract});
 const id=started.run.id,record={pair,id,status:'running',startedAt:new Date().toISOString()};cohort.records.push(record);await persist();console.log(JSON.stringify({event:'started',pair,id,root}));
 const end=Date.now()+12*60*1000;let run,lastLog=0;
 while(Date.now()<end){
  run=(await api('/api/runs/'+id)).run;
  if(run.reportUrl&&['completed','stopped','failed'].includes(run.state))break;
  if(Date.now()-lastLog>30000){lastLog=Date.now();console.log(JSON.stringify({event:'progress',pair,phase:run.phase,originalActions:run.comparison?.original?.steps.length,correctedActions:run.comparison?.corrected?.steps.length}));}
  await delay(2000);
 }
 if(!run.reportUrl){await api('/api/runs/'+id+'/stop',{});record.status='timeout-stop-requested';await persist();throw new Error('Pair timed out; stop requested. Partial record retained.');}
 const report=await api(`/reports/${id}/report.json`);await writeFile(resolve(root,`${id}.json`),JSON.stringify(report,null,2)+'\n');assert.equal(report.executionMode,'meta-live');
 Object.assign(record,{status:run.state,reason:run.reason,verified:run.comparison.verified,routeActions:run.comparison.discovery?.steps.length??null,requests:run.requests,finishedAt:run.finishedAt});
 for(const side of ['original','corrected']){
  const s=run.comparison[side],a=s.agent;
  record[side]={attempted:!!a||s.steps.length>0,valid:a?.valid??null,actions:s.steps.length,model:a?.model??null,outcome:a?.outcome??null,reason:a?.reason??null,firstEscape:a?.contract?.attempts.find(x=>x.valid)?.passed??null,auditPassed:a?.contract?.passed??null,checks:{passed:s.passed,failed:s.failed,inconclusive:s.inconclusive,completed:s.completed},configuration:a?.configuration??null,applyActivated:s.steps.some(x=>x.focusBefore?.id==='apply-change'&&['Enter','Space'].includes(x.action?.arguments?.key))};
  if(run.comparison.discovery)for(const p of s.probes){assert.equal(p.routeSourceRunId,run.comparison.discovery.sourceRunId);assert.deepEqual(p.actions.slice(0,Math.min(p.actions.length,run.comparison.discovery.steps.length)).map(x=>x.action),run.comparison.discovery.steps.slice(0,Math.min(p.actions.length,run.comparison.discovery.steps.length)).map(x=>x.action));}
  if(s.screenshot){const u=new URL(s.screenshot,origin);assert.equal(u.origin,origin);const image=await fetch(u);assert.equal(image.status,200);await writeFile(resolve(root,`${id}-${side}.png`),Buffer.from(await image.arrayBuffer()));}
 }
 await persist();console.log(JSON.stringify({event:'finished',...record}));
}
cohort.finishedAt=new Date().toISOString();await persist();console.log(JSON.stringify({event:'cohort-finished',root,pairs:cohort.records.length,verified:cohort.records.filter(x=>x.verified).length}));
