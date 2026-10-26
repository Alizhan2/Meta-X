import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeBenchmark} from '../src/metrics.mjs';

test('benchmark retains failures in operational denominators and never invents model detection',()=>{
  const base={variant:'correct',configuration:{version:1},outcome:'task_completed',agentResult:{valid:true,outcome:'task_completed'},usage:[],requests:[]};
  const failed={...base,runId:'failed',agentResult:{valid:false,reason:'model_http_429'}};
  const summary=summarizeBenchmark([base,failed]);const row=summary.rows[0];
  assert.deepEqual(row.operationalCompletion,{numerator:1,denominator:2,percent:50});
  assert.equal(row.eligibleCompletion.denominator,1);assert.equal(row.errors.length,1);assert.equal(summary.modelDefectDetection,null);
});
test('mixed configurations cannot yield eligible comparisons and empty groups yield N/A',()=>{
  const report={variant:'correct',agentResult:{valid:true,outcome:'task_completed'},configuration:{version:1}};
  const summary=summarizeBenchmark([report,{...report,configuration:{version:2}}]);
  assert.equal(summary.configurationConsistent,false);assert.equal(summary.rows[0].eligible,0);assert.equal(summary.rows[1].operationalCompletion.percent,null);
});
