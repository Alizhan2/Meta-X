# Run workbench verification

Story: choose a controlled fixture in the browser → start the server-side agent → observe the screenshot and executed keyboard actions → stop or finish → open the persisted report.

The main page is a local control surface. It never becomes part of the agent's observations. The model still receives only `press_key` and `type_text`; the UI does not grant it pointer, DOM mutation, selectors or navigation powers.

## Verified boundaries

| Boundary | Evidence |
| --- | --- |
| Browser → run API | Start creates one run; concurrent start returns 409; no automatic run on page load or refresh |
| Run API → browser worker | Current screenshot and ordered executed steps appear during the run |
| Stop → worker | Shared abort signal interrupts model requests and closes the active browser, including evidence/replay sessions |
| Worker → report | Fully observed actions, cancellation reason and any interrupted action are preserved in JSON/HTML |
| Report → UI | Finished and stopped runs expose report links; history and selection survive refresh |
| Local history | Existing saved reports reload when the server starts |
| Mobile layout | 390px viewport has no horizontal page overflow; controls and report remain available |
| Request boundary | Cross-origin mutations and non-JSON start requests are rejected; manager shutdown rejects new starts before draining |

`npm test`: 47 passing tests. Cancellation tests cover abort before a key, during inference, and after token counting; no next keyboard action or inference is allowed. Shutdown tests reject starts while closing and after closing. Report tests retain uncertainty for an interrupted action and never treat user cancellation as website attribution.

`npm run check:console`: 13 browser/API checks passed with no page errors. It used real Chromium and the real fixture/server/runner; decisions were injected from a saved successful keyboard sequence. No Meta API calls were made. Four test runs covered partial cancellation after two actions, a complete 15-action booking, cancellation during evidence after booking, and cancellation before the first action. Generated reports are explicitly marked `scripted-test` and kept in their own ignored test folder.

## Live Meta check

Two actual runs were started using the browser controls. The corrected fixture completed in 15 actions / 15 decisions and produced a completed report. A second run was stopped using **Stop** after two actions; its third decision attempt was cancelled, and its saved report remained inconclusive with `user_stopped`. No further action followed the stop. The partial report link was opened through the UI.

Both records are retained separately from all earlier benchmarks: [completed run](console-2026-10-26/runs/agent-1793038983990660873.json), [stopped run](console-2026-10-26/runs/agent-1793039122127382231.json). [Scripted browser-check summary](console-2026-10-26/browser-check.json). Returned usage totals 281,673 known tokens; the interrupted attempt has no returned usage and is not assumed to be free. Client cancellation does not establish provider-side billing or refunds.

## Behavior and limits

The screenshot is the latest observation, not a remote interactive browser. Run controls never click inside the agent page. A stopped task may have made partial progress, so the report distinguishes fully observed steps from an action interrupted before its after-state was captured. Cancelling evidence checks retains a previously confirmed booking while leaving the overall result inconclusive.

Reports are saved under `output/playwright/agent-…/` and are retained between server restarts. The service lists up to 100 saved runs on startup. A browser refresh reconnects to an active run; server shutdown stops its own active run. A force-killed server cannot produce a final cancellation report.

The server binds to `127.0.0.1`. There is no hosted deployment or user authentication. This verification covers the fixture console; [custom website URL/task support](custom-targets.md) was added in a subsequent follow-up. Every live attempt still has the existing 25-request/action ceiling, 64,000-token input preflight and 2,048-token output limit.
