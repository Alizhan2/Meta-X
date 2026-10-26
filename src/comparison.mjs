import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {modelSettings,inputTokenLimit} from './meta.mjs';
import {matchesBooking} from './evidence.mjs';

export async function runConfiguration(browserVersion){
  const hash=createHash('sha256');
  for(const file of ['fixture.mjs','keyboard.mjs','browser.mjs','meta.mjs','server.mjs','evidence.mjs','report.mjs','comparison.mjs','../scripts/run-agent.mjs','../public/style.css'])hash.update(file).update(await readFile(new URL(file,import.meta.url)));
  return {schema:1,fixtureAndAgentBuild:hash.digest('hex'),browserVersion,playwrightVersion:createRequire(import.meta.url)('playwright/package.json').version,platform:process.platform,architecture:process.arch,seed:'booking-v1',requestedModel:process.env.META_MODEL||'muse-spark-1.3',inputTokenLimit,modelSettings};
}

export function compareRuns(original,corrected){
  const fail=reason=>({verified:false,reason});
  if(original.runId&&original.runId===corrected.runId||original.startedAt&&original.startedAt===corrected.startedAt)return fail('same_run');
  if(original.agentResult?.valid!==true||original.outcome!=='suspected_blocker'||!original.evidence?.findings.some(f=>f.confirmedInControlledFixture))return fail('no_valid_original_blocker');
  if(corrected.variant!=='correct'||corrected.agentResult?.valid!==true||corrected.outcome!=='task_completed'||!matchesBooking(corrected.record)||corrected.evidence?.controlsClean!==true)return fail('corrected_run_not_completed');
  if(original.task!==corrected.task||original.model!==corrected.model||original.budget!==corrected.budget)return fail('different_task_model_or_budget');
  if(!original.configuration||!corrected.configuration)return fail('missing_run_configuration');
  if(JSON.stringify(original.configuration)!==JSON.stringify(corrected.configuration))return fail('different_run_configuration');
  return {verified:true,reason:'distinct_comparable_runs'};
}
