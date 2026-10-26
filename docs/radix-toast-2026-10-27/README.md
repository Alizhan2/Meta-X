# Second third-party example: Radix Toast before/after an upstream dependency upgrade

Measured October 27, 2026 (Asia/Aqtobe), using Playwright **1.64.1**, Chromium **156.0.8078.4**, React **18.3.1**, macOS arm64, and real **Radix Toast 1.2.19 / 1.2.20** npm packages.

Open [the standalone before/after report](comparison.html), or run `npm run demo:radix-toast` and visit http://127.0.0.1:4197/ for a viewer with working links to both versions.

## Known issue and correction

[Upstream issue #2906](https://github.com/radix-ui/primitives/issues/2906) reports Escape removing an unfocused toast along with the focused one. [Upstream PR #4005](https://github.com/radix-ui/primitives/pull/4005) fixes it. We reproduced this known, historically fixed bug; we did not discover it first or author the upstream fix.

Both conditions use the same host JSX/CSS and three actual Radix notifications. There is no custom Escape handler, focus movement or simulated failure. Controlled open state simply reflects the library's `onOpenChange`. Notification expiry is disabled equally with `duration={Infinity}`.

**Correction:** upgrade the pinned Toast dependency from 1.2.19 to 1.2.20. The dependencies are installed side by side as npm aliases. Their corresponding transitive graphs also differ: primitive, dismissable-layer, portal, presence, controllable-state and visually-hidden receive patch upgrades. We explicitly compare the full dependency upgrade, **not one isolated source line**. The full [lockfile](../../examples/radix-toast/package-lock.json) retains both graphs and npm integrity values; no package files are patched.

## Deterministic browser test

The identical sequence is **Tab × 6 → Escape**. Before Escape all three notifications are present and focus is inside Draft saved. The original TabProof keyboard executor performs all keys. The oracle reads actual DOM/focus/open states, without changing them.

| Observation | Original: 1.2.19 | Corrected: 1.2.20 |
| --- | --- | --- |
| Exactly one Escape inside Draft saved | 3/3 | 3/3 |
| Draft saved dismissed | 3/3 | 3/3 |
| Upload complete preserved | 3/3 | 3/3 |
| Sync finished preserved | **0/3** | **3/3** |
| Full scenario passes | **0/3** | **3/3** |

The old version removes two notifications; the new version removes only the selected one. [Per-action observations, package metadata and source hashes](deterministic-results.json) are published. Trace ZIPs remain in local ignored `output/playwright/radix-toast-check-1793044651750/`.

Additional controls, each run on both package versions:

- **Focus middle toast (Upload):** original removes Upload and Sync; corrected removes only Upload. This reproduces the failure beyond a single host ID/position.
- **Real pointer close button on Draft:** both versions remove only Draft.
- **Escape with focus outside the notifications:** both versions remove only Sync, the most recent notification.

`middle-toast-control.passed:true` in the JSON means the expected version-specific observation matched, not that the old component is accessible. Separate original-only and corrected-only commands were executed and exited **1** and **0**, respectively. The matrix exits 0 only when the specified original failure, corrected success and control observations are all reproduced.

## Actual TabProof / Muse Spark comparison

| Run | Version | Actions | Model/API validity | Model result | Independent live-session measurement |
| --- | --- | --- | --- | --- | --- |
| agent-1793044691579268206 | 1.2.19 | 7 | Valid | Reported blockage | Only Upload remains; Sync incorrectly removed |
| agent-1793044745859339841 | 1.2.20 | 7 | Valid | Reported completion | Upload and Sync remain; only Draft removed |

Both agents independently chose **six Tabs and one Escape**. They used the existing TabProof model loop, worker and keyboard-only boundary; no model decisions were scripted and no agent-runtime changes were needed. Both attempts are retained in [development-attempts.json](development-attempts.json); there were no API-error attempts in this comparison.

The [accepted summary](agent-summary.json) asserts matching starting URL, task, model, full runtime configuration and stable host source fingerprints. The package version is the deliberate variable. Model: `muse-spark-1.3`; agent fingerprint `6f1a17ab9d07d1e1c4fd57a8a5240154f41fe05092cfcef6695ea294684629ce`; 25-action budget; 64,000 input-token preflight limit; 2,048 output limit; context policy v3. Known generation usage: 29,612 tokens original and 29,761 corrected; this is not a monetary cost estimate.

The oracle recorded states in the **actual live sessions**, separately from screenshots/semantics passed to the model. It checked the focus origin of Escape, initial and remaining notification sets, preservation through every step, and absence of Dismiss-button activation. These read-only measurements were never passed to the model. [Raw reports](runs/) remain unaltered, with [independent audits](audits/) alongside them. Generic custom-site completion is still labeled model-reported; this example-specific audit is separate.

Two live attempts are an exploratory demonstration, not a reliability estimate. The deterministic 3+3 repeats are six different browser sessions with no model calls, not six more agent trials.

## Re-run

```sh
npm ci
npm ci --prefix examples/radix-toast --ignore-scripts
npx playwright install chromium
npm run check:radix-toast
npm run check:radix-toast -- --condition=original
npm run check:radix-toast -- --condition=corrected
```

The original-only command is supposed to fail. These checks make no model calls. To spend Meta credits on a fresh pair, explicitly run `npm run check:radix-toast:agent`.

Regenerate the report from the saved local artifacts:

```sh
node scripts/render-radix-toast-comparison.mjs \
  output/playwright/radix-toast-check-1793044651750/results.json \
  output/playwright/radix-toast-agent-1793044691555/summary.json
```

The renderer rejects mismatches between deterministic/live host-source hashes, requires a comparable valid live pair, and preserves any prior attempts supplied as additional summary paths.

This example is independent of [the first React Aria case](../react-aria-2026-10-27/README.md). It uses Radix, not React Aria, and demonstrates an actual upstream dependency upgrade rather than an integration tabindex workaround. It remains a local minimal reproduction in one browser, not a new public-site discovery, generic accessibility detection or WCAG certification.
