import http from 'node:http';
export const dialogTask='Open the Keyboard details dialog. Close it using Escape and finish with focus on its opener. If Escape does not close it, report the obstacle and stop.';
export const dialogContract={type:'dialog_escape_focus',triggerSelector:'#open-details',dialogSelector:'#details-dialog'};

// A separate, ordinary website for end-to-end testing of user-supplied URLs.
// The runner contains no knowledge of these paths or defect switches.
export async function createDialogComparisonSite({port=0}={}){
  const server=http.createServer((req,res)=>{
    const path=new URL(req.url,'http://127.0.0.1').pathname;
    if(path==='/favicon.ico'){res.writeHead(204);res.end();return;}
    if(!['/before','/after','/still-broken','/bad-focus','/missing','/ambiguous','/delayed'].includes(path)){res.writeHead(404);res.end('Not found');return;}
    const broken=['/before','/still-broken'].includes(path),badFocus=path==='/bad-focus',missing=path==='/missing',ambiguous=path==='/ambiguous';
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Keyboard details</title><style>body{font:18px/1.6 system-ui;background:#f4f7fb;color:#203648;margin:0;padding:9vh 8vw}main{max-width:700px;margin:auto}h1{font-size:40px;line-height:1.15}button{font:inherit;padding:12px 20px;border:1px solid #48698c;border-radius:6px;color:inherit;background:white;cursor:pointer}button:focus-visible{outline:3px solid #c45419;outline-offset:4px}dialog{max-width:500px;padding:28px;border:1px solid #48698c;border-radius:10px}dialog::backdrop{background:#162a3b77}.note{font-size:15px;color:#526c80}</style><main><p class="note">A separate test website for TabProof</p><h1>Keyboard details</h1><p>Open the details dialog, then close it using Escape. Focus should return to the opener.</p>${missing?'':'<button id="open-details">Open Keyboard details</button>'}${ambiguous?'<button id="open-details">Another opener</button>':''}<button id="other" hidden>Other action</button><dialog id="details-dialog" aria-labelledby="dialog-title"><h2 id="dialog-title">Keyboard details</h2><p>Press Escape to close this dialog and return to its opener.</p><button id="close-details" autofocus>Close details</button></dialog></main><script>const opener=document.querySelector('#open-details'),dialog=document.querySelector('#details-dialog');opener?.addEventListener('click',()=>${path==='/delayed'?'setTimeout(()=>dialog.showModal(),250)':'dialog.showModal()'});document.querySelector('#close-details').onclick=()=>dialog.close();${broken?"dialog.addEventListener('cancel',event=>event.preventDefault());":''}${badFocus?"dialog.addEventListener('close',()=>{const other=document.querySelector('#other');other.hidden=false;other.focus();});":''}</script></html>`);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return {origin:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();})};
}
