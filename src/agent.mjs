import {nextAction} from './meta.mjs';
import {expected} from './fixture.mjs';
import {createProgressMonitor,stopPolicy} from './stopping.mjs';

// Observation and decision are injectable so stop ordering can be tested without API calls.
export async function runAgent(session,report,{observeStep,decide=nextAction,onStep=()=>{}}){
  let history=[];
  let observation=await observeStep(0,false);
  const progress=createProgressMonitor(observation);
  report.stopPolicy=stopPolicy;
  for(let i=0;i<report.budget;i++){
    if(i>0)observation=await observeStep(i,false);
    progress.beforeAction(observation);
    const attempt={index:report.requests.length+1,startedAt:new Date().toISOString(),state:'pending'};
    report.requests.push(attempt);
    let decision;
    try{
      decision=await decide(history,observation,report.task,{onResponse:metadata=>{
        Object.assign(attempt,metadata);
        if(metadata.usage)report.usage.push(metadata.usage);
        if(metadata.model)report.model=metadata.model;
      }});
      attempt.state='validated';
    }catch(error){attempt.state='failed';attempt.reason=error.message;throw error;}
    report.model=decision.model;
    if(decision.kind==='stop'){
      report.reason='model_reported_blockage';
      report.stop={source:'model',reason:report.reason,atStep:report.steps.length,detail:decision.reason};
      break;
    }
    const result=await session.executor.execute(decision.action);
    const after=await observeStep(i,true);
    const {checkpoint,stop}=progress.afterAction(decision.action,after,result.index);
    report.steps.push({...result,timestamp:new Date().toISOString(),focusBefore:observation.focus,focusAfter:after.focus,checkpoint});
    history=decision.continueWith({executed:true,focus:after.focus});
    onStep(result,after);
    // A completed server write wins even if its visible page happens to repeat.
    if(session.record()){
      report.record=session.record();
      if(Object.entries(expected).every(([key,value])=>report.record[key]===value)){report.outcome='task_completed';report.reason='server_record_matches';}
      else report.reason='wrong_booking_record';
      break;
    }
    if(stop){report.stop=stop;report.reason=stop.reason;break;}
  }
}
