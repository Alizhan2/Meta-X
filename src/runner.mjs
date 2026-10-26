import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomInt} from 'node:crypto';
import {createFixtureServer} from './server.mjs';
import {openSession,openWebsiteSession,observe} from './browser.mjs';
import {normalizeCustomTarget} from './target.mjs';
import {runAgent} from './agent.mjs';
import {variants} from './fixture.mjs';
import {collectEvidence,replayTrace} from './evidence.mjs';
import {classifyReport,renderReport} from './report.mjs';
import {runConfiguration} from './comparison.mjs';

export const task='Book a studio introduction for Alex Tester, email alex@example.test, on October 30, 2026 at 15:00. Review the details, close the review window, then confirm the booking.';
export const newRunId=()=>`agent-${Date.now()}${String(randomInt(1000000)).padStart(6,'0')}`;

export async function executeRun({variant='correct',targetUrl,task:customTask,controlOrigins=[],id=newRunId(),root=resolve('output/playwright'),signal,onUpdate=()=>{},decide}={}){
  const target=targetUrl!==undefined?normalizeCustomTarget({targetUrl,task:customTask},{controlOrigins}):{targetKind:'fixture',variant,task};
  if(target.targetKind==='fixture'&&!variants.includes(variant)||!/^agent-\d+$/.test(id))throw new Error('invalid_run');
  variant=target.variant;
  const output=resolve(root,id);await mkdir(output,{recursive:true});
  const report={runId:id,...target,startedAt:new Date().toISOString(),budget:25,valid:true,outcome:'agent_inconclusive',reason:'action_budget_exhausted',steps:[],usage:[],requests:[],scope:target.targetKind==='custom'?'Website keyboard-task attempt; completion is model-reported, without an independent success oracle.':'Single controlled fixture run; not benchmark metrics.',executionMode:decide?'scripted-test':'meta-live'};
  let app,session;
  const update=(phase,extra={})=>onUpdate({phase,report,...extra});
  const markCancelled=()=>{
    if(report.cancelled)return;
    if(report.stop)report.stopBeforeCancellation=report.stop;
    report.cancelled=true;report.reason='user_stopped';report.stop={source:'user',reason:'user_stopped',atStep:report.steps.length};};
  try{
    signal?.throwIfAborted();update('starting');
    if(target.targetKind==='custom')session=await openWebsiteSession(target.targetUrl,{signal,controlOrigins});
    else {app=await createFixtureServer();session=await openSession(app,variant,{signal});}
    report.configuration=await runConfiguration(session.page.context().browser().version());
    if(target.targetKind==='custom')Object.assign(report.configuration,{seed:null,targetKind:'custom',completionVerification:'model-reported'});
    await runAgent(session,report,{
      signal,...(decide?{decide}:{}),
      observeStep:async(i,after)=>{
        const file=`${String(i).padStart(2,'0')}${after?'-after':''}.png`;
        const observation=await observe(session.page,resolve(output,file));
        report.finalUrl=observation.url;
        report.latestScreenshot=file;
        update('running',{screenshot:file,focus:observation.focus});return observation;
      },
      onRequest:()=>update('running'),onStep:()=>update('running')
    });
  }catch(error){
    if(signal?.aborted)markCancelled();
    else {report.valid=false;report.reason=error.message;}
  }finally{
    if(report.pendingAction){report.interruptedAction=report.pendingAction;delete report.pendingAction;}
    if(session)report.executedActions=session.executor.used;
    report.agentResult={outcome:report.outcome,reason:report.reason,valid:report.valid};
    await session?.close().catch(()=>{});
  }
  try{
    if(target.targetKind==='custom'){report.evidenceSkipped='custom_target';report.replaysSkipped='custom_target';}
    if(app&&!signal?.aborted){
      update('checking');
      try{
        const evidence=await collectEvidence(app,variant,{directory:resolve(output,'evidence'),signal});
        report.evidence={findings:evidence.findings,controlsClean:evidence.controlsClean,observedRuns:evidence.observedRuns,controlRuns:evidence.controlRuns,scope:evidence.scope};
      }catch(error){if(!signal?.aborted)report.evidenceError=error.message;}
      report.replays=[];report.replayErrors=[];
      for(const [label,condition] of [['Original condition',variant],['Corrected condition','correct']]){
        if(signal?.aborted)break;
        try{report.replays.push({label,...await replayTrace(app,condition,report.steps,{directory:resolve(output,label==='Original condition'?'replay-original':'replay-corrected'),signal})});}
        catch(error){if(!signal?.aborted)report.replayErrors.push({label,reason:error.message});}
      }
    }
    if(signal?.aborted){
      markCancelled();report.evidenceSkipped='user_stopped';report.replaysSkipped='user_stopped';
      if(report.agentResult.valid!==false&&report.agentResult.outcome!=='task_completed')report.agentResult={outcome:'agent_inconclusive',reason:'user_stopped',valid:report.valid};
    }
    Object.assign(report,classifyReport(report,report.evidence));
    report.finishedAt=new Date().toISOString();
    await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
    await writeFile(resolve(output,'report.html'),renderReport(report));
    update('finished');return {report,output};
  }finally{await app?.close();}
}
