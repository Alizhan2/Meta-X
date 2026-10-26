import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createFixtureServer} from '../src/server.mjs';
import {openSession} from '../src/browser.mjs';
import {matchesBooking,replayTrace} from '../src/evidence.mjs';

const steps=JSON.parse(await readFile(new URL('../docs/examples/corrected-run.json',import.meta.url))).steps;
const app=await createFixtureServer();let session;
try{
  session=await openSession(app,'correct',{budget:15});
  await session.page.route('**/api/book',async route=>{await new Promise(resolve=>setTimeout(resolve,1000));await route.continue();});
  for(const step of steps)await session.executor.execute(step.action);
  assert.equal(session.executor.used,15);
  assert.equal(matchesBooking(session.record()),true,'last budgeted action must await delayed booking');
  await session.close();session=null;
  const replay=await replayTrace(app,'correct',steps);
  assert.equal(replay.taskCompleted,true);
  assert.equal(replay.focusPathMatches,true);
  const changed=structuredClone(steps);changed[5].focusAfter.name='Different calendar day';
  const mismatch=await replayTrace(app,'correct',changed);
  assert.equal(mismatch.focusPathMatches,false,'different day labels must not match');
  console.log('PASS: delayed final booking, exact replay, and different-element rejection');
}finally{await session?.close();await app.close();}
