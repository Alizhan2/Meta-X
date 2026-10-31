# TabProof

A keyboard-only AI agent that attempts a web task, records evidence of blockers, and reruns the task after a fix.

## Status and scope

Planning and the first implementation started on October 26, 2026 for the Meta Global AI Developer Hackathon. A 25-run controlled-fixture benchmark is recorded: the corrected page completed 5/5 times in 15 keyboard actions, with no false positives on those five controls. Eight model output-limit failures and nine later corrected-replay errors are retained in the data. Initial scope: Chromium, controlled test sites without authentication, and one appointment-booking workflow.

See [the first-run evidence and limitations](docs/first-run.md).

A local workbench now starts and stops the real agent, shows its observed page and keyboard actions, and opens the saved evidence report. Run history survives page refresh and server restart. User cancellation preserves a partial report without attributing a website defect.

## Run locally

Requires Node.js 24+.

```sh
npm ci
npx playwright install chromium
npm start
```

Open http://127.0.0.1:3000 for the agent workbench. Choose a condition and press **Start agent**; **Stop** cancels the current attempt or evidence checks. The page updates the screenshot and action record as the agent works, then exposes **Open evidence report**. Only one run may be active; opening or refreshing the workbench never starts a run. Live runs use Meta API credits.

Both third-party examples are also available directly in this main workbench. Choose **Run on → Third-party examples**, select **React Aria reading dialog** or **Radix notification dismissal**, then choose the method:

- **Deterministic checks · free** runs the same keyboard contract three times on each version, plus the case's independent controls. It makes no model calls and works without a Meta key.
- **Meta agent · API credits** starts a fresh original/corrected pair using the real agent and separate example-specific measurements. It uses Meta credits for two sessions.

The before/after view shows fresh screenshots, counts, keyboard actions, the correction and a saved report. The initial **Saved reference** is explicitly labeled as previously published evidence; it is never presented as a new run. All run types share one lock and the same **Stop** button. Stopping keeps a partial comparison and does not certify a defect or completed fix. History and selection survive refresh; unfinished comparisons recovered after a service restart are marked failed rather than verified.

After any finished or stopped run, **Download offline report** saves one HTML file containing the report, recorded screenshots and downloadable source JSON. It opens without the local server or internet. The same export works for fixture runs, custom websites and both third-party comparisons. A stopped attempt stays partial, custom-site completion stays model-reported, and missing artifacts are disclosed. The file contains captured page content and entered text: review it before sharing. Separate runs and browser traces are not bundled.

Install the pinned example dependencies once, before starting the workbench:

```sh
npm ci --prefix examples/react-aria-scroll --ignore-scripts
npm ci --prefix examples/radix-toast --ignore-scripts
```

An example without installed dependencies remains viewable as a saved reference but cannot start a fresh run. See [main-interface example integration and verification](docs/console-examples.md).

To test your own site, choose **Run on → Your website**, paste a complete HTTP(S) address, and write the task in **Task to attempt**. Press **Start agent**. Public websites and a separate localhost development server are supported. The agent starts in a fresh browser and stays on the same site. Screenshots and page text are sent to Meta; use test data for private pages.

To compare your own versions, choose **Run on → Your website · before and after**. Enter two different test-page URLs, the same task, and two plain CSS selectors: the dialog opener and the dialog itself. Selectors must work on both versions. The current independent contract is deliberately narrow: Tab reaches the opener, Enter opens the dialog with focus inside, Escape closes it, and focus returns to the opener. Selectors are read-only harness inputs and are not added to the agent’s instructions. The agent still has only keyboard/text tools.

**Independent keyboard checks · free** creates three fresh browser sessions per version without model calls. **Meta agent + independent checks** additionally creates two fresh model sessions and observes their Escape behavior read-only. Before/after verification requires three matching valid original failures, three corrected passes, matching browser/build metadata, and—in agent mode—valid comparable model sessions that actually exercised the contract. Missing or ambiguous elements, an unopened dialog, an API error, cancellation, two passing versions, or a still-failing corrected version cannot verify a fix. The task’s other requirements remain unverified. The submitted URLs do not establish source-code equivalence or prove that only one source change caused the observed difference.

The comparison shares Stop, saved history and offline report downloads with the other modes. Localhost test servers are supported; the TabProof control server and private network destinations remain excluded. Fresh sessions have no existing login. This first contract supports one main-frame dialog, Enter activation and a maximum of 50 Tab steps; it does not support iframes or arbitrary user test code. See [implementation and verification](docs/website-comparison.md).

For a multistep workflow, choose **Route to the dialog → Meta discovers route · replay as evidence**. The opener may be absent until the agent navigates to it. Meta receives the task and normal page observations, with no authored navigation recipe. Once an observed opening and Escape identify the target, TabProof extracts the original agent's executed prefix and replays that **same** sequence on both versions in six fresh sessions. Focus/value mismatches make a replay inconclusive rather than changing the sequence or inventing a defect. The report keeps route provenance, actions and the source run ID. This method requires agent mode; it does not generate a route from an empty or failed attempt.

The **DispatchDesk** controlled demo contains a customer search, similar customer names, different order statuses, order details, a delivery-date choice and a preview. The task specifies a customer, shipment status and proposed date, without naming a route or internal order ID. The target selectors additionally constrain the order/date, so reaching a different preview cannot verify the target contract. The two releases differ only by one cancel-event regression. This is a newly built synthetic scenario with an injected bug, not a newly discovered third-party vulnerability or evidence that the agent can find every keyboard defect.

After starting the demo server, select **Your website · before and after → Load DispatchDesk demo** to fill the task, URLs and contract in one step. Loading the example does not start a run; starting the comparison uses Meta credits.

```sh
npm run demo:dispatch
# Before: http://127.0.0.1:4217/releases/r8x/
# After:  http://127.0.0.1:4217/releases/q2z/
npm run check:discovery
```

The last command checks real browsers and learned-route replay with explicitly injected test decisions and no model calls. `npm run check:discovery:live` is separate: it requires the configured main workbench and DispatchDesk, starts two actual Meta sessions from the UI and spends API credits. The recorded October 29 Meta pair found a 16-action route; first-Escape checks failed 3/3 before and passed 3/3 after. The original agent eventually recovered, and that recovery remains visible. See [the live evidence, discovery and scope](docs/dispatch-discovery.md).

A separate October 31 stability cohort ran three new Meta pairs: all six sessions exercised the target preview, all three pairs verified the correction, and independent first-Escape checks failed 9/9 before and passed 9/9 after. Routes varied between 16 and 18 actions. See [the complete table and all raw records](docs/discovery-stability-2026-10-31/README.md); replay counts are kept separate from model-session counts.

For a separate demonstration website:

```sh
npm run demo:website-comparison
# Before: http://127.0.0.1:4207/before
# After:  http://127.0.0.1:4207/after
# Opener: #open-details
# Dialog: #details-dialog
```

The final build was checked on the unmodified official Python documentation: opening Tutorial took 14 actions and searching for `venv` took 15. Separate read-only replays verified the resulting URLs, page headings/results and focus paths. Earlier context-limit and navigation-loop failures are retained alongside the fixes. See [all public-site attempts and verification](docs/public-sites-2026-10-27/README.md).

A third-party keyboard barrier is now reproduced with the actual, unmodified **React Aria Components 1.19.0** package: a modal skips its scrollable reading panel. An identical keyboard test fails on the original integration in 3/3 sessions and passes after adding `tabIndex={0}` in 3/3, with pointer and native-browser controls. In a valid real-Meta comparison the agent stops on the original after 4 actions and completes the corrected task in 7; separate read-only live-session measurements confirm the results. An earlier API timeout is retained. This reproduces known upstream issue #10395 locally; it is an integration workaround, not an original upstream discovery or library patch. See [the before/after report and all attempts](docs/react-aria-2026-10-27/README.md).

```sh
npm ci --prefix examples/react-aria-scroll --ignore-scripts
npm run check:third-party
npm run demo:third-party
```

The deterministic check makes no Meta calls. The demo opens at http://127.0.0.1:4187/ with screenshots, measurements and links to the original/corrected integrations.

A second, independent example uses **Radix Toast 1.2.19 → 1.2.20**. On the old version one Escape dismisses both the focused notification and an unrelated notification; after the actual upstream dependency upgrade it dismisses only the focused one. The same keyboard test fails in 3/3 original sessions and passes in 3/3 corrected sessions. Two real Muse Spark attempts both take seven actions; the original reports blockage, while the corrected completes, with separate live-session measurements confirming the remaining notifications. Both complete dependency graphs are pinned; host JSX/CSS and agent runtime are unchanged. This is known upstream issue #2906, not a new original discovery. See [the Radix before/after evidence](docs/radix-toast-2026-10-27/README.md).

```sh
npm ci --prefix examples/radix-toast --ignore-scripts
npm run check:radix-toast
npm run demo:radix-toast
```

The second local evidence viewer is http://127.0.0.1:4197/. `check:radix-toast` makes no Meta calls; `check:radix-toast:agent` explicitly starts a fresh paid live pair.

For a custom website, completion is explicitly **model-reported**, without an independent success oracle. Its report contains the actual URL, task, observed actions and screenshots. Fixture-specific contract checks and automatic replays never run against a custom site, so submitting a form is not repeated for evidence. See [custom website support and verification](docs/custom-targets.md).

The server loads a local `.env` automatically. Without a configured `MODEL_API_KEY`, the workbench remains viewable and disables starting the agent. Keys stay on the server. The server accepts only `127.0.0.1:<port>` or `localhost:<port>` as the `Host` header (DNS-rebinding protection), so a forwarded port, devcontainer URL or reverse proxy answers `403 Invalid host`; open the workbench through a local address. This workbench binds only to the local computer; it is not a hosted multi-user service.

Open http://127.0.0.1:3000/lab to manually open a fresh booking fixture. This developer panel is separate from the agent's observations.

```sh
npm test
npm run check:fixtures
npm run check:evidence
npm run check:regressions
npm run check:stopping
npm run check:console
npm run check:custom
npm run check:website-comparison
```

For a live Meta run, copy `.env.example` to `.env` and fill your own `MODEL_API_KEY` and `META_MODEL` locally. The validated model is `muse-spark-1.3`. Never paste keys into issues, chat, screenshots, or committed files. Then run:

```sh
npm run agent -- correct
```

Each live run can make up to 25 model decision attempts. The model sees only screenshots, accessible semantics, current focus, page URL and its action history. For a fixture run it does not see the chosen condition or server record. Outputs go to ignored `output/playwright/` folders. Fixture requests remain restricted to local booking routes. Custom sites use a separate browser network policy described above.

The agent now stops before another model request when three actions leave its observation unchanged or same-direction Tab navigation completes a cycle back to the same page/focus state. The model may also return a strictly validated blocked message without a keyboard action. Stops are recorded separately from website attribution; API failures remain invalid runs. See [stopping policy and verification](docs/agent-stopping.md). The original 25-run benchmark remains frozen.

Reports record a hash of the fixture and agent source files. Any change to those files (including the workbench commit `f88fb3c`) changes the hash, so `compare` rejects pairing runs from different builds (`different_run_configuration`); compare runs made on the same build.

Workbench verification covers start, live actions/screenshots, cancellation before the first key and during evidence checks, partial reports, restart, history, and mobile layout. `check:console` uses real Chromium with explicitly labelled scripted decisions and makes no Meta calls. See [console verification](docs/console-verification.md).

Other conditions: `unreachable_button`, `calendar_keyboard`, `modal_dismissal`, `focus_loss`. Every live run now includes three independent fixture-contract probes, three corrected controls, exact-key replays, and an HTML evidence report. An unconfirmed failure stays inconclusive. Confirmed fixture observations produce a suspected-blocker outcome while keeping the AI task outcome separate. Do not treat the current runner as a general accessibility scanner: probes currently know the booking fixture's expected contracts.

See [the 25-run results, limitations and raw data](docs/benchmark-2026-10-26/README.md), plus [the earlier repeated checks](docs/evidence-results.md).

An independent review added regression guards for delayed server writes, full focus identity during replay, invalid model responses and token accounting. New reports record browser/runtime versions, model settings and a source fingerprint for comparison; older sample reports lack this metadata and are not eligible for strict automatic verification. See [review fixes](docs/review-fixes.md).

The distinction to demonstrate is **keyboard-only execution + reproducible evidence + verification after a fix**. This is a developer testing aid, not a certification of accessibility or a simulation of every disabled user's experience.

## How it will work

1. Supply a test-site URL, task, and synthetic form data.
2. A Meta model observes screenshots and read-only page semantics, then chooses a keyboard action.
3. A restricted browser worker executes the action and records the resulting focus and page state.
4. An independent, deterministic checker evaluates the task's success condition.
5. On failure, run a bounded keyboard probe and replay the relevant trace. Report evidence, uncertainty, and a comparison against the corrected fixture when available.

Initial runtime budget: 25 agent actions. Each action is one key press/chord or one bounded text entry. The separate probe has its own explicit budget. Budget exhaustion alone is not a website defect.

## Enforced action boundary

The model will receive only two action tools: `press_key` and `type_text`. Initial navigation and reset are controlled by the runner, outside the model's action interface.

- Validate keys, modifiers, text lengths, and action counts at the worker boundary.
- `type_text` types into the currently focused element using keyboard events; it must not locate, focus, fill, or paste into a target element.
- Do not expose browser/page handles, JavaScript execution, shell execution, selectors, arbitrary URLs, mouse actions, DOM mutation, programmatic focus, or direct form submission to the agent.
- Keep read-only observation and verification separate from action execution. Inspection must not change focus or page state.
- Key presses may naturally activate a button or submit a form, as a keyboard user would.

Implementation checks must attempt forbidden actions and confirm rejection; wording in the model prompt is insufficient.

## Results and evidence

| Result | Meaning |
| --- | --- |
| Task completed | An independent task-specific oracle confirms the expected result. |
| Suspected blocker | The trace and keyboard probe identify a reproducible obstacle; site attribution remains qualified. |
| Agent inconclusive | The run failed without sufficient evidence to attribute it to the website. |

Use structured reason codes for budget exhaustion, model/API failure, website/runtime failure, and suspected interaction barriers. Do not count infrastructure errors as detected accessibility defects.

Repeated model failures are evidence of repeatability, not proof of a site defect: a model can repeat the same mistake. Stronger fixture evidence combines known ground truth, deterministic keyboard observations, a replayable trace, and a corrected counterpart passing the same task. On unfamiliar sites, retain uncertainty and support manual reproduction.

See [the evaluation protocol](docs/evaluation.md) for controls, probes, and metrics.

## First test site

Build one appointment-booking fixture with independent defect switches:

1. The booking control is reachable by mouse but cannot be reached or activated through the supported keyboard interactions.
2. The date picker opens but cannot select a required date using documented keyboard interactions.
3. A modal has neither a working Escape dismissal nor another working keyboard dismissal path. Missing Escape alone is not sufficient evidence.
4. After an action, focus moves to a wrong or disconnected location, outside the scenario's documented expected destinations.

Start with an all-correct control and four single-defect variants. Combined defects are optional and excluded from the initial score because one blocker can mask another. Defect labels and switches must not be included in the model's observations.

## Evaluation

Five independent trials per initial variant have been recorded: 25 trials total, with all failures retained. Raw records include model/version, configuration, budgets, errors and usage.

| Metric | Definition | Result |
| --- | --- | --- |
| Correct-control completion | Successful bookings / all control attempts | 5/5 |
| Hybrid fixture findings | Correct contract finding / eligible defect runs; excludes eight invalid AI runs | 12/12 eligible; see per-condition denominators |
| Standalone model diagnosis | Model's independently scored defect identification | Not measured |
| False positives | Control runs incorrectly attributed to a site blocker / all control attempts | 0/5 |
| Reproducibility | Same normalized pipeline outcome / eligible runs | Per-condition table in benchmark metrics |
| Original exact-key replay | Saved focus path matches / replayed traces, including partial traces | 25/25; not task-completion proof |
| Corrected exact-key replay errors | Navigation/observation failure after successful probes | 9 retained; separate local follow-up fixes execution |

Five trials are a small exploratory sample. Publish counts, not unsupported claims of reliability. A screenshot or an LLM's statement that a task succeeded is not a success oracle.

## Build schedule

Dates use Asia/Aqtobe (UTC+5). Organizer submission deadline: **November 5, 2026 at 07:00 Aqtobe time**, corresponding to November 4 at 21:00 EST. Target submission: November 4 by 18:00 Aqtobe time.

| Dates | Deliverable |
| --- | --- |
| Oct 26 | Repository, scope, provenance notes, evaluation protocol |
| Oct 27–28 | Restricted browser worker, fixture, Meta screenshot/tool-call capability spike, initial agent loop |
| Oct 29–30 | Correct scenario completion, 25-action budget, traces and screenshots |
| Oct 31–Nov 1 | Bounded keyboard probes, independent checks, outcomes and evidence report |
| Nov 2 | Minimal launch/stop interface, browser view, action history |
| Nov 3 | Evaluation runs, raw results, three-minute demo plus backup recording |
| Nov 4 | README/results, public access checks, participant list, submission |

## Meta integration

Validate image input and tool calling against the account's actual available Meta model before selecting a model identifier. Candidate: Muse Spark through Meta Model API. Fallback to evaluate: Muse Spark Open through Baseten. For that partner, the participant guide specifies `meta-models/muse-spark-open-1026`.

Meta API access has been validated with a local key; no API key is included in this repository. The live screenshot/tool-call check and the first booking run use Muse Spark 1.3. Meta currently rejects `tool_choice: "required"`, so the client uses `"auto"` and independently rejects missing, multiple, malformed, or forbidden actions. A completed assistant message containing exactly `{"status":"blocked","reason":"..."}` is a valid terminal decision; mixed stop/action responses are rejected.

## Provenance and new work

- These planning documents were authored on October 26, 2026 with AI assistance.
- The initial planning revision contained no implementation or borrowed fixture. The current fixture and executor were authored for this project; their actual dates are retained in Git.
- Record implementation changes in Git from the beginning. Preserve actual commit dates.
- When dependencies, external templates, snippets, data, images, or fixtures are introduced, document their source, license, and our modifications in [PROVENANCE.md](PROVENANCE.md).
- The demo must identify features and code built during the event. Using an existing library does not mean we authored that library.

## References

- [Participant guide](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details)
- [W3C: evaluating web accessibility](https://www.w3.org/WAI/test-evaluate/)
- [W3C: no keyboard trap](https://www.w3.org/WAI/WCAG21/Understanding/no-keyboard-trap)
- [Playwright: accessibility testing](https://playwright.dev/docs/accessibility-testing)
