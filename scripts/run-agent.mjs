import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createFixtureServer} from '../src/server.mjs';
import {openSession,observe} from '../src/browser.mjs';
import {nextAction} from '../src/meta.mjs';
import {expected,variants} from '../src/fixture.mjs';
import {collectEvidence,replayTrace} from '../src/evidence.mjs';
import {classifyReport,renderReport} from '../src/report.mjs';

const variant=process.argv[2]||'correct';
if(!variants.includes(variant))throw new Error('Unknown fixture variant');
const task='Book a studio introduction for Alex Tester, email alex@example.test, on October 30, 2026 at 15:00. Review the details, close the review window, then confirm the booking.';
const output=resolve('output/playwright',`agent-${Date.now()}`);
await mkdir(output,{recursive:true});
const app=await createFixtureServer();
let session;
const report={variant,task,startedAt:new Date().toISOString(),budget:25,valid:true,outcome:'agent_inconclusive',reason:'action_budget_exhausted',steps:[],usage:[],scope:'Single controlled fixture run; not benchmark metrics.'};
let history=[];
try{
  session=await openSession(app,variant);
  for(let i=0;i<25;i++){
    const observation=await observe(session.page,resolve(output,`${String(i).padStart(2,'0')}.png`));
    const decision=await nextAction(history,observation,task);
    const result=await session.executor.execute(decision.action);
    const after=await observe(session.page,resolve(output,`${String(i).padStart(2,'0')}-after.png`));
    report.steps.push({...result,focusBefore:observation.focus,focusAfter:after.focus});
    report.usage.push(decision.usage);report.model=decision.model;
    history=decision.continueWith({executed:true,focus:after.focus});
    console.log(`${i+1}: ${decision.action.name} ${JSON.stringify(decision.action.arguments)} -> ${after.focus.id||after.focus.tag}`);
    if(session.record()){
      const record=session.record();
      report.record=record;
      if(Object.entries(expected).every(([key,value])=>record[key]===value)) {report.outcome='task_completed';report.reason='server_record_matches';}
      else report.reason='wrong_booking_record';
      break;
    }
  }
}catch(error){report.valid=false;report.reason=error.message;console.error(`Run stopped: ${error.message}`);}
finally{
  report.agentResult={outcome:report.outcome,reason:report.reason,valid:report.valid};
  await session?.close();
  try{
    console.log('Collecting independent keyboard evidence and corrected comparisons...');
    const evidence=await collectEvidence(app,variant,{directory:resolve(output,'evidence')});
    report.evidence={findings:evidence.findings,controlsClean:evidence.controlsClean,observedRuns:evidence.observedRuns,controlRuns:evidence.controlRuns,scope:evidence.scope};
    report.replays=[];
    for(const [label,condition] of [['Original condition',variant],['Corrected condition','correct']]){
      const result=await replayTrace(app,condition,report.steps,{directory:resolve(output,label==='Original condition'?'replay-original':'replay-corrected')});
      report.replays.push({label,...result});
    }
  }catch(error){report.evidenceError=error.message;}
  Object.assign(report,classifyReport(report,report.evidence));
  report.finishedAt=new Date().toISOString();
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
  await writeFile(resolve(output,'report.html'),renderReport(report));
  await app.close();
}
console.log(JSON.stringify({outcome:report.outcome,reason:report.reason,valid:report.valid,steps:report.steps.length,output}));
if(report.outcome!=='task_completed')process.exitCode=1;
