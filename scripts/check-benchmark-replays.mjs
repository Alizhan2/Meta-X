import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {createFixtureServer} from '../src/server.mjs';
import {replayTrace} from '../src/evidence.mjs';

const manifestPath=process.argv[2]||'docs/benchmark-2026-10-26/manifest.json';
const root=dirname(resolve(manifestPath));
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
const app=await createFixtureServer();
const followup={scope:'Post-benchmark local replay regression only. No AI requests; original 25-run data unchanged.',recordedAt:new Date().toISOString(),browserSourceSha256:createHash('sha256').update(await readFile(new URL('../src/browser.mjs',import.meta.url))).digest('hex'),results:[]};
try{
  for(const job of manifest.jobs){
    const path=resolve(root,job.reportPath);const original=await readFile(path,'utf8');const report=JSON.parse(original);
    if(!report.evidenceError)continue;
    const result=await replayTrace(app,'correct',report.steps);
    followup.results.push({runId:report.runId,variant:report.variant,actions:report.steps.length,replayCompletedWithoutError:true,taskCompleted:result.taskCompleted,focusPathMatches:result.focusPathMatches});
    assert.equal(await readFile(path,'utf8'),original,'Original report must stay unchanged');
    console.log(JSON.stringify(followup.results.at(-1)));
  }
  assert.equal(followup.results.length,9);
}finally{await app.close();await writeFile(resolve(root,'replay-followup.json'),JSON.stringify(followup,null,2)+'\n');}
