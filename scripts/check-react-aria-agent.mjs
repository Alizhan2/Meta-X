import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createReactAriaExample} from '../examples/react-aria-scroll/server.mjs';
import {openWebsiteSession,observe} from '../src/browser.mjs';
import {runAgent} from '../src/agent.mjs';
import {newRunId} from '../src/runner.mjs';
import {runConfiguration} from '../src/comparison.mjs';
import {renderReport} from '../src/report.mjs';
import {reactAriaTask,readReadingState,readingContract} from './react-aria-contract.mjs';

// Uses the actual TabProof worker, model loop, limits and stopping policy.
// The read-only oracle is outside the model context and outside generic reports.
const controller=new AbortController();
const stop=()=>controller.abort(new Error('user_stopped'));
process.once('SIGINT',stop);process.once('SIGTERM',stop);
const directory=resolve('output/playwright',`react-aria-agent-${Date.now()}`);await mkdir(directory,{recursive:true});
const attempts=[];let port=0;
const sourceFiles=['examples/react-aria-scroll/app.jsx','examples/react-aria-scroll/style.css','examples/react-aria-scroll/server.mjs','examples/react-aria-scroll/package-lock.json','scripts/react-aria-contract.mjs','scripts/check-react-aria-agent.mjs'];
const snapshotSources=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
try{
  for(const corrected of [false,true]){
    controller.signal.throwIfAborted();
    const sourcesBefore=await snapshotSources();
    const app=await createReactAriaExample({corrected,port});port=Number(new URL(app.origin).port);
    const id=newRunId(),output=resolve('output/playwright',id);await mkdir(output,{recursive:true});
    const report={runId:id,targetKind:'custom',targetUrl:app.origin+'/',task:reactAriaTask,startedAt:new Date().toISOString(),budget:25,valid:true,outcome:'agent_inconclusive',reason:'action_budget_exhausted',steps:[],usage:[],requests:[],executionMode:'meta-live',scope:'Real Meta/TabProof attempt on pinned third-party React Aria; generic completion remains model-reported. Separate example-specific read-only audit is saved beside this report.'};
    let session;const states=[];
    try{
      session=await openWebsiteSession(report.targetUrl,{signal:controller.signal});
      await session.page.locator('#open-reading').waitFor();
      report.configuration=await runConfiguration(session.page.context().browser().version());
      Object.assign(report.configuration,{seed:null,targetKind:'custom',completionVerification:'model-reported'});
      await runAgent(session,report,{
        signal:controller.signal,
        observeStep:async(index,after)=>{
          const observation=await observe(session.page,resolve(output,`${String(index).padStart(2,'0')}${after?'-after':''}.png`));
          report.finalUrl=observation.url;
          states.push({index,after,...await readReadingState(session.page)});
          return observation;
        },
        onStep:step=>console.log(JSON.stringify({condition:corrected?'corrected':'original',runId:id,step:step.index,action:step.action})),
        onRequest:attempt=>{if(attempt.reason)console.log(JSON.stringify({runId:id,requestError:attempt.reason}));}
      });
      states.push({final:true,...await readReadingState(session.page)});
    }catch(error){report.valid=false;report.reason=error.message;}
    finally{
      if(report.pendingAction){report.interruptedAction=report.pendingAction;delete report.pendingAction;}
      report.executedActions=session?.executor.used;
      report.agentResult={outcome:report.outcome,reason:report.reason,valid:report.valid};
      report.evidenceSkipped='custom_target';report.replaysSkipped='custom_target';report.finishedAt=new Date().toISOString();
      await session?.close();await app.close();
      await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2)+'\n');
      await writeFile(resolve(output,'report.html'),renderReport(report));
      const contract=readingContract(states);
      const audit={condition:corrected?'corrected':'original',runId:id,scope:'Read-only DOM/focus/scroll audit of the actual live session. These measurements were never provided to the model. This is a task-specific oracle, not universal accessibility detection.',contract,taskVerified:Object.values(contract).every(Boolean),states};
      await writeFile(resolve(output,'reading-audit.json'),JSON.stringify(audit,null,2)+'\n');
      const sourcesAfter=await snapshotSources();
      const attempt={condition:audit.condition,runId:id,output,model:report.model,configuration:report.configuration,sources:sourcesBefore,sourcesStable:JSON.stringify(sourcesBefore)===JSON.stringify(sourcesAfter),valid:report.valid,outcome:report.outcome,reason:report.reason,actions:report.steps.length,contract,taskVerified:audit.taskVerified,knownTokens:report.usage.reduce((sum,entry)=>sum+(entry.total_tokens||0),0)};
      attempts.push(attempt);await writeFile(resolve(directory,'attempts.json'),JSON.stringify(attempts,null,2)+'\n');
      console.log(JSON.stringify(attempt));
    }
  }
  const sources=await snapshotSources();
  const comparable=attempts.length===2&&attempts.every(a=>a.configuration&&a.model&&a.sourcesStable)&&attempts[0].model===attempts[1].model&&JSON.stringify(attempts[0].configuration)===JSON.stringify(attempts[1].configuration)&&JSON.stringify(attempts[0].sources)===JSON.stringify(attempts[1].sources);
  const passed=comparable&&attempts.every(a=>a.valid)&&attempts[0].taskVerified===false&&attempts[0].outcome!=='agent_reported_complete'&&attempts[1].taskVerified===true&&attempts[1].outcome==='agent_reported_complete';
  const summary={schema:1,checkedAt:new Date().toISOString(),task:reactAriaTask,scope:'One fresh Meta session per condition on the same URL, task, model and agent build. Two exploratory attempts, not reliability statistics. All attempts retained. No scripted model decisions.',comparable,passed,sources,attempts};
  await writeFile(resolve(directory,'summary.json'),JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify({passed,directory}));if(!passed)process.exitCode=1;
}finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
