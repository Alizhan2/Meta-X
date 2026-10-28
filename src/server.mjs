import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {bookingPage, variants} from './fixture.mjs';
import {exportOfflineReport} from './export.mjs';

export async function createFixtureServer({port = 0,runs=null,artifactRoot=resolve('output/playwright')} = {}) {
  const sessions = new Map();
  const css = await readFile(new URL('../public/style.css', import.meta.url));
  function createSession(variant = 'correct') {
    if (!variants.includes(variant)) throw new Error('unknown_variant');
    const id = randomUUID(); sessions.set(id, {variant, record: null}); return id;
  }
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const send = (status, body, type = 'text/html') => {res.writeHead(status, {'Content-Type': type+'; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}); res.end(body);};
    const json=(status,body)=>send(status,JSON.stringify(body),'application/json');
    const sid = /(?:^|;\s*)session=([\w-]+)/.exec(req.headers.cookie || '')?.[1];
    let session = sessions.get(sid);
    try {
      const actualPort=server.address().port;
      if(![`127.0.0.1:${actualPort}`,`localhost:${actualPort}`].includes(req.headers.host))return send(403,'Invalid host');
      if(runs&&url.pathname==='/api/examples'&&req.method==='GET')return json(200,runs.examples());
      const reference=/^\/examples\/(react-aria-scroll|radix-toast)\/reference\/(original\.png|corrected\.png|deterministic-results\.json|agent-summary\.json)$/.exec(url.pathname);
      if(runs&&reference&&req.method==='GET'){
        const file=await runs.reference(reference[1],reference[2]);
        return file?send(200,file,reference[2].endsWith('.png')?'image/png':'application/json'):send(404,'Reference not found');
      }
      if(url.pathname.startsWith('/api/runs')&&runs){
        if(req.method==='POST'){
          if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return json(403,{error:'invalid_origin'});
          if(req.headers['content-type']?.split(';')[0]!=='application/json')return json(415,{error:'json_required'});
        }
        try{
          if(url.pathname==='/api/runs'&&req.method==='GET')return json(200,runs.list());
          if(url.pathname==='/api/runs'&&req.method==='POST'){
            const body=JSON.parse(await readBody(req,16384));
            if(!body||typeof body!=='object'||Array.isArray(body))return json(400,{error:'invalid_request'});
            return json(202,{run:runs.start(body)});
          }
          const match=/^\/api\/runs\/(agent-\d+)(\/stop)?$/.exec(url.pathname);
          if(match&&!match[2]&&req.method==='GET')return json(200,{run:runs.get(match[1])});
          if(match&&match[2]&&req.method==='POST')return json(202,{run:runs.stop(match[1])});
          return json(404,{error:'not_found'});
        }catch(error){return json(error.status||400,{error:error.code||'invalid_request'});}
      }
      const consoleFiles={'/':'console.html','/console':'console.html','/console.css':'console.css','/console.mjs':'console.mjs'};
      if(runs&&consoleFiles[url.pathname]&&req.method==='GET')return send(200,await readFile(new URL('../public/'+consoleFiles[url.pathname],import.meta.url)),url.pathname.endsWith('.css')?'text/css':url.pathname.endsWith('.mjs')?'text/javascript':'text/html');
      if (url.pathname === '/style.css') return send(200, css, 'text/css');
      if (url.pathname === '/favicon.ico') return send(204, '');
      const download=/^\/reports\/(agent-\d+)\/offline\.html$/.exec(url.pathname);
      if(download&&req.method==='GET'){
        try{
          const exported=await exportOfflineReport(artifactRoot,download[1]);
          res.setHeader('Content-Disposition',`attachment; filename="${exported.filename}"`);
          res.setHeader('Content-Security-Policy',"default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
          return send(200,exported.html);
        }catch(error){return json(error.status||404,{error:error.code||'report_not_found'});}
      }
      const artifact=/^\/reports\/(agent-\d+)\/(report\.(?:html|json)|details\.json|(?:original|corrected)\.png|\d{2}(?:-after)?\.png|evidence\/evidence\.json)$/.exec(url.pathname);
      if(artifact && req.method==='GET'){
        try{
          const file=await readFile(resolve(artifactRoot,artifact[1],artifact[2]));
          return send(200,file,artifact[2].endsWith('.png')?'image/png':artifact[2].endsWith('.json')?'application/json':'text/html');
        }catch{return send(404,'Report not found');}
      }
      if (url.pathname === '/' || url.pathname === '/lab') return send(200, `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TabProof fixture lab</title><link rel="stylesheet" href="/style.css"><header><a href="/lab">TabProof</a><span>Fixture lab</span></header><main class="lab"><h1>One task. Five conditions.</h1><p>Book a studio session for Alex Tester (alex@example.test), October 30, 2026 at 15:00. Review the details, close the review, then confirm.</p><form method="post" action="/lab/session"><label for="variant">Test condition</label><select id="variant" name="variant">${variants.map(v=>`<option value="${v}">${v.replaceAll('_',' ')}</option>`).join('')}</select><button class="primary">Open a fresh booking session</button></form><ul><li>Agent sessions open only the booking page. This control panel is not part of the agent's observations.</li><li>The server stores the booking record independently of the page's success message.</li><li>Focus loss can be a defect even when the task is eventually completed.</li></ul></main></html>`);
      if (url.pathname === '/lab/session' && req.method === 'POST') {
        const body = await readBody(req); const variant = new URLSearchParams(body).get('variant');
        if (!variants.includes(variant)) return send(400, 'Invalid condition');
        const id = createSession(variant); res.writeHead(303, {'Location':'/booking','Set-Cookie':`session=${id}; HttpOnly; SameSite=Strict; Path=/`}); return res.end();
      }
      if (url.pathname === '/booking' && req.method === 'GET') {
        if (!session) {const id=createSession();session=sessions.get(id);res.setHeader('Set-Cookie',`session=${id}; HttpOnly; SameSite=Strict; Path=/`);}
        return send(200, bookingPage(session.variant));
      }
      if (url.pathname === '/api/book' && req.method === 'POST') {
        if (!session) return send(401, '{}', 'application/json');
        const body = JSON.parse(await readBody(req));
        if (Object.keys(body).sort().join() !== 'date,email,name,time' || typeof body.name !== 'string' || !body.name.trim() || body.name.length>100 || typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || !['2026-10-29','2026-10-30','2026-10-31'].includes(body.date) || !['14:00','15:00','16:00'].includes(body.time)) return send(400,'{}','application/json');
        session.record = structuredClone(body); return send(201, JSON.stringify({booked:true}), 'application/json');
      }
      return send(404, 'Not found');
    } catch { return send(400, 'Invalid request'); }
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve)});
  const origin = `http://127.0.0.1:${server.address().port}`;
  runs?.addControlOrigin?.(origin);
  return {origin, createSession, getRecord(id) {return structuredClone(sessions.get(id)?.record ?? null)}, async close(){await new Promise((resolve,reject)=>{server.close(e=>e?reject(e):resolve());server.closeAllConnections();});}};
}

async function readBody(req,limit=4096) {const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw new Error('body_too_large');chunks.push(chunk);}return Buffer.concat(chunks).toString('utf8');}
