import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

// Verify an actual UI download in a fresh browser context with networking disabled.
export async function checkOfflineDownload({page,browser,button,path,id,expectedText,minimumImages=1,screenshot}){
  await button.waitFor({state:'visible'});
  const event=page.waitForEvent('download');await button.click();const download=await event;
  assert.equal(download.suggestedFilename(),`tabproof-${id}.html`);await download.saveAs(path);
  assert.equal(await download.failure(),null);
  const html=await readFile(path,'utf8'),context=await browser.newContext({offline:true,viewport:{width:1440,height:1000}});
  try{
    const offline=await context.newPage(),errors=[],network=[];
    offline.on('pageerror',error=>errors.push(error.message));offline.on('request',request=>{if(/^https?:/.test(request.url()))network.push(request.url());});
    await offline.goto(pathToFileURL(path).href);
    assert.ok((await offline.locator('main').innerText()).includes('Offline evidence copy'));
    assert.ok((await offline.locator('main').innerText()).includes(expectedText));
    const images=await offline.locator('img').evaluateAll(images=>images.map(image=>({ready:image.complete&&image.naturalWidth>0,embedded:image.src.startsWith('data:image/png;base64,')})));
    assert.ok(images.length>=minimumImages);assert.ok(images.every(image=>image.ready&&image.embedded));
    assert.equal(await offline.locator('script').count(),0);
    assert.equal(await offline.locator('a[href^="/"],a[href^="http://127.0.0.1"],a[href^="http://localhost"]').count(),0);
    const jsonLink=await offline.locator('a[download$="-report.json"]').getAttribute('href');
    const json=JSON.parse(Buffer.from(jsonLink.split(',')[1],'base64').toString('utf8'));assert.equal(json.runId,id);
    assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
    const snapshot=offline.locator('a[href^="#snapshot-"]').first();
    if(await snapshot.count()){await snapshot.click();assert.equal(await offline.locator(':target').count(),1);}
    if(screenshot)await offline.screenshot({path:screenshot,fullPage:true});
    await offline.setViewportSize({width:390,height:844});assert.ok(await offline.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    return {id,images:images.length,offline:true,networkRequests:network.length,pageErrors:errors,rawReportIncluded:true,missingEvidenceNotice:html.includes('Incomplete evidence:')};
  }finally{await context.close();}
}
