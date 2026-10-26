import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {build} from './node_modules/esbuild/lib/main.js';

export const toastVersions=Object.freeze({original:'1.2.19',corrected:'1.2.20'});

export async function createRadixToastExample({corrected=false,port=0}={}) {
  // The host source and CSS are identical. Only the actual npm package import
  // changes. Both complete dependency graphs are pinned in the same lockfile.
  const packageName=corrected?'radix-toast-corrected':'radix-toast-original';
  const bundle=await build({entryPoints:[fileURLToPath(new URL('app.jsx',import.meta.url))],bundle:true,write:false,outdir:'dist',minify:true,alias:{'toast-under-test':packageName},absWorkingDir:fileURLToPath(new URL('.',import.meta.url)),define:{'process.env.NODE_ENV':'"production"'},legalComments:'eof'});
  const files=new Map(bundle.outputFiles.map(file=>[file.path.endsWith('.css')?'/app.css':'/app.js',file.contents]));
  const html=Buffer.from('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Notification inbox · Radix UI</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js" defer></script></body></html>');
  const server=createServer((req,res)=>{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const path=new URL(req.url,'http://localhost').pathname;
    if(path==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:html);}
    else if(files.has(path)){res.writeHead(200,{'Content-Type':path.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:files.get(path));}
    else {res.writeHead(404);res.end();}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {origin:`http://127.0.0.1:${server.address().port}`,version:toastVersions[corrected?'corrected':'original'],close:()=>new Promise((resolve,reject)=>{server.closeAllConnections();server.close(error=>error?reject(error):resolve());})};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const app=await createRadixToastExample({corrected:process.argv.includes('--corrected'),port:Number(process.argv.find(arg=>/^--port=\d+$/.test(arg))?.split('=')[1]||4195)});
  console.log(JSON.stringify({origin:app.origin,version:app.version}));
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{void app.close().then(()=>process.exit(0));});
}
