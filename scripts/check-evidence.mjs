import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createFixtureServer} from '../src/server.mjs';
import {variants} from '../src/fixture.mjs';
import {collectEvidence} from '../src/evidence.mjs';

const expectedCodes={correct:null,unreachable_button:'confirmation_unreachable',calendar_keyboard:'calendar_date_unreachable',modal_dismissal:'modal_keyboard_dismissal',focus_loss:'unexpected_focus_return'};
const app=await createFixtureServer();const results=[];
await mkdir('output/playwright/evidence',{recursive:true});
try{
  for(const variant of variants){
    const evidence=await collectEvidence(app,variant,{repeats:3,directory:`output/playwright/evidence/${variant}`});
    if(expectedCodes[variant]){
      assert.equal(evidence.findings.length,1);
      assert.equal(evidence.findings[0].code,expectedCodes[variant]);
      assert.equal(evidence.findings[0].confirmedInControlledFixture,true);
      assert.equal(evidence.findings[0].occurrences,3);
    }else{assert.equal(evidence.findings.length,0);assert.ok(evidence.observed.every(run=>run.taskCompleted));}
    results.push({variant,code:evidence.findings[0]?.code||'none',reproduced:`${evidence.findings[0]?.occurrences??3}/3`,correctedControl:evidence.controlsClean,taskCompleted:evidence.observed.every(run=>run.taskCompleted)});
    console.log(JSON.stringify(results.at(-1)));
  }
}finally{await app.close();await writeFile('output/playwright/evidence/summary.json',JSON.stringify(results,null,2));}
console.table(results);
