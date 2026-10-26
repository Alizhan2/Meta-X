import test from 'node:test';
import assert from 'node:assert/strict';
import {nextAction} from '../src/meta.mjs';

test('only a strict completed blocked message is accepted as a terminal decision',async()=>{
  const old=process.env.MODEL_API_KEY;process.env.MODEL_API_KEY='synthetic-test-key';
  try{
    for(const [terminal,accepted] of [
      [{status:'blocked',reason:'Escape has no effect and no close control is reachable.'},true],
      [{status:'success',reason:'Done'},false],
      [{status:'blocked',reason:''},false],
      [{status:'blocked',reason:'x'.repeat(241)},false],
      [{status:'blocked',reason:'Blocked',action:'click'},false]
    ]){
      const body={status:'completed',model:'test',usage:{total_tokens:10},output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(terminal)}]}]};
      const request=async url=>({ok:true,status:200,json:async()=>url.endsWith('/input_tokens')?{input_tokens:100}:body});
      const promise=nextAction([],{focus:{},semantics:'Synthetic',screenshot:''},'test',{request});
      if(accepted){const result=await promise;assert.equal(result.kind,'stop');assert.equal(result.action,undefined);}
      else await assert.rejects(promise,/model_expected_one_action/);
    }
  }finally{if(old===undefined)delete process.env.MODEL_API_KEY;else process.env.MODEL_API_KEY=old;}
});

test('usage is captured before rejecting missing, malformed or incomplete actions',async()=>{
  const old=process.env.MODEL_API_KEY;process.env.MODEL_API_KEY='synthetic-test-key';
  const observation={focus:{},semantics:'Synthetic page',screenshot:''};
  try{
    for(const body of [
      {status:'completed',model:'test',usage:{total_tokens:30},output:[]},
      {status:'incomplete',model:'test',usage:{total_tokens:30},output:[]},
      {status:'completed',model:'test',usage:{total_tokens:30},output:[{type:'function_call',name:'click',arguments:'{}'}]},
      {status:'completed',model:'test',usage:{total_tokens:30},output:[{type:'function_call',name:'type_text',arguments:'not JSON'}]}
    ]){
      const metadata=[];
      await assert.rejects(nextAction([],observation,'test',{request:async url=>({ok:true,status:200,json:async()=>url.endsWith('/input_tokens')?{input_tokens:100}:body}),onResponse:item=>metadata.push(item)}));
      assert.equal(metadata.filter(item=>item.usage).length,1);assert.equal(metadata.find(item=>item.usage).usage.total_tokens,30);
    }
  }finally{if(old===undefined)delete process.env.MODEL_API_KEY;else process.env.MODEL_API_KEY=old;}
});
test('preflight refuses oversized input before any inference is sent',async()=>{
  const old=process.env.MODEL_API_KEY;process.env.MODEL_API_KEY='synthetic-test-key';const urls=[];
  try{
    await assert.rejects(nextAction([],{focus:{},semantics:'',screenshot:''},'test',{request:async url=>{urls.push(url);return {ok:true,status:200,json:async()=>({input_tokens:64001})};}}),/input_token_limit/);
    assert.deepEqual(urls,['https://api.meta.ai/v1/responses/input_tokens']);
  }finally{if(old===undefined)delete process.env.MODEL_API_KEY;else process.env.MODEL_API_KEY=old;}
});

test('mixed stop plus action and incomplete terminal messages remain invalid',async()=>{
  const old=process.env.MODEL_API_KEY;process.env.MODEL_API_KEY='synthetic-test-key';
  try{
    const message={type:'message',role:'assistant',content:[{type:'output_text',text:'{"status":"blocked","reason":"No keyboard path"}'}]};
    for(const body of [
      {status:'completed',output:[message,{type:'function_call',name:'press_key',arguments:'{"key":"Enter"}'}]},
      {status:'incomplete',output:[message]}
    ]){
      await assert.rejects(nextAction([],{focus:{},semantics:'',screenshot:''},'test',{request:async url=>({ok:true,status:200,json:async()=>url.endsWith('/input_tokens')?{input_tokens:100}:body})}),/model_mixed_stop_and_action|model_incomplete/);
    }
  }finally{if(old===undefined)delete process.env.MODEL_API_KEY;else process.env.MODEL_API_KEY=old;}
});
