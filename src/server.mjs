import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {bookingPage, variants} from './fixture.mjs';

export async function createFixtureServer({port = 0} = {}) {
  const sessions = new Map();
  const css = await readFile(new URL('../public/style.css', import.meta.url));
  function createSession(variant = 'correct') {
    if (!variants.includes(variant)) throw new Error('unknown_variant');
    const id = randomUUID(); sessions.set(id, {variant, record: null}); return id;
  }
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const send = (status, body, type = 'text/html') => {res.writeHead(status, {'Content-Type': type+'; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}); res.end(body);};
    const sid = /(?:^|;\s*)session=([\w-]+)/.exec(req.headers.cookie || '')?.[1];
    let session = sessions.get(sid);
    try {
      if (url.pathname === '/style.css') return send(200, css, 'text/css');
      if (url.pathname === '/favicon.ico') return send(204, '');
      const artifact=/^\/reports\/(agent-\d+)\/(report\.(?:html|json)|\d{2}(?:-after)?\.png|evidence\/evidence\.json)$/.exec(url.pathname);
      if(artifact && req.method==='GET'){
        try{
          const file=await readFile(resolve('output/playwright',artifact[1],artifact[2]));
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
  return {origin, createSession, getRecord(id) {return structuredClone(sessions.get(id)?.record ?? null)}, async close(){await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}};
}

async function readBody(req) {let body='';for await (const chunk of req){body+=chunk;if(Buffer.byteLength(body)>4096)throw new Error('body_too_large')}return body;}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const app = await createFixtureServer({port:Number(process.env.PORT || 3000)});
  console.log(`TabProof fixture lab: ${app.origin}/lab`);
}
