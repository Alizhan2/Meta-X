# Evaluation protocol

## Fixture ground truth

Create a reproducibly seeded appointment-booking page. Each evaluation variant starts from a clean browser context and reset fixture data. An independent harness knows the active defect; the agent must not see its identifier in the URL, DOM attributes, accessible descriptions, screenshot labels, or task text.

The appointment success oracle checks the fixture's stored appointment record against expected synthetic input, date, and time. A page success banner may be supporting evidence but must not be the sole source of truth.

Document expected focus transitions for each interaction. Allow legitimate alternative destinations; moving focus is not inherently a defect.

## Read-only observations

After each action record:

- Action index, key or bounded text-entry descriptor, and timestamp.
- Focused element's role, accessible name, stable fixture identifier, and relevant state.
- Screenshot and a read-only semantic snapshot.
- Oracle result and harness errors, when present.

Logs use synthetic data. Secrets and real personal form data must not be put in public artifacts.

## Deterministic keyboard probe

Run in a clean replica of the same fixture state when possible; do not silently change the live agent run. Record the reset/replay procedure so the probe's starting state is reproducible.

1. Enumerate candidate interactive elements without changing the DOM. This is a heuristic inventory, not a complete keyboard-reachability oracle.
2. Record actual `document.activeElement` transitions after sequential Tab presses. Use a fixed maximum of 100 steps; record browser-content exits and repeated focus sequences. A repeated element alone is not enough to classify a trap.
3. Repeat with Shift+Tab. For composite widgets, test documented arrow-key, Enter, Space, and Escape behavior with bounded, fixture-specific probes. Tab alone does not visit every operable item.
4. For dialogs, check both dismissal and focus restoration. Focus intentionally cycling inside an open modal is expected when a keyboard dismissal path exists.
5. Compare observed paths against the corrected fixture and fixture-specific expected transitions. Record differences, rather than asking the model to decide the verdict.

The probe must not use `focus()`, clicks, `fill()`, direct submission, or synthetic DOM event dispatch as an action shortcut. Reading active focus is allowed.

## Repetition and replay

- Five fresh agent runs for the corrected control and each of four single-defect variants: 25 trials.
- Keep task, synthetic data, browser version, model/version, model settings, and action budget fixed and record them.
- Save a replayable keyboard trace for each suspected blocker and independently rerun it from the same clean state.
- For attribution, compare the relevant trace/probe on the defective and corrected versions. Prefer a controlled comparison over an unrelated successful path on the corrected version.
- Matching failures in three or five runs are a repeatability signal, not universal proof. On an unfamiliar website, use the suspected-blocker label unless independent verification establishes the specific fault.
- Known fixtures can have confirmed findings when deterministic checks match injected ground truth. Keep this separate from the agent's own prediction and from general accessibility conformance.

## Metrics and record format

Each run record must include `run_id`, variant (harness-only), seed, task, browser/model versions, settings, budgets, validity, outcome, predicted blocker, ground-truth blocker, success-oracle result, trace path, screenshots, replay result, elapsed time, and model usage when available.

Publish:

1. Correct-control completion: completed / valid control runs.
2. Per-defect detection: runs reporting the correct blocker / valid runs for that defect; also publish a pooled total.
3. False-positive rate: control runs attributed to a website blocker / valid control runs.
4. Reproducibility: count of the most frequent normalized outcome plus blocker / valid runs, separately for each variant. Always pair with correctness: consistently wrong predictions are not a good result.
5. Replay confirmation: confirmed reproductions / attempted replays.
6. Infrastructure failures: count and reason, reported separately. Never silently remove them or label them website defects.

If a denominator is zero, report N/A, not 0%. Never fabricate results before execution. Publish raw counts beside percentages.

## Capability and enforcement checks

Before expanding the UI:

- Verify that the selected Meta endpoint accepts actual screenshots and performs the required tool-call loop.
- Verify on the corrected fixture that the agent can complete the entire task within the action budget.
- Attempt tool names and payloads for clicking, selecting elements, focusing, JavaScript, arbitrary navigation, and submission; the action executor must reject them.
- Verify that unsupported keys, excessive text, extra tool parameters, and out-of-budget requests are rejected before browser actions.
- Check that observations neither mutate the page nor reveal hidden defect labels.
- Verify that a model claiming success without a stored appointment cannot produce a completed outcome.
