import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createFixtureServer} from '../src/server.mjs';
import {openSession,observe} from '../src/browser.mjs';
import {runAgent} from '../src/agent.mjs';
import {variants} from '../src/fixture.mjs';
import {collectEvidence,replayTrace} from '../src/evidence.mjs';
import {classifyReport,renderReport} from '../src/report.mjs';
import {runConfiguration} from '../src/comparison.mjs';
import {randomInt} from 'node:crypto';

const variant=process.argv[2]||'correct';
if(!variants.includes(variant))throw new Error('Unknown fixture variant');
const task='Book a studio introduction for Alex Tester, email alex@example.test, on October 30, 2026 at 15:00. Review the details, close the review window, then confirm the booking.';
const output=resolve('output/playwright',`agent-${Date.now()}${String(randomInt(1000000)).padStart(6,'0')}`);
await mkdir(output,{recursive:true});
const app=await createFixtureServer();
let session;
const report={runId:output.split('/').at(-1),variant,task,startedAt:new Date().toISOString(),budget:25,valid:true,outcome:'agent_inconclusive',reason:'action_budget_exhausted',steps:[],usage:[],requests:[],scope:'Single controlled fixture run; not benchmark metrics.'};
try{
  session=await openSession(app,variant);
  report.configuration=await runConfiguration(session.page.context().browser().version());
  await runAgent(session,report,{
    observeStep:(i,after)=>observe(session.page,resolve(output,`${String(i).padStart(2,'0')}${after?'-after':''}.png`)),
    onStep:(result,after)=>console.log(`${result.index}: ${result.action.name} ${JSON.stringify(result.action.arguments)} -> ${after.focus.id||after.focus.tag}`)
  });
}catch(error){report.valid=false;report.reason=error.message;console.error(`Run stopped: ${error.message}`);}
finally{
  report.agentResult={outcome:report.outcome,reason:report.reason,valid:report.valid};
  await session?.close();
  try{
    console.log('Collecting independent keyboard evidence and corrected comparisons...');
    const evidence=await collectEvidence(app,variant,{directory:resolve(output,'evidence')});
    report.evidence={findings:evidence.findings,controlsClean:evidence.controlsClean,observedRuns:evidence.observedRuns,controlRuns:evidence.controlRuns,scope:evidence.scope};
  }catch(error){report.evidenceError=error.message;}
  report.replays=[];report.replayErrors=[];
  for(const [label,condition] of [['Original condition',variant],['Corrected condition','correct']]){
    try{
      const result=await replayTrace(app,condition,report.steps,{directory:resolve(output,label==='Original condition'?'replay-original':'replay-corrected')});
      report.replays.push({label,...result});
    }catch(error){report.replayErrors.push({label,reason:error.message});}
  }
  Object.assign(report,classifyReport(report,report.evidence));
  report.finishedAt=new Date().toISOString();
  await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
  await writeFile(resolve(output,'report.html'),renderReport(report));
  await app.close();
}
console.log(JSON.stringify({outcome:report.outcome,reason:report.reason,valid:report.valid,steps:report.steps.length,output}));
if(report.outcome!=='task_completed')process.exitCode=1;
