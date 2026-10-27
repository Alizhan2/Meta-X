# React Aria scroll-container reproduction

This example integrates the **real, unmodified `react-aria-components@1.19.0` npm package**, pinned with its transitive dependencies and integrity values in `package-lock.json`.

It reproduces the already published [React Spectrum issue #10395](https://github.com/adobe/react-spectrum/issues/10395). We did not discover this issue first. The minimal host application and test are new TabProof work; the actual Dialog/Modal/FocusScope implementation belongs to Adobe's React Spectrum project. This is not our booking fixture and no focus trap or keyboard failure is implemented by our application.

## Install and run

From the repository root:

```sh
npm ci
npm ci --prefix examples/react-aria-scroll --ignore-scripts
npx playwright install chromium
node examples/react-aria-scroll/server.mjs --port=4175
```

Open `http://127.0.0.1:4175`. In another terminal:

```sh
node examples/react-aria-scroll/server.mjs --corrected --port=4176
```

The two conditions have the same package, content, CSS and component tree. The only corrective change is an explicit `tabIndex={0}` on the reading panel. It is an application integration workaround recommended in the issue, **not a patch or upgrade to the upstream library**. `/native` renders the same panel outside the modal as a positive browser control.

## Reproduce without AI

1. Press Tab to reach **Open reading details**.
2. Press Enter to open the actual React Aria Dialog.
3. Press Tab once.
4. Press End.
5. Press Escape.

Original: focus skips the reading panel; End leaves `scrollTop` at zero. Corrected: focus reaches the panel, End scrolls to its bottom, and Escape returns focus to the opening button.

```sh
npm run check:third-party
```

The matrix passes only if three original sessions fail the keyboard contract, three corrected sessions pass, the original supports real pointer-wheel scrolling, and the uncorrected panel outside the modal supports native Tab/End scrolling. Trace ZIPs, screenshots and JSON go to `output/playwright/react-aria-check-*`.

The same standalone assertion exits **1** on the original and **0** on the corrected integration:

```sh
npm run check:third-party -- --condition=original
npm run check:third-party -- --condition=corrected
```

These checks make no model calls. The browser measurements are read-only; all interaction in the keyboard test uses the actual TabProof keyboard executor. The pointer positive control is separate and is never exposed to the agent.

## Run the real Meta agent

With the existing local `.env` configured:

```sh
npm run check:third-party:agent
```

This spends Meta API credits. It uses the actual TabProof `openWebsiteSession`, `runAgent`, `nextAction`, 25-action limit and stopping policy, with no scripted decisions. Original and corrected conditions run sequentially at the same URL. A separate, example-specific read-only oracle samples focus and scrolling in the **actual live sessions**, without giving those measurements to the model. Generic custom-site reports still label completion as model-reported; the independent audit stays separate.

The comparison is accepted only if models, full agent configurations and source fingerprints match; source files must remain stable during each attempt. Every attempt, including API errors, is retained.

## Scope

Verified in Chromium on macOS; this does not establish behavior in every browser or every integration. The example-specific contract is not a generic accessibility classifier. A failed task alone does not prove that no keyboard alternative exists. Here attribution also rests on direct focus/scroll observations, the identical native control, the pointer control, a minimal integration correction and the upstream report.

Dependency licenses and upstream attribution are recorded in the root `PROVENANCE.md` and this directory's lockfile. Bundling retains dependency license comments.
