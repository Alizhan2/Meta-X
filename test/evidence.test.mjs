import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeComparisons,matchesBooking} from '../src/evidence.mjs';
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
