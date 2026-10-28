import {mkdir,writeFile,rename} from 'node:fs/promises';
import {copyFileSync,renameSync,writeFileSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {executeRun,newRunId} from './runner.mjs';
import {probeDialogContract,createDialogAudit,contractDifference,contractScope} from './dialog-contract.mjs';
import {renderWebsiteComparisonReport,reasonText} from './website-report.mjs';

export function newWebsiteComparison(spec){
  const side=(label,url)=>({label,url,state:'waiting',total:3,completed:0,passed:0,failed:0,inconclusive:0,steps:[],probes:[],screenshot:null,taskVerified:null});
  return {original:side('Before',spec.beforeUrl),corrected:side('After',spec.afterUrl),phase:'starting',verified:false,scope:contractScope,summary:'Waiting to check both versions.'};
}

function sameConfiguration(configurations){
  const keys=['fixtureAndAgentBuild','browserVersion','playwrightVersion','platform','architecture','requestedModel','modelSettings','inputTokenLimit','contextPolicy'];
  if(!configurations.length||configurations.some(c=>!c||keys.some(key=>c[key]===undefined)))return false;
  const signature=c=>JSON.stringify(keys.map(key=>c[key]));return configurations.every(c=>signature(c)===signature(configurations[0]));
}

export function evaluateWebsiteComparison(report){
  const comparison=report.comparison;
  comparison.independent=contractDifference(comparison);
  const sides=[comparison.original,comparison.corrected],probes=sides.flatMap(s=>s.probes);
  if(!sameConfiguration(probes.map(p=>p.configuration)))comparison.independent={verified:false,reason:'different_browser_or_build'};
  if(report.checkMode==='agent'){
    const [a,b]=sides.map(side=>side.agent);
    comparison.agentComparability={verified:!!(a?.valid&&b?.valid&&a.runId!==b.runId&&a.model&&a.model===b.model&&sameConfiguration([a.configuration,b.configuration,...probes.map(p=>p.configuration)])),reason:'different_or_invalid_agent_runs'};
    if(comparison.agentComparability.verified)comparison.agentComparability.reason='same_task_model_budget_and_runtime';
  }
  const agentExercised=report.checkMode!=='agent'||comparison.agentComparability.verified&&comparison.original.agent.contract.valid&&comparison.original.agent.contract.passed===false&&comparison.corrected.agent.contract.valid&&comparison.corrected.agent.contract.passed===true;
  comparison.verified=comparison.independent.verified&&agentExercised;
  comparison.summary=comparison.verified?'Escape failed consistently before the change and passed after it. This verifies only the configured dialog contract.':comparison.independent.verified?'Independent checks verified the dialog improvement, but the agent attempts did not establish a comparable before/after result.':comparison.independent.reason==='corrected_contract_failed'?'The corrected version still fails the configured dialog contract.':comparison.independent.reason==='original_failure_not_reproduced'?'The original version did not consistently fail. No fixed defect is established.':'The available observations do not establish a reproducible improvement.';
  return comparison.verified;
}

export async function executeWebsiteComparison({id,root,signal,onUpdate=()=>{},controlOrigins=[],decideFor,...spec}){
  const output=resolve(root,id);await mkdir(output,{recursive:true});
  const report={runId:id,...spec,startedAt:new Date().toISOString(),valid:true,outcome:'agent_inconclusive',reason:'comparison_in_progress',steps:[],requests:[],usage:[],executionMode:spec.checkMode==='agent'?(decideFor?'scripted-test':'meta-live'):'deterministic',comparison:newWebsiteComparison(spec)};
  const details={contract:spec.contract,scope:contractScope,original:{},corrected:{}};
  const persist=phase=>{
    report.comparison.phase=phase;
    for(const [name,data] of [['report.json',JSON.stringify(report,null,2)+'\n'],['report.html',renderWebsiteComparisonReport(report)]]){writeFileSync(resolve(output,name+'.tmp'),data);renameSync(resolve(output,name+'.tmp'),resolve(output,name));}
    onUpdate({phase,report});
  };
  const copyShot=(source,side,caption)=>{
    const rel=relative(output,resolve(source));if(!rel||rel.startsWith('..')||isAbsolute(rel))throw new Error('invalid_screenshot_path');
    copyFileSync(source,resolve(output,side+'.png.tmp'));renameSync(resolve(output,side+'.png.tmp'),resolve(output,side+'.png'));
    const record=report.comparison[side];record.revision=(record.revision||0)+1;record.screenshot=`/reports/${id}/${side}.png?v=${record.revision}`;record.screenshotSource=caption;
  };
  try{
    signal?.throwIfAborted();persist('starting');
    for(const sideName of ['original','corrected']){
      signal?.throwIfAborted();const side=report.comparison[sideName];side.state='running';
      if(spec.checkMode==='agent'){
        const audit=createDialogAudit(spec.contract,signal),childId=newRunId(),childRoot=resolve(output,'agent');
        const child=await executeRun({id:childId,root:childRoot,targetUrl:side.url,task:spec.task,signal,controlOrigins,inspectObservation:audit.observe,...(decideFor?{decide:decideFor(sideName)}:{}),onUpdate:({report:raw,screenshot})=>{
          side.steps=structuredClone(raw.steps);side.actionsScope='AI agent session';side.modelOutcome=raw.outcome;side.agentContract=structuredClone(audit.audit);
          side.summary=`AI attempt in progress. Escape audit: ${reasonText(audit.audit.reason)} Whole-task completion is not verified.`;
          if(screenshot)copyShot(resolve(childRoot,childId,screenshot),sideName,'Screenshot from the AI agent session');
          details[sideName].agentReport=raw;
          report.requests=['original','corrected'].flatMap(key=>details[key].agentReport?.requests||[]);report.usage=['original','corrected'].flatMap(key=>details[key].agentReport?.usage||[]);persist('running');
        }});
        const raw=child.report;side.agent={runId:raw.runId,valid:raw.agentResult.valid,model:raw.model,outcome:raw.outcome,reason:raw.reason,configuration:raw.configuration,contract:structuredClone(audit.audit)};report.model=raw.model;
        signal?.throwIfAborted();
        if(raw.agentResult.valid!==true)throw new Error('comparison_agent_failed');
      }
      persist('checking');
      for(let repeat=0;repeat<3;repeat++){
        signal?.throwIfAborted();
        const result=await probeDialogContract({targetUrl:side.url,contract:spec.contract,signal,controlOrigins,capture:async page=>{
          const file=resolve(output,`${sideName}-probe.png.tmp`);await page.screenshot({path:file,type:'png'});await rename(file,resolve(output,sideName+'-probe.png'));
          copyShot(resolve(output,sideName+'-probe.png'),sideName,`Screenshot from independent check ${repeat+1} of 3`);
        },onStep:probe=>{
          if(spec.checkMode==='deterministic'){side.steps=structuredClone(probe.actions);side.actionsScope=`Independent check ${repeat+1} of 3`;}
          persist('checking');
        }});
        side.probes.push(result);side.completed++;if(result.valid){if(result.passed)side.passed++;else side.failed++;}else side.inconclusive++;
        side.taskVerified=null;
        side.summary=`Dialog contract: ${side.passed} passed, ${side.failed} failed, ${side.inconclusive} inconclusive. ${reasonText(result.reason)} ${side.screenshotSource||''}. ${side.agent?`AI outcome: ${side.agent.outcome}. AI Escape audit: ${reasonText(side.agent.contract.reason)} `:''}Whole-task completion is not verified.`;
        persist('checking');
      }
      side.state='finished';persist('checking');
    }
    signal?.throwIfAborted();
    const verified=evaluateWebsiteComparison(report);report.outcome=verified?'comparison_verified':'agent_inconclusive';report.reason=verified?'dialog_contract_improvement':report.comparison.independent.verified?'agent_contract_not_verified':report.comparison.independent.reason;
    if([report.comparison.original,report.comparison.corrected].some(s=>s.inconclusive>0))report.valid=false;
  }catch(error){
    report.comparison.verified=false;
    if(signal?.aborted){report.cancelled=true;report.reason='user_stopped';report.comparison.summary='Stopped at your request. These partial results do not verify a comparison.';}
    else{report.valid=false;report.reason=error.message==='comparison_agent_failed'?'comparison_agent_failed':'comparison_check_failed';report.comparison.summary='The checks or model attempt could not finish. No completed comparison is verified.';}
    for(const side of [report.comparison.original,report.comparison.corrected])if(side.state!=='finished')side.state=signal?.aborted?'stopped':'failed';
  }finally{
    details.original.probes=report.comparison.original.probes;details.corrected.probes=report.comparison.corrected.probes;
    await writeFile(resolve(output,'details.json'),JSON.stringify(details,null,2)+'\n');
    // A stop may arrive while the last evidence file is being written.
    if(signal?.aborted){
      report.cancelled=true;report.outcome='agent_inconclusive';report.reason='user_stopped';report.comparison.verified=false;
      report.comparison.summary='Stopped at your request. These partial results do not verify a comparison.';
      for(const side of [report.comparison.original,report.comparison.corrected])if(side.state!=='finished')side.state='stopped';
    }
    report.finishedAt=new Date().toISOString();report.agentResult={valid:report.valid,outcome:report.outcome,reason:report.reason};persist('finished');
  }
  return {report,output};
}
