# DispatchDesk stability: three new Meta pairs

Recorded October 31, 2026 (Asia/Aqtobe). This is a new consecutive cohort; the October 29 pilot is excluded. All scheduled attempts are retained. No retries, injected decisions or cherry-picked replacements were used.

## Results

| Pair | Discovered prefix | Meta actions before / after | First Escape before / after | Independent checks before / after | Verified |
| --- | --- | --- | --- | --- | --- |
| [1](agent-1793446729013523813.json) | 16 actions | 20 / 21 | Failed / Passed | 3 failures / 3 passes | Yes |
| [2](agent-1793446893384801091.json) | 16 actions | 20 / 17 | Failed / Passed | 3 failures / 3 passes | Yes |
| [3](agent-1793447041673720000.json) | 18 actions | 22 / 17 | Failed / Passed | 3 failures / 3 passes | Yes |

All 6/6 model sessions were valid and reached/exercised the configured order/date preview. The original agent discovered a route in 3/3 pairs. Combined contract verification passed 3/3 pairs. There were no API failures, cancellations or unstarted corrected attempts in this cohort. No recorded Enter/Space activated Apply delivery change.

The first Escape failed in 3/3 original model sessions and passed in 3/3 corrected model sessions. All original agents eventually reported completion after recovery; the failure is not permanent entrapment. All corrected agents also reported completion. These declarations do not independently prove the rest of the business task.

There were 9/9 independent first-Escape failures before the correction and 9/9 passes after it. These 18 fresh browser reproductions are **not 18 more AI runs**. Within each pair, both versions replay the exact prefix discovered by that pair’s original Meta session, with focus/value checks and provenance assertions. Prefix lengths were 16, 16 and 18; fresh corrected agents chose their own paths.

The cohort made 123 model inference requests. Each session retained the existing 25-decision limit, 64,000-token input ceiling and 2,048-token output cap. Generation usage is retained in the raw reports; no dollar cost is inferred from request counts.

## Reproducibility and scope

Every model session used `muse-spark-1.3`, Chromium `156.0.8078.4`, Playwright `1.64.1` and build `5612c7051455d62c80e124a0be7c86a90e00eaf47cff662e0246519e90dc8377`. All six recorded configurations match. The task, target contract and source SHA-256 values are in [summary.json](summary.json). Live served HTML was checked against both generated releases before any model call. Their only source difference is the existing cancel-event regression.

This controlled synthetic workflow and three pairs provide an observed repeatability result, not a general reliability estimate across sites or an accessibility certificate. The target selectors are known to the independent harness; the model receives the business task and page observations, without an authored route. False-positive rates on unrelated clean tasks were not measured in this cohort.

Raw parent reports linked above retain exact actions, live Escape audits, independent probes, model request/usage metadata and configuration. Recorded images remain in the local run service and output directory; screenshot links inside these raw JSON files require that service. [CSV table](results.csv). [Prior pilot](../dispatch-discovery.md).

## Repeat the series

Start `npm start` and `npm run demo:dispatch`, then run `npm run check:discovery:stability`. This makes three new paid Meta pairs sequentially, saving every scheduled result and stopping on infrastructure errors. It does not replace existing evidence.
