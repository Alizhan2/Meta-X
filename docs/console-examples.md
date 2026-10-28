# Both third-party examples in the main workbench

Implemented for the existing local TabProof console, October 27–28, 2026 (Asia/Aqtobe). The application keeps its native JavaScript UI, Node HTTP server, actual Meta model loop and keyboard-only worker.

## User flow

At http://127.0.0.1:3000/ choose **Third-party examples**, then **React Aria reading dialog** or **Radix notification dismissal**. Both offer:

- **Deterministic checks:** three original sessions, three corrected sessions, plus each example's controls; no Meta key or model calls.
- **Meta agent comparison:** one fresh real-agent attempt per condition, with a separate read-only task oracle. Two sessions consume Meta credits.

The initial saved reference uses archived published measurements and screenshots, explicitly labeled **Saved reference**. Starting a run creates a new ID and fresh artifacts; no archived measurement is inserted into a new result. Selecting a historical comparison restores both sides and its report. Changing the selected example shows that example's reference until a fresh run is started.

Each side shows its state, recorded-session count, pass/fail count, latest screenshot, and keyboard actions. Deterministic action details describe the **last completed browser session**, not the sum of all three repeats. Meta action details show the actual executed keys for that condition. The correction, upstream attribution and scope stay visible.

## Execution and persistence

`src/examples.mjs` defines the two fixed cases and runs the same exported functions as the command-line checks. It dynamically imports example code only when requested, so optional missing example packages do not break the normal fixture/custom website console. Each function keeps its standalone CLI guard; importing it does not start a browser or make a model call.

All modes use the existing global run manager. A fixture, custom-site task, deterministic comparison or Meta comparison prevents a concurrent second run. Deterministic checks bypass only the Meta-key requirement; live comparisons still require configured Meta access.

Comparison jobs persist below `output/playwright/agent-ID/`:

```text
report.json / report.html   comparison state and human-readable report
original.png               latest original observation
corrected.png              latest corrected observation
details.json               full checker metadata or live-pair summary
details/checks/            deterministic snapshots, traces and measurements
details/agent/             live pair attempts and source comparison
details/runs/              original live reports, audits and screenshots
```

Progress snapshots are written atomically. Cancellation preserves already observed results and screenshots, marks the overall comparison unverified, closes its resources, and prevents a later corrected attempt from starting. Cancellation during a deterministic operation is handled at bounded operation boundaries; trusted local navigation and element waits are limited to five seconds. The checker does not close the entire browser in the middle of pending protocol events.

On restart, a saved example report without a finished timestamp is recovered as a failed/unverified interrupted comparison; its HTML/JSON are updated accordingly. Completed and explicitly stopped reports preserve their recorded outcomes.

## API

```text
GET  /api/examples
GET  /api/runs
POST /api/runs        {"exampleId":"react-aria-scroll","checkMode":"deterministic"}
POST /api/runs        {"exampleId":"radix-toast","checkMode":"agent"}
GET  /api/runs/agent-ID
POST /api/runs/agent-ID/stop
```

Only the two fixed example IDs and the two fixed methods are accepted. This endpoint does not accept a script, shell command, arbitrary path or extra URL. Cross-origin POSTs are rejected. Read-only published reference routes and report routes use narrow filename allowlists; they cannot expose `.env` or traverse the project tree. No API key is sent to the client.

The comparison's overall verification requires all planned sessions, an expected original contract failure, corrected success and completion of the checker. Live comparisons additionally require valid API/model runs and matching model/configuration/host fingerprints. A model/API error is displayed separately and cannot establish a verified comparison. A model declaration is not silently promoted to an independently checked success.

These checkers know the two examples' contracts. Their results are not a generic website accessibility detector, statistical reliability estimate or WCAG certification. Known upstream bugs and corrections remain attributed in the original case documentation.

## Verification

`npm test` passes **50 tests**, including key-free deterministic execution, the shared lock, invalid inputs, dependency availability, reference path restrictions, cancellation labels and recovery after restart.

`npm run check:console-examples` exercises the actual UI → API → real Chromium → persisted report → UI flow for both examples with **configured=false**. No model decisions or outcomes are mocked. The successful run is saved in:

```text
output/playwright/console-examples-check-1793078957182/summary.json
```

It covers both real 3+3 comparisons, positive controls, fresh screenshots, report links, URL/reload restoration, stop after one original repeat, no corrected attempt after cancellation, partial persistence, service restart, 390px layout, single-run locking and cross-origin/path restrictions. No page errors were reported.

The prior fixture-console and custom-target browser checks also passed after the integration:

```text
output/playwright/console-check-1793078684280/summary.json
output/playwright/custom-check-1793078685418/
```

During development the stop/restart tests exposed a Playwright transport race from closing a browser during pending navigation, and an HTTP shutdown wait with open client connections. The final implementation handles cancellation at safe operation boundaries and closes console HTTP connections on shutdown. Failed development attempts remain in ignored local output directories; they are not substituted with passing results.

`npm run check:console-examples:live` explicitly spends credits to verify the main-console buttons against a running configured local server. It uses no scripted decisions. The first such React Aria comparison (`agent-1793079049597860494`) retained an original API timeout and a corrected completion, so the UI correctly marked the overall comparison failed/unverified. This is not counted as model defect detection.

A separate successful full verification on October 28 is saved at `output/playwright/console-examples-live-1793161144593/summary.json`:

| Main-console comparison | Example | Original actions | Corrected actions | Result |
| --- | --- | --- | --- | --- |
| agent-1793161145180178068 | React Aria | 5 | 7 | Independent before/after comparison verified |
| agent-1793161207720899449 | Radix Toast | 7 | 7 | Independent before/after comparison verified |

All four real sessions used the current console's own API and shared manager. Both sides' fresh screenshots, action records, independent measurements, report links and history reloads were checked; no page errors were recorded. These four sessions demonstrate the integrated flow and are not a general reliability estimate. The earlier failed comparison remains in the history.

Historical evidence folders for the two original third-party demonstrations remain unchanged. Refactoring their CLI modules creates new source fingerprints for future runs and does not rewrite the archived raw results.
