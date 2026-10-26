# TabProof

A keyboard-only AI agent that attempts a web task, records evidence of blockers, and reruns the task after a fix.

## Status and scope

Planning and the first implementation started on October 26, 2026 for the Meta Global AI Developer Hackathon. The first Meta-driven keyboard-only booking completed in 15 actions, verified against a server-side record. The fixture's five conditions have deterministic checks; the planned 25-run AI benchmark has not been performed. Initial scope: Chromium, controlled test sites without authentication, and one appointment-booking workflow.

See [the first-run evidence and limitations](docs/first-run.md).

## Run locally

Requires Node.js 24+.

```sh
npm ci
npx playwright install chromium
npm start
```

Open http://127.0.0.1:3000/lab to select a condition and open a fresh booking session. The developer panel is separate from the agent page.

```sh
npm test
npm run check:fixtures
npm run check:evidence
```

For a live Meta run, copy `.env.example` to `.env` and fill your own `MODEL_API_KEY` and `META_MODEL` locally. The validated model is `muse-spark-1.3`. Never paste keys into issues, chat, screenshots, or committed files. Then run:

```sh
npm run agent -- correct
```

Each live run can make up to 25 billable model calls. The model sees only screenshots, accessible semantics, current focus and its action history. It does not see the chosen condition or server record. Outputs go to ignored `output/playwright/` folders. The fixture runner only permits network requests to its local booking routes; arbitrary external URLs are not supported.

Other conditions: `unreachable_button`, `calendar_keyboard`, `modal_dismissal`, `focus_loss`. Every live run now includes three independent fixture-contract probes, three corrected controls, exact-key replays, and an HTML evidence report. An unconfirmed failure stays inconclusive. Confirmed fixture observations produce a suspected-blocker outcome while keeping the AI task outcome separate. Do not treat the current runner as a general accessibility scanner: probes currently know the booking fixture's expected contracts.

See [repeated checks and the live broken/corrected comparison](docs/evidence-results.md). The AI benchmark across five trials per condition remains pending.

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

Run five independent trials per initial variant: 25 trials total. Report raw counts and denominators, model/version, configuration, budgets, and infrastructure failures. Results are **not measured yet**.

| Metric | Planned definition | Result |
| --- | --- | --- |
| Correct-control completion | Successful valid runs / valid control runs | Not measured |
| Defect detection | Correctly attributed injected blockers / valid defect runs; also report each defect separately | Not measured |
| False positives | Control runs incorrectly attributed to a site blocker / valid control runs | Not measured |
| Reproducibility | Trials agreeing on the same normalized outcome and blocker / valid trials per variant | Not measured |
| Replay confirmation | Successful reproductions / attempted replays | Not measured |

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

Meta API access has been validated with a local key; no API key is included in this repository. The live screenshot/tool-call check and the first booking run use Muse Spark 1.3. Meta currently rejects `tool_choice: "required"`, so the client uses `"auto"` and independently rejects missing, multiple, malformed, or forbidden actions.

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
