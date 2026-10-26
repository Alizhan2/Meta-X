export const expectedFinding=Object.freeze({correct:null,unreachable_button:'confirmation_unreachable',calendar_keyboard:'calendar_date_unreachable',modal_dismissal:'modal_keyboard_dismissal',focus_loss:'unexpected_focus_return'});
const ratio=(numerator,denominator)=>({numerator,denominator,percent:denominator?Math.round(1000*numerator/denominator)/10:null});

export function summarizeBenchmark(reports){
  const configurations=reports.filter(r=>r.configuration).map(r=>JSON.stringify(r.configuration));
  const common=!!configurations.length&&new Set(configurations).size===1;
  const rows=Object.entries(expectedFinding).map(([variant,code])=>{
    const attempts=reports.filter(r=>r.variant===variant);
    const eligible=attempts.filter(r=>r.agentResult?.valid===true&&r.configuration&&common);
    const signatures=eligible.map(r=>r.outcome+':'+(r.evidence?.findings.filter(f=>f.confirmedInControlledFixture).map(f=>f.code).sort().join(',')||''));
    const counts=new Map();for(const signature of signatures)counts.set(signature,(counts.get(signature)||0)+1);
    const knownFindings=r=>r.evidence?.findings.filter(f=>f.confirmedInControlledFixture).map(f=>f.code)||[];
    const replay=attempts.flatMap(r=>(r.replays||[]).filter(p=>p.label==='Original condition'));
    return {variant,attempts:attempts.length,eligible:eligible.length,
      operationalCompletion:ratio(attempts.filter(r=>r.agentResult?.valid===true&&r.agentResult?.outcome==='task_completed').length,attempts.length),
      eligibleCompletion:ratio(eligible.filter(r=>r.agentResult.outcome==='task_completed').length,eligible.length),
      confirmedFixtureFinding:code?ratio(eligible.filter(r=>knownFindings(r).includes(code)).length,eligible.length):null,
      falsePositive:code?null:ratio(eligible.filter(r=>knownFindings(r).length>0||r.outcome==='suspected_blocker').length,eligible.length),
      reproducibility:ratio(counts.size?Math.max(...counts.values()):0,eligible.length),
      replayPathMatches:ratio(replay.filter(r=>r.focusPathMatches===true).length,replay.length),
      errors:attempts.filter(r=>r.agentResult?.valid!==true).map(r=>({runId:r.runId,reason:r.agentResult?.reason||r.reason||'missing_report'})),
      evidenceErrors:attempts.filter(r=>r.evidenceError).map(r=>({runId:r.runId,reason:r.evidenceError}))};
  });
  const usage=reports.flatMap(r=>r.usage||[]);
  return {attempts:reports.length,configurationConsistent:common,missingConfigurations:reports.filter(r=>!r.configuration).length,rows,
    requests:reports.reduce((n,r)=>n+(r.requests?.length||0),0),
    knownTokens:usage.reduce((sum,u)=>sum+(u.total_tokens||0),0),
    requestsWithoutUsage:reports.flatMap(r=>r.requests||[]).filter(r=>!r.usage).length,
    modelDefectDetection:null,
    limitation:'Fixture-finding rates measure the hybrid system with a fixture-specific independent detector. They are not standalone model defect-detection rates. Errors remain in operational completion denominators and are listed separately from eligible-run ratios. Five trials per condition are exploratory.'};
}

export function benchmarkMarkdown(summary){
  const format=value=>value?`${value.numerator}/${value.denominator}${value.percent===null?' (N/A)':` (${value.percent}%)`}`:'N/A';
  return `# TabProof benchmark\n\n${summary.attempts} scheduled attempts recorded. Configuration consistent among recorded configurations: ${summary.configurationConsistent}. Missing configurations: ${summary.missingConfigurations}.\n\n| Condition | Completed / all attempts | Completed / eligible | Confirmed fixture finding / eligible | False positives / eligible | Reproducibility / eligible |\n| --- | --- | --- | --- | --- | --- |\n${summary.rows.map(r=>`| ${r.variant} | ${format(r.operationalCompletion)} | ${format(r.eligibleCompletion)} | ${format(r.confirmedFixtureFinding)} | ${format(r.falsePositive)} | ${format(r.reproducibility)} |`).join('\n')}\n\n${summary.limitation}\n\nKnown usage: ${summary.knownTokens} tokens across ${summary.requests} attempted requests. Requests without returned usage: ${summary.requestsWithoutUsage}. No dollar cost is inferred from tokens.\n\n## Errors retained\n\n${summary.rows.flatMap(r=>[...r.errors.map(e=>`- ${r.variant}: ${e.runId}: ${e.reason}`),...r.evidenceErrors.map(e=>`- ${r.variant}: ${e.runId}: independent evidence error: ${e.reason}`)]).join('\n')||'None.'}\n`;
}
