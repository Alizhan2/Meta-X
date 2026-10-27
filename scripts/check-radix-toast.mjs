import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {createKeyboardExecutor} from '../src/keyboard.mjs';
import {createRadixToastExample} from '../examples/radix-toast/server.mjs';
import {readToastState,settleToast,toastContract,toastKeyboardSequence} from './radix-toast-contract.mjs';

const condition=process.argv.find(arg=>arg.startsWith('--condition='))?.split('=')[1]||'matrix';
assert.ok(['matrix','original','corrected'].includes(condition));
const output=resolve('output/playwright',`radix-toast-check-${Date.now()}`);await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
const results=[];
try{
  for(const corrected of condition==='matrix'?[false,true]:[condition==='corrected']){
    const app=await createRadixToastExample({corrected});
    const fresh=async()=>{
      const context=await browser.newContext({viewport:{width:1180,height:960},reducedMotion:'reduce'});
      const page=await context.newPage();await page.goto(app.origin);await page.locator('#toast-draft').waitFor();
      assert.deepEqual((await readToastState(page)).open,['draft','sync','upload']);
      return {context,page,executor:createKeyboardExecutor(page,{afterAction:()=>settleToast(page)})};
    };
    try{
      for(let repeat=1;repeat<=(condition==='matrix'?3:1);repeat++){
        const {context,page,executor}=await fresh();
        const errors=[];page.on('pageerror',error=>errors.push(error.message));
        try{
          await context.tracing.start({screenshots:true,snapshots:true,sources:true});
          const initial=await readToastState(page),actions=[];
          for(const key of toastKeyboardSequence){
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
          if(condition==='matrix')assert.equal(passed,corrected);
          else if(!passed)process.exitCode=1;
          assert.equal(actions.at(-1).before.focusedToast,'draft');
          assert.deepEqual(final.open,corrected?['sync','upload']:['upload']);
        }finally{await context.close();}
      }
      // Same scenario with focus on the middle toast: protects against a
      // result that depends solely on a host ID or one notification position.
      {
        const {context,page,executor}=await fresh();
        try{
          for(const key of ['Tab','Tab','Tab','Tab'])await executor.execute({name:'press_key',arguments:{key}});
          assert.equal((await readToastState(page)).focusedToast,'upload');
          await executor.execute({name:'press_key',arguments:{key:'Escape'}});
          const state=await readToastState(page);assert.deepEqual(state.open,corrected?['draft','sync']:['draft']);
          results.push({condition:'middle-toast-control',version:app.version,passed:true,state});
        }finally{await context.close();}
      }
      // Positive controls, separate from the keyboard-only agent interface.
      for(const kind of ['pointer-close','outside-escape']){
        const {context,page,executor}=await fresh();
        try{
          if(kind==='pointer-close')await page.getByRole('button',{name:'Dismiss Draft saved',exact:true}).click();
          else {await executor.execute({name:'press_key',arguments:{key:'Tab'}});await executor.execute({name:'press_key',arguments:{key:'Escape'}});}
          await settleToast(page);const state=await readToastState(page);
          assert.deepEqual(state.open,kind==='pointer-close'?['sync','upload']:['draft','upload']);
          results.push({condition:kind,version:app.version,passed:true,state});
        }finally{await context.close();}
      }
    }finally{await app.close();}
  }
  const lock=JSON.parse(await readFile('examples/radix-toast/package-lock.json','utf8'));
  const sources={};for(const file of ['examples/radix-toast/app.jsx','examples/radix-toast/style.css','examples/radix-toast/server.mjs','examples/radix-toast/package-lock.json','scripts/radix-toast-contract.mjs','scripts/check-radix-toast.mjs'])sources[file]=createHash('sha256').update(await readFile(file)).digest('hex');
  const metadata={schema:1,checkedAt:new Date().toISOString(),scope:'Known Radix issue 2906 reproduced with actual unmodified npm packages. Correction upgrades Toast 1.2.19 to 1.2.20 and its pinned transitive dependency graph; host JSX/CSS stay identical. No model calls.',upstreamIssue:'https://github.com/radix-ui/primitives/issues/2906',upstreamFix:'https://github.com/radix-ui/primitives/pull/4005',browserVersion:browser.version(),nodeVersion:process.version,platform:process.platform,architecture:process.arch,components:{original:lock.packages['node_modules/radix-toast-original'],corrected:lock.packages['node_modules/radix-toast-corrected']},sources,keyboardSequence:toastKeyboardSequence,results};
  await writeFile(resolve(output,'results.json'),JSON.stringify(metadata,null,2)+'\n');
  console.log(JSON.stringify({condition,output,results:results.map(({condition,version,repeat,passed,contract,final,state})=>({condition,version,repeat,passed,contract,remaining:(final||state)?.open}))},null,2));
}finally{await browser.close();}
