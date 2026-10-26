import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createFixtureServer} from '../src/server.mjs';
import {openSession,observe} from '../src/browser.mjs';
import {expected,variants} from '../src/fixture.mjs';

const app=await createFixtureServer();const results=[];
await mkdir('output/playwright',{recursive:true});
try{
  for(const variant of variants){
    const session=await openSession(app,variant,{budget:60});
    const press=key=>session.executor.execute({name:'press_key',arguments:{key}});
    const type=text=>session.executor.execute({name:'type_text',arguments:{text}});
    const focus=()=>session.page.evaluate(()=>document.activeElement?.id);
    try{
      // Read-only observation snapshots must not expose the selected condition.
      const initial=await observe(session.page,`output/playwright/${variant}-start.png`);
      for(const label of variants.filter(v=>v!=='correct'))assert.ok(!initial.semantics.includes(label));
      assert.equal(await focus(),'name');
      await type(expected.name);await press('Tab');await type(expected.email);await press('Tab');
      assert.equal(await focus(),'date-trigger');await press('Enter');await press('Tab');
      if(variant==='calendar_keyboard'){
        assert.equal(await focus(),'time-14');assert.equal(session.record(),null);
        results.push({variant,check:'date options skipped by keyboard',pass:true});continue;
      }
      await press('Tab');await press('Enter');
      if(variant==='focus_loss'){
        assert.equal(await focus(),'title');assert.equal(session.record(),null);
        results.push({variant,check:'focus returns to heading instead of date trigger',pass:true});continue;
      }
      assert.equal(await focus(),'date-trigger');await press('Tab');assert.equal(await focus(),'time-14');await press('ArrowRight');assert.equal(await session.page.locator('input[name=time]:checked').inputValue(),'15:00');await press('Tab');assert.equal(await focus(),'review');await press('Enter');
      await press('Escape');
      if(variant==='modal_dismissal'){
        assert.equal(await session.page.locator('dialog').evaluate(el=>el.open),true);
        const path=[];for(let i=0;i<6;i++){await press('Tab');path.push(await focus());}
        assert.ok(!path.includes('close-review'));assert.equal(session.record(),null);
        results.push({variant,check:'Escape blocked and close button absent from tab path',pass:true});continue;
      }
      assert.equal(await focus(),'review');await press('Tab');
      if(variant==='unreachable_button'){
        assert.notEqual(await focus(),'book');
        const path=[];for(let i=0;i<12;i++){await press('Tab');path.push(await focus());}
        assert.ok(!path.includes('book'));assert.equal(session.record(),null);
        results.push({variant,check:'confirmation absent from tab path',pass:true});continue;
      }
      assert.equal(await focus(),'book');await press('Enter');
      await session.page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Your session is booked'));
      assert.deepEqual(session.record(),expected);
      await observe(session.page,'output/playwright/correct-pass.png');
      results.push({variant,check:'keyboard-only booking matches server record',pass:true});
    }catch(error){const state=await observe(session.page,`output/playwright/${variant}-failure.png`);console.error(state.semantics);throw error;}finally{await session.close();}
  }
}finally{await app.close();await writeFile('output/playwright/fixture-checks.json',JSON.stringify(results,null,2));}
console.table(results);
assert.equal(results.length,5);
