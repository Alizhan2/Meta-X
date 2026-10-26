import test from 'node:test';
import assert from 'node:assert/strict';
import {createProgressMonitor,observationKey} from '../src/stopping.mjs';
import {runAgent} from '../src/agent.mjs';
import {classifyReport,renderReport} from '../src/report.mjs';
import {expected} from '../src/fixture.mjs';

const key=key=>({name:'press_key',arguments:{key}});
const state=(id='a',semantics='page',extra={})=>({semantics,focus:{id,value:'',...extra},viewport:{scrollX:0,scrollY:0}});
const report=()=>({task:'Synthetic task',budget:25,valid:true,outcome:'agent_inconclusive',reason:'action_budget_exhausted',steps:[],requests:[],usage:[]});

test('three unchanged observations stop; changing semantics, selection, value and scroll count as progress',()=>{
  const monitor=createProgressMonitor(state());
  assert.equal(monitor.afterAction(key('Escape'),state(),1).stop,null);
  assert.equal(monitor.afterAction(key('Escape'),state(),2).stop,null);
  assert.equal(monitor.afterAction(key('Escape'),state(),3).stop.reason,'unchanged_observation');
  for(const next of [state('a','open calendar'),state('a','page',{value:'typed'}),state('a','page',{selectionStart:1}),state('a','page',{selectionEnd:2}),{...state(),viewport:{scrollX:0,scrollY:30}}]){
    assert.notEqual(observationKey(state()),observationKey(next));
    const guard=createProgressMonitor(state());
    assert.equal(guard.afterAction(key('ArrowRight'),next,1).checkpoint.unchangedActions,0);
  }
});
test('full same-direction Tab cycle stops; reversals, semantic changes and asynchronous progress reset the path',()=>{
  for(const direction of ['Tab','Shift+Tab']){
    const monitor=createProgressMonitor(state());
    assert.equal(monitor.afterAction(key(direction),state('b'),1).stop,null);
    assert.equal(monitor.afterAction(key(direction),state('c'),2).stop,null);
    assert.equal(monitor.afterAction(key(direction),state(),3).stop.reason,'focus_navigation_cycle');
  }
  const monitor=createProgressMonitor(state());
  assert.equal(monitor.afterAction(key('Tab'),state('b'),1).stop,null);
  assert.equal(monitor.afterAction(key('Shift+Tab'),state(),2).stop,null);
  assert.equal(monitor.afterAction(key('Tab'),state('b','calendar opened'),3).stop,null);
  monitor.beforeAction(state('b','loaded'));
  assert.equal(monitor.afterAction(key('Tab'),state('a','loaded'),4).stop,null);
  const noop=createProgressMonitor(state());
  assert.equal(noop.afterAction(key('Tab'),state(),1).stop,null);
  assert.equal(noop.afterAction(key('Tab'),state(),2).stop,null);
  assert.equal(noop.afterAction(key('Tab'),state(),3).stop.reason,'unchanged_observation');
  const scrolled=createProgressMonitor(state());
  assert.equal(scrolled.afterAction(key('Tab'),{...state('b'),viewport:{scrollX:0,scrollY:200}},1).stop,null);
  assert.equal(scrolled.afterAction(key('Tab'),{...state(),viewport:{scrollX:0,scrollY:100}},2).stop.reason,'focus_navigation_cycle');
});
test('runner guard stops before another model call or key; only independent findings permit site attribution',async()=>{
  let calls=0,keys=0;const result=report();
  await runAgent({executor:{execute:async action=>({index:++keys,action})},record:()=>null},result,{
    observeStep:async()=>state(),
    decide:async()=>{calls++;return {action:key('Escape'),model:'synthetic',continueWith:()=>[]};}
  });
  assert.equal(calls,3);assert.equal(keys,3);assert.equal(result.steps.length,3);
  assert.equal(result.valid,true);assert.equal(result.reason,'unchanged_observation');
  result.agentResult={valid:result.valid,outcome:result.outcome,reason:result.reason};
  assert.equal(classifyReport(result,{findings:[]}).outcome,'agent_inconclusive');
  assert.equal(classifyReport(result,{findings:[{confirmedInControlledFixture:true}]}).outcome,'suspected_blocker');
});
test('model stop causes no keyboard action, while completed booking wins over a repeat guard',async()=>{
  let calls=0,keys=0;const stopped=report();
  await runAgent({executor:{execute:async()=>{keys++;}},record:()=>null},stopped,{
    observeStep:async()=>state(),decide:async()=>{calls++;return {kind:'stop',reason:'No supported dismissal path',model:'synthetic'};}
  });
  assert.equal(calls,1);assert.equal(keys,0);assert.equal(stopped.reason,'model_reported_blockage');assert.equal(stopped.steps.length,0);
  const completed=report();
  await runAgent({executor:{execute:async action=>({index:++keys,action})},record:()=>keys===3?expected:null},completed,{
    observeStep:async()=>state(),decide:async()=>({action:key('Enter'),model:'synthetic',continueWith:()=>[]})
  });
  assert.equal(completed.outcome,'task_completed');assert.equal(completed.stop,undefined);
});

test('bounded nonrepeating exploration respects the model-call budget and stop reports escape model text',async()=>{
  let calls=0,keys=0;const result=report();result.budget=2;
  await runAgent({executor:{execute:async action=>({index:++keys,action})},record:()=>null},result,{
    observeStep:async()=>state('focus-'+keys),decide:async()=>{calls++;return {action:key('Tab'),model:'synthetic',continueWith:()=>[]};}
  });
  assert.equal(calls,2);assert.equal(keys,2);assert.equal(result.reason,'action_budget_exhausted');
  const html=renderReport({...report(),stop:{reason:'model_reported_blockage',atStep:0,detail:'<script>unsafe</script>'}});
  assert.ok(html.includes('Agent stopped safely'));
  assert.ok(html.includes('&lt;script&gt;unsafe&lt;/script&gt;'));
  assert.ok(!html.includes('<script>unsafe</script>'));
});
