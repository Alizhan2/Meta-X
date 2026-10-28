import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createKeyboardExecutor} from '../src/keyboard.mjs';
import {createRadixToastExample} from '../examples/radix-toast/server.mjs';
import {readToastState,settleToast,toastContract,toastKeyboardSequence} from './radix-toast-contract.mjs';

export async function checkRadixToast({condition='matrix',output=resolve('output/playwright',`radix-toast-check-${Date.now()}`),signal,onUpdate=()=>{}}={}){
signal?.throwIfAborted();
assert.ok(['matrix','original','corrected'].includes(condition));
output=resolve(output);await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
// Observe cancellation between bounded local operations; do not close the
// browser while Playwright is binding an in-flight navigation response.
const results=[];
let failure,metadata,partial;
try{
  signal?.throwIfAborted();
  for(const corrected of condition==='matrix'?[false,true]:[condition==='corrected']){
    signal?.throwIfAborted();const name=corrected?'corrected':'original';
    onUpdate({phase:name,condition:name});
    const app=await createRadixToastExample({corrected});
    const fresh=async()=>{
      signal?.throwIfAborted();
      const context=await browser.newContext({viewport:{width:1180,height:960},reducedMotion:'reduce'});
      try{
        context.setDefaultTimeout(5000);context.setDefaultNavigationTimeout(5000);signal?.throwIfAborted();
        const page=await context.newPage();signal?.throwIfAborted();
        await page.goto(app.origin);signal?.throwIfAborted();await page.locator('#toast-draft').waitFor();
        assert.deepEqual((await readToastState(page)).open,['draft','sync','upload']);
        return {context,page,executor:createKeyboardExecutor(page,{signal,afterAction:()=>settleToast(page)})};
      }catch(error){await context.close();throw error;}
    };
    try{
      for(let repeat=1;repeat<=(condition==='matrix'?3:1);repeat++){
        signal?.throwIfAborted();
        const {context,page,executor}=await fresh();
        const errors=[];page.on('pageerror',error=>errors.push(error.message));
        try{
          await context.tracing.start({screenshots:true,snapshots:true,sources:true});
          const initial=await readToastState(page),actions=[];
          partial={condition:name,version:app.version,repeat,passed:false,incomplete:true,initial,actions,errors};
          for(const key of toastKeyboardSequence){
            signal?.throwIfAborted();
            const before=await readToastState(page);
            const step=await executor.execute({name:'press_key',arguments:{key}});
            actions.push({...step,before,after:await readToastState(page)});
          }
          const final=await readToastState(page),contract=toastContract(initial,actions,final);
          const passed=Object.values(contract).every(Boolean);
          assert.deepEqual(errors,[]);
          await page.screenshot({path:resolve(output,`${corrected?'corrected':'original'}-${repeat}.png`)});
          await context.tracing.stop({path:resolve(output,`${corrected?'corrected':'original'}-${repeat}-trace.zip`)});
          results.push({condition:corrected?'corrected':'original',version:app.version,repeat,passed,contract,initial,final,actions,errors});
          partial=null;
          if(condition==='matrix')assert.equal(passed,corrected);
          assert.equal(actions.at(-1).before.focusedToast,'draft');
          assert.deepEqual(final.open,corrected?['sync','upload']:['upload']);
          onUpdate({phase:name,condition:name,result:results.at(-1),screenshot:resolve(output,`${name}-${repeat}.png`)});
        }finally{await context.close();}
      }
      // Same scenario with focus on the middle toast: protects against a
      // result that depends solely on a host ID or one notification position.
      {
        signal?.throwIfAborted();onUpdate({phase:'controls',condition:name});
        const {context,page,executor}=await fresh();
        try{
          for(const key of ['Tab','Tab','Tab','Tab']){signal?.throwIfAborted();await executor.execute({name:'press_key',arguments:{key}});}
          assert.equal((await readToastState(page)).focusedToast,'upload');
          await executor.execute({name:'press_key',arguments:{key:'Escape'}});
          const state=await readToastState(page);assert.deepEqual(state.open,corrected?['draft','sync']:['draft']);
          results.push({condition:'middle-toast-control',version:app.version,passed:true,state});
          onUpdate({phase:'controls',condition:name,result:results.at(-1)});
        }finally{await context.close();}
      }
      // Positive controls, separate from the keyboard-only agent interface.
      for(const kind of ['pointer-close','outside-escape']){
        signal?.throwIfAborted();
        const {context,page,executor}=await fresh();
        try{
          if(kind==='pointer-close')await page.getByRole('button',{name:'Dismiss Draft saved',exact:true}).click();
          else {await executor.execute({name:'press_key',arguments:{key:'Tab'}});await executor.execute({name:'press_key',arguments:{key:'Escape'}});}
          await settleToast(page);const state=await readToastState(page);
          assert.deepEqual(state.open,kind==='pointer-close'?['sync','upload']:['draft','upload']);
          results.push({condition:kind,version:app.version,passed:true,state});
          onUpdate({phase:'controls',condition:name,result:results.at(-1)});
        }finally{await context.close();}
      }
    }finally{await app.close();}
  }
}catch(error){failure=signal?.aborted?(signal.reason||error):error;if(partial)results.push(partial);}
finally{
  try{await browser.close();}catch(error){failure??=error;}
  const lock=JSON.parse(await readFile('examples/radix-toast/package-lock.json','utf8'));
  const sources={};for(const file of ['examples/radix-toast/app.jsx','examples/radix-toast/style.css','examples/radix-toast/server.mjs','examples/radix-toast/package-lock.json','scripts/radix-toast-contract.mjs','scripts/check-radix-toast.mjs'])sources[file]=createHash('sha256').update(await readFile(file)).digest('hex');
  metadata={schema:1,checkedAt:new Date().toISOString(),scope:'Known Radix issue 2906 reproduced with actual unmodified npm packages. Correction upgrades Toast 1.2.19 to 1.2.20 and its pinned transitive dependency graph; host JSX/CSS stay identical. No model calls.',upstreamIssue:'https://github.com/radix-ui/primitives/issues/2906',upstreamFix:'https://github.com/radix-ui/primitives/pull/4005',browserVersion:browser.version(),nodeVersion:process.version,platform:process.platform,architecture:process.arch,components:{original:lock.packages['node_modules/radix-toast-original'],corrected:lock.packages['node_modules/radix-toast-corrected']},sources,keyboardSequence:toastKeyboardSequence,results,...(failure?{incomplete:true,error:signal?.aborted?'user_stopped':failure.message}:{})};
  await writeFile(resolve(output,'results.json'),JSON.stringify(metadata,null,2)+'\n');
}
if(failure)throw failure;signal?.throwIfAborted();
return {metadata,output,passed:condition==='matrix'||results.filter(r=>r.condition===condition).every(r=>r.passed)};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const controller=new AbortController(),stop=()=>controller.abort(new Error('user_stopped'));
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try{
    const condition=process.argv.find(arg=>arg.startsWith('--condition='))?.split('=')[1]||'matrix';
    const {metadata,output,passed}=await checkRadixToast({condition,signal:controller.signal});
    console.log(JSON.stringify({condition,output,results:metadata.results.map(({condition,version,repeat,passed,contract,final,state})=>({condition,version,repeat,passed,contract,remaining:(final||state)?.open}))},null,2));
    if(!passed)process.exitCode=1;
  }finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
}
