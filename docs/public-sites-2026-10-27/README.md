# Public-site verification — October 27, 2026 (Aqtobe)

The agent was tested through the actual workbench on the unmodified [official Python documentation](https://docs.python.org/3/). This used Muse Spark 1.3, a fresh proxied Chromium session, real keyboard events and ordinary public HTTPS responses. No cloned page, fixture variant or scripted model decision was used. Source timestamps are UTC, spanning October 26; this date uses Asia/Aqtobe.

## Final build

Both final runs have the same source fingerprint and context policy v3.

| Task | Actions | Decision attempts | Actual final page | Separate audit |
| --- | ---: | ---: | --- | --- |
| Open Tutorial without search | 14 | 15 | `/3/tutorial/index.html` | URL + heading matched; 14/14 focus checkpoints matched |
| Search for `venv` | 15 | 16 | `/3/search.html?q=venv` | URL + visible module result matched; 15/15 focus checkpoints matched |

[Navigation audit](verification/tutorial.json), [search audit](verification/search.json). Each audit replayed the saved keys from the documentation home page, allowed only GET/HEAD for the replayed interactions, and read the resulting DOM/URL. It made no model calls and did not alter the raw run. The original agent screenshots were also inspected: the tutorial heading and actual search results are visible.

The generic product still labels custom completion **model-reported**. These two goals were independently checked for this development exercise; there is no universal success oracle for other user tasks.

## All development attempts

[Manifest](manifest.json) links every raw report, including failures.

| Attempt | Context policy | Task | Actions / decisions | Result | Peak counted input |
| --- | --- | --- | ---: | --- | ---: |
| 1 | Original full history | Tutorial | 12 / 13 | Preflight stopped before an oversized inference | 66,966 |
| 2 | v1: ledger + current observation | Tutorial | 14 / 15 | Reached Tutorial | 9,696 |
| 3 | v2: bounded earlier-page excerpts | Search | 25 / 25 | Repeated navigation exhausted the action budget | 7,189 |
| 4 | v3: recent encrypted tool turn retained | Search | 15 / 16 | Goal verified | 12,495 |
| 5 | v3: final control rerun | Tutorial | 14 / 15 | Goal verified | 13,578 |

These are development attempts across different builds, not a pooled reliability benchmark. The first attempt made 12 inference calls; the thirteenth decision was rejected by the existing 64,000-token preflight. That token ceiling, the 2,048-token output cap and the 25-decision limit were not raised.

## Fixes exercised

The original client resent every screenshot and page tree at each decision. The new context keeps only the current screenshot/current page, all executed actions, and at most three marked page excerpts of 12,000 characters. Excerpts are saved before activation/dismissal or a URL transition to retain recently read facts; older or clipped information can be lost.

The final policy also retains one intact recent function-call/result pair with its opaque encrypted reasoning state, as described in the [Meta Responses protocol](https://dev.meta.ai/docs/protocols/responses). Dropping that continuity had allowed the model to repeat navigation. Opaque reasoning stays in memory and is excluded from public reports. No old screenshots are replayed to the model.

A runner guard now ends repeated Tab/Shift+Tab navigation when four successive navigation actions revisit known states without discovering a new state. This is an inconclusive agent stop, not website-defect attribution.

## Regression checks

- 46 unit tests pass, including bounded context, exact tool pairing, recent reasoning retention, cross-page/closed-dialog facts, unchanged token guards and repeated navigation stopping.
- [All 25 saved fixture traces](stopping-replay.json) pass the local stopping regression; all ten previously completed paths still complete. This is replay, not 25 new AI trials.
- [Custom-site UI integration](custom-check.json) still passes with scripted decisions and zero page errors; it makes no Meta calls.

To repeat a separate read-only public audit from the published records:

```sh
npm run check:public-run -- docs/public-sites-2026-10-27/runs/agent-1793042156136961688.json tutorial
npm run check:public-run -- docs/public-sites-2026-10-27/runs/agent-1793041940427310541.json search
```

Artifacts are written to ignored `output/playwright/`. The helper is explicitly restricted to these Python-docs scenarios and is never automatically invoked for arbitrary custom forms.

This confirms two tasks on one genuine public site. It does not establish reliability on every website or accessibility conformance. Earlier hackathon benchmarks remain unchanged.
