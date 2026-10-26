import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createFixtureServer} from '../src/server.mjs';
import {openSession,observe} from '../src/browser.mjs';
import {runAgent} from '../src/agent.mjs';
import {runConfiguration} from '../src/comparison.mjs';

const manifestPath=resolve('docs/benchmark-2026-10-26/manifest.json');
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
const output=resolve('output/playwright',`stopping-replay-${Date.now()}`);
await mkdir(output,{recursive:true});
const summary={scope:'Counterfactual local keyboard replay of 25 frozen traces with the new stopping policy; no new model requests or model reliability claims.',results:[]};
const app=await createFixtureServer();
try{
  for(const job of manifest.jobs){
    const file=resolve(dirname(manifestPath),job.reportPath),raw=await readFile(file,'utf8'),original=JSON.parse(raw);
    const session=await openSession(app,original.variant);
    try{
      summary.configuration??=await runConfiguration(session.page.context().browser().version());
      const report={task:original.task,budget:original.steps.length,valid:true,outcome:'agent_inconclusive',reason:'action_budget_exhausted',steps:[],requests:[],usage:[]};
      let decisions=0;
      await runAgent(session,report,{
        observeStep:()=>observe(session.page),
        decide:async()=>{
          const step=original.steps[decisions++];
          assert.ok(step,`No guard stop before saved trace ended: ${original.runId}`);
          return {action:step.action,model:'saved-key-replay',continueWith:()=>[]};
        }
      });
      const control=['correct','focus_loss'].includes(original.variant);
      if(control){assert.equal(report.outcome,'task_completed');assert.equal(report.stop,undefined);}
      else {
        assert.notEqual(report.outcome,'task_completed');
        assert.ok(report.stop||report.reason==='action_budget_exhausted');
      }
      assert.equal(decisions,report.steps.length,'no extra decision after guard stop');
      assert.equal(await readFile(file,'utf8'),raw,'frozen raw benchmark must remain unchanged');
      const result={runId:original.runId,variant:original.variant,originalActions:original.steps.length,originalModelFailure:original.agentResult.valid===false,actions:report.steps.length,savedActionDifference:original.steps.length-report.steps.length,completed:report.outcome==='task_completed',reason:report.stop||report.outcome==='task_completed'?report.reason:original.steps.length<25?'saved_trace_ended':'action_budget_exhausted',stop:report.stop??null};
      summary.results.push(result);console.log(JSON.stringify(result));
    }finally{await session.close();}
  }
  assert.equal(summary.results.length,25);
}finally{await app.close();await writeFile(resolve(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');}
console.log(JSON.stringify({output,checked:summary.results.length}));
