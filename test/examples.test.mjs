import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createRunManager} from '../src/runs.mjs';
import {loadExamples,exampleDefinition,readExampleReference,newExampleComparison,renderExampleReport} from '../src/examples.mjs';

test('published references are clearly separate from new execution and reference paths cannot escape',async()=>{
  const entries=await loadExamples();assert.equal(entries.length,2);
  for(const entry of entries){
    assert.equal(entry.reference.executionMode,'published-reference');
    assert.equal(entry.reference.comparison.original.passed,0);assert.equal(entry.reference.comparison.corrected.passed,3);
    assert.equal(entry.reference.comparison.verified,true);assert.ok(entry.reference.startedAt);
    assert.ok((await readExampleReference(entry.id,'original.png')).length>0);
  }
  for(const [id,file] of [['__proto__','original.png'],['radix-toast','../../.env'],['react-aria-scroll','server.mjs']])assert.equal(await readExampleReference(id,file),null);
});

test('deterministic examples work without a model key and share the normal run lock and cancellation',async()=>{
  const root=await mkdtemp(join(tmpdir(),'tabproof-example-manager-'));
  let executions=0;
  const manager=await createRunManager({root,configured:()=>false,examplesCatalog:[{id:'radix-toast',available:true}],executeExample:async({id,exampleId,checkMode,signal,onUpdate})=>{
    executions++;
    const report={runId:id,targetKind:'example',exampleId,checkMode,startedAt:new Date().toISOString(),steps:[],requests:[],comparison:newExampleComparison(exampleDefinition(exampleId),checkMode)};
    onUpdate({phase:'checking',report});
    if(!signal.aborted)await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));
    return {report:{...report,cancelled:true,finishedAt:new Date().toISOString(),reason:'user_stopped',agentResult:{valid:true}}};
  }});
  try{
    assert.throws(()=>manager.start({exampleId:'radix-toast',checkMode:'agent'}),e=>e.code==='model_not_configured');
    assert.throws(()=>manager.start({exampleId:'other',checkMode:'deterministic'}),e=>e.status===400);
    assert.throws(()=>manager.start({exampleId:['radix-toast'],checkMode:'deterministic'}),e=>e.status===400);
    assert.throws(()=>manager.start({exampleId:'radix-toast',checkMode:'shell'}),e=>e.status===400);
    assert.throws(()=>manager.start({exampleId:'radix-toast',checkMode:'deterministic',targetUrl:'https://example.test'}),e=>e.status===400);
    const run=manager.start({exampleId:'radix-toast',checkMode:'deterministic'});assert.equal(run.executionMode,'deterministic');
    assert.throws(()=>manager.start('correct'),e=>e.code==='run_already_active');
    assert.throws(()=>manager.start({exampleId:'radix-toast',checkMode:'deterministic'}),e=>e.code==='run_already_active');
    manager.stop(run.id);while(manager.list().activeId)await delay(5);
    assert.equal(manager.get(run.id).state,'stopped');assert.equal(manager.get(run.id).comparison.verified,false);assert.equal(executions,1);
  }finally{await manager.close();await rm(root,{recursive:true,force:true});}
});

test('an incomplete saved example is failed after restart and cannot inherit a verified result',async()=>{
  const root=await mkdtemp(join(tmpdir(),'tabproof-example-restart-'));
  try{
    await mkdir(join(root,'agent-999'));
    await writeFile(join(root,'agent-999','report.json'),JSON.stringify({runId:'agent-999',targetKind:'example',exampleId:'radix-toast',checkMode:'deterministic',startedAt:'2026-10-27T01:00:00Z',steps:[],requests:[],comparison:{verified:true}}));
    const manager=await createRunManager({root,configured:()=>false,examplesCatalog:[{id:'radix-toast',available:false}]});
    try{
      const run=manager.get('agent-999');assert.equal(run.state,'failed');assert.equal(run.comparison.verified,false);assert.equal(run.reason,'comparison_interrupted_by_restart');
      assert.throws(()=>manager.start({exampleId:'radix-toast',checkMode:'deterministic'}),e=>e.code==='example_dependencies_missing');
    }finally{await manager.close();}
  }finally{await rm(root,{recursive:true,force:true});}
});

test('partial comparison reports disclose cancellation even if a completed side passed',()=>{
  const comparison=newExampleComparison(exampleDefinition('radix-toast'));
  comparison.original={...comparison.original,label:'<img src=x onerror=alert(1)>',state:'finished',completed:3};
  comparison.corrected={...comparison.corrected,state:'stopped'};
  const html=renderExampleReport({runId:'agent-1',exampleId:'radix-toast',checkMode:'deterministic',comparison,cancelled:true});
  assert.ok(html.includes('Comparison stopped'));assert.ok(html.includes('partial'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<h1>Before/after comparison verified'));
});
