# TabProof benchmark

25 scheduled attempts recorded. Configuration state: consistent. Missing configurations: 0.

| Condition | Completed / all attempts | Completed / eligible | Confirmed fixture finding / eligible | False positives / eligible | Reproducibility / eligible |
| --- | --- | --- | --- | --- | --- |
| correct | 5/5 (100%) | 5/5 (100%) | N/A | 0/5 (0%) | 5/5 (100%) |
| unreachable_button | 0/5 (0%) | 0/2 (0%) | 2/2 (100%) | N/A | 2/2 (100%) |
| calendar_keyboard | 0/5 (0%) | 0/5 (0%) | 5/5 (100%) | N/A | 5/5 (100%) |
| modal_dismissal | 0/5 (0%) | 0/0 (N/A) | 0/0 (N/A) | N/A | 0/0 (N/A) |
| focus_loss | 5/5 (100%) | 5/5 (100%) | 5/5 (100%) | N/A | 5/5 (100%) |

Fixture-finding rates measure the hybrid system with a fixture-specific independent detector. They are not standalone model defect-detection rates. Errors remain in operational completion denominators and are listed separately from eligible-run ratios. Five trials per condition are exploratory.

Known usage: 12603702 tokens across 505 recorded attempts. Attempts without returned usage: 0. Runs with unknown request count: 0. No dollar cost is inferred from tokens.

## Errors retained

- unreachable_button: agent-1793035133080089065: model_incomplete
- unreachable_button: agent-1793035461820294624: model_incomplete
- unreachable_button: agent-1793036113346233715: model_incomplete
- calendar_keyboard: agent-1793035233037270379: independent evidence error: page.evaluate: Execution context was destroyed, most likely because of a navigation
- calendar_keyboard: agent-1793035848342337335: independent evidence error: page.evaluate: Execution context was destroyed, most likely because of a navigation
- calendar_keyboard: agent-1793036127001221566: independent evidence error: page.evaluate: Execution context was destroyed, most likely because of a navigation
- calendar_keyboard: agent-1793036433334901464: independent evidence error: page.evaluate: Execution context was destroyed, most likely because of a navigation
- modal_dismissal: agent-1793035273203213310: model_incomplete
- modal_dismissal: agent-1793035624368042030: model_incomplete
- modal_dismissal: agent-1793035918862648708: model_incomplete
- modal_dismissal: agent-1793036234901702591: model_incomplete
- modal_dismissal: agent-1793036498989575852: model_incomplete
- focus_loss: agent-1793035368627942190: independent evidence error: page.evaluate: Execution context was destroyed, most likely because of a navigation
- focus_loss: agent-1793035657954428168: independent evidence error: page.evaluate: Execution context was destroyed, most likely because of a navigation
- focus_loss: agent-1793036020615113624: independent evidence error: page.evaluate: Execution context was destroyed, most likely because of a navigation
- focus_loss: agent-1793036267663325348: independent evidence error: page.evaluate: Execution context was destroyed, most likely because of a navigation
- focus_loss: agent-1793036599211641947: independent evidence error: page.evaluate: Execution context was destroyed, most likely because of a navigation
