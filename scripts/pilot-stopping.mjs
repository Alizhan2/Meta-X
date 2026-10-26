import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {variants} from '../src/fixture.mjs';

// Deliberately one run per condition, no retries: at most 125 bounded model requests.
const output=resolve('output/playwright',`stopping-pilot-${Date.now()}`);
await mkdir(output,{recursive:true});
const pilot={scope:'Five fresh live runs with graceful stopping; exploratory pilot, separate from the frozen 25-run benchmark.',planned:5,maxRequests:125,startedAt:new Date().toISOString(),jobs:[]};
for(const variant of variants){
  console.log('START '+variant);
  const child=spawn(process.execPath,['--env-file=.env','scripts/run-agent.mjs',variant],{cwd:process.cwd(),stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';
  child.stdout.on('data',data=>{stdout+=data;process.stdout.write(data);});
  child.stderr.on('data',data=>{stderr+=data;process.stderr.write(data);});
  const exitCode=await new Promise(resolve=>{child.once('error',error=>{stderr+=error.message;resolve(-1)});child.once('close',resolve)});
  await writeFile(resolve(output,variant+'.log'),stdout+stderr);
  const line=stdout.trim().split('\n').reverse().map(line=>{try{return JSON.parse(line);}catch{return null;}}).find(value=>value?.output);
  if(!line)throw new Error('child_report_missing');
  const reportPath=resolve(line.output,'report.json');
  const report=JSON.parse(await readFile(reportPath,'utf8'));
  pilot.jobs.push({variant,reportPath,runId:report.runId,exitCode,outcome:report.outcome,agentResult:report.agentResult,actions:report.steps.length,requests:report.requests.length,stop:report.stop??null,configuration:report.configuration,model:report.model});
  await writeFile(resolve(output,'pilot.json'),JSON.stringify(pilot,null,2)+'\n');
  if(pilot.jobs.some(job=>JSON.stringify(job.configuration)!==JSON.stringify(pilot.jobs[0].configuration)))throw new Error('configuration_mismatch');
}
pilot.finishedAt=new Date().toISOString();
await writeFile(resolve(output,'pilot.json'),JSON.stringify(pilot,null,2)+'\n');
console.log(JSON.stringify({output,completed:pilot.jobs.length}));
