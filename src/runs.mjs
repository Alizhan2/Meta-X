import {readdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {executeRun,newRunId,task} from './runner.mjs';
import {variants} from './fixture.mjs';

const fail=(status,code)=>Object.assign(new Error(code),{status,code});
function project(report){
  const screenshot=report.latestScreenshot||(report.steps.length?`${String(report.steps.length-1).padStart(2,'0')}-after.png`:null);
  return {id:report.runId,variant:report.variant,startedAt:report.startedAt,finishedAt:report.finishedAt,steps:report.steps,requests:report.requests?.length??0,reason:report.reason,outcome:report.outcome,taskCompleted:report.agentResult?.outcome==='task_completed',latestScreenshot:screenshot?`/reports/${report.runId}/${screenshot}`:null,task:report.task,executionMode:report.executionMode||'meta-live',model:report.model,interruptedAction:report.interruptedAction,executedActions:report.executedActions};
}
function finalState(report){return report.cancelled?'stopped':report.agentResult?.valid===false?'failed':'completed';}

export async function createRunManager({execute=executeRun,root=resolve('output/playwright'),configured=()=>!!process.env.MODEL_API_KEY}={}){
  const records=new Map();let active=null,closing=false;
  let folders=[];try{folders=await readdir(root);}catch{}
  for(const folder of folders.filter(name=>/^agent-\d+$/.test(name)).sort().reverse().slice(0,100)){
    try{
      const report=JSON.parse(await readFile(resolve(root,folder,'report.json'),'utf8'));
      if(report.runId!==folder||!Array.isArray(report.steps)||typeof report.startedAt!=='string')continue;
      records.set(folder,{...project(report),state:finalState(report),phase:'finished',reportUrl:`/reports/${folder}/report.html`});
    }catch{}
  }
  const get=id=>{const run=records.get(id);if(!run)throw fail(404,'run_not_found');return structuredClone(run);};
  return {
    list(){return {runs:[...records.values()].sort((a,b)=>b.startedAt.localeCompare(a.startedAt)).map(run=>structuredClone(run)),configured:configured(),activeId:active?.id??null};},
    get,
    start(variant){
      if(closing)throw fail(503,'service_stopping');
      if(!variants.includes(variant))throw fail(400,'invalid_condition');
      if(active)throw fail(409,'run_already_active');
      if(!configured())throw fail(503,'model_not_configured');
      const id=newRunId(),controller=new AbortController();
      const run={id,variant,state:'starting',phase:'starting',steps:[],requests:0,latestScreenshot:null,reportUrl:null,startedAt:new Date().toISOString(),task,taskCompleted:false,executionMode:'meta-live'};
      records.set(id,run);
      active={id,controller,promise:null};
      const job=active;
      job.promise=Promise.resolve().then(()=>execute({variant,id,root,signal:controller.signal,onUpdate:({phase,report,screenshot})=>{
        if(screenshot)report.latestScreenshot=screenshot;
        Object.assign(run,project(report));
        run.phase=phase;
        if(!controller.signal.aborted&&phase!=='finished')run.state=phase==='checking'?'checking':phase==='starting'?'starting':'running';
      }})).then(({report})=>{
        Object.assign(run,project(report),{state:finalState(report),phase:'finished',reportUrl:`/reports/${id}/report.html`});
      }).catch(()=>{
        // No raw exception/credential material is exposed through the control API.
        Object.assign(run,{state:controller.signal.aborted?'stopped':'failed',phase:'finished',reason:controller.signal.aborted?'user_stopped':'run_failed',finishedAt:new Date().toISOString()});
      }).finally(()=>{if(active===job)active=null;});
      return get(id);
    },
    stop(id){
      const run=records.get(id);if(!run)throw fail(404,'run_not_found');
      if(active?.id===id&&!active.controller.signal.aborted){run.state='stopping';run.phase='stopping';active.controller.abort(new Error('user_stopped'));}
      return get(id);
    },
    async close(){closing=true;const job=active;if(job){this.stop(job.id);await job.promise;}}
  };
}
