import {chromium} from 'playwright';
import {createKeyboardExecutor} from './keyboard.mjs';
import {createTargetProxy} from './target.mjs';

async function waitForRender(page){
  const handle=await page.waitForFunction(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(document.readyState!=='loading')))),null,{timeout:5000});
  await handle.dispose();
}

export async function openSession(app, variant, {budget = 25,signal} = {}) {
  signal?.throwIfAborted();
  const browser = await chromium.launch({headless:true, ...(process.env.BROWSER_EXECUTABLE_PATH ? {executablePath:process.env.BROWSER_EXECUTABLE_PATH} : {})});
  const abort=()=>{void browser.close().catch(()=>{});};
  signal?.addEventListener('abort',abort,{once:true});
  try {
    signal?.throwIfAborted();
    const context = await browser.newContext({viewport:{width:1180,height:960}, reducedMotion:'reduce', serviceWorkers:'block'});
    const id = app.createSession(variant);
    await context.addCookies([{name:'session',value:id,url:app.origin,httpOnly:true,sameSite:'Strict'}]);
    await context.route('**/*', route => {
      const url=new URL(route.request().url());
      if(url.origin===app.origin && ['/booking','/style.css','/api/book','/favicon.ico'].includes(url.pathname)) return route.continue();
      return route.abort();
    });
    const page=await context.newPage();
    let pendingBooking=null;
    page.on('request',request=>{
      if(request.method()==='POST'&&new URL(request.url()).pathname==='/api/book'){
        // Wait on the request's response promise rather than Request wrapper identity.
        pendingBooking=request.response().then(response=>{
          if(!response)throw new Error('booking_request_failed');
          if(!response.ok())throw new Error('booking_http_'+response.status());
        });
        // Observe rejection immediately; the action boundary still receives it below.
        pendingBooking.catch(()=>{});
      }
    });
    await page.goto(app.origin+'/booking');
    await page.waitForFunction(()=>document.activeElement?.id==='name');
    const executor=createKeyboardExecutor(page,{budget,signal,afterAction:async()=>{
      await waitForRender(page);
      if(pendingBooking){
        let timer;
        try{await Promise.race([pendingBooking,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('booking_settlement_timeout')),5000)})]);}
        finally{clearTimeout(timer);pendingBooking=null;}
        await waitForRender(page);
      }
    }});
    return {page, executor, record:()=>app.getRecord(id), close:async()=>{signal?.removeEventListener('abort',abort);await browser.close();}};
  } catch(error) {signal?.removeEventListener('abort',abort);await browser.close();throw error;}
}

export async function observe(page, screenshotPath) {
  const screenshot=await page.screenshot({path:screenshotPath});
  const focus=await readFocus(page);
  const semantics=await page.locator('body').ariaSnapshot();
  const viewport=await page.evaluate(()=>({scrollX,scrollY}));
  return {screenshot:screenshot.toString('base64'),focus,semantics,viewport,url:page.url()};
}

export async function readFocus(page){
  return page.evaluate(()=>{
    const el=document.activeElement;
    return {id:el?.id||null,tag:el?.tagName||null,role:el?.getAttribute('role')||null,name:el?.tagName==='BODY'||el?.tagName==='HTML'?'Page':el?.getAttribute('aria-label')||el?.labels?.[0]?.innerText||el?.innerText?.trim().slice(0,160)||'',value:el && 'value' in el?el.value:null,selectionStart:el?.selectionStart??null,selectionEnd:el?.selectionEnd??null};
  });
}

export function allowsTargetNavigation(target,candidate){
  const initial=new URL(target),next=new URL(candidate);
  if(next.username||next.password||!['http:','https:'].includes(next.protocol))return false;
  if(initial.origin===next.origin)return true;
  const base=host=>host.replace(/^www\./,'');
  return base(initial.hostname)===base(next.hostname)&&!initial.port&&!next.port&&(initial.protocol===next.protocol||initial.protocol==='http:'&&next.protocol==='https:');
}

export async function openWebsiteSession(targetUrl,{budget=25,signal,controlOrigins=[],closeOnAbort=true}={}){
  signal?.throwIfAborted();
  const proxy=await createTargetProxy({targetUrl,controlOrigins,signal});
  let browser;
  const abort=()=>{void browser?.close().catch(()=>{});};
  try{
    browser=await chromium.launch({headless:true,proxy:{server:proxy.server,bypass:'<-loopback>'},args:['--disable-quic','--force-webrtc-ip-handling-policy=disable_non_proxied_udp','--webrtc-ip-handling-policy=disable_non_proxied_udp'],...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
    if(closeOnAbort)signal?.addEventListener('abort',abort,{once:true});signal?.throwIfAborted();
    const context=await browser.newContext({viewport:{width:1180,height:960},reducedMotion:'reduce',serviceWorkers:'block',acceptDownloads:false});
    const page=await context.newPage();page.setDefaultTimeout(10000);
    let scopeOrigin=null;
    await context.route('**/*',route=>{
      const request=route.request();let url;try{url=new URL(request.url());}catch{return route.abort();}
      if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return route.abort();
      if(request.isNavigationRequest()&&request.frame()===page.mainFrame()){
        if(scopeOrigin?url.origin!==scopeOrigin:!allowsTargetNavigation(targetUrl,url.href))return route.abort();
      }
      return route.continue();
    });
    context.on('page',popup=>{if(popup!==page)void popup.close().catch(()=>{});});
    context.on('dialog',dialog=>void dialog.dismiss().catch(()=>{}));
    const pending=new Set();
    page.on('request',request=>{
      if(['document','fetch','xhr'].includes(request.resourceType())){
        const settled=request.response().then(response=>response?.finished()).catch(()=>{}).finally(()=>pending.delete(settled));pending.add(settled);
      }
    });
    const response=await page.goto(targetUrl,{waitUntil:'domcontentloaded',timeout:30000});
    if(response&&response.status()>=400)throw new Error('target_http_'+response.status());
    scopeOrigin=new URL(page.url()).origin;
    await waitForRender(page);
    const executor=createKeyboardExecutor(page,{budget,signal,afterAction:async()=>{
      await waitForRender(page);
      if(pending.size){let timer;try{await Promise.race([Promise.allSettled([...pending]),new Promise(resolve=>{timer=setTimeout(resolve,1800)})]);}finally{clearTimeout(timer);}}
      await waitForRender(page);
    }});
    return {page,executor,record:()=>null,close:async()=>{signal?.removeEventListener('abort',abort);try{await browser.close();}finally{await proxy.close();}}};
  }catch(error){signal?.removeEventListener('abort',abort);try{await browser?.close();}finally{await proxy.close();}throw error;}
}
