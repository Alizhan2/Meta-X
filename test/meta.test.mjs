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
      await assert.rejects(nextAction([],observation,'test',{request:async()=>({ok:true,status:200,json:async()=>body}),onResponse:item=>metadata.push(item)}));
      assert.equal(metadata.length,1);assert.equal(metadata[0].usage.total_tokens,30);
    }
  }finally{if(old===undefined)delete process.env.MODEL_API_KEY;else process.env.MODEL_API_KEY=old;}
});
