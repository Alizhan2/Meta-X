import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRadixToastExample} from '../examples/radix-toast/server.mjs';
import {openWebsiteSession,observe} from '../src/browser.mjs';
import {runAgent} from '../src/agent.mjs';
import {newRunId} from '../src/runner.mjs';
import {runConfiguration} from '../src/comparison.mjs';
import {renderReport} from '../src/report.mjs';
import {radixToastTask,readToastState,toastContract} from './radix-toast-contract.mjs';

export async function checkRadixToastAgent({directory=resolve('output/playwright',`radix-toast-agent-${Date.now()}`),runRoot=resolve('output/playwright'),signal,onUpdate=()=>{}}={}){
signal?.throwIfAborted();directory=resolve(directory);runRoot=resolve(runRoot);await mkdir(directory,{recursive:true});
const attempts=[];let port=0;
let failure,summary;
const sourceFiles=['examples/radix-toast/app.jsx','examples/radix-toast/style.css','examples/radix-toast/server.mjs','examples/radix-toast/package-lock.json','scripts/radix-toast-contract.mjs','scripts/check-radix-toast-agent.mjs'];
const snapshotSources=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
try{
  for(const corrected of [false,true]){
    signal?.throwIfAborted();
    const sourcesBefore=await snapshotSources();
    signal?.throwIfAborted();
    const condition=corrected?'corrected':'original';
    const id=newRunId(),output=resolve(runRoot,id);await mkdir(output,{recursive:true});
    const report={runId:id,targetKind:'custom',task:radixToastTask,startedAt:new Date().toISOString(),budget:25,valid:true,outcome:'agent_inconclusive',reason:'action_budget_exhausted',steps:[],usage:[],requests:[],executionMode:'meta-live',scope:'Real Meta/TabProof attempt on pinned Radix Toast; generic completion is model-reported. A separate read-only live-session oracle checks selective Escape dismissal.'};
    let app,session,screenshot,initial,final,beforeState,lastState;const actions=[],observations=[];
    const emit=extra=>onUpdate({phase:condition,condition,report,screenshot,...extra});
    try{
      signal?.throwIfAborted();app=await createRadixToastExample({corrected,port});port=Number(new URL(app.origin).port);
      report.targetUrl=app.origin+'/';emit({});signal?.throwIfAborted();
      session=await openWebsiteSession(report.targetUrl,{signal});
      await session.page.locator('#toast-draft').waitFor();initial=await readToastState(session.page);
      report.configuration=await runConfiguration(session.page.context().browser().version());
      Object.assign(report.configuration,{seed:null,targetKind:'custom',completionVerification:'model-reported'});
      await runAgent(session,report,{
        signal,
        observeStep:async(index,after)=>{
          signal?.throwIfAborted();const file=resolve(output,`${String(index).padStart(2,'0')}${after?'-after':''}.png`);
          const observation=await observe(session.page,file);screenshot=file;
          report.finalUrl=observation.url;lastState=await readToastState(session.page);
          if(!after)beforeState=lastState;
          observations.push({index,after,...lastState});
          emit({});return observation;
        },
        onStep:step=>{
          actions.push({...step,before:beforeState,after:lastState});
          emit({step});
        },
        onRequest:attempt=>emit({request:attempt})
      });
      final=await readToastState(session.page);
    }catch(error){
      report.valid=false;report.reason=signal?.aborted?'user_stopped':error.message;
      if(signal?.aborted){report.cancelled=true;report.outcome='agent_inconclusive';report.stop={source:'user',reason:'user_stopped',atStep:report.steps.length};}
    }
    finally{
      if(report.pendingAction){report.interruptedAction=report.pendingAction;delete report.pendingAction;}
      report.executedActions=session?.executor.used;
      report.agentResult={outcome:report.outcome,reason:report.reason,valid:report.valid};
      report.evidenceSkipped='custom_target';report.replaysSkipped='custom_target';report.finishedAt=new Date().toISOString();
      // Capture final read-only state even on an API error; do not invent it if
      // the browser was closed or a keyboard action was interrupted.
      if(!final&&session&&!signal?.aborted)try{final=await readToastState(session.page);}catch{}
      for(const resource of [session,app])try{await resource?.close();}catch(error){report.valid=false;report.cleanupError=error.message;}
      report.agentResult.valid=report.valid;
      await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
      await writeFile(resolve(output,'report.html'),renderReport(report));
      const contract=initial&&final?toastContract(initial,actions,final):null;
      const audit={condition:corrected?'corrected':'original',version:app?.version,runId:id,scope:'Read-only DOM/focus measurements of the actual live session; never passed to the model. Example-specific oracle, not universal website diagnosis.',contract,taskVerified:!!contract&&Object.values(contract).every(Boolean),initial,final,actions,observations};
      await writeFile(resolve(output,'toast-audit.json'),JSON.stringify(audit,null,2)+'\n');
      const sourcesAfter=await snapshotSources();
      const attempt={condition:audit.condition,version:app?.version,runId:id,output,model:report.model,configuration:report.configuration,sources:sourcesBefore,sourcesStable:JSON.stringify(sourcesBefore)===JSON.stringify(sourcesAfter),valid:report.valid,outcome:report.outcome,reason:report.reason,actions:report.steps.length,contract,taskVerified:audit.taskVerified,remaining:final?.open,knownTokens:report.usage.reduce((sum,entry)=>sum+(entry.total_tokens||0),0)};
      attempts.push(attempt);await writeFile(resolve(directory,'attempts.json'),JSON.stringify(attempts,null,2)+'\n');
      emit({result:attempt});
    }
    signal?.throwIfAborted();
  }
}catch(error){failure=signal?.aborted?(signal.reason||error):error;}
finally{
  const sources=await snapshotSources();
  const comparable=attempts.length===2&&attempts.every(a=>a.configuration&&a.model&&a.sourcesStable)&&attempts[0].model===attempts[1].model&&JSON.stringify(attempts[0].configuration)===JSON.stringify(attempts[1].configuration)&&JSON.stringify(attempts[0].sources)===JSON.stringify(attempts[1].sources)&&attempts[0].version==='1.2.19'&&attempts[1].version==='1.2.20';
  const passed=comparable&&attempts.every(a=>a.valid)&&attempts[0].taskVerified===false&&attempts[1].taskVerified===true&&attempts[1].outcome==='agent_reported_complete';
  summary={schema:1,checkedAt:new Date().toISOString(),task:radixToastTask,scope:'One fresh real-Meta session per version. Same URL/task/model/host/agent; dependency upgrade is the intentional variable. All attempts retained, not a reliability benchmark.',comparable,passed:passed&&!failure,originalFalseCompletion:attempts[0]?.outcome==='agent_reported_complete'&&!attempts[0]?.taskVerified,sources,attempts,...(failure?{incomplete:true,error:signal?.aborted?'user_stopped':failure.message}:{})};
  await writeFile(resolve(directory,'summary.json'),JSON.stringify(summary,null,2)+'\n');
}
if(failure)throw failure;signal?.throwIfAborted();
return {summary,directory};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const controller=new AbortController(),stop=()=>controller.abort(new Error('user_stopped'));
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try{
    const {summary,directory}=await checkRadixToastAgent({signal:controller.signal,onUpdate:event=>{
      if(event.step)console.log(JSON.stringify({condition:event.condition,runId:event.report.runId,step:event.step.index,action:event.step.action}));
      if(event.request?.reason)console.log(JSON.stringify({runId:event.report.runId,requestError:event.request.reason}));
      if(event.result){const a=event.result;console.log(JSON.stringify({condition:a.condition,version:a.version,runId:a.runId,valid:a.valid,outcome:a.outcome,reason:a.reason,actions:a.actions,taskVerified:a.taskVerified,remaining:a.remaining}));}
    }});
    console.log(JSON.stringify({passed:summary.passed,directory}));if(!summary.passed)process.exitCode=1;
  }finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
}
