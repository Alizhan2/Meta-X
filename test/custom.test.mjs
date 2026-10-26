import test from 'node:test';
import assert from 'node:assert/strict';
import {nextAction} from '../src/meta.mjs';
import {runAgent} from '../src/agent.mjs';
import {validateAction} from '../src/keyboard.mjs';
import {allowsTargetNavigation} from '../src/browser.mjs';
import {classifyReport,renderReport} from '../src/report.mjs';
import {observationKey} from '../src/stopping.mjs';

test('custom completion is a strict model declaration, never a fixture success oracle',async()=>{
  const old=process.env.MODEL_API_KEY;process.env.MODEL_API_KEY='synthetic-test-key';
  const body={status:'completed',model:'synthetic',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'{"status":"done","reason":"Search results are visible"}'}]}]};
  const request=async url=>({ok:true,status:200,json:async()=>url.endsWith('/input_tokens')?{input_tokens:10}:body});
  try{
    const observation={focus:{},semantics:'Results',screenshot:''};
    assert.equal((await nextAction([],observation,'Search',{request,allowCompletion:true})).kind,'done');
    await assert.rejects(nextAction([],observation,'Book',{request}),/model_expected_one_action/);
    const report={targetKind:'custom',task:'Search',budget:25,valid:true,steps:[],requests:[],usage:[],outcome:'agent_inconclusive'};
    await runAgent({executor:{},record:()=>null},report,{observeStep:async()=>observation,decide:async()=>({kind:'done',model:'synthetic',reason:'Results visible'})});
    assert.equal(report.outcome,'agent_reported_complete');assert.equal(report.steps.length,0);assert.equal(report.requests.length,1);
    report.agentResult={outcome:report.outcome,valid:true};
    assert.equal(classifyReport(report,{findings:[{confirmedInControlledFixture:true}]}).outcome,'agent_reported_complete');
    assert.ok(!renderReport(report).includes('Independent stored booking matches'));
    assert.ok(renderReport(report).includes('not been independently verified'));
  }finally{if(old===undefined)delete process.env.MODEL_API_KEY;else process.env.MODEL_API_KEY=old;}
});
test('custom target report escapes task/model text and never offers fixture probes or replays',()=>{
  const html=renderReport({targetKind:'custom',runId:'agent-1',targetUrl:'https://example.com/',task:'<script>unsafe</script>',scope:'Custom website',outcome:'agent_reported_complete',steps:[],agentResult:{valid:true},stop:{detail:'<img src=x onerror=alert(1)>'}});
  assert.ok(html.includes('&lt;script&gt;unsafe&lt;/script&gt;'));assert.ok(!html.includes('<script>unsafe</script>'));
  assert.ok(!html.includes('href="evidence/evidence.json"'));assert.ok(!html.includes('Corrected condition'));
});
test('same-site navigation allows initial www/HTTPS redirects but rejects escapes, credentials and protocol downgrade',()=>{
  assert.equal(allowsTargetNavigation('http://example.com/','https://www.example.com/path'),true);
  for(const next of ['https://evil.test/','https://example.com.evil.test/','http://example.com/','file:///tmp/test','https://user:pass@example.com/'])assert.equal(allowsTargetNavigation('https://example.com/',next),false);
  assert.equal(allowsTargetNavigation('http://localhost:3001/','http://localhost:3002/'),false);
});
test('printable multilingual text remains bounded; controls and hidden modifiers cannot be typed',()=>{
  assert.equal(validateAction({name:'type_text',arguments:{text:'Привет, 世界 👋'}}).arguments.text,'Привет, 世界 👋');
  for(const text of ['x\nnext','x\u0000','x\u202e','x'.repeat(257)])assert.throws(()=>validateAction({name:'type_text',arguments:{text}}));
  assert.notEqual(observationKey({url:'https://example.com/a',focus:{},semantics:'Same'}),observationKey({url:'https://example.com/b',focus:{},semantics:'Same'}));
});
