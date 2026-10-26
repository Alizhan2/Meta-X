# Independent review and regression fixes

Two independent read-only reviews examined the action boundary and evidence/comparison pipeline. Reviews used source inspection and local tests; no model API calls were made for this audit.

## Corrected behaviors

- An invalid AI run (including missing API key, provider rejection or malformed tool output) remains inconclusive even when a separate deterministic probe finds a fixture defect. Independent findings are still visible, but cannot count as AI detection.
- Model requests are recorded before invocation. Returned model usage is captured before action validation, so rejected/incomplete/no-tool replies do not disappear from known token usage. A provider/network failure without returned usage is recorded as an attempted request with unknown usage.
- At least three observed probes and three clean corrected controls are required for controlled-fixture confirmation. The report displays the actual run counts.
- Replay compares focused element ID, tag, accessible-name observation, role and value. Missing reference focus or an empty trace is unknown, not an asserted matching path.
- Booking requests are given up to five seconds to return an HTTP response before the next observation/oracle check. Timeout/failure is surfaced as a run error. A delayed final action no longer silently becomes budget exhaustion.
- A corrected comparison requires distinct runs, a valid original confirmed fixture issue, a completed corrected run with matching stored inputs, and identical recorded task/model/budget/configuration.
- New configuration records include browser and Playwright versions, platform, a fixed fixture seed, model settings, and a SHA-256 fingerprint of the fixture, server, detector, browser executor, model adapter, report/comparison code, runner and stylesheet.

## Checks

`npm test` covers invalid attribution, insufficient repeats, differing calendar-button names, self-comparison, missing/different configuration and usage capture before rejection.

`npm run check:regressions` delays the booking POST by one second while using an exact 15-action budget, checks a matching server record, replays the trace, and verifies that a different calendar label cannot match the original focus path.

`npm run check:evidence` reruns the three observed/three corrected probes for each of five conditions. These remain fixture-specific engineering checks, not AI benchmark metrics.

The previously saved AI examples predate configuration recording. Their observed completion/failure records remain historical evidence, but their corrected-comparison flag is downgraded to unverified because build/browser comparability cannot be reconstructed from those records. No missing metadata has been fabricated. Future AI benchmark runs must use the new report format.
