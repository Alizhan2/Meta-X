import test from 'node:test';
import assert from 'node:assert/strict';
import {nextAction,inputTokenLimit} from '../src/meta.mjs';

test('25 decisions retain every executed action while sending only the current observation',async()=>{
  const old=process.env.MODEL_API_KEY;process.env.MODEL_API_KEY='synthetic-test-key';
  let history=[],largest=0;
  try{
    for(let i=0;i<25;i++){
      const request=async(url,options)=>{
        const payload=JSON.parse(options.body);assert.ok(payload.input.length<=5);
        const retained=payload.input.filter(item=>item.type==='reasoning');assert.equal(retained.length,i>0?1:0);if(i>0){assert.equal(retained[0].encrypted_content,'encrypted-test-reasoning-'+(i-1));assert.deepEqual(retained[0].summary,[]);const call=payload.input.find(item=>item.type==='function_call');const result=payload.input.find(item=>item.type==='function_call_output');assert.equal(call.call_id,result.call_id);}
        const content=payload.input.at(-1).content;assert.equal(content.filter(c=>c.type==='input_image').length,1);
        assert.equal(content.at(-1).image_url,'data:image/png;base64,image-'+i);
        assert.ok(content[0].text.includes('snapshot-'+i+'-only'));
        if(i>0)assert.ok(!content[0].text.includes('snapshot-'+(i-1)+'-only'));
        largest=Math.max(largest,options.body.length);
        return {ok:true,status:200,json:async()=>url.endsWith('/input_tokens')?{input_tokens:1000}:{status:'completed',model:'synthetic',output:[{type:'reasoning',encrypted_content:'encrypted-test-reasoning-'+i},{type:'function_call',call_id:'call-'+i,name:'press_key',arguments:'{"key":"Tab"}'}]}};
      };
      const decision=await nextAction(history,{focus:{name:'Field '+i},url:'https://example.com/',semantics:'snapshot-'+i+'-only '+'x'.repeat(12000),screenshot:'image-'+i},'Find a link',{request});
      const before=JSON.stringify(history);
      const next=decision.continueWith({focus:{name:'Field '+(i+1),value:'v'.repeat(5000)},url:'https://example.com/'});
      assert.equal(JSON.stringify(history),before,'memory is immutable');history=next;
      assert.equal(history.actions.length,i+1);assert.equal(history.actions[0].step,1);assert.equal(history.actions.at(-1).step,i+1);
      assert.equal(history.actions.at(-1).focusAfter.value.length,256);
    }
    assert.equal(inputTokenLimit,64000);assert.ok(largest<40000,'request size is not 25 duplicated page snapshots');
  }finally{if(old===undefined)delete process.env.MODEL_API_KEY;else process.env.MODEL_API_KEY=old;}
});

test('facts read before navigation or same-URL activation survive later focus steps without retaining old screenshots',async()=>{
  const old=process.env.MODEL_API_KEY;process.env.MODEL_API_KEY='synthetic-test-key';
  try{
    for(const [version,activation] of [['3.14.1','Enter'],['3.13.7','Escape']]){
      let history=[],lastPayload;
      for(const [i,semantics] of ['Current release: '+version,'Feedback form','Feedback form'].entries()){
        const decision=await nextAction(history,{focus:{name:'Feedback'},url:'https://example.com/',semantics,screenshot:'current-'+i},'Read release and enter it on feedback',{request:async(url,options)=>{
          lastPayload=JSON.parse(options.body);
          return {ok:true,status:200,json:async()=>url.endsWith('/input_tokens')?{input_tokens:100}:{status:'completed',model:'synthetic',output:[{type:'function_call',name:'press_key',arguments:JSON.stringify({key:i===0?activation:'Tab'})}]}};
        }});
        history=decision.continueWith({focus:{name:'Feedback field'},url:'https://example.com/'});
      }
      assert.ok(JSON.stringify(lastPayload).includes(version));assert.equal(history.pages.length,1);
      assert.equal(lastPayload.input.at(-1).content.filter(item=>item.type==='input_image').length,1);
    }
  }finally{if(old===undefined)delete process.env.MODEL_API_KEY;else process.env.MODEL_API_KEY=old;}
});

test('page memory stays capped at three explicitly clipped excerpts',async()=>{
  const old=process.env.MODEL_API_KEY;process.env.MODEL_API_KEY='synthetic-test-key';let history=[];
  try{
    for(let i=0;i<6;i++){
      const decision=await nextAction(history,{focus:{},url:'https://example.com/'+i,semantics:'page-'+i+' '+ 'x'.repeat(15000),screenshot:'current'},'Read a fact',{request:async url=>({ok:true,status:200,json:async()=>url.endsWith('/input_tokens')?{input_tokens:1000}:{status:'completed',model:'synthetic',output:[{type:'function_call',name:'press_key',arguments:'{"key":"Enter"}'}]}})});
      history=decision.continueWith({focus:{},url:'https://example.com/'+(i+1)});
      assert.ok(history.pages.length<=3);
      assert.ok(history.pages.every(page=>page.text.length===12000&&page.clipped===true));
    }
    assert.equal(history.actions.length,6);assert.deepEqual(history.pages.map(page=>page.url),['https://example.com/3','https://example.com/4','https://example.com/5']);
  }finally{if(old===undefined)delete process.env.MODEL_API_KEY;else process.env.MODEL_API_KEY=old;}
});
