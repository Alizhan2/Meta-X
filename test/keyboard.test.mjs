import test from 'node:test';
import assert from 'node:assert/strict';
import {createKeyboardExecutor} from '../src/keyboard.mjs';

test('forbidden tools, injected parameters and out-of-budget actions never reach browser',async()=>{
  const events=[];
  const keyboard={press:async key=>events.push(['press',key]),type:async text=>events.push(['type',text])};
  const executor=createKeyboardExecutor({keyboard},{budget:2});
  for(const name of ['click','focus','evaluate','goto','submit','fill','shell'])await assert.rejects(executor.execute({name,arguments:{}}));
  for(const action of [
    {name:'press_key',arguments:{key:'Meta+L'}},
    {name:'press_key',arguments:{key:'Tab',selector:'#book'}},
    {name:'type_text',arguments:{text:'x',selector:'#name'}},
    {name:'type_text',arguments:{text:'a'.repeat(257)}},
    {name:'type_text',arguments:{text:'hello\nworld'}},
    {name:'type_text',arguments:{text:'abc'},script:'alert(1)'}
  ])await assert.rejects(executor.execute(action));
  assert.equal(events.length,0);assert.equal(executor.used,0);
  await executor.execute({name:'type_text',arguments:{text:'Alex Tester'}});
  await executor.execute({name:'press_key',arguments:{key:'Tab'}});
  await assert.rejects(executor.execute({name:'press_key',arguments:{key:'Enter'}}),/budget/);
  assert.deepEqual(events,[['type','Alex Tester'],['press','Tab']]);
});
