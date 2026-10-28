import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createKeyboardExecutor} from '../src/keyboard.mjs';
import {createReactAriaExample} from '../examples/react-aria-scroll/server.mjs';
import {readReadingState,settleReadingScroll,readingContract} from './react-aria-contract.mjs';

export async function checkReactAriaScroll({condition='matrix',output=resolve('output/playwright',`react-aria-check-${Date.now()}`),signal,onUpdate=()=>{}}={}){
signal?.throwIfAborted();
assert.ok(['matrix','original','corrected'].includes(condition));
output=resolve(output);await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
// Local harness operations finish at bounded await boundaries. Closing the
// browser in an abort listener races Playwright's response transport binding.
const results=[];
let failure,metadata,partial;
const keySequence=['Tab','Enter','Tab','End','Escape'];
const hash=async path=>createHash('sha256').update(await readFile(path)).digest('hex');
try{
  signal?.throwIfAborted();
  for(const corrected of condition==='matrix'?[false,true]:[condition==='corrected']){
    signal?.throwIfAborted();
    const name=corrected?'corrected':'original';
    onUpdate({phase:name,condition:name});
    const app=await createReactAriaExample({corrected});
    try{
      for(let repeat=1;repeat<=(condition==='matrix'?3:1);repeat++){
        signal?.throwIfAborted();
        const label=`${corrected?'corrected':'original'}-${repeat}`;
        const context=await browser.newContext({viewport:{width:1180,height:960},reducedMotion:'reduce'});
        try{
          context.setDefaultTimeout(5000);context.setDefaultNavigationTimeout(5000);signal?.throwIfAborted();
          await context.tracing.start({screenshots:true,snapshots:true,sources:true});
          const page=await context.newPage();signal?.throwIfAborted();
          await page.goto(app.origin);signal?.throwIfAborted();await page.locator('#open-reading').waitFor();
          const errors=[];page.on('pageerror',error=>errors.push(error.message));
          const executor=createKeyboardExecutor(page,{signal,afterAction:()=>settleReadingScroll(page)});
          const states=[await readReadingState(page)],actions=[];
          partial={condition:name,repeat,passed:false,incomplete:true,actions,errors};
          for(const key of keySequence){
            signal?.throwIfAborted();
            const executed=await executor.execute({name:'press_key',arguments:{key}});
            const state=await readReadingState(page);states.push(state);actions.push({...executed,state});
            if(key==='End')await page.screenshot({path:resolve(output,`${label}.png`)});
          }
          const contract=readingContract(states);const passed=Object.values(contract).every(Boolean);
          results.push({condition:corrected?'corrected':'original',repeat,passed,contract,actions,errors});
          partial=null;
          assert.deepEqual(errors,[]);
          // Same requirement in both variants; matrix mode expects the original
          // assertion to fail. A standalone original run exits with status 1.
          if(condition==='matrix')assert.equal(passed,corrected,`${label}: unexpected keyboard result`);
          if(!corrected){
            assert.equal(Math.max(...states.map(s=>s.scrollTop||0)),0);
            // Positive pointer control, deliberately outside the keyboard-only
            // test and never exposed as an agent action.
            signal?.throwIfAborted();await page.keyboard.press('Enter');await page.locator('#reading-panel').waitFor();
            const bounds=await page.locator('#reading-panel').boundingBox();
            signal?.throwIfAborted();await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
            signal?.throwIfAborted();await page.mouse.wheel(0,900);const pointer=await settleReadingScroll(page);
            assert.ok(pointer.scrollTop>0,'Original panel must still support real pointer scrolling');
            results.at(-1).pointerControl={scrollTop:pointer.scrollTop,passed:true};
          }
          await context.tracing.stop({path:resolve(output,`${label}-trace.zip`)});
          onUpdate({phase:name,condition:name,result:results.at(-1),screenshot:resolve(output,`${label}.png`)});
        }finally{await context.close();}
      }
      if(!corrected){
        signal?.throwIfAborted();onUpdate({phase:'controls',condition:name});
        const context=await browser.newContext({viewport:{width:1180,height:960},reducedMotion:'reduce'});
        try{
          context.setDefaultTimeout(5000);context.setDefaultNavigationTimeout(5000);signal?.throwIfAborted();
          const page=await context.newPage();signal?.throwIfAborted();
          await page.goto(app.origin+'/native');signal?.throwIfAborted();await page.locator('#reading-panel').waitFor();
          const executor=createKeyboardExecutor(page,{signal,afterAction:()=>settleReadingScroll(page)});
          for(const key of ['Tab','Tab','End']){signal?.throwIfAborted();await executor.execute({name:'press_key',arguments:{key}});}
          const state=await readReadingState(page);assert.equal(state.panelFocused,true);assert.equal(state.atEnd,true);
          results.push({condition:'native-control',passed:true,state});
          onUpdate({phase:'controls',condition:name,result:results.at(-1)});
        }finally{await context.close();}
      }
    }finally{await app.close();}
  }
}catch(error){failure=signal?.aborted?(signal.reason||error):error;if(partial)results.push(partial);}
finally{
  try{await browser.close();}catch(error){failure??=error;}
  const lock=JSON.parse(await readFile(new URL('../examples/react-aria-scroll/package-lock.json',import.meta.url),'utf8'));
  metadata={schema:1,checkedAt:new Date().toISOString(),scope:'Known upstream React Aria issue 10395 reproduced with the unmodified pinned npm package; explicit tabIndex=0 is an application integration workaround, not an upstream library patch. Deterministic checks; no model calls.',upstreamIssue:'https://github.com/adobe/react-spectrum/issues/10395',browserVersion:browser.version(),nodeVersion:process.version,platform:process.platform,architecture:process.arch,component:lock.packages['node_modules/react-aria-components'],sources:{app:await hash(new URL('../examples/react-aria-scroll/app.jsx',import.meta.url)),lock:await hash(new URL('../examples/react-aria-scroll/package-lock.json',import.meta.url)),contract:await hash(new URL('react-aria-contract.mjs',import.meta.url)),test:await hash(new URL('check-react-aria-scroll.mjs',import.meta.url))},keyboardSequence:keySequence,results,...(failure?{incomplete:true,error:signal?.aborted?'user_stopped':failure.message}:{})};
  await writeFile(resolve(output,'results.json'),JSON.stringify(metadata,null,2)+'\n');
}
if(failure)throw failure;
signal?.throwIfAborted();
return {metadata,output,passed:condition==='matrix'||results.filter(r=>r.condition===condition).every(r=>r.passed)};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const controller=new AbortController(),stop=()=>controller.abort(new Error('user_stopped'));
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try{
    const condition=process.argv.find(arg=>arg.startsWith('--condition='))?.split('=')[1]||'matrix';
    const {metadata,output,passed}=await checkReactAriaScroll({condition,signal:controller.signal});
    console.log(JSON.stringify({condition,output,results:metadata.results.map(({condition,repeat,passed,contract,pointerControl})=>({condition,repeat,passed,contract,pointerControl}))},null,2));
    if(!passed)process.exitCode=1;
  }finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
}
