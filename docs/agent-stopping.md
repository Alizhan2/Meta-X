# Graceful stopping

The earlier prompt required a keyboard action even when no supported path remained. Eight of the frozen 25 runs ended with `model_incomplete`, exhausting the 2,048-token response limit. The new policy allows the agent to stop and records why it did so.

## Enforced runner policy

After every executed action, a monitor checks accessible page semantics, full focus identity/value/selection, and viewport scroll. Three consecutive identical observations stop the agent with `unchanged_observation`. Pixel changes are excluded because carets and animation can vary without interaction progress.

Same-direction Tab or Shift+Tab traversal stops with `focus_navigation_cycle` when it returns to an earlier page/focus state after at least two transitions between distinct states. Automatic viewport scrolling is excluded from this cycle identity. Reversing direction or pressing another key resets the traversal. A fresh change between actions resets monitoring, so asynchronous visible progress is not mistaken for another no-op.

The runner checks the server booking record before applying a stop. A successful final action, including a delayed write, still completes the task. A stop breaks the loop before any further agent decision or keyboard action. Independent fixture probes and exact-key replays then run separately; historical replay is never truncated by the new policy.

## Model terminal response

The model still has exactly two browser tools: `press_key` and `type_text`. It can return a completed assistant message containing only:

```json
{"status":"blocked","reason":"Short observed obstacle"}
```

The reason must contain 1–240 characters, with no extra keys. This ends the run with `model_reported_blockage`; it consumes one model request and zero keyboard actions. Mixed stop plus tool calls, malformed messages, forbidden actions, incomplete generations and HTTP failures remain invalid. Existing token limits and the maximum 25 model attempts are unchanged.

A policy or model stop is a valid but inconclusive task attempt. Only the separate repeated fixture-contract probes can support the pipeline's suspected-blocker outcome. Neither repetition nor a model's explanation establishes that an unfamiliar website is defective.

## Checks and limits

`npm test` verifies stop ordering with injected decisions: no extra model call/key, exact terminal validation, delayed-success precedence, selection/scroll/semantic changes, and attribution rules. `npm run check:regressions` exercises delayed booking and exact-key replay in Chromium.

`npm run check:stopping` replays the 25 frozen action sequences through real local Chromium observations without contacting Meta. It retains successful corrected/focus-loss paths and records policy coverage on blocked paths. This is a counterfactual replay, not 25 new AI trials. Truncated historical traces remain explicitly marked when no guard fires before their saved actions end. The script never rewrites the original benchmark.

`node scripts/pilot-stopping.mjs` makes five **billable** fresh runs, one per condition, without retries (at most 125 model requests). It stores a separate manifest under ignored `output/playwright/`. Verify available credits before running it.

This is a bounded exploration policy. It may stop a legitimate retry or miss a changing/nonrepeating dead end; the action budget remains the fallback. A small fixture pilot does not establish general website reliability.

See [recorded replay and five fresh live results](stopping-2026-10-26/README.md). All 24 unit tests and the delayed-booking/exact-replay browser regression passed. The five live runs preserve both task completions and stop all three blocking conditions without model or replay errors.
