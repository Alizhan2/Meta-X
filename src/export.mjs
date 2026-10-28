import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {renderReport} from './report.mjs';
import {renderExampleReport} from './examples.mjs';
import {renderWebsiteComparisonReport} from './website-report.mjs';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fail=(status,code)=>Object.assign(new Error(code),{status,code});
const allowed=/^(?:report\.json|details\.json|evidence\/evidence\.json|(?:original|corrected|\d{2}(?:-after)?)\.png)$/;
const limit=64*1024*1024;

// Export only recorded artifacts from this one run. Never fetch a URL in a report.
export async function exportOfflineReport(root,id){
  if(!/^agent-\d+$/.test(id))throw fail(400,'invalid_run');
  const base=await realpath(root),directory=await realpath(resolve(base,id));
  if(directory!==resolve(base,id))throw fail(403,'invalid_artifact_path');
  let bytes=0;
  const cache=new Map(),missing=new Set(),gallery=new Map();
  async function artifact(name){
    if(cache.has(name))return cache.get(name);
    if(!allowed.test(name))return null;
    try{
      const file=await realpath(resolve(directory,name)),path=relative(directory,file);
      if(path.startsWith('..')||isAbsolute(path))return null;
      const info=await stat(file);
      if(!info.isFile()||info.size>16*1024*1024)throw fail(413,'export_too_large');
      bytes+=info.size;if(bytes>limit)throw fail(413,'export_too_large');
      const data=await readFile(file);cache.set(name,data);return data;
    }catch(error){if(error.status)throw error;return null;}
  }
  const raw=await artifact('report.json');if(!raw)throw fail(404,'report_not_found');
  let report;try{report=JSON.parse(raw);}catch{throw fail(422,'invalid_report');}
  if(report.runId!==id||!Array.isArray(report.steps))throw fail(422,'invalid_report');
  if(!report.finishedAt)throw fail(409,'run_not_finished');
  const hash=createHash('sha256').update(raw).digest('hex');
  let html=report.targetKind==='example'?renderExampleReport(report):report.targetKind==='website-comparison'?renderWebsiteComparisonReport(report):renderReport(report);
  const localName=ref=>{
    const prefix=`/reports/${id}/`;
    const name=(ref.startsWith(prefix)?ref.slice(prefix.length):ref).split('?')[0];
    return allowed.test(name)?name:null;
  };
  const imageId=name=>'snapshot-'+name.replaceAll('.','-');
  async function dataUrl(name){
    const data=await artifact(name);
    if(!data){missing.add(name);return null;}
    // A .png filename alone must not allow arbitrary active content into an export.
    if(name.endsWith('.png')&&!data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){missing.add(name);return null;}
    return `data:${name.endsWith('.png')?'image/png':'application/json'};base64,${data.toString('base64')}`;
  }
  // The trusted renderers escape report text and emit only double-quoted attributes.
  const tags=[...html.matchAll(/<(img|a)\b([^>]*?)\b(src|href)="([^"]*)"([^>]*)>/g)];
  for(const match of tags){
    const [tag,kind,before,attribute,ref,after]=match,name=localName(ref);
    let replacement;
    if(kind==='img'){
      const data=name?.endsWith('.png')?await dataUrl(name):null;
      replacement=data?`<img ${before}src="${data}"${after}>`:'<p role="note">Screenshot unavailable in this export.</p>';
    }else if(name){
      const data=await dataUrl(name);
      if(!data)replacement='<a aria-disabled="true" title="Artifact unavailable in this export">';
      else if(name.endsWith('.png')){gallery.set(name,data);replacement=`<a href="#${imageId(name)}">`;}
      else replacement=`<a href="${data}" download="${id}-${name.replaceAll('/','-')}">`;
    }else if(/^https:\/\//.test(ref))replacement=`<a ${before}href="${ref}"${after} target="_blank" rel="noopener noreferrer">`;
    else replacement='<a aria-disabled="true" title="This link requires the original workbench">';
    html=html.replace(tag,replacement);
  }
  html=html.replace(/<a aria-disabled="true" title="This link requires the original workbench">(Back to workbench|Back to the workbench)<\/a>/g,'<p>Open TabProof separately to return to your runs.</p>');
  html=html.replace(/<a aria-disabled="true"[^>]*>([\s\S]*?)<\/a>/g,'<span>$1 (not included in this file)</span>');
  const note=`<aside id="offline-summary" style="border:1px solid #c4d5d5;padding:16px;margin-bottom:24px"><strong>Offline evidence copy</strong><p>Run <code>${escape(id)}</code>. Finished ${escape(report.finishedAt)}. This file includes the recorded images and linked JSON available at export time. External source links require internet access. Separate runs and browser traces are not bundled.</p><p>Review the screenshots and entered text before sharing this file.</p><details><summary>Report integrity</summary><p>SHA-256 of the original report.json: <code>${hash}</code></p></details></aside>`;
  const images=[...gallery].map(([name,data])=>`<figure id="${imageId(name)}" style="margin:24px 0"><figcaption>${escape(name)}</figcaption><img alt="Recorded page: ${escape(name)}" src="${data}"></figure>`).join('');
  const warning=missing.size?`<p role="note"><strong>Incomplete evidence:</strong> ${[...missing].map(escape).join(', ')} could not be included. Missing artifacts do not change the recorded outcome.</p>`:'';
  html=html.replace('<main>','<main>'+note+warning).replace('</main>',(images?'<h2>Recorded screenshots</h2>'+images:'')+'</main>');
  html=html.replace('<meta charset="utf-8">',`<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">`);
  if(Buffer.byteLength(html)>limit*2)throw fail(413,'export_too_large');
  return {html,filename:`tabproof-${id}.html`,missing:[...missing]};
}
