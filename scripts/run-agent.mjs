import {executeRun} from '../src/runner.mjs';
const controller=new AbortController();
const stop=()=>controller.abort(new Error('user_stopped'));
process.once('SIGTERM',stop);process.once('SIGINT',stop);
try{
  let lastStep=0,lastPhase='';
  const {report,output}=await executeRun({variant:process.argv[2]||'correct',signal:controller.signal,onUpdate:({phase,report})=>{
    if(phase==='checking'&&lastPhase!==phase)console.log('Collecting independent keyboard evidence and corrected comparisons...');
    if(report.steps.length>lastStep){const step=report.steps.at(-1);console.log(`${step.index}: ${step.action.name} ${JSON.stringify(step.action.arguments)} -> ${step.focusAfter.id||step.focusAfter.tag}`);lastStep=report.steps.length;}
    lastPhase=phase;
  }});
  console.log(JSON.stringify({outcome:report.outcome,reason:report.reason,valid:report.valid,steps:report.steps.length,output}));
  if(report.outcome!=='task_completed')process.exitCode=1;
}finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}
