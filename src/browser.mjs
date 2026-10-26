import {chromium} from 'playwright';
import {createKeyboardExecutor} from './keyboard.mjs';

export async function openSession(app, variant, {budget = 25} = {}) {
  const browser = await chromium.launch({headless:true, ...(process.env.BROWSER_EXECUTABLE_PATH ? {executablePath:process.env.BROWSER_EXECUTABLE_PATH} : {})});
  try {
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
    const executor=createKeyboardExecutor(page,{budget,afterAction:async()=>{
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      if(pendingBooking){
        let timer;
        try{await Promise.race([pendingBooking,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('booking_settlement_timeout')),5000)})]);}
        finally{clearTimeout(timer);pendingBooking=null;}
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      }
    }});
    return {page, executor, record:()=>app.getRecord(id), close:()=>browser.close()};
  } catch(error) {await browser.close();throw error;}
}

export async function observe(page, screenshotPath) {
  const screenshot=await page.screenshot({path:screenshotPath});
  const focus=await page.evaluate(()=>{
    const el=document.activeElement;
    return {id:el?.id||null,tag:el?.tagName||null,role:el?.getAttribute('role')||null,name:el?.getAttribute('aria-label')||el?.labels?.[0]?.textContent||el?.textContent?.trim().slice(0,160)||'',value:el && 'value' in el?el.value:null};
  });
  const semantics=await page.locator('body').ariaSnapshot();
  return {screenshot:screenshot.toString('base64'),focus,semantics};
}
