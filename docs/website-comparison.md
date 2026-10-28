# Compare your own website before and after a fix

Implemented October 28, 2026 for the existing local TabProof workbench.

## Start a comparison

Choose **Your website · before and after** in the main console. Supply two different HTTP(S) URLs, a task, the opener's plain CSS selector and the dialog's plain CSS selector. These selectors must identify the same intended roles on both versions. An opener must be unique and visible in the main frame. The dialog may be absent when closed but cannot match multiple nodes.

The contract is fixed in this first version:

1. From a fresh browser, reach the opener with at most 50 Tab presses.
2. Press Enter. Observe that the configured dialog is visible and focus is inside it.
3. Press Escape. Independently observe that the dialog is hidden or removed and focus is on its opener.

The checker reads DOM state; its only actions go through the keyboard executor. It never clicks, fills, focuses elements, submits forms directly, or runs user-provided JavaScript. CSS selectors are used only by the read-only harness and are not added to the model's task or instructions. Naturally observed page semantics and current focus remain visible to the model.

Use test pages: starting this mode explicitly requests three fresh checks of each version, which may activate the configured opener six times. This is separate from the ordinary one-URL mode, which still performs no automatic probes/replays on arbitrary sites.

## Two methods

- **Independent keyboard checks · free**: six actual Chromium sessions, no model requests, no key required.
- **Meta agent + independent checks**: one fresh Meta task attempt per version, each followed by three fresh keyboard checks. A trusted observation hook reads dialog visibility/focus during the agent's own Escape actions, separately from its declaration of completion. The agent has no access to this hook or its selectors.

Both use the same single-run lock, Stop button, history and report/download controls as other runs. A completed export includes the parent report, available detailed measurements, both latest screenshots and their recorded provenance. Screenshots in the final side-by-side view come from the last independent check; the action record is explicitly labelled as the AI session or a specified independent session.

## What verifies a result

The independent difference requires all three original checks to fail the exercised contract with the same reason, all three corrected checks to pass, and matching recorded browser/build configurations. The checker distinguishes `escape_did_not_close` from `focus_not_restored`.

An unreachable/missing opener, multiple matching nodes, invalid selector syntax, an already-open dialog, or failure to open with focus inside is **inconclusive for this contract**. These are not counted as successful Escape tests or attributed as reproduced Escape defects. Two passing versions and a corrected version that still fails do not establish an improvement.

In agent mode, verification additionally requires distinct valid agent sessions, matching actual model/configuration and a failed original/passed corrected read-only Escape observation. If the agent claims completion without exercising Escape, independent results may still show an improvement but the combined comparison remains unverified. A model/API failure stops the pair and prevents the corrected attempt. Injected test decisions are labelled `scripted-test`, never real Meta execution.

This checks only the configured dialog contract. It does not independently verify arbitrary other requirements in the task, certify accessibility, prove source-code equivalence of the submitted URLs, or establish that one particular code change caused the difference. The application has no generic success oracle for unfamiliar workflows.

## Cancellation and recovery

Stop preserves partial observations, prevents subsequent sessions and clears the overall verified flag, including cancellation while the final evidence file is being written. Probes check the signal at action/observation boundaries and close their own sessions in `finally`; they avoid forcibly closing the browser in the middle of a protocol event. Agent cancellation still interrupts its model request and browser.

Progress and the final HTML/JSON parent report are saved atomically. On service restart, an unfinished website comparison is marked failed/unverified rather than resumed or presented as completed.

## API and files

```json
{
  "beforeUrl": "http://127.0.0.1:4207/before",
  "afterUrl": "http://127.0.0.1:4207/after",
  "task": "Open the details dialog, close it with Escape, and return to its opener.",
  "checkMode": "deterministic",
  "contract": {
    "type": "dialog_escape_focus",
    "triggerSelector": "#open-details",
    "dialogSelector": "#details-dialog"
  }
}
```

POST this exact shape to `/api/runs`. `checkMode` is `deterministic` or `agent`. Extra parameters, arbitrary test code and unsupported contract types are rejected. Both URLs use the existing custom-site validation and pinned proxy: private/reserved destinations and the control server, including loopback aliases, remain blocked. Per-session same-site navigation restrictions, clean profiles, popup handling and blocked service workers remain in effect. Authentication, iframes, Space-only openers and alternative contract types are not implemented.

The parent `output/playwright/agent-ID/` contains `report.json`, `report.html`, `details.json` and `original.png` / `corrected.png`. Nested `agent/agent-CHILD/` folders retain the actual model reports and per-action screenshots; they are not separate top-level history runs. `details.json` retains child records and all independent probe traces. Browser/runtime/model settings and source fingerprints are recorded for comparison.

## Verification

`npm test` passes 62 tests. `npm run check:website-comparison` exercises the UI → API → actual isolated browsers → persisted result → reload/restart → offline export flow with no Meta calls. It covers two different site origins, original/fixed, both clean, still broken, wrong focus restoration, invalid selector syntax, shared locking, key gating, cross-origin rejection, user cancellation, cancellation during the final write, an agent that does not exercise Escape, and an API/model failure. Agent decisions in that suite are explicitly injected; DOM checks and browser execution are real.

`npm run check:website-comparison:live` is a separate paid verification against the main running service and `npm run demo:website-comparison`. It starts the actual form's agent comparison, checks both real model sessions and all six independent probes, downloads the report, opens it from disk in an offline browser and restores it through history.

The real Meta pair `agent-1793179724352159542` passed: three actual keyboard actions on each version; Escape remained open before the change and closed with restored opener focus afterwards. Each side's three independent sessions agreed. Eight Meta decision requests were recorded. This is a single paired demonstration, not a reliability estimate. The dedicated final-write cancellation regression and explicit scripted-test display label were added afterwards and verified separately without additional model calls. The live pair's exact configuration fingerprints remain in its saved records.

An initial development test assumed `[broken` was invalid CSS; Chromium accepted it as a selector without a match. The result correctly remained inconclusive, but the zero-action assertion failed. The test now uses a genuinely invalid selector, `[`. The failed attempt remains in local ignored output; it was not substituted into the passing evidence.

Existing fixture-console, custom-site and third-party-example browser regressions also passed. Structured results and artifact paths are in [website-comparison-verification.json](website-comparison-verification.json).
