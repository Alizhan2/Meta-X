import test from 'node:test';
import assert from 'node:assert/strict';
import {nextAction} from '../src/meta.mjs';

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
