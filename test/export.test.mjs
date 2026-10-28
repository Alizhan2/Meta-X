import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {exportOfflineReport} from '../src/export.mjs';
import {exampleDefinition,newExampleComparison} from '../src/examples.mjs';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const base={runId:'agent-123',startedAt:'2026-10-28T00:00:00Z',finishedAt:'2026-10-28T00:01:00Z',steps:[],requests:[]};
async function setup(report,check){
  const root=await mkdtemp(join(tmpdir(),'tabproof-export-'));await mkdir(join(root,'agent-123'));
  try{await writeFile(join(root,'agent-123','report.json'),JSON.stringify(report));await check(root,join(root,'agent-123'));}
  finally{await rm(root,{recursive:true,force:true});}
}

test('offline custom report embeds exact JSON and screenshots without promoting model completion',async()=>{
  const report={...base,targetKind:'custom',task:'Find <script>alert("x")</script>',targetUrl:'https://example.test',outcome:'agent_reported_complete',steps:[{action:{name:'press_key',arguments:{key:'Tab'}},focusBefore:{tag:'BODY'},focusAfter:{tag:'BUTTON',name:'Search'}}]};
  await setup(report,async(root,directory)=>{
    await writeFile(join(directory,'00-after.png'),png);
    await writeFile(join(directory,'report.html'),'<script>untrusted saved HTML</script>');
    const {html,filename,missing}=await exportOfflineReport(root,report.runId);
    assert.equal(filename,'tabproof-agent-123.html');assert.deepEqual(missing,[]);
    assert.ok(html.includes('Task completion has not been independently verified.'));
    assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('data:image/png;base64,'+png.toString('base64')));
    assert.ok(html.includes('href="#snapshot-00-after-png"'));
    assert.ok(!html.includes('href="/?run='));assert.ok(!html.includes('untrusted saved HTML'));
    const json=Buffer.from(html.match(/href="data:application\/json;base64,([^"]+)"/)[1],'base64');
    assert.deepEqual(JSON.parse(json),report);
    assert.ok(html.includes(createHash('sha256').update(json).digest('hex')));
    assert.ok(html.includes("default-src 'none'"));
  });
});

test('partial example export keeps cancellation explicit and rejects cross-run and symlink artifacts',async()=>{
  const comparison=newExampleComparison(exampleDefinition('radix-toast'),'agent');
  comparison.verified=false;comparison.original.screenshot='/reports/agent-123/original.png?v=1';comparison.corrected.screenshot='/reports/agent-999/corrected.png';
  await setup({...base,targetKind:'example',exampleId:'radix-toast',checkMode:'agent',cancelled:true,comparison},async(root,directory)=>{
    await writeFile(join(root,'secret.txt'),'PRIVATE_SENTINEL');await symlink(join(root,'secret.txt'),join(directory,'original.png'));
    const {html,missing}=await exportOfflineReport(root,'agent-123');
    assert.ok(html.includes('Comparison stopped'));assert.ok(html.includes('partial'));
    assert.ok(!html.includes('Before/after comparison verified'));assert.ok(!html.includes('PRIVATE_SENTINEL'));
    assert.ok(!html.includes('src="/reports/agent-999'));assert.ok(html.includes('Screenshot unavailable'));
    assert.deepEqual(missing,['original.png','details.json']);
  });
});

test('exports reject active reports, invalid identities, invalid images and escaped run folders',async()=>{
  await setup({...base,finishedAt:undefined},async(root)=>{
    await assert.rejects(exportOfflineReport(root,'agent-123'),e=>e.code==='run_not_finished');
    await assert.rejects(exportOfflineReport(root,'../.env'),e=>e.code==='invalid_run');
    await writeFile(join(root,'agent-123','report.json'),JSON.stringify({...base,runId:'agent-456'}));
    await assert.rejects(exportOfflineReport(root,'agent-123'),e=>e.code==='invalid_report');
    await symlink(join(root,'agent-123'),join(root,'agent-456'));
    await assert.rejects(exportOfflineReport(root,'agent-456'),e=>e.code==='invalid_artifact_path');
    await writeFile(join(root,'agent-123','report.json'),JSON.stringify({...base,targetKind:'custom',latestScreenshot:'00.png',targetUrl:'https://example.test',task:'Read page'}));
    await writeFile(join(root,'agent-123','00.png'),'<svg onload="alert(1)"></svg>');
    const result=await exportOfflineReport(root,'agent-123');assert.deepEqual(result.missing,['00.png']);assert.ok(!result.html.includes('data:image/png'));
  });
});
