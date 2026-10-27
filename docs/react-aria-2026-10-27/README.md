# Third-party React Aria: keyboard regression before and after an integration fix

Measured October 27, 2026 (Asia/Aqtobe), using real **React Aria Components 1.19.0 / React Aria 3.50.0**, React 18.3.1, Playwright 1.64.1 and Chromium **156.0.8078.4** on macOS arm64.

Open [the standalone comparison](comparison.html), or run `npm run demo:third-party` and visit http://127.0.0.1:4187/ for a local viewer with working links to both integrations.

## Attribution and exact scope

We reproduced the already published [adobe/react-spectrum issue #10395](https://github.com/adobe/react-spectrum/issues/10395); we did **not** discover this upstream issue first. This is a local minimal integration of an actual, unmodified third-party npm package, not an untouched production website and not our appointment-booking fixture.

React Aria supplies Dialog, Modal and the focus scope. The project supplies the host markup, overflowing reading content, styles, checks and report. We add no custom focus trap, key interception or simulated broken scrolling. Dependencies and their integrity values are pinned in [the example lockfile](../../examples/react-aria-scroll/package-lock.json).

The correction adds an explicit `tabIndex={0}` to the scrolling reading panel. It is an **application integration workaround** described in the upstream issue. We did not patch, upgrade or submit a change to Adobe's library. Explicit tabindex creates a tab stop even if content later stops overflowing, which is a limitation of this minimal workaround.

## Deterministic reproduction: one test, both conditions

Sequence: **Tab → Enter → Tab → End → Escape**. All keyboard actions use TabProof's real keyboard executor. The checker reads focus and element geometry/scroll state without changing the page.

| Check | Original integration | Corrected integration |
| --- | --- | --- |
| Tab reaches the reading panel | No, 0/3 | Yes, 3/3 |
| End reaches the actual bottom and exposes the final paragraph | No, 0/3; scrollTop stays 0 | Yes, 3/3; scrollTop 2260 |
| Escape closes the dialog and returns focus to the opener | Yes, 3/3 | Yes, 3/3 |
| Complete keyboard contract | **0/3 pass** | **3/3 pass** |

Positive controls:

- Real pointer-wheel scrolling moves the original panel by **900 px** in each of its three sessions. This is separate from the keyboard test and is never an agent tool.
- The same uncorrected panel **outside the modal** receives focus through native Tab and scrolls to its bottom through End, without an explicit tabindex.

[All deterministic measurements](deterministic-results.json) include per-action states, source hashes, browser version and npm package integrity. Trace ZIPs remain in local ignored `output/playwright/react-aria-check-1793043459428/`.

Standalone commands were also executed: `--condition=original` exited **1**; `--condition=corrected` exited **0**. Matrix mode exits 0 only when the original contract fails, the corrected contract passes and the positive controls pass.

## Real TabProof / Meta attempts

The agent was asked to open the reading details, focus the reading panel, scroll it to its end and close the dialog. It used the existing TabProof browser worker, Meta model loop and keyboard-only action boundary, with no scripted decisions or agent-runtime changes.

| Attempt | Condition | Actions | Valid API/model run | Agent result | Independent live-session audit |
| --- | --- | --- | --- | --- | --- |
| agent-1793043522810239683 | Original, first pair | 3 | **No: token-count request timed out** | Inconclusive | Task not completed; **not counted as agent detection** |
| agent-1793043596931546554 | Corrected, first pair | 7 | Yes | Model reported completion | Panel focused, bottom reached, dialog closed |
| agent-1793043687813023279 | Original, repeated pair | 4 | Yes | Model reported blockage | Panel not focused/scrolled; task not completed |
| agent-1793043716255035530 | Corrected, repeated pair | 7 | Yes | Model reported completion | Panel focused, bottom reached, dialog closed |

All four attempts, including the failure, are in [development-attempts.json](development-attempts.json). The two valid sessions from the repeated pair form the [accepted comparison](agent-summary.json). Their URLs, task, model, full runtime configurations and source fingerprints match; source files stayed unchanged during both runs. Model: `muse-spark-1.3`, agent build `6f1a17ab9d07d1e1c4fd57a8a5240154f41fe05092cfcef6695ea294684629ce`, 25-action budget, 64,000 preflight input limit, 2,048 output limit, context policy v3.

The separate oracle sampled the **actual live sessions**, checking `document.activeElement`, reading-panel scroll position, end-paragraph geometry, dialog presence and final focus. It never changed the DOM, focus or scroll, and its measurements were not included in model observations. [Live audits](audits/) and [unaltered raw reports](runs/) are published separately. Generic custom-site reports still label success as model-reported; this example-specific audit does not silently turn the product into a generic success verifier.

These four development attempts are not a reliability benchmark. The deterministic 3+3 repeats are not six additional AI runs. Repeated model failure alone is not website attribution; the focus/scroll contract, native and pointer controls, minimal correction and upstream report supply the independent evidence here.

## Re-run

```sh
npm ci
npm ci --prefix examples/react-aria-scroll --ignore-scripts
npx playwright install chromium
npm run check:third-party
npm run check:third-party -- --condition=original
npm run check:third-party -- --condition=corrected
```

The first command checks the entire matrix; the original-only command intentionally fails. None of these checks calls Meta. To explicitly spend API credits on a fresh original/corrected pair:

```sh
npm run check:third-party:agent
```

See [the example guide](../../examples/react-aria-scroll/README.md) for manual reproduction. To regenerate this report from the saved original local outputs:

```sh
node scripts/render-react-aria-comparison.mjs \
  output/playwright/react-aria-check-1793043459428/results.json \
  output/playwright/react-aria-agent-1793043687715/summary.json \
  output/playwright/react-aria-agent-1793043522729/summary.json
```

This example-specific test does not certify WCAG compliance or establish behavior in other browsers. It demonstrates a known keyboard barrier in one pinned real component integration and a verifiable correction.
