import {access,readFile,mkdir,writeFile} from 'node:fs/promises';
import {copyFileSync,writeFileSync,renameSync} from 'node:fs';
import {resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot=fileURLToPath(new URL('..',import.meta.url));
const definitions=Object.freeze({
  'react-aria-scroll':{
    id:'react-aria-scroll',title:'React Aria reading dialog',description:'Tab skips the scrolling reading panel inside a modal. Check keyboard access before and after an explicit tab stop.',
    originalLabel:'Before · no explicit tab stop',correctedLabel:'After · explicit tab stop',correction:'Add tabIndex={0} to the reading panel. The React Aria package stays unchanged.',
    scope:'A local reproduction of known React Spectrum issue #10395, using the real unmodified React Aria 1.19.0 package. The independent checker knows this example’s expected behavior.',
    sourceUrl:'https://github.com/adobe/react-spectrum/issues/10395',referenceDirectory:'react-aria-2026-10-27',dependency:'react-aria-components',
    checkScript:'check-react-aria-scroll.mjs',checkExport:'checkReactAriaScroll',agentScript:'check-react-aria-agent.mjs',agentExport:'checkReactAriaAgent',
    task:'Open the reading dialog, focus its reading panel, scroll to the end and close the dialog.'
  },
  'radix-toast':{
    id:'radix-toast',title:'Radix notification dismissal',description:'One Escape closes both the focused notification and an unrelated notification. Check the upstream dependency upgrade.',
    originalLabel:'Before · Radix Toast 1.2.19',correctedLabel:'After · Radix Toast 1.2.20',correction:'Upgrade Radix Toast 1.2.19 to 1.2.20, including its locked transitive dependencies. Host JSX and CSS stay identical.',
    scope:'A local reproduction of known Radix issue #2906, already fixed upstream. This compares complete pinned dependency graphs, not one isolated library source line.',
    sourceUrl:'https://github.com/radix-ui/primitives/issues/2906',fixUrl:'https://github.com/radix-ui/primitives/pull/4005',referenceDirectory:'radix-toast-2026-10-27',dependency:'radix-toast-corrected',
    checkScript:'check-radix-toast.mjs',checkExport:'checkRadixToast',agentScript:'check-radix-toast-agent.mjs',agentExport:'checkRadixToastAgent',
    task:'Focus Draft saved and press Escape once. Keep Upload complete and Sync finished open.'
  }
});
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const exampleDefinition=id=>Object.hasOwn(definitions,id)?definitions[id]:null;
const publicDefinition=d=>Object.fromEntries(['id','title','description','originalLabel','correctedLabel','correction','scope','sourceUrl','fixUrl','task'].filter(k=>d[k]!==undefined).map(k=>[k,d[k]]));
export function newExampleComparison(definition,checkMode='deterministic'){
  const side=label=>({label,state:'waiting',total:checkMode==='agent'?1:3,completed:0,passed:0,failed:0,steps:[],screenshot:null,taskVerified:null});
  return {original:side(definition.originalLabel),corrected:side(definition.correctedLabel),phase:'starting',verified:false,scope:definition.scope,correction:definition.correction};
}

export async function loadExamples(){
  return Promise.all(Object.values(definitions).map(async definition=>{
    let available=true;
    try{for(const dependency of ['esbuild',definition.dependency])await access(resolve(projectRoot,'examples',definition.id,'node_modules',dependency,'package.json'));}catch{available=false;}
    const item={...publicDefinition(definition),available,reference:null};
    try{
      const raw=JSON.parse(await readFile(resolve(projectRoot,'docs',definition.referenceDirectory,'deterministic-results.json'),'utf8'));
      const comparison=newExampleComparison(definition);
      for(const condition of ['original','corrected']){
        const rows=raw.results.filter(r=>r.condition===condition),side=comparison[condition];
        Object.assign(side,{state:'finished',completed:rows.length,total:rows.length,passed:rows.filter(r=>r.passed).length,failed:rows.filter(r=>!r.passed).length,screenshot:`/examples/${definition.id}/reference/${condition}.png`,taskVerified:rows.every(r=>r.passed)});
      }
      comparison.phase='finished';comparison.verified=comparison.original.failed===3&&comparison.corrected.passed===3;
      item.reference={comparison,startedAt:raw.checkedAt,finishedAt:raw.checkedAt,executionMode:'published-reference',reason:'saved_reference',outcome:comparison.verified?'comparison_verified':'agent_inconclusive'};
    }catch{}
    return item;
  }));
}

export async function readExampleReference(id,file){
  const definition=exampleDefinition(id);
  if(!definition||!['original.png','corrected.png','deterministic-results.json','agent-summary.json'].includes(file))return null;
  try{return await readFile(resolve(projectRoot,'docs',definition.referenceDirectory,file));}catch{return null;}
}

export function renderExampleReport(report){
  const d=exampleDefinition(report.exampleId),comparison=report.comparison||{};
  const stopped=report.cancelled,failed=report.valid===false;
  const title=stopped?'Comparison stopped':failed?'Comparison could not finish':comparison.verified?'Before/after comparison verified':'Comparison in progress';
  const sideHtml=condition=>{
    const side=comparison[condition]||{};
    return `<section><h2>${escape(side.label)}</h2><p>${escape(side.state||'waiting')} · ${escape(side.completed||0)}/${escape(side.total||0)} sessions recorded</p><p>${escape(side.passed||0)} passed · ${escape(side.failed||0)} did not pass</p>${side.screenshot?`<img src="${escape(side.screenshot)}" alt="${escape(side.label)} observed page">`:'<p>No screenshot recorded.</p>'}${side.taskVerified!==null?`<p>Task contract: ${side.taskVerified?'passed':'not passed'}.</p>`:''}${side.modelOutcome?`<p>Model result: ${escape(side.modelOutcome)}. This is separate from the independent task check.</p>`:''}<ol>${(side.steps||[]).map(step=>`<li>${escape(step.action?.name==='press_key'?step.action.arguments?.key:`Type ${step.action?.arguments?.text||''}`)}</li>`).join('')}</ol></section>`;
  };
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TabProof · ${escape(title)}</title><style>body{font:16px/1.6 system-ui,sans-serif;background:#f3f7f8;color:#20353f;margin:0}main{max-width:1180px;margin:auto;padding:32px}h1{letter-spacing:-.04em;line-height:1.15}a{color:#2455cf}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}section{background:white;border:1px solid #cbdadd;padding:20px;border-radius:12px;min-width:0}img{width:100%;display:block}p{overflow-wrap:anywhere}.note{border-left:4px solid #2455cf;padding:12px 20px;background:#e9f0f7}@media(max-width:650px){main{padding:20px}.grid{grid-template-columns:1fr}}</style><main><a href="/?run=${escape(report.runId)}">Back to workbench</a><h1>${escape(title)}</h1><p>${escape(d?.title)}</p><p class="note">${escape(stopped?'You stopped this comparison. Recorded observations are partial; this is not a completed before/after result.':failed?'The comparison did not finish successfully. Recorded observations do not establish a completed before/after result.':report.checkMode==='agent'?'Real Meta runs; the model declaration and the independent example-specific check are reported separately.':'Deterministic browser checks. No model calls or API credits.')}</p><div class="grid">${sideHtml('original')}${sideHtml('corrected')}</div><p>${escape(d?.correction)}</p><p>${escape(d?.scope)} This is a small demonstration in one browser, not a reliability estimate or accessibility certification.</p><p><a href="${escape(d?.sourceUrl)}">Upstream issue</a>${d?.fixUrl?` · <a href="${escape(d.fixUrl)}">Upstream fix</a>`:''} · <a href="/reports/${escape(report.runId)}/report.json">Saved comparison JSON</a> · <a href="/reports/${escape(report.runId)}/details.json">Detailed measurements</a></p></main></html>`;
}

export async function executeExampleComparison({exampleId,checkMode='deterministic',id,root=resolve('output/playwright'),signal,onUpdate=()=>{}}={}){
  const definition=exampleDefinition(exampleId);
  if(!definition||!['deterministic','agent'].includes(checkMode)||!/^agent-\d+$/.test(id))throw new Error('invalid_example_run');
  const output=resolve(root,id);await mkdir(output,{recursive:true});
  const report={runId:id,targetKind:'example',exampleId,exampleTitle:definition.title,checkMode,task:definition.task,startedAt:new Date().toISOString(),valid:true,outcome:'agent_inconclusive',reason:'comparison_in_progress',steps:[],requests:[],usage:[],executionMode:checkMode==='agent'?'meta-live':'deterministic',comparison:newExampleComparison(definition,checkMode)};
  const rawReports=new Map();let details=null;
  const persist=()=>{
    for(const [name,body] of [['report.json',JSON.stringify(report,null,2)+'\n'],['report.html',renderExampleReport(report)]]){writeFileSync(resolve(output,name+'.tmp'),body);renameSync(resolve(output,name+'.tmp'),resolve(output,name));}
  };
  const update=phase=>{persist();onUpdate({phase,report});};
  const event=event=>{
    const condition=['original','corrected'].includes(event.condition)?event.condition:['original','corrected'].includes(event.phase)?event.phase:null;
    report.comparison.phase=event.phase||condition||'checking';
    if(condition){
      const side=report.comparison[condition];if(side.completed<side.total)side.state='running';
      if(event.report){
        rawReports.set(condition,event.report);side.steps=structuredClone(event.report.steps||[]);side.modelOutcome=event.report.outcome;side.reason=event.report.reason;
        report.model=event.report.model;report.requests=[...rawReports.values()].flatMap(r=>r.requests||[]);report.usage=[...rawReports.values()].flatMap(r=>r.usage||[]);
      }
      if(event.screenshot){
        const source=resolve(event.screenshot),rel=relative(output,source);
        if(rel&&!rel.startsWith('..')&&!isAbsolute(rel)){
          copyFileSync(source,resolve(output,condition+'.png.tmp'));renameSync(resolve(output,condition+'.png.tmp'),resolve(output,condition+'.png'));
          side.revision=(side.revision||0)+1;side.screenshot=`/reports/${id}/${condition}.png?v=${side.revision}`;
        }
      }
      if(event.result&&['original','corrected'].includes(event.result.condition)){
        const result=event.result;
        if(checkMode==='agent'){
          side.completed=1;side.passed=result.taskVerified?1:0;side.failed=result.taskVerified?0:1;side.taskVerified=result.taskVerified;side.modelOutcome=result.outcome;side.reason=result.reason;side.valid=result.valid;
          if(!result.valid)side.summary='The model/API attempt did not finish successfully. This is not a finding about the component.';
        }else{
          side.completed++;side.passed+=result.passed?1:0;side.failed+=result.passed?0:1;side.taskVerified=side.passed===side.completed;
          if(Array.isArray(result.actions)){side.steps=structuredClone(result.actions);side.actionsScope='Last completed browser session';}
        }
        if(side.completed>=side.total)side.state='finished';
      }
    }
    update(checkMode==='agent'?'running':'checking');
  };
  try{
    signal?.throwIfAborted();update('starting');
    const script=checkMode==='agent'?definition.agentScript:definition.checkScript;
    const name=checkMode==='agent'?definition.agentExport:definition.checkExport;
    const module=await import(new URL('../scripts/'+script,import.meta.url));
    signal?.throwIfAborted();
    if(checkMode==='agent'){
      const result=await module[name]({directory:resolve(output,'details','agent'),runRoot:resolve(output,'details','runs'),signal,onUpdate:event});
      details=result.summary;
      if(!result.summary.passed||!result.summary.comparable)throw new Error('example_agent_comparison_failed');
    }else{
      const result=await module[name]({output:resolve(output,'details','checks'),signal,onUpdate:event});
      details=result.metadata;
      if(!result.passed)throw new Error('example_deterministic_comparison_failed');
    }
    signal?.throwIfAborted();
    if(report.comparison.original.completed!==report.comparison.original.total||report.comparison.corrected.completed!==report.comparison.corrected.total||report.comparison.original.passed!==0||report.comparison.corrected.failed!==0)throw new Error('example_comparison_incomplete');
    report.comparison.verified=true;report.comparison.phase='finished';report.outcome='comparison_verified';report.reason='example_comparison_verified';
  }catch(error){
    report.comparison.verified=false;report.comparison.phase=signal?.aborted?'stopped':'failed';
    for(const side of [report.comparison.original,report.comparison.corrected])if(side.state!=='finished')side.state=signal?.aborted?'stopped':'failed';
    if(signal?.aborted){report.cancelled=true;report.reason='user_stopped';report.stop={source:'user',reason:'user_stopped'};}
    else{report.valid=false;report.reason=error.code==='ERR_MODULE_NOT_FOUND'?'example_dependencies_missing':'example_check_failed';}
  }finally{
    report.agentResult={valid:report.valid,outcome:report.outcome,reason:report.reason};report.finishedAt=new Date().toISOString();
    if(!details)try{details=JSON.parse(await readFile(resolve(output,'details',checkMode==='agent'?'agent/summary.json':'checks/results.json'),'utf8'));}catch{}
    await writeFile(resolve(output,'details.json'),JSON.stringify(details||{partial:true,reason:report.reason,comparison:report.comparison},null,2)+'\n');
    update('finished');
  }
  return {report,output};
}
