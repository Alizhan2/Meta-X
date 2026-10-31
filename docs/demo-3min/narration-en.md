# TabProof — three-minute narration

English system voice in the rendered MP4. Recorded Meta results; edited for time. No new model calls were made for this presentation.

## 00:00:00–00:00:12 · Can someone finish your flow using only a keyboard?

A website can work with a mouse and still fail during keyboard navigation. TabProof helps developers turn a keyboard failure into a reproducible test, then check whether a fix actually works.

## 00:00:12–00:00:25 · Give the agent a goal.

Here is DispatchDesk, our controlled test application. The task is to find Northstar Studio's order in transit, review a proposed delivery date, and close the preview without applying changes.

## 00:00:25–00:00:40 · Meta chooses the path.

Meta Muse Spark interprets screenshots, page semantics, focus, and action history to choose the next step. We supply the business goal, not a navigation script. The agent's only action tools are keyboard presses and text entry.

## 00:00:40–00:01:05 · From a goal to an executed route.

Watch this recorded route from the third pair. The agent passes a similarly named customer, opens the correct order, and selects the requested date. It briefly overshoots a control, then recovers. Eighteen real keyboard actions reach the preview. These are observations from the saved Meta session, not a hand-authored route.

## 00:01:05–00:01:20 · Escape leaves the preview open.

Now the first Escape leaves the preview open, with focus still inside it. TabProof records the observed dialog state independently of what the model says. This is the specific keyboard behavior we are measuring.

## 00:01:20–00:01:34 · Recovery does not erase the failure.

The agent eventually finds a way out after more actions and reports completion. That does not erase the earlier Escape failures. TabProof keeps eventual recovery and the measured interaction defect as separate results.

## 00:01:34–00:01:48 · One controlled source change.

The two demo releases differ by one source change: removing the cancel handler that prevents default dialog dismissal. The generated pages are checked for this exact difference. This is a seeded bug in our own test application.

## 00:01:48–00:02:03 · Replay the same discovered route.

The independent checker replays the original agent's exact route on both versions, in three fresh browsers each. It checks focus along the way, then tests one Escape. A changed route becomes inconclusive instead of a guessed defect.

## 00:02:03–00:02:18 · After: Escape closes and restores focus.

A fresh Meta attempt also reaches the corrected preview. Its first Escape closes the dialog and returns focus to the opener. The independently replayed original route passes too. The model outcome and the keyboard measurements are both retained.

## 00:02:18–00:02:34 · Three new pairs. Every result retained.

We ran three new pairs, six actual Meta sessions, with no API failures. All six reached the target. Every original first Escape failed; every corrected first Escape passed. The eighteen independent reproductions are separate checks, not extra model runs.

## 00:02:34–00:02:48 · Evidence a developer can use.

Developers can start and stop runs, inspect actions and screenshots, compare versions, and download an offline evidence report. Instead of manually writing the initial path, they can inspect the path discovered by Meta and reproduce the measured interaction.

## 00:02:48–00:03:00 · Goal → Meta exploration → repeatable evidence.

That is TabProof: Meta discovers a path, and independent checks measure the fix. This small controlled study is not an accessibility certification. Our code, raw results, and reproduction steps are public.

