# TabProof — three-minute demo

An edited presentation of actual recorded Meta sessions and independent checks. English system narration (macOS Samantha); selectable English subtitles. It does not depict a new live model session. No new Meta calls were made to produce the video.

Local video: `output/playwright/demo-3min/TabProof-demo-3min.mp4` (generated, not committed). [Narration and timing](narration-en.md), [subtitles](subtitles.srt), [scene sources](scenes.json).

## Story

| Time | Show | Message |
| --- | --- | --- |
| 0:00–0:12 | Keyboard interaction problem | A working mouse path can hide a broken keyboard flow. |
| 0:12–0:25 | Business task and DispatchDesk | Give an outcome, not a list of navigation steps. |
| 0:25–0:40 | Meta input and restricted tools | Meta interprets screenshots, semantics, focus and history; actions are keys/text. |
| 0:40–1:05 | All 18 original-route actions, edited for time | Meta chooses the correct order/date and recovers from overshooting. |
| 1:05–1:20 | First Escape observation | Preview stays open. The checker reads actual dialog/focus state. |
| 1:20–1:34 | Eventual recovery | A model completion declaration does not erase the first failure. |
| 1:34–1:48 | One-line source correction | Controlled synthetic regression; no claim of a novel third-party bug. |
| 1:48–2:03 | Original and corrected independent snapshots | Replay the same discovered prefix, then test one Escape in fresh browsers. |
| 2:03–2:18 | Fresh corrected Meta session | First Escape closes the dialog and restores opener focus. |
| 2:18–2:34 | All three new pairs | Six model sessions, with 18 additional independent reproductions counted separately. |
| 2:34–2:48 | Actual saved workbench comparison | Inspect steps/screenshots, stop runs, compare and export evidence. |
| 2:48–3:00 | Developer value and public repository | Meta discovers a path; deterministic checks measure the configured fix. |

## Evidence provenance

The walkthrough uses pair `agent-1793447041673720000` from the [October 31 cohort](../discovery-stability-2026-10-31/README.md). Original model child: `agent-1793447041674441950`; corrected child: `agent-1793447141178730203`. Action images are the actual saved `NN-after.png` observations, in recorded order. The two independent images come from the parent run's `original.png` and `corrected.png`. The workbench is captured from its saved comparison, with no Start action.

The task does not supply the route. The independent harness knows the target selectors and dialog contract. Only that contract is verified; task completion as a whole and accessibility conformance are not. All original agents eventually recovered. The cohort is a small study of one synthetic workflow.

## Rebuild

Requires the saved local run artifacts above, the workbench on port 3000, installed Playwright, macOS `say` with Samantha, and Python `imageio-ffmpeg` (only for video authoring, not an app dependency).

1. `node scripts/build-demo-frames.mjs` captures the actual saved evidence and builds 29 scene frames. No Meta calls.
2. `python3 scripts/build-demo-audio.py` generates system narration, subtitles and the timed transcript. Set `PYTHONPATH` if using a temporary package directory.
3. `python3 scripts/build-demo-video.py` encodes H.264/AAC MP4, 1920×1080, 25 fps, 180 seconds. It verifies full audio/video decoding, duration, resolution, subtitle track and audio volume, then saves [verification.json](verification.json).

## Before submission

Watch the full MP4 and adjust pronunciation/pacing or record the provided English text in your own voice. Upload the video to an accessible hosting service and add that link to the submission. Creating this local file does not upload a video or submit the project.
