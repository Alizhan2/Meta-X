import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {openSession,observe} from './browser.mjs';
import {expected} from './fixture.mjs';

export function matchesBooking(record) {
  return !!record && Object.entries(expected).every(([key,value])=>record[key]===value);
}

async function active(page) {
  return page.evaluate(()=>{const el=document.activeElement;return {id:el?.id||null,tag:el?.tagName||null,role:el?.getAttribute('role')||null,name:el?.tagName==='BODY'||el?.tagName==='HTML'?'Page':el?.getAttribute('aria-label')||el?.labels?.[0]?.innerText||el?.innerText?.trim().slice(0,160)||'',value:el&&'value'in el?el.value:null};});
}

// This inventory is evidence, never an exhaustive operability verdict.
export async function inventory(page) {
  return page.evaluate(()=>Array.from(document.querySelectorAll('button,input,select,textarea,a[href],[role="button"],[tabindex]')).filter(el=>el.getClientRects().length&&!el.closest('[hidden]')).map(el=>({id:el.id||null,tag:el.tagName,role:el.getAttribute('role'),name:el.getAttribute('aria-label')||el.labels?.[0]?.textContent||el.textContent.trim().slice(0,120),tabIndex:el.tabIndex,disabled:!!el.disabled})));
}

export async function tabPath(session, {count=12, backward=false}={}) {
  if(!Number.isInteger(count)||count<1||count>40)throw new Error('invalid_probe_budget');
  const path=[await active(session.page)];
  for(let i=0;i<count;i++){
    await session.executor.execute({name:'press_key',arguments:{key:backward?'Shift+Tab':'Tab'}});
    path.push(await active(session.page));
  }
  return path;
}

// Fixture-specific contract checks. This detector knows expected UI contracts,
// not the active defect switch. Never publish its accuracy as model accuracy.
export async function inspectFixture(app,variant,{directory,signal}={}) {
  if(directory)await mkdir(directory,{recursive:true});
  const session=await openSession(app,variant,{budget:100,signal});
  const trace=[];const findings=[];const checkpoints=[];
  async function action(name,args){const before=await active(session.page);const result=await session.executor.execute({name,arguments:args});trace.push({...result,before,after:await active(session.page)});}
  const press=key=>action('press_key',{key});
  const type=text=>action('type_text',{text});
  async function checkpoint(label){const data={label,focus:await active(session.page),inventory:await inventory(session.page)};checkpoints.push(data);if(directory)await observe(session.page,resolve(directory,label+'.png'));return data;}
  async function seek(predicate,{count=14,backward=false}={}){
    const path=[await active(session.page)];
    if(predicate(path[0]))return {reached:true,path};
    for(let i=0;i<count;i++){await press(backward?'Shift+Tab':'Tab');const current=await active(session.page);path.push(current);if(predicate(current))return {reached:true,path};}
    return {reached:false,path};
  }
  function finding(code,description,evidence){findings.push({code,description,evidence,attribution:'fixture_contract_observation'});}
  try{
    await checkpoint('start');await type(expected.name);await press('Tab');await type(expected.email);await press('Tab');await press('Enter');
    const calendar=await checkpoint('calendar-open');
    const date=await seek(el=>el.name==='October 30, 2026',{count:12});
    if(!date.reached){
      const reverse=await seek(el=>el.name==='October 30, 2026',{count:12,backward:true});
      if(!reverse.reached){finding('calendar_date_unreachable','The required date is present but was not reached in the bounded forward/backward keyboard probe.',{inventory:calendar.inventory,forward:date.path,backward:reverse.path});return await finish();}
    }
    await press('Enter');const afterDate=await checkpoint('date-selected');
    if(afterDate.focus.id!=='date-trigger')finding('unexpected_focus_return','After choosing a date, focus did not return to the date selector required by this fixture contract.',{expectedId:'date-trigger',actual:afterDate.focus});
    const time=await seek(el=>el.id==='time-14');if(!time.reached)throw new Error('probe_time_not_reached');
    await press('ArrowRight');const review=await seek(el=>el.id==='review');if(!review.reached)throw new Error('probe_review_not_reached');
    await press('Enter');await checkpoint('review-open');await press('Escape');
    const isOpen=()=>session.page.locator('dialog').evaluate(el=>el.open);
    if(await isOpen()){
      const close=await seek(el=>el.id==='close-review',{count:8});
      if(close.reached)await press('Enter');
      if(await isOpen()){
        const reverse=await seek(el=>el.id==='close-review',{count:8,backward:true});
        if(reverse.reached)await press('Enter');
        if(await isOpen()){finding('modal_keyboard_dismissal','Escape did not dismiss the review, and no usable close button was found in the bounded forward/backward keyboard probe.',{forward:close.path,backward:reverse.path,inventory:await inventory(session.page)});await checkpoint('modal-blocked');return await finish();}
      }
    }
    const book=await seek(el=>el.id==='book',{count:12});
    if(!book.reached){
      const reverse=await seek(el=>el.id==='book',{count:12,backward:true});
      if(!reverse.reached){finding('confirmation_unreachable','The confirmation control was not reached in the bounded forward/backward keyboard probe.',{forward:book.path,backward:reverse.path,inventory:await inventory(session.page)});await checkpoint('confirmation-blocked');return await finish();}
    }
    await press('Enter');
    await session.page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Your session is booked'),{},{timeout:3000});
    await checkpoint('finished');return await finish();
  }finally{await session.close();}
  async function finish(){
    const record=session.record();
    const result={taskCompleted:matchesBooking(record),record,findings,trace,checkpoints};
    if(directory)await writeFile(resolve(directory,'probe.json'),JSON.stringify(result,null,2));
    return result;
  }
}

export function summarizeComparisons(observed,control) {
  const controlsClean=control.length>0 && control.every(item=>item.taskCompleted&&item.findings.length===0);
  const codes=[...new Set(observed.flatMap(item=>item.findings.map(f=>f.code)))];
  const findings=codes.map(code=>{
    const occurrences=observed.filter(item=>item.findings.some(f=>f.code===code)).length;
    return {code,occurrences,runs:observed.length,reproduced:occurrences===observed.length,correctedControlClean:controlsClean,confirmedInControlledFixture:observed.length>=3&&control.length>=3&&occurrences===observed.length&&controlsClean};
  });
  return {findings,controlsClean,observedRuns:observed.length,controlRuns:control.length,scope:'Fixture-specific deterministic contract checks; not a general WCAG verdict and not model detection metrics.'};
}

export async function collectEvidence(app,variant,{repeats=3,directory,signal}={}) {
  if(!Number.isInteger(repeats)||repeats<1||repeats>5)throw new Error('invalid_repeats');
  const observed=[],control=[];
  for(let i=0;i<repeats;i++){
    signal?.throwIfAborted();
    observed.push(await inspectFixture(app,variant,{directory:directory&&resolve(directory,`observed-${i+1}`),signal}));
    control.push(await inspectFixture(app,'correct',{directory:directory&&resolve(directory,`corrected-${i+1}`),signal}));
  }
  const result={...summarizeComparisons(observed,control),observed,control};
  if(directory)await writeFile(resolve(directory,'evidence.json'),JSON.stringify(result,null,2));
  return result;
}

export async function replayTrace(app,variant,steps,{directory,signal}={}) {
  if(!Array.isArray(steps)||steps.length>25)throw new Error('invalid_trace');
  if(directory)await mkdir(directory,{recursive:true});
  const session=await openSession(app,variant,{budget:25,signal});const replay=[];
  try{
    for(const [index,step] of steps.entries()){
      await session.executor.execute(step.action);
      const focus=await active(session.page);
      replay.push({index:index+1,focus,matchesOriginalFocus:step.focusAfter?focusMatches(step.focusAfter,focus):null});
    }
    const observation=await observe(session.page,directory&&resolve(directory,'replay-final.png'));
    return {taskCompleted:matchesBooking(session.record()),record:session.record(),focusPathMatches:replay.length?replay.every(step=>step.matchesOriginalFocus===true):null,steps:replay,finalFocus:observation.focus};
  }finally{await session.close();}
}

export function focusMatches(a,b){return ['id','tag','role','name','value'].every(key=>key==='name'?String(a[key]??'').replace(/\s+/g,' ').trim()===String(b[key]??'').replace(/\s+/g,' ').trim():(a[key]??null)===(b[key]??null));}
