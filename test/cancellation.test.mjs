import test from 'node:test';
import assert from 'node:assert/strict';
import {runAgent} from '../src/agent.mjs';
import {nextAction} from '../src/meta.mjs';
import {createKeyboardExecutor} from '../src/keyboard.mjs';
import {classifyReport,renderReport} from '../src/report.mjs';
const observation={semantics:'Synthetic',focus:{id:'name'},screenshot:''};
const report=()=>({task:'Synthetic',budget:25,valid:true,outcome:'agent_inconclusive',steps:[],requests:[],usage:[]});

test('abort while model is thinking prevents its completed action and every subsequent decision',async()=>{
  const controller=new AbortController();let calls=0,keys=0;
  const r=report();
  await assert.rejects(runAgent({executor:{execute:async()=>keys++},record:()=>null},r,{
    signal:controller.signal,observeStep:async()=>observation,
    decide:async()=>{calls++;controller.abort(new Error('user_stopped'));return {action:{name:'press_key',arguments:{key:'Enter'}}};}
  }),/user_stopped/);
  assert.equal(calls,1);assert.equal(keys,0);
});
test('aborted keyboard executor never sends a key and user cancellation never certifies a site defect',async()=>{
  const controller=new AbortController();controller.abort(new Error('user_stopped'));let keys=0;
  const executor=createKeyboardExecutor({keyboard:{press:()=>keys++}},{signal:controller.signal});
  await assert.rejects(executor.execute({name:'press_key',arguments:{key:'Enter'}}),/user_stopped/);
  assert.equal(keys,0);assert.equal(executor.used,0);
  const r={...report(),cancelled:true,stop:{reason:'user_stopped',atStep:0},agentResult:{valid:true,reason:'user_stopped'}};
  assert.equal(classifyReport(r,{findings:[{confirmedInControlledFixture:true}]}).outcome,'agent_inconclusive');
  const html=renderReport(r);assert.ok(html.includes('You stopped this run'));assert.ok(html.includes('Checks interrupted by the user'));
  assert.ok(!html.includes('href="evidence/evidence.json"'));
});
test('abort interrupts an in-flight Meta request and prevents the inference after token counting',async()=>{
  const old=process.env.MODEL_API_KEY;process.env.MODEL_API_KEY='synthetic-test-key';
  try{
    const controller=new AbortController();let calls=0;
    await assert.rejects(nextAction([],observation,'Synthetic',{signal:controller.signal,request:async(url,options)=>{
      calls++;assert.ok(options.signal);
      controller.abort(new Error('user_stopped'));
      return {ok:true,status:200,json:async()=>({input_tokens:10})};
    }}),/user_stopped/);
    assert.equal(calls,1);
  }finally{if(old===undefined)delete process.env.MODEL_API_KEY;else process.env.MODEL_API_KEY=old;}
});

test('abort propagates into a pending inference and an interrupted action remains explicit in the report',async()=>{
  const old=process.env.MODEL_API_KEY;process.env.MODEL_API_KEY='synthetic-test-key';
  try{
    const controller=new AbortController();let calls=0;
    const pending=nextAction([],observation,'Synthetic',{signal:controller.signal,request:async(url,options)=>{
      calls++;
      if(url.endsWith('/input_tokens'))return {ok:true,status:200,json:async()=>({input_tokens:10})};
      return new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});controller.abort(new Error('user_stopped'));});
    }});
    await assert.rejects(pending,/user_stopped/);assert.equal(calls,2);
    const html=renderReport({...report(),cancelled:true,interruptedAction:{index:1,action:{name:'press_key',arguments:{key:'Enter'}}}});
    assert.ok(html.includes('Interrupted action'));assert.ok(html.includes('partial trace'));
  }finally{if(old===undefined)delete process.env.MODEL_API_KEY;else process.env.MODEL_API_KEY=old;}
});
