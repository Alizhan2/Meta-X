# Graceful-stop verification — October 26, 2026

This follow-up uses a new agent build. The original [25-run benchmark](../benchmark-2026-10-26/README.md) remains unchanged. Neither replay results nor this small live pilot are pooled into its metrics.

## Saved-key replay in local Chromium

[Raw replay check](replay-check.json): all 25 original keyboard traces were replayed against fresh local sessions with the new progress monitor. No Meta requests were made. The model's future choices were not simulated.

| Condition | Traces | Completed as before | Runner stop | No guard before saved trace ended/budget |
| --- | ---: | ---: | ---: | ---: |
| Correct | 5 | 5 | 0 | 0 |
| Unreachable confirmation | 5 | 0 | 4 | 1 truncated trace |
| Keyboard-inaccessible calendar | 5 | 0 | 4 | 1 action budget |
| Undismissable modal | 5 | 0 | 5 | 0 |
| Focus loss | 5 | 5 | 0 | 0 |

All ten previously successful paths still complete. The runner guard fires on 13/15 blocked traces, including seven of the eight traces that previously ended before an incomplete model response. It does **not** establish prevention of every future model failure. The one truncated unreachable-button trace contains only 21 saved actions and ends without a guard; no unsaved actions or model responses were invented. One calendar trace reaches its 25-action budget.

Stopping trims 55 saved keyboard actions in this counterfactual replay. This is not a measured token/cost saving: a fresh model can choose different actions or stop itself.

## Five fresh Meta runs

[Pilot manifest](pilot.json) links all five raw run records. Same runtime/source fingerprint as the local replay above; model `muse-spark-1.3`. Exactly one new attempt per condition, no retries.

| Condition | Actions / model requests | AI task result | Stop |
| --- | ---: | --- | --- |
| Correct | 15 / 15 | Completed | Server booking matches |
| Unreachable confirmation | 20 / 20 | Inconclusive | Runner: focus navigation cycle |
| Keyboard-inaccessible calendar | 16 / 16 | Inconclusive | Runner: focus navigation cycle |
| Undismissable modal | 17 / 17 | Inconclusive | Runner: three unchanged observations |
| Focus loss | 18 / 18 | Completed | Server booking matches; independent focus defect remains |

All five AI runs are valid; no `model_incomplete`, evidence-collection error or replay error occurred. The three blocking conditions stop before the 25-action limit. Requests equal executed actions: no extra inference was sent after a runner stop. Independent probes reproduce each defect three times against three clean controls; this is fixture-contract evidence, not a standalone model diagnosis score.

The pilot made 86 bounded model requests. Token usage and maximum preflight/output counts are retained in the manifest. The assistant's terminal JSON parser is verified with injected responses; no model-declared stop occurred in this pilot. All three early live stops came from enforced runner checks.

One trial per condition is a smoke test, not a reliability estimate or proof that future blocked tasks cannot exhaust the output/action limit. The unchanged old benchmark still contains its original eight incomplete model responses.

## Reproduce

```sh
npm test
npm run check:regressions
npm run check:stopping
```

The checks above do not contact Meta. A separate fresh pilot is run with `node scripts/pilot-stopping.mjs`; it contacts the model and can consume credits. See [policy and limitations](../agent-stopping.md).
