import http from 'node:http';
import net from 'node:net';
import {lookup as defaultLookup} from 'node:dns/promises';

const fail=code=>Object.assign(new Error(code),{status:400,code});
const unbracket=host=>host.startsWith('[')?host.slice(1,-1):host;
const portOf=url=>Number(url.port||(url.protocol==='https:'?443:80));
const explicitLoopback=host=>['localhost','127.0.0.1','::1'].includes(unbracket(host));

function parseUrl(value){
  if(typeof value!=='string'||value.length>2048)throw fail('invalid_target_url');
  const text=value.trim();
  if(!text||/[\x00-\x1f\x7f]/.test(text)||/^[a-z][a-z0-9+.-]*:\/\/[^/?#\\]*@/i.test(text))throw fail('invalid_target_url');
  let url;try{url=new URL(text);}catch{throw fail('invalid_target_url');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||!url.hostname||portOf(url)<1)throw fail('invalid_target_url');
  return url;
}

function ipv4Number(address){
  if(net.isIP(address)!==4)return null;
  return address.split('.').reduce((value,part)=>value*256+Number(part),0);
}
function inV4(address,base,bits){
  const value=ipv4Number(address),start=ipv4Number(base);
  return value!==null&&Math.floor(value/2**(32-bits))===Math.floor(start/2**(32-bits));
}
function ipv6Number(address){
  if(net.isIP(address)!==6||address.includes('%'))return null;
  let text=address.toLowerCase();
  if(text.includes('.')){
    const start=text.lastIndexOf(':')+1,value=ipv4Number(text.slice(start));
    if(value===null)return null;
    text=text.slice(0,start)+(value>>>16).toString(16)+':'+(value&65535).toString(16);
  }
  const halves=text.split('::');
  const left=halves[0]?halves[0].split(':'):[],right=halves[1]?halves[1].split(':'):[];
  const words=halves.length===2?[...left,...Array(8-left.length-right.length).fill('0'),...right]:left;
  if(words.length!==8)return null;
  return words.reduce((value,word)=>(value<<16n)+BigInt('0x'+word),0n);
}
const inV6=(value,base,bits)=>value>>BigInt(128-bits)===ipv6Number(base)>>BigInt(128-bits);
function publicAddress(address){
  if(net.isIP(address)===4){
    const denied=[['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]];
    return address!=='168.63.129.16'&&!denied.some(([base,bits])=>inV4(address,base,bits));
  }
  const value=ipv6Number(address);if(value===null)return false;
  // IPv4-mapped DNS answers must obey the IPv4 policy too.
  if(value>>32n===65535n){
    const low=Number(value&0xffffffffn);
    return publicAddress([low>>>24,(low>>>16)&255,(low>>>8)&255,low&255].join('.'));
  }
  // Only global unicast allocation is routable here; transition, documentation,
  // local, multicast, unspecified and reserved ranges are deliberately excluded.
  return inV6(value,'2000::',3)&&!inV6(value,'2001::',23)&&!inV6(value,'2001:db8::',32)&&!inV6(value,'2002::',16)&&!inV6(value,'3fff::',20);
}

function targetPolicy(targetUrl,controlOrigins){
  const target=parseUrl(targetUrl);
  const controls=controlOrigins.map(value=>parseUrl(value));
  const allowedLocal=explicitLoopback(target.hostname);
  function check(url){
    const host=unbracket(url.hostname),ip=net.isIP(host);
    if(controls.some(control=>control.origin===url.origin))throw fail('target_not_allowed');
    if(explicitLoopback(url.hostname)){
      if(!allowedLocal||url.origin!==target.origin||controls.some(control=>explicitLoopback(control.hostname)&&portOf(control)===portOf(url)))throw fail('target_not_allowed');
      return true;
    }
    if(host==='localhost.'||host.endsWith('.localhost')||host.endsWith('.localhost.')||host.endsWith('.local')||host.endsWith('.local.'))throw fail('target_not_allowed');
    if(ip&&!publicAddress(host))throw fail('target_not_allowed');
    return false;
  }
  check(target);return {target,check};
}

export function normalizeCustomTarget({targetUrl,task}={}, {controlOrigins=[]}={}){
  const {target}=targetPolicy(targetUrl,controlOrigins);
  if(typeof task!=='string'||!task.trim()||task.trim().length>2000)throw fail('invalid_task');
  return {targetKind:'custom',variant:'custom',targetUrl:target.href,task:task.trim()};
}

// Exported separately so the complete resolution policy is testable without
// opening a listening socket. Successful DNS answers are pinned for this run.
export function createTargetResolver({targetUrl,controlOrigins=[],lookup=defaultLookup,signal}={}){
  const {check}=targetPolicy(targetUrl,controlOrigins),cache=new Map();
  return async function resolveDestination(value){
    signal?.throwIfAborted();
    const url=parseUrl(value),local=check(url),hostname=unbracket(url.hostname);
    if(local)return {url,address:hostname==='localhost'?'127.0.0.1':hostname,family:hostname==='::1'?6:4,port:portOf(url)};
    if(net.isIP(hostname))return {url,address:hostname,family:net.isIP(hostname),port:portOf(url)};
    if(!cache.has(hostname))cache.set(hostname,(async()=>{
      let timer,abort;
      try{
        const records=await Promise.race([
          Promise.resolve().then(()=>lookup(hostname,{all:true,verbatim:true})),
          new Promise((_,reject)=>{timer=setTimeout(()=>reject(fail('target_not_allowed')),10000);timer.unref?.();}),
          ...(signal?[new Promise((_,reject)=>{abort=()=>reject(signal.reason||fail('target_not_allowed'));signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();})]:[])
        ]);
        signal?.throwIfAborted();
        // A mixed answer is rejected in full: no private fallback is available.
        const answers=Array.isArray(records)?records:[records];
        if(!answers.length||answers.some(record=>!record||!publicAddress(record.address)||Number(record.family)!==net.isIP(record.address)))throw fail('target_not_allowed');
        return {address:answers[0].address,family:Number(answers[0].family)};
      }catch(error){if(signal?.aborted)throw signal.reason;throw fail('target_not_allowed');}
      finally{clearTimeout(timer);if(abort)signal.removeEventListener('abort',abort);}
    })());
    const destination=await cache.get(hostname);signal?.throwIfAborted();
    return {url,...destination,port:portOf(url)};
  };
}

const hopHeaders=new Set(['connection','proxy-connection','proxy-authorization','proxy-authenticate','keep-alive','te','trailer','transfer-encoding','upgrade']);
function forwardHeaders(headers){
  const denied=new Set([...hopHeaders,...String(headers.connection||'').toLowerCase().split(',').map(value=>value.trim())]);
  return Object.fromEntries(Object.entries(headers).filter(([key])=>!denied.has(key.toLowerCase())));
}

export async function createTargetProxy({targetUrl,controlOrigins=[],signal,lookup=defaultLookup}={}){
  signal?.throwIfAborted();
  const resolveDestination=createTargetResolver({targetUrl,controlOrigins,signal,lookup});
  await resolveDestination(targetUrl);
  const sockets=new Set(),requests=new Set();let closed=false,closePromise;
  const track=socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));socket.on('error',()=>socket.destroy());socket.setTimeout(30000,()=>socket.destroy());return socket;};
  const unavailable=()=>closed||signal?.aborted;
  const server=http.createServer(async(req,res)=>{
    try{
      const destination=await resolveDestination(req.url);
      if(unavailable()||req.destroyed||res.destroyed)return req.destroy();
      if(destination.url.protocol!=='http:')throw fail('invalid_target_url');
      const headers={...forwardHeaders(req.headers),host:destination.url.host,connection:'close'};
      const upstream=http.request({hostname:destination.address,family:destination.family,port:destination.port,method:req.method,path:destination.url.pathname+destination.url.search,headers,agent:false},response=>{
        response.on('error',()=>res.destroy());
        res.writeHead(response.statusCode,forwardHeaders(response.headers));response.pipe(res);
      });
      requests.add(upstream);upstream.once('close',()=>requests.delete(upstream));
      upstream.on('socket',track);upstream.setTimeout(15000,()=>upstream.destroy());
      upstream.on('error',()=>{if(!res.headersSent){res.writeHead(502,{'Connection':'close'});res.end('Target unavailable');}else res.destroy();});
      req.on('aborted',()=>upstream.destroy());req.on('error',()=>upstream.destroy());res.on('close',()=>upstream.destroy());req.pipe(upstream);
    }catch{if(!res.headersSent){res.writeHead(403,{'Connection':'close'});res.end('Target not allowed');}else res.destroy();}
  });
  server.on('connection',socket=>{if(unavailable()||sockets.size>=128)socket.destroy();else track(socket);});
  server.on('clientError',(_,socket)=>socket.destroy());
  server.on('connect',async(req,client,head)=>{
    try{
      // CONNECT carries an authority, never a path, userinfo or another scheme.
      if(!/^(?:\[[0-9a-f:.]+\]|[a-z0-9._-]+):[0-9]{1,5}$/i.test(req.url))throw fail('invalid_target_url');
      const destination=await resolveDestination('https://'+req.url+'/');
      if(unavailable()||client.destroyed)return client.destroy();
      const upstream=track(net.connect({host:destination.address,family:destination.family,port:destination.port}));
      const deadline=setTimeout(()=>upstream.destroy(),120000);deadline.unref?.();
      upstream.once('close',()=>{clearTimeout(deadline);client.destroy();});
      client.once('close',()=>upstream.destroy());
      upstream.on('error',()=>client.destroy());
      upstream.once('connect',()=>{
        if(unavailable()){upstream.destroy();return client.destroy();}
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if(head.length)upstream.write(head);
        client.pipe(upstream);upstream.pipe(client);
      });
    }catch{if(!client.destroyed)client.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');}
  });
  server.headersTimeout=10000;server.requestTimeout=30000;server.keepAliveTimeout=1000;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const close=()=>{
    if(closePromise)return closePromise;
    closed=true;signal?.removeEventListener('abort',abort);
    for(const request of requests)request.destroy();for(const socket of sockets)socket.destroy();
    closePromise=new Promise(resolve=>server.close(()=>resolve()));return closePromise;
  };
  const abort=()=>{void close();};
  signal?.addEventListener('abort',abort,{once:true});
  if(signal?.aborted){await close();signal.throwIfAborted();}
  return {server:`http://127.0.0.1:${server.address().port}`,close};
}
