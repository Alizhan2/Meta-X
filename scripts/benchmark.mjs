import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {variants} from '../src/fixture.mjs';
import {summarizeBenchmark,benchmarkMarkdown} from '../src/metrics.mjs';

const batch=resolve('output/playwright',`benchmark-${Date.now()}`);
await mkdir(batch,{recursive:true});
const jobs=Array.from({length:5},(_,round)=>variants.map(variant=>({round:round+1,variant}))).flat();
const reports=[];const manifest={startedAt:new Date().toISOString(),planned:25,concurrency:2,maxKnownTokens:25000000,jobs:[],state:'running'};
let next=0,halt=false,saving=Promise.resolve();
function save(){
  const operation=saving.then(async()=>{
  const summary=summarizeBenchmark(reports);
  await writeFile(resolve(batch,'manifest.json'),JSON.stringify(manifest,null,2));
  await writeFile(resolve(batch,'summary.json'),JSON.stringify(summary,null,2));
  await writeFile(resolve(batch,'summary.md'),benchmarkMarkdown(summary));
  return summary;
  });
  saving=operation.catch(()=>{});
  return operation;
}
async function run(job){
  const entry={...job,startedAt:new Date().toISOString(),state:'running'};manifest.jobs.push(entry);
  console.log(`START ${job.round}/5 ${job.variant}`);
  const child=spawn(process.execPath,['--env-file=.env','scripts/run-agent.mjs',job.variant],{cwd:process.cwd(),stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';
  child.stdout.on('data',data=>{stdout+=data});child.stderr.on('data',data=>{stderr+=data});
  const exitCode=await new Promise(resolve=>{child.once('error',error=>{stderr+=error.message;resolve(-1)});child.once('close',resolve)});
  await writeFile(resolve(batch,`${job.round}-${job.variant}.log`),stdout+stderr);
  let report;
  try{
    const result=stdout.trim().split('\n').reverse().map(line=>{try{return JSON.parse(line)}catch{return null}}).find(value=>value?.output);
    if(!result)throw new Error('child_report_missing');
    report=JSON.parse(await readFile(resolve(result.output,'report.json'),'utf8'));
    entry.reportPath=resolve(result.output,'report.json');entry.runId=report.runId;entry.outcome=report.outcome;
  }catch(error){report={variant:job.variant,runId:`batch-${job.round}-${job.variant}`,missingReport:true,agentResult:{valid:false,reason:error.message},steps:[],usage:[],requests:[]};entry.error=error.message;}
  reports.push(report);entry.exitCode=exitCode;entry.finishedAt=new Date().toISOString();entry.state='finished';
  const summary=await save();
  if(summary.knownTokens>=manifest.maxKnownTokens){halt=true;manifest.haltReason='known_token_budget';}
  if(summary.configurationState==='mismatch'){halt=true;manifest.haltReason='configuration_mismatch';}
  console.log(`DONE ${reports.length}/25 ${job.variant}: ${report.outcome||'failed'}; ${report.steps.length} actions; known tokens ${summary.knownTokens}`);
}
async function worker(){while(!halt&&next<jobs.length){const job=jobs[next++];await run(job);}}
await save();
await Promise.all([worker(),worker()]);
manifest.finishedAt=new Date().toISOString();manifest.state=reports.length===25?'complete':'stopped';await save();
console.log(JSON.stringify({state:manifest.state,completed:reports.length,planned:25,batch,haltReason:manifest.haltReason}));
if(manifest.state!=='complete')process.exitCode=1;
