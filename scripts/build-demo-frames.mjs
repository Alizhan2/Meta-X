import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('output/playwright/demo-3min');await mkdir(root,{recursive:true});
const scenes=JSON.parse(await readFile('docs/demo-3min/scenes.json','utf8'));
assert.equal(scenes.reduce((n,s)=>n+s.duration,0),180);
const source=resolve('output/playwright/agent-1793447041673720000');
const details=JSON.parse(await readFile(resolve(source,'details.json'),'utf8'));
const report=JSON.parse(await readFile(resolve(source,'report.json'),'utf8'));
assert.equal(report.executionMode,'meta-live');assert.equal(report.comparison.verified,true);
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const img=async path=>'data:image/png;base64,'+(await readFile(path)).toString('base64');
const shot=async ref=>{const [side,file]=ref.split(':');return img(resolve(source,'agent',details[side].agentReport.runId,file));};
const frames=[];
try{
 await page.goto('http://127.0.0.1:3000/?run=agent-1793447041673720000');await page.locator('#comparison-download').waitFor({state:'visible'});
 await page.locator('#comparison-view').screenshot({path:resolve(root,'workbench.png')});
 for(const [i,s] of scenes.entries()){
  const steps=s.route?report.comparison.discovery.steps:[null];
  for(const [j,step] of steps.entries()){
   let media='';
   if(s.image)media=`<img src="${await shot(s.image)}">`;
   if(s.route)media=`<img src="${await shot('original:'+String(j).padStart(2,'0')+'-after.png')}"><div class="key">${j+1} / ${steps.length} · ${e(step.action.arguments.key||'Type text')} → ${e(step.focusAfter.name)}</div>`;
   if(s.code)media='<div class="code"><span class="removed">− preview.addEventListener(\'cancel\',<br>    event =&gt; event.preventDefault());</span><br><br><span class="added">+ Use native dialog dismissal.</span><p>Controlled demo • only this handler differs</p></div>';
   if(s.pair)media=`<div class="pair"><div><strong>BEFORE · Escape failed</strong><img src="${await img(resolve(source,'original.png'))}"></div><div><strong>AFTER · Escape passed</strong><img src="${await img(resolve(source,'corrected.png'))}"></div></div>`;
   if(s.table)media='<table><tr><th>Pair</th><th>Meta actions<br>before / after</th><th>First Escape<br>before / after</th></tr><tr><td>1</td><td>20 / 21</td><td><b>Fail</b> / Pass</td></tr><tr><td>2</td><td>20 / 17</td><td><b>Fail</b> / Pass</td></tr><tr><td>3</td><td>22 / 17</td><td><b>Fail</b> / Pass</td></tr></table>';
   if(s.workbench)media=`<img src="${await img(resolve(root,'workbench.png'))}">`;
   const full=s.pair||s.table||s.workbench;
   await page.setContent(`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;width:1920px;height:1080px;background:#edf3f2;color:#173c45;font:30px/1.45 Arial,sans-serif;padding:48px 70px}header{display:flex;justify-content:space-between;border-bottom:2px solid #c4d5d5;padding-bottom:20px;font-size:25px}header b{font-size:34px}header span{color:#506e76}.tag{color:#2455cf;font-weight:bold;font-size:23px;letter-spacing:1px;margin:35px 0 20px}h1{font-size:${full?48:64}px;line-height:1.1;margin:0 0 25px;max-width:1550px}.content{display:${full?'block':'grid'};grid-template-columns:41% 56%;gap:3%;height:${full?650:710}px}.intro{display:flex;flex-direction:column;justify-content:center}.intro p{font-size:31px;white-space:pre-line}.full p{font-size:27px;margin:0 0 18px}.media{position:relative;min-height:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px}.media img{display:block;max-width:100%;max-height:${full?530:690}px;object-fit:contain;border:1px solid #c4d5d5;border-radius:8px;background:white}.key{font-size:23px;padding:12px 20px;background:#173c45;color:white;border-radius:8px;width:100%}.pair{display:flex;gap:30px;width:100%}.pair>div{width:50%;font-size:27px}.pair img{margin-top:12px;max-height:500px}.code{font:25px/1.8 monospace;background:#17334d;padding:40px;color:white;overflow-wrap:anywhere;border-radius:10px}.code p{font:23px Arial}.removed{color:#ffb9ab}.added{color:#b5ecbd}table{width:100%;border-collapse:collapse;background:white;font-size:38px}th,td{text-align:left;padding:23px 35px;border-bottom:2px solid #c4d5d5}th{font-size:29px;color:#506e76}td b{color:#a3322b}footer{position:absolute;bottom:30px;left:70px;right:70px;display:flex;justify-content:space-between;color:#506e76;font-size:20px}</style><header><b>TabProof</b><span>Meta Global AI Developer Hackathon · Solo project</span></header><div class="tag">${e(s.tag)}</div>${full?`<h1>${e(s.title)}</h1><div class="content full"><p>${e(s.body)}</p><div class="media">${media}</div></div>`:`<div class="content"><div class="intro"><h1>${e(s.title)}</h1><p>${e(s.body)}</p></div><div class="media">${media||'<div style="font-size:54px;line-height:1.6;color:#2455cf">Keyboard only<br>Evidence saved<br>Fix verified</div>'}</div></div>`}<footer><span>Recorded real Meta results · Edited presentation · Synthetic test application</span><span>${i+1} / ${scenes.length}</span></footer>`);
   await page.evaluate(()=>Promise.all([...document.images].map(x=>x.decode())));await page.screenshot({path:resolve(root,`frame-${i}-${j}.png`)});
   frames.push({file:`frame-${i}-${j}.png`,duration:s.duration/steps.length,scene:i});
  }
 }
 await writeFile(resolve(root,'frames.json'),JSON.stringify(frames,null,2));await writeFile(resolve(root,'frames.txt'),frames.map(f=>`file '${f.file}'\nduration ${f.duration}`).join('\n')+`\nfile '${frames.at(-1).file}'\n`);
 console.log(JSON.stringify({frames:frames.length,seconds:frames.reduce((n,f)=>n+f.duration,0),root}));
}finally{await browser.close();}
