# 25-run controlled-fixture benchmark

Measured October 26, 2026, using runtime commit **bf9bc20**, `muse-spark-1.3`, one browser/build configuration, and synthetic data. Five fresh AI sessions were scheduled for each of five conditions, two at a time. No run was retried or replaced. All 25 records are present in [the manifest](manifest.json) and [raw reports](runs).

## Observed results

| Condition | Booking completed / all 5 attempts | Valid AI runs | Model output-limit failures | Confirmed finding among valid AI runs | Corrected exact-replay errors |
| --- | --- | --- | --- | --- | --- |
| Correct | 5/5 | 5/5 | 0 | No false positives: 0/5 | 0 |
| Unreachable confirmation | 0/5 | 2/5 | 3 | 2/2 | 0 |
| Calendar keyboard barrier | 0/5 | 5/5 | 0 | 5/5 | 4 |
| Modal cannot be dismissed | 0/5 | 0/5 | 5 | N/A | 0 |
| Focus loss | 5/5 | 5/5 | 0 | 5/5 | 5 |

Every correct-control booking completed in **15 keyboard actions**. Focus-loss bookings completed in **18 actions**, but completion did not remove the independently observed focus defect. No incorrect booking record was reported as success.

The findings column is a **conditional hybrid-system measure**: the independent detector knows the expected behavior of this fixture. It is not standalone AI defect-detection accuracy. The eight `model_incomplete` runs are retained in the all-attempt denominators, listed as failures, and excluded from eligible-run finding ratios. In particular, 12/12 findings among eligible defect runs does not mean 20/20 defect runs or 100% model accuracy. No standalone model-diagnosis rate is reported.

Full calculated ratios and error lists: [metrics](metrics.md), [summary JSON](summary.json). Five trials per condition and one controlled page are exploratory; these numbers cannot establish general website reliability.

## Comparability, replay and usage

- All 25 run IDs are unique, with one recorded browser/build/model configuration and no missing configuration.
- The [fresh-run comparison](comparison.json) selects the earliest valid blocked run and the earliest corrected control that started after it finished. The tasks, model, budget and recorded configuration match; the corrected task completes in 15 actions. Selection does not modify either original report.
- Original-condition exact replay matches all 25 recorded focus paths. Some traces end early because the model response was truncated; matching a partial trace is not proof that the complete task was exercised.
- Nine corrected-condition exact replays failed after successful independent probes: four calendar and five focus-loss traces activated a navigation and interrupted observation. The raw records retain these errors. They are not nine lost independent defect probes.
- Known usage: **12,603,702 tokens across 505 model-response attempts**. Every attempt returned usage; no request count is unknown. Token-count preflights are separate from generation responses.
- Maximum preflight input: **60,783 / 64,000**. Maximum output: **2,048 / 2,048**. Maximum generation attempts/actions per run: **25 / 25**. See [request bounds](../benchmark-safety.md).

## Separate post-benchmark regression

After freezing the raw benchmark records, the browser-settlement code was changed to tolerate navigation between keypress and observation. All nine previously failing corrected replays then executed without a context error, using only the saved keys and **no new Meta calls**. None completed the task: the old trace does not adapt to the corrected interface. These results are in [replay-followup.json](replay-followup.json), separately from the original metrics.

New reports also separate independent-probe errors from replay-stage errors, so a later replay failure no longer implies that completed independent findings were lost. The measured 25-run dataset predates this presentation/stage-classification fix.

## What to improve next

The current agent reliably completes this corrected fixture, but does not stop cleanly on impossible interactions. The next experiment should add a bounded stuck-state/diagnostic exit so a blocked flow does not consume the entire reasoning/output budget. That experiment must use a new build fingerprint and a separate cohort; these measurements must not be mixed with it.

The public raw reports contain synthetic inputs, actions, focus observations, configuration and usage. Screenshots and full independent-probe artifacts remain in local ignored `output/playwright/`; the repository does not contain API keys or model reasoning.
