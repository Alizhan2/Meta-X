const $=id=>document.getElementById(id);
const ui={form:$('start-form'),condition:$('condition'),start:$('start'),startLabel:$('start-label'),stop:$('stop'),service:$('service-status'),mark:$('status-mark'),note:$('control-note'),notice:$('notice'),noticeText:$('notice-text'),retry:$('retry'),selectedLabel:$('selected-run-label'),selectedState:$('selected-run-state'),empty:$('screen-empty'),emptyTitle:$('empty-title'),emptyDescription:$('empty-description'),image:$('screen-image'),imageError:$('image-error'),focus:$('focus-caption'),screenMeta:$('screen-caption-meta'),count:$('action-count'),actionEmpty:$('action-empty'),timeline:$('timeline'),scroll:$('action-scroll'),detail:$('run-detail'),report:$('report-link'),history:$('run-history'),historyEmpty:$('history-empty'),historyNote:$('history-note'),refresh:$('refresh-history')};
const conditions={correct:'Corrected form',unreachable_button:'Unreachable confirm button',calendar_keyboard:'Calendar keyboard barrier',modal_dismissal:'Review window cannot close',focus_loss:'Unexpected focus return'};
const states={starting:'Starting',running:'Running',stopping:'Stopping',checking:'Checking evidence',completed:'Finished',stopped:'Stopped',failed:'Failed'};
const activeStates=new Set(['starting','running','stopping','checking']);
const reasons={unchanged_observation:'Repeated keyboard actions did not change the observed page.',focus_navigation_cycle:'The agent stopped after repeating a keyboard navigation path.',model_reported_blockage:'The model stopped and reported an obstacle. Independent checks determine what the evidence supports.',server_record_matches:'The stored booking matches the task.',reproduced_fixture_contract_violation:'An independent check reproduced a keyboard obstacle.',action_budget_exhausted:'The agent reached its action limit. The report keeps this separate from a site defect.',policy_no_progress:'The agent stopped after repeated actions made no progress.',policy_cycle:'The agent stopped after revisiting the same page state.',model_stopped:'The model ended its attempt. Independent checks determine what the evidence supports.',model_reported_blocked:'The model reported an obstacle. Independent checks determine what the evidence supports.',user_stopped:'Stopped at your request.',user_stop:'Stopped at your request.',stopped_by_user:'Stopped at your request.'};
const runs=new Map();
let selectedId=new URL(location.href).searchParams.get('run');
let activeId=null,configured=false,connected=false,mutating=false,mutationVersion=0,lastListAt=0,listBusy=false,timer=null;
let timelineSignature='',historySignature='',previewKey='',ticking=false,rerunRequested=false,suspended=false;
const setText=(node,value)=>{const text=String(value??'');if(node.textContent!==text)node.textContent=text;};
const conditionName=variant=>conditions[variant]||String(variant||'Unknown condition').replaceAll('_',' ');
const stateName=state=>states[state]||String(state||'Unknown state').replaceAll('_',' ');
function readableReason(run){if(!run)return 'Choose a test condition to begin.';if(activeStates.has(run.state))return run.phase?String(run.phase).replaceAll('_',' '):'Waiting for the next observed action.';if(run.reason)return reasons[run.reason]||String(run.reason).replaceAll('_',' ');return run.taskCompleted?'The stored booking matches the task.':'Open the report to inspect this attempt.';}
function dateLabel(value){const date=new Date(value);return Number.isNaN(date.valueOf())?'Time unavailable':new Intl.DateTimeFormat('en',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(date);}
function notice(message,{retry=false}={}){setText(ui.noticeText,message);ui.notice.hidden=!message;ui.retry.hidden=!retry;}
function safeReportPath(value,{image=false}={}){
  if(typeof value!=='string'||!value.startsWith('/reports/'))return null;
  try{const url=new URL(value,location.origin);if(url.origin!==location.origin||url.pathname.split('/').some(part=>part==='..')||!url.pathname.startsWith('/reports/'))return null;if(image?!url.pathname.endsWith('.png'):!url.pathname.endsWith('/report.html'))return null;return url.pathname+url.search;}catch{return null;}
}
function store(run){if(!run||typeof run.id!=='string'||!Array.isArray(run.steps))throw new Error('The run service returned an unreadable run.');runs.set(run.id,run);return run;}
function newest(){return [...runs.values()].sort((a,b)=>(Date.parse(b.startedAt)||0)-(Date.parse(a.startedAt)||0));}
function selected(){return runs.get(selectedId)||null;}
function setSelection(id,{persist=false}={}){selectedId=id;timelineSignature='';previewKey='';if(persist){const url=new URL(location.href);url.searchParams.set('run',id);history.replaceState(null,'',url);}render();}
function renderControls(){
  const active=runs.get(activeId);
  ui.start.disabled=!connected||!configured||!!activeId||mutating;
  ui.condition.disabled=mutating;
  ui.stop.disabled=!activeId||mutating||active?.state==='stopping'||!!(active&&!activeStates.has(active.state));
  ui.stop.setAttribute('aria-label',active?`Stop active run: ${conditionName(active.variant)}`:'Stop active run');
  setText(ui.startLabel,mutating&&ui.start.dataset.pending==='true'?'Starting…':'Start agent');
  if(!connected){setText(ui.service,'Run service unavailable');ui.mark.dataset.state='failed';setText(ui.note,'Reconnect to start a run.');return;}
  if(!configured){setText(ui.service,'API key required');ui.mark.dataset.state='idle';setText(ui.note,'Configure Meta API on this server before starting.');return;}
  if(activeId){setText(ui.service,active?stateName(active.state):'Agent active');ui.mark.dataset.state=active?.state||'running';setText(ui.note,`${active?conditionName(active.variant):'Another run'}${selectedId&&selectedId!==activeId?' · viewing a previous run':''}`);return;}
  setText(ui.service,mutating?'Starting a run':'Ready to run');ui.mark.dataset.state=mutating?'starting':'idle';setText(ui.note,'One agent run at a time. No run starts automatically.');
}
function focusName(focus){if(!focus)return 'Unknown focus';return focus.name?.trim()||focus.id||String(focus.tag||'Page').toLowerCase();}
function renderTimeline(run){
  const steps=run?.steps||[];
  const signature=JSON.stringify([run?.id,steps]);
  setText(ui.count,steps.length?`${steps.length} ${steps.length===1?'action':'actions'} recorded`:'No actions recorded');
  ui.actionEmpty.hidden=steps.length>0;
  if(signature===timelineSignature)return;
  const follow=ui.scroll.scrollHeight-ui.scroll.scrollTop-ui.scroll.clientHeight<75;
  const sameRun=ui.timeline.dataset.runId===run?.id;
  timelineSignature=signature;ui.timeline.dataset.runId=run?.id||'';
  const fragment=document.createDocumentFragment();
  for(const [i,step] of steps.entries()){
    const li=document.createElement('li'),number=document.createElement('span'),main=document.createElement('div'),label=document.createElement('p'),path=document.createElement('p');
    number.className='step-number';setText(number,String(step.index??i+1).padStart(2,'0'));number.setAttribute('aria-label',`Step ${step.index??i+1}`);
    main.className='action-main';label.className='action-label';path.className='focus-path';
    if(step.action?.name==='press_key'){const key=document.createElement('kbd');setText(key,step.action.arguments?.key||'Unknown key');label.append(key);label.append(document.createTextNode('pressed'));}
    else if(step.action?.name==='type_text'){setText(label,`Typed “${String(step.action.arguments?.text??'').slice(0,256)}”`);}
    else setText(label,step.action?.name||'Recorded action');
    const before=focusName(step.focusBefore),after=focusName(step.focusAfter);setText(path,before===after?`Focus stays on ${after}`:`${before} → ${after}`);
    main.append(label,path);li.append(number,main);fragment.append(li);
  }
  ui.timeline.replaceChildren(fragment);
  if(sameRun&&follow&&run&&activeStates.has(run.state))ui.scroll.scrollTop=ui.scroll.scrollHeight;
  else if(!sameRun)ui.scroll.scrollTop=0;
}
function renderPreview(run){
  const steps=run?.steps||[];
  setText(ui.selectedLabel,run?`${conditionName(run.variant)} · ${dateLabel(run.startedAt)}${run.executionMode==='scripted-test'?' · Scripted test':''}`:'No run selected');
  ui.selectedState.hidden=!run;setText(ui.selectedState,run?stateName(run.state):'');
  const source=safeReportPath(run?.latestScreenshot,{image:true});
  ui.empty.hidden=!!source;ui.image.hidden=!source;
  if(source){const key=`${run.id}:${source}:${steps.length}`;if(previewKey!==key){previewKey=key;ui.imageError.hidden=true;ui.image.src=source+(source.includes('?')?'&':'?')+'view='+steps.length;ui.image.alt=steps.length?`Observed booking page after action ${steps.length}`:'Initial observed booking page';}}
  else{previewKey='';ui.image.removeAttribute('src');ui.imageError.hidden=true;setText(ui.emptyTitle,!run?'The next move is a key press.':activeStates.has(run.state)?'Waiting for the first screenshot.':'No screenshot was recorded.');setText(ui.emptyDescription,!run?'Start a run to see the real page and the agent’s actions.':activeStates.has(run.state)?'The browser is being prepared. Executed actions will appear alongside it.':'You can still inspect any available action record or evidence report.');}
  setText(ui.focus,steps.length?`Focus: ${focusName(steps.at(-1).focusAfter)}`:run?'No executed keyboard action yet.':'Keyboard focus will appear here.');
  setText(ui.screenMeta,steps.length?`After action ${steps.length}`:source?'Initial page':'');
  setText(ui.detail,readableReason(run)+(run?.interruptedAction?' An action was interrupted before its resulting page could be recorded.':''));
  const report=safeReportPath(run?.reportUrl);ui.report.hidden=!report;if(report)ui.report.href=report;else ui.report.removeAttribute('href');
}
function renderHistory(){
  const ordered=newest();setText(ui.historyNote,ordered.length?`${ordered.length} ${ordered.length===1?'run':'runs'} saved locally. Select one to inspect it.`:'Only real runs are listed here.');
  ui.historyEmpty.hidden=ordered.length>0;
  const signature=JSON.stringify([selectedId,ordered.map(run=>[run.id,run.variant,run.state,run.startedAt])]);
  if(signature===historySignature)return;historySignature=signature;
  const focusedRunId=ui.history.contains(document.activeElement)?document.activeElement.dataset.runId:null;
  const fragment=document.createDocumentFragment();
  for(const run of ordered){const li=document.createElement('li'),button=document.createElement('button'),name=document.createElement('span'),time=document.createElement('span'),state=document.createElement('span');button.type='button';button.dataset.runId=run.id;button.setAttribute('aria-pressed',String(run.id===selectedId));button.setAttribute('aria-label',`${conditionName(run.variant)}, ${dateLabel(run.startedAt)}, ${stateName(run.state)}`);name.className='history-name';time.className='history-time';state.className='history-state';setText(name,conditionName(run.variant));setText(time,dateLabel(run.startedAt));setText(state,stateName(run.state));button.append(name,time,state);button.addEventListener('click',()=>{setSelection(run.id,{persist:true});void refreshRun(run.id);});li.append(button);fragment.append(li);}
  const position=ui.history.scrollTop;ui.history.replaceChildren(fragment);ui.history.scrollTop=position;if(focusedRunId){const target=[...ui.history.querySelectorAll('button')].find(button=>button.dataset.runId===focusedRunId);target?.focus({preventScroll:true});}
}
function render(){renderControls();renderTimeline(selected());renderPreview(selected());renderHistory();}
async function api(path,options={}){
  const response=await fetch(path,{cache:'no-store',...options,headers:{'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(12000)});
  let data;try{data=await response.json();}catch{throw new Error('The run service returned an unreadable response.');}
  if(!response.ok)throw new Error(typeof data.error==='string'?data.error:typeof data.message==='string'?data.message:`The request was not accepted (${response.status}).`);
  return data;
}
async function refreshList(){
  if(listBusy)return;listBusy=true;ui.refresh.disabled=true;const version=mutationVersion;
  try{
    const data=await api('/api/runs');if(version!==mutationVersion){lastListAt=0;return;}
    if(!Array.isArray(data.runs)||typeof data.configured!=='boolean'||!(data.activeId===null||typeof data.activeId==='string'))throw new Error('The run service returned an unreadable state.');
    for(const run of data.runs)store(run);
    configured=data.configured;activeId=data.activeId;connected=true;lastListAt=Date.now();
    if(!selectedId){selectedId=activeId||newest()[0]?.id||null;}
    if(!configured)notice('The Meta API key is not configured on this server. Add it locally before starting a run.');
    else notice('');
    render();
    if(selectedId&&!runs.has(selectedId))void refreshRun(selectedId);
  }catch(error){if(version===mutationVersion){connected=false;notice(`Cannot reach the run service. ${error.message}`,{retry:true});renderControls();}}
  finally{listBusy=false;ui.refresh.disabled=false;}
}
async function refreshRun(id){
  const version=mutationVersion;
  try{const data=await api('/api/runs/'+encodeURIComponent(id));if(version!==mutationVersion)return;store(data.run);render();}
  catch(error){if(id===selectedId&&version===mutationVersion)notice(`Cannot refresh this run. ${error.message}`,{retry:true});}
}
async function tick(){
  if(suspended)return;
  clearTimeout(timer);
  if(ticking){rerunRequested=true;return;}
  ticking=true;
  try{if(!mutating){if(Date.now()-lastListAt>=3000)await refreshList();const id=activeId;if(id)await refreshRun(id);}}
  finally{ticking=false;if(!suspended){const delay=rerunRequested?0:activeId?700:1000;rerunRequested=false;timer=setTimeout(tick,delay);}}
}
ui.form.addEventListener('submit',async event=>{
  event.preventDefault();if(ui.start.disabled||mutating||activeId)return;
  mutating=true;mutationVersion++;ui.start.dataset.pending='true';notice('');renderControls();
  try{const data=await api('/api/runs',{method:'POST',body:JSON.stringify({variant:ui.condition.value})});const run=store(data.run);activeId=activeStates.has(run.state)?run.id:null;selectedId=run.id;timelineSignature='';previewKey='';const url=new URL(location.href);url.searchParams.delete('run');history.replaceState(null,'',url);render();}
  catch(error){notice(`The run could not be started. ${error.message}`,{retry:true});connected=false;}
  finally{mutating=false;ui.start.dataset.pending='false';lastListAt=0;render();void tick();}
});
ui.stop.addEventListener('click',async()=>{
  if(ui.stop.disabled||!activeId||mutating)return;
  const id=activeId;mutating=true;mutationVersion++;notice('');renderControls();
  try{const data=await api('/api/runs/'+encodeURIComponent(id)+'/stop',{method:'POST',body:'{}'});store(data.run);render();}
  catch(error){notice(`The stop request was not confirmed. ${error.message}`,{retry:true});}
  finally{mutating=false;lastListAt=0;render();void tick();}
});
ui.image.addEventListener('error',()=>{if(ui.image.getAttribute('src'))ui.imageError.hidden=false;});
ui.refresh.addEventListener('click',()=>{lastListAt=0;void refreshList();});
ui.retry.addEventListener('click',()=>{lastListAt=0;void refreshList();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){lastListAt=0;void tick();}});
window.addEventListener('pagehide',()=>{suspended=true;clearTimeout(timer);});
window.addEventListener('pageshow',event=>{if(event.persisted){suspended=false;lastListAt=0;void tick();}});
void tick();
