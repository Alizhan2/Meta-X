import {setTimeout as delay} from 'node:timers/promises';
import {openWebsiteSession} from './browser.mjs';
import {normalizeCustomTarget} from './target.mjs';
import {runConfiguration} from './comparison.mjs';

const fail=code=>Object.assign(new Error(code),{status:400,code});
export const contractScope='Only the configured main-frame dialog: open it with Enter, close it with Escape, and restore focus to its opener. This does not verify the whole task or accessibility conformance. The URLs are supplied by the user; source-code equivalence between the versions is not established.';
export function normalizeWebsiteComparison(body,{controlOrigins=[]}={}){
  if(!body||Object.keys(body).sort().join()!=='afterUrl,beforeUrl,checkMode,contract,task'||!['deterministic','agent'].includes(body.checkMode))throw fail('invalid_comparison');
  const original=normalizeCustomTarget({targetUrl:body.beforeUrl,task:body.task},{controlOrigins});
  const corrected=normalizeCustomTarget({targetUrl:body.afterUrl,task:body.task},{controlOrigins});
  if(original.targetUrl===corrected.targetUrl)throw fail('identical_comparison_urls');
  const c=body.contract;
  if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).sort().join()!=='dialogSelector,triggerSelector,type'||c.type!=='dialog_escape_focus')throw fail('invalid_contract');
  // Plain CSS is evaluated read-only in the main frame, never as JS or Playwright selectors.
  const selector=value=>{if(typeof value!=='string'||!value.trim()||value.length>200||/[\x00-\x1f\x7f]/.test(value))throw fail('invalid_contract');return value.trim();};
  const contract={type:c.type,triggerSelector:selector(c.triggerSelector),dialogSelector:selector(c.dialogSelector)};
  if(contract.triggerSelector===contract.dialogSelector)throw fail('invalid_contract');
  return {targetKind:'website-comparison',beforeUrl:original.targetUrl,afterUrl:corrected.targetUrl,task:original.task,checkMode:body.checkMode,contract};
}

export async function readDialogState(page,contract){
  return page.evaluate(({triggerSelector,dialogSelector})=>{
    let triggers,dialogs;
    try{triggers=[...document.querySelectorAll(triggerSelector)];dialogs=[...document.querySelectorAll(dialogSelector)];}
    catch{return {valid:false,reason:'invalid_css_selector'};}
    if(triggers.length!==1||dialogs.length>1)return {valid:false,reason:'elements_not_unique',triggerCount:triggers.length,dialogCount:dialogs.length};
    const trigger=triggers[0],dialog=dialogs[0],active=document.activeElement;
    const visible=el=>{if(!el||el.closest('[hidden],[inert]'))return false;const style=getComputedStyle(el);return style.display!=='none'&&style.visibility!=='hidden'&&style.visibility!=='collapse'&&el.getClientRects().length>0;};
    return {valid:true,dialogVisible:visible(dialog),focusInside:!!dialog?.contains(active),triggerFocused:active===trigger,triggerVisible:visible(trigger),focus:{id:active?.id||null,tag:active?.tagName||null,name:active?.getAttribute('aria-label')||active?.innerText?.slice(0,100)||''}};
  },contract);
}

export async function settleDialogState(page,contract,phase,signal){
  const end=Date.now()+1800;let state;
  do{
    signal?.throwIfAborted();state=await readDialogState(page,contract);
    if(!state.valid||phase==='open'&&state.dialogVisible&&state.focusInside||phase==='close'&&!state.dialogVisible&&state.triggerFocused)return state;
    await delay(60,null,{signal});
  }while(Date.now()<end);
  return state;
}

export function escapeResult(before,after){
  if(!before?.valid||!after?.valid)return {valid:false,passed:null,reason:before?.reason||after?.reason||'invalid_observation'};
  if(!before.dialogVisible||!before.focusInside)return {valid:false,passed:null,reason:'escape_not_exercised_in_dialog'};
  return {valid:true,passed:!after.dialogVisible&&after.triggerFocused,reason:after.dialogVisible?'escape_did_not_close':!after.triggerFocused?'focus_not_restored':'dialog_contract_passed'};
}

export function createDialogAudit(contract,signal){
  let before=null;
  const audit={valid:true,passed:null,reason:'escape_not_exercised_in_dialog',attempts:[]};
  return {audit,async observe({page,after,action}){
    let state=after&&action?.name==='press_key'&&action.arguments.key==='Escape'&&before?.dialogVisible&&before?.focusInside?await settleDialogState(page,contract,'close',signal):await readDialogState(page,contract);
    if(!state.valid){audit.valid=false;audit.passed=null;audit.reason=state.reason;throw new Error('invalid_contract_observation');}
    if(after&&action?.name==='press_key'&&action.arguments.key==='Escape'){
      const result=escapeResult(before,state);audit.attempts.push({before,after:state,...result});
      const exercised=audit.attempts.filter(attempt=>attempt.valid);
      if(audit.valid&&exercised.length){audit.passed=exercised.every(attempt=>attempt.passed);audit.reason=exercised.find(attempt=>!attempt.passed)?.reason||'dialog_contract_passed';}
    }
    before=state;
  }};
}

export async function probeDialogContract({targetUrl,contract,signal,controlOrigins=[],capture=async()=>{},onStep=()=>{}}){
  let session;
  const result={valid:false,passed:null,reason:'probe_not_completed',actions:[],initialUrl:targetUrl};
  try{
    signal?.throwIfAborted();
    session=await openWebsiteSession(targetUrl,{budget:54,signal,controlOrigins,closeOnAbort:false});
    result.finalUrl=session.page.url();result.configuration=await runConfiguration(session.page.context().browser().version());
    let state=await readDialogState(session.page,contract);
    const press=async key=>{
      signal?.throwIfAborted();const prior=state;
      await session.executor.execute({name:'press_key',arguments:{key}});
      state=await readDialogState(session.page,contract);
      result.actions.push({action:{name:'press_key',arguments:{key}},focusBefore:prior.focus,focusAfter:state.focus});onStep(result);
    };
    if(!state.valid)result.reason=state.reason;
    else if(state.dialogVisible)result.reason='dialog_already_open';
    else if(!state.triggerVisible)result.reason='trigger_not_visible';
    else{
      for(let i=0;i<50&&!state.triggerFocused&&state.valid;i++)await press('Tab');
      if(!state.valid)result.reason=state.reason;
      else if(!state.triggerFocused)result.reason='trigger_not_reached';
      else{
        await press('Enter');state=await settleDialogState(session.page,contract,'open',signal);
        if(!state.valid)result.reason=state.reason;
        else if(!state.dialogVisible||!state.focusInside)result.reason='dialog_not_opened_with_focus';
        else{
          const before=state;await press('Escape');state=await settleDialogState(session.page,contract,'close',signal);
          Object.assign(result,escapeResult(before,state),{beforeEscape:before,afterEscape:state});
        }
      }
    }
    signal?.throwIfAborted();await capture(session.page,result);
  }catch(error){
    if(signal?.aborted)throw error;
    result.reason='probe_runtime_error';
  }finally{await session?.close().catch(()=>{});}
  return result;
}

export function contractDifference(comparison){
  const original=comparison.original.probes,corrected=comparison.corrected.probes;
  if(original.length!==3||corrected.length!==3||[...original,...corrected].some(p=>p.valid!==true))return {verified:false,reason:'independent_checks_incomplete'};
  if(corrected.some(p=>!p.passed))return {verified:false,reason:'corrected_contract_failed'};
  if(original.some(p=>p.passed))return {verified:false,reason:'original_failure_not_reproduced'};
  if(new Set(original.map(p=>p.reason)).size!==1)return {verified:false,reason:'original_failures_differ'};
  return {verified:true,reason:'independent_contract_improvement'};
}
