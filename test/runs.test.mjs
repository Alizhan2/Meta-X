import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRunManager} from '../src/runs.mjs';
import {setTimeout as delay} from 'node:timers/promises';

test('run manager locks concurrent starts, stops idempotently, and releases for a fresh run',async()=>{
  const root=await mkdtemp(join(tmpdir(),'tabproof-manager-'));let executions=0;
  const manager=await createRunManager({root,configured:()=>true,execute:async({id,variant,signal,onUpdate})=>{
    executions++;
    const report={runId:id,variant,startedAt:new Date().toISOString(),steps:[],requests:[],agentResult:{valid:true},cancelled:false};
    onUpdate({phase:'running',report});
    if(!signal.aborted)await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));
    report.cancelled=true;report.finishedAt=new Date().toISOString();return {report};
  }});
  try{
    const first=manager.start('correct');
    assert.throws(()=>manager.start('correct'),error=>error.status===409);
    assert.throws(()=>manager.start('bad_condition'),error=>error.status===400);
    assert.equal(manager.stop(first.id).state,'stopping');
    assert.equal(manager.stop(first.id).state,'stopping');
    while(manager.list().activeId)await delay(5);
    assert.equal(executions,1);assert.equal(manager.get(first.id).state,'stopped');assert.equal(manager.list().activeId,null);
    const second=manager.start('focus_loss');assert.notEqual(first.id,second.id);
    const shutdown=manager.close();
    assert.throws(()=>manager.start('correct'),error=>error.status===503);
    await shutdown;assert.equal(executions,2);
    assert.throws(()=>manager.start('correct'),error=>error.status===503);
    assert.throws(()=>manager.stop('agent-1'),error=>error.status===404);
  }finally{await manager.close();await rm(root,{recursive:true,force:true});}
});
test('run history survives manager restart and missing credentials cannot start execution',async()=>{
  const root=await mkdtemp(join(tmpdir(),'tabproof-history-'));
  try{
    await mkdir(join(root,'agent-123'));
    await writeFile(join(root,'agent-123','report.json'),JSON.stringify({runId:'agent-123',variant:'correct',startedAt:'2026-10-26T00:00:00Z',steps:[],requests:[],agentResult:{valid:true},cancelled:true}));
    const manager=await createRunManager({root,configured:()=>false});
    assert.equal(manager.list().configured,false);assert.equal(manager.get('agent-123').state,'stopped');
    assert.equal(manager.get('agent-123').reportUrl,'/reports/agent-123/report.html');
    assert.throws(()=>manager.start('correct'),error=>error.status===503);
    await manager.close();
  }finally{await rm(root,{recursive:true,force:true});}
});
test('list omits step detail but reports step counts; get keeps the full action record',async()=>{
  const root=await mkdtemp(join(tmpdir(),'tabproof-summary-'));
  try{
    await mkdir(join(root,'agent-456'));
    const steps=[{index:1,action:{name:'press_key',arguments:{key:'Tab'}},focusBefore:{id:'a'},focusAfter:{id:'b'}}];
    await writeFile(join(root,'agent-456','report.json'),JSON.stringify({runId:'agent-456',variant:'correct',startedAt:'2026-10-26T00:00:00Z',steps,requests:[],agentResult:{valid:true}}));
    const manager=await createRunManager({root,configured:()=>true});
    const [summary]=manager.list().runs;
    assert.equal(summary.stepCount,1);assert.equal('steps' in summary,false);
    assert.equal(manager.get('agent-456').steps.length,1);
    await manager.close();
  }finally{await rm(root,{recursive:true,force:true});}
});
