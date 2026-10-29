import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {normalizeWebsiteComparison,escapeResult,contractDifference,extractDiscoveredRoute,sameReplayFocus} from '../src/dialog-contract.mjs';
import {newWebsiteComparison,evaluateWebsiteComparison} from '../src/website-comparison.mjs';
import {createRunManager} from '../src/runs.mjs';
import {renderWebsiteComparisonReport} from '../src/website-report.mjs';
const input={beforeUrl:'https://example.test/before',afterUrl:'https://example.test/after',task:'Open details and close with Escape.',checkMode:'deterministic',contract:{type:'dialog_escape_focus',triggerSelector:'#open',dialogSelector:'#details'}};

test('website comparison accepts only explicit two-URL contracts and applies target policy to both',()=>{
  assert.equal(normalizeWebsiteComparison(input).targetKind,'website-comparison');
  assert.throws(()=>normalizeWebsiteComparison({...input,contract:{...input.contract,reach:'agent-route'}}),e=>e.code==='discovery_requires_agent');
  assert.equal(normalizeWebsiteComparison({...input,checkMode:'agent',contract:{...input.contract,reach:'agent-route'}}).contract.reach,'agent-route');
  for(const body of [{...input,afterUrl:input.beforeUrl},{...input,afterUrl:'http://192.168.1.1/'},{...input,beforeUrl:'file:///tmp/page'},{...input,contract:{...input.contract,script:'alert(1)'}},{...input,contract:{...input.contract,dialogSelector:'#open'}},{...input,checkMode:'shell'},{...input,extra:true}])assert.throws(()=>normalizeWebsiteComparison(body),e=>e.status===400);
  assert.throws(()=>normalizeWebsiteComparison({...input,afterUrl:'http://localhost:3000/'},{controlOrigins:['http://127.0.0.1:3000']}),e=>e.code==='target_not_allowed');
});

test('discovered routes require an actual observed opening and Escape and preserve exact agent steps',()=>{
  const steps=Array.from({length:5},(_,i)=>({action:{name:'press_key',arguments:{key:i===4?'Escape':'Tab'}},focusBefore:{tag:'BUTTON',id:String(i)},focusAfter:{tag:'BUTTON',id:String(i+1)}}));
  const raw={runId:'agent-123',steps};
  assert.equal(extractDiscoveredRoute(raw,{attempts:[{valid:true,actionIndex:4}]}),null,'a dialog already open at entry is not a discovered opening');
  assert.equal(extractDiscoveredRoute(raw,{attempts:[{valid:false,actionIndex:4,openedAtIndex:3}]}),null);
  const route=extractDiscoveredRoute(raw,{attempts:[{valid:true,actionIndex:4,openedAtIndex:3}]});assert.equal(route.sourceRunId,raw.runId);assert.deepEqual(route.steps,steps.slice(0,4));
  route.steps[0].action.arguments.key='Enter';assert.equal(raw.steps[0].action.arguments.key,'Tab','route snapshot does not mutate the agent record');
  assert.equal(sameReplayFocus({tag:'INPUT',id:'query',name:'Search',value:'Northstar'},{tag:'INPUT',id:'query',name:'Search',value:'Other'}),false);
  assert.equal(sameReplayFocus({tag:'BUTTON',name:'Preview'},{tag:'BUTTON',name:'Apply'}),false);
});

test('Escape requires an observed open focused dialog and checks closure and focus separately',()=>{
  const before={valid:true,dialogVisible:true,focusInside:true};
  assert.equal(escapeResult(before,{valid:true,dialogVisible:false,triggerFocused:true}).passed,true);
  assert.equal(escapeResult(before,{valid:true,dialogVisible:true,triggerFocused:false}).reason,'escape_did_not_close');
  assert.equal(escapeResult(before,{valid:true,dialogVisible:false,triggerFocused:false}).reason,'focus_not_restored');
  assert.equal(escapeResult({...before,focusInside:false},{valid:true,dialogVisible:false,triggerFocused:true}).passed,null);
});

test('independent attribution needs three valid repeated original failures and corrected passes on one runtime',()=>{
  const configuration=Object.fromEntries(['fixtureAndAgentBuild','browserVersion','playwrightVersion','platform','architecture','requestedModel','modelSettings','inputTokenLimit','contextPolicy'].map(key=>[key,'same']));
  const comparison=newWebsiteComparison(input),report={...input,comparison};
  comparison.original.probes=Array.from({length:3},()=>({valid:true,passed:false,reason:'escape_did_not_close',configuration}));
  comparison.corrected.probes=Array.from({length:3},()=>({valid:true,passed:true,reason:'dialog_contract_passed',configuration}));
  assert.equal(evaluateWebsiteComparison(report),true);
  comparison.corrected.probes[2]={valid:true,passed:false,reason:'escape_did_not_close',configuration};assert.equal(evaluateWebsiteComparison(report),false);
  comparison.corrected.probes[2]={valid:false,passed:null,reason:'invalid_css_selector',configuration};assert.equal(contractDifference(comparison).verified,false);
  comparison.corrected.probes[2]={valid:true,passed:true,configuration:{...configuration,browserVersion:'changed'}};assert.equal(evaluateWebsiteComparison(report),false);
  comparison.corrected.probes[2].configuration=configuration;report.checkMode='agent';assert.equal(evaluateWebsiteComparison(report),false,'independent checks cannot invent agent verification');
  comparison.original.agent={runId:'a',valid:true,model:'model',configuration,contract:{valid:true,passed:false}};comparison.corrected.agent={runId:'b',valid:true,model:'model',configuration,contract:{valid:true,passed:null}};
  assert.equal(evaluateWebsiteComparison(report),false,'unexercised Escape cannot establish an agent comparison');
  comparison.corrected.agent.contract.passed=true;assert.equal(evaluateWebsiteComparison(report),true);
  report.contract={...report.contract,reach:'agent-route'};
  comparison.discovery={sourceRunId:'a',steps:[{action:{name:'press_key',arguments:{key:'Tab'}}}]};
  assert.equal(evaluateWebsiteComparison(report),false,'unattributed probes cannot establish discovered-route evidence');
  for(const side of [comparison.original,comparison.corrected])for(const probe of side.probes)Object.assign(probe,{routeSourceRunId:'a',routeSteps:1});
  assert.equal(evaluateWebsiteComparison(report),true);
  comparison.corrected.probes[0].routeSourceRunId='b';assert.equal(evaluateWebsiteComparison(report),false,'corrected-agent route cannot replace the original route');
  comparison.corrected.probes[0].routeSourceRunId='a';comparison.corrected.probes[0].routeSteps=2;assert.equal(evaluateWebsiteComparison(report),false,'a different prefix length cannot verify the shared route');
  comparison.corrected.probes[0].routeSteps=1;
  comparison.corrected.agent.valid=false;assert.equal(evaluateWebsiteComparison(report),false,'invalid model attempt cannot verify comparison');
});

test('website comparisons use the shared key gate, lock, cancellation and interrupted-run recovery',async()=>{
  const root=await mkdtemp(join(tmpdir(),'tabproof-website-'));
  let started=0;
  const manager=await createRunManager({root,configured:()=>false,examplesCatalog:[],executeComparison:async({id,signal,...spec})=>{
    started++;if(!signal.aborted)await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));
    return {report:{runId:id,...spec,startedAt:new Date().toISOString(),finishedAt:new Date().toISOString(),steps:[],requests:[],cancelled:true,agentResult:{valid:true},comparison:newWebsiteComparison(spec)}};
  }});
  try{
    assert.throws(()=>manager.start({...input,checkMode:'agent'}),e=>e.code==='model_not_configured');
    const run=manager.start(input);assert.equal(run.executionMode,'deterministic');assert.throws(()=>manager.start(input),e=>e.code==='run_already_active');
    manager.stop(run.id);await manager.close();assert.equal(started,1);assert.equal(manager.get(run.id).state,'stopped');
    await mkdir(join(root,'agent-999'));await writeFile(join(root,'agent-999','report.json'),JSON.stringify({runId:'agent-999',...normalizeWebsiteComparison(input),startedAt:'2026-10-28T00:00:00Z',steps:[],comparison:{...newWebsiteComparison(input),verified:true}}));
    const restored=await createRunManager({root,examplesCatalog:[]});assert.equal(restored.get('agent-999').state,'failed');assert.equal(restored.get('agent-999').comparison.verified,false);await restored.close();
    const html=renderWebsiteComparisonReport({...input,cancelled:true,comparison:newWebsiteComparison(input),task:'<script>bad</script>'});assert.ok(html.includes('Comparison stopped'));assert.ok(!html.includes('<script>bad'));assert.ok(html.includes('partial'));
    const scripted=renderWebsiteComparisonReport({...input,executionMode:'scripted-test',comparison:newWebsiteComparison(input)});assert.ok(scripted.includes('No real model calls were made'));
  }finally{await manager.close();await rm(root,{recursive:true,force:true});}
});
