import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeComparisons,matchesBooking,focusMatches} from '../src/evidence.mjs';
import {compareRuns} from '../src/comparison.mjs';
import {expected} from '../src/fixture.mjs';
import {classifyReport,renderReport} from '../src/report.mjs';

test('repeated failure is not confirmation when corrected control also fails',()=>{
  const bad={taskCompleted:false,findings:[{code:'example'}]};
  assert.equal(summarizeComparisons([bad,bad,bad],[bad,bad,bad]).findings[0].confirmedInControlledFixture,false);
});
test('a non-reproduced finding stays unconfirmed even with a passing control',()=>{
  const bad={taskCompleted:false,findings:[{code:'example'}]},good={taskCompleted:true,findings:[]};
  assert.equal(summarizeComparisons([bad,bad,good],[good,good,good]).findings[0].confirmedInControlledFixture,false);
});
test('completion requires all four stored fields, not a model claim or banner',()=>{
  assert.equal(matchesBooking({status:'success'}),false);
  assert.equal(matchesBooking({...expected,time:'14:00'}),false);
  assert.equal(matchesBooking(expected),true);
});
test('task completion does not hide a reproduced focus defect',()=>{
  const report={agentResult:{outcome:'task_completed'}};
  assert.equal(classifyReport(report,{findings:[{confirmedInControlledFixture:true}]}).outcome,'suspected_blocker');
});
test('HTML report escapes model-controlled text',()=>{
  const html=renderReport({task:'<script>alert(1)</script>',outcome:'agent_inconclusive',steps:[],evidence:{findings:[]}});
  assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
});
test('API failure cannot count as agent detection even with independent fixture findings',()=>{
  const result=classifyReport({agentResult:{valid:false,reason:'model_http_429'}},{findings:[{confirmedInControlledFixture:true}]});
  assert.equal(result.outcome,'agent_inconclusive');assert.equal(result.reason,'model_http_429');
});
test('one repeat is insufficient for fixture confirmation',()=>{
  const bad={taskCompleted:false,findings:[{code:'example'}]},good={taskCompleted:true,findings:[]};
  assert.equal(summarizeComparisons([bad],[good]).findings[0].confirmedInControlledFixture,false);
});
test('calendar buttons with different names cannot be the same replay focus',()=>{
  assert.equal(focusMatches({id:null,tag:'BUTTON',name:'October 29, 2026'},{id:null,tag:'BUTTON',name:'October 30, 2026'}),false);
});
test('corrected comparisons require distinct runs, an original fault and matching recorded configuration',()=>{
  const original={runId:'a',variant:'unreachable_button',task:'book',model:'test',budget:25,agentResult:{valid:true},outcome:'suspected_blocker',evidence:{findings:[{confirmedInControlledFixture:true}]},configuration:{browser:'test-v1'}};
  const corrected={runId:'b',variant:'correct',task:'book',model:'test',budget:25,agentResult:{valid:true},outcome:'task_completed',record:expected,evidence:{controlsClean:true},configuration:{browser:'test-v1'}};
  assert.equal(compareRuns(original,corrected).verified,true);
  assert.equal(compareRuns(corrected,corrected).verified,false);
  assert.equal(compareRuns({...original,configuration:undefined},corrected).reason,'missing_run_configuration');
  assert.equal(compareRuns(original,{...corrected,configuration:{browser:'other'}}).verified,false);
});
