import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCustomTarget,createTargetResolver} from '../src/target.mjs';

const valid=(targetUrl,options)=>normalizeCustomTarget({targetUrl,task:'  Complete the public form.  '},options);
const code=expected=>error=>error.status===400&&error.code===expected;

test('custom input normalizes public HTTP URLs, trims task and preserves client-side route fragments',()=>{
  assert.deepEqual(valid('HTTPS://EXAMPLE.COM:443/a?q=1#/settings'),{targetKind:'custom',variant:'custom',targetUrl:'https://example.com/a?q=1#/settings',task:'Complete the public form.'});
  assert.equal(valid('http://8.8.8.8/').targetUrl,'http://8.8.8.8/');
  assert.equal(valid('https://[2606:4700:4700::1111]/').targetKind,'custom');
});
test('malformed URL, credentials, unsafe schemes and malformed task are rejected',()=>{
  for(const url of [null,'','not a URL','https://','https://user:pass@example.com/','https://@example.com/','https://:@example.com/','file:///etc/passwd','data:text/html,test','ftp://example.com','http://example.com:0/','https://exa\nmple.com','https://example.com/'+ 'x'.repeat(2048)])assert.throws(()=>valid(url),code('invalid_target_url'));
  for(const task of [null,{},1,'',' \t\n ','x'.repeat(2001)])assert.throws(()=>normalizeCustomTarget({targetUrl:'https://example.com',task}),code('invalid_task'));
});
test('private, metadata, reserved and mapped private IP literals cannot be targets',()=>{
  for(const ip of ['0.0.0.0','10.1.2.3','100.64.0.1','100.100.100.200','127.0.0.2','169.254.169.254','168.63.129.16','172.16.0.1','172.31.255.255','192.0.0.192','192.0.2.1','192.168.1.1','192.88.99.1','198.18.0.1','198.19.255.255','198.51.100.1','203.0.113.1','224.0.0.1','255.255.255.255','[::]','[::ffff:127.0.0.1]','[::ffff:10.0.0.1]','[::ffff:192.168.1.1]','[fc00::1]','[fe80::1]','[ff02::1]','[64:ff9b::808:808]','[2001:db8::1]','[2001::1]','[2002:7f00:1::]','[3fff::1]'])assert.throws(()=>valid(`http://${ip}/`),code('target_not_allowed'),ip);
});
test('explicit loopback development target is scoped to its origin and excludes control ports across aliases',async()=>{
  for(const url of ['http://localhost:4100/a','http://127.0.0.1:4100/','http://[::1]:4100/'])assert.equal(valid(url).targetKind,'custom');
  for(const url of ['http://localhost:3000','http://127.0.0.1:3000','https://[::1]:3000'])assert.throws(()=>valid(url,{controlOrigins:['http://127.0.0.1:3000']}),code('target_not_allowed'));
  assert.throws(()=>valid('https://example.com',{controlOrigins:['https://example.com']}),code('target_not_allowed'));
  assert.throws(()=>valid('http://localhost./'),code('target_not_allowed'));
  const resolve=createTargetResolver({targetUrl:'http://localhost:4100/a',lookup:()=>assert.fail('localhost must be pinned without DNS')});
  assert.equal((await resolve('http://localhost:4100/next')).address,'127.0.0.1');
  for(const url of ['http://localhost:4101/','https://localhost:4100/','http://127.0.0.1:4100/','http://[::1]:4100/'])await assert.rejects(resolve(url),code('target_not_allowed'));
});
test('all DNS answers must be public and have a matching address family',async()=>{
  for(const answers of [[],[{address:'10.0.0.1',family:4}],[{address:'8.8.8.8',family:4},{address:'169.254.169.254',family:4}],[{address:'::ffff:a9fe:a9fe',family:6}],[{address:'fd00:ec2::254',family:6}],[{address:'8.8.8.8',family:6}],[{address:'not-an-IP',family:4}]]){
    const resolve=createTargetResolver({targetUrl:'https://example.com',lookup:async()=>answers});
    await assert.rejects(resolve('https://example.com'),code('target_not_allowed'));
  }
  const failing=createTargetResolver({targetUrl:'https://example.com',lookup:async()=>{throw new Error('ENOTFOUND');}});
  await assert.rejects(failing('https://example.com'),code('target_not_allowed'));
});
test('public hosts and CDN subresources resolve once to pinned public addresses with no rebinding',async()=>{
  const calls=[];
  const resolve=createTargetResolver({targetUrl:'https://example.com',lookup:async(host,options)=>{calls.push(host);assert.equal(options.all,true);return calls.length<=2?[{address:host==='example.com'?'8.8.8.8':'2606:4700:4700::1111',family:host==='example.com'?4:6}]:[{address:'127.0.0.1',family:4}];}});
  assert.equal((await resolve('https://example.com/a')).address,'8.8.8.8');
  assert.equal((await resolve('https://cdn.example.com/x')).family,6);
  assert.equal((await resolve('http://example.com:8080/b')).address,'8.8.8.8');
  assert.deepEqual(calls,['example.com','cdn.example.com']);
  await assert.rejects(resolve('http://localhost:4100'),code('target_not_allowed'));
});
test('DNS aliases resolving to loopback cannot inherit explicit localhost permission',async()=>{
  const resolve=createTargetResolver({targetUrl:'http://localhost:4100',lookup:async()=>[{address:'127.0.0.1',family:4}]});
  await assert.rejects(resolve('http://alias.example:4100'),code('target_not_allowed'));
});
test('aborting while DNS is pending prevents any resolved destination from escaping',async()=>{
  const controller=new AbortController();let finish;
  const resolve=createTargetResolver({targetUrl:'https://example.com',signal:controller.signal,lookup:()=>new Promise(done=>finish=done)});
  const pending=resolve('https://example.com');await Promise.resolve();
  controller.abort(new Error('user_stopped'));finish([{address:'8.8.8.8',family:4}]);
  await assert.rejects(pending,/user_stopped/);
});
