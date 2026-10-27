import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRadixToastExample} from '../examples/radix-toast/server.mjs';

const apps=[];let viewer;
const close=async()=>{
  if(viewer)await new Promise(resolve=>{viewer.closeAllConnections();viewer.close(resolve);});
  await Promise.allSettled(apps.map(app=>app.close()));
};
try{
  const before=await createRadixToastExample({port:4195});apps.push(before);
  const after=await createRadixToastExample({corrected:true,port:4196});apps.push(after);
  viewer=createServer(async(req,res)=>{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const path=new URL(req.url,'http://localhost').pathname;
    if(path==='/before'||path==='/after'){res.writeHead(302,{Location:(path==='/before'?before:after).origin});res.end();return;}
    const file=path==='/'?'comparison.html':path.slice(1);
    if(!/^(?:comparison\.html|(?:original|corrected)\.png|(?:deterministic-results|agent-summary|development-attempts)\.json|(?:runs|audits)\/agent-\d+\.json)$/.test(file)){res.writeHead(404);res.end();return;}
    try{
      const body=await readFile(resolve('docs/radix-toast-2026-10-27',file));
      res.writeHead(200,{'Content-Type':file.endsWith('.png')?'image/png':file.endsWith('.json')?'application/json; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store'});
      res.end(req.method==='HEAD'?undefined:body);
    }catch{res.writeHead(404);res.end('Evidence not found. Run the documented checks and renderer first.');}
  });
  await new Promise((resolve,reject)=>{viewer.once('error',reject);viewer.listen(4197,'127.0.0.1',resolve);});
  console.log(JSON.stringify({comparison:'http://127.0.0.1:4197/',original:before.origin,corrected:after.origin}));
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{void close().then(()=>process.exit(0));});
}catch(error){await close();throw error;}
