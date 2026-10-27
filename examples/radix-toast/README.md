# Radix Toast: Escape closes an unrelated notification

This is a second third-party example, independent of React Aria. It uses the actual, unmodified **`@radix-ui/react-toast` npm packages 1.2.19 and 1.2.20**, imported through pinned npm aliases. The host JSX, CSS and notification state logic are identical.

Known upstream issue: [radix-ui/primitives #2906](https://github.com/radix-ui/primitives/issues/2906). Upstream correction: [PR #4005](https://github.com/radix-ui/primitives/pull/4005). We are reproducing a historical bug already fixed by the library authors; this is not a new discovery or a new upstream patch by TabProof.

## Install and run

From the repository root:

```sh
npm ci
npm ci --prefix examples/radix-toast --ignore-scripts
npx playwright install chromium
npm run demo:radix-toast
```

- Evidence viewer: http://127.0.0.1:4197/
- Original integration, Toast 1.2.19: http://127.0.0.1:4195/
- Corrected integration, Toast 1.2.20: http://127.0.0.1:4196/

Individual servers can also be started with `node examples/radix-toast/server.mjs --port=4195` or `--corrected --port=4196`.

## Manual reproduction

Start a fresh page. Three notifications are open: Draft saved, Upload complete and Sync finished. Press **Tab six times**, which moves focus from the page through the real Radix viewport to the Draft saved notification, then press **Escape once**.

- 1.2.19 removes Draft saved **and** Sync finished. Only Upload complete remains.
- 1.2.20 removes Draft saved alone. Upload complete and Sync finished remain.

The application has no custom Escape handler, DOM focus helper or injected dismissal failure. Actual Radix Root, Close, Provider and Viewport components handle the interactions. Controlled open state only reflects `onOpenChange`; `duration={Infinity}` is identical in both conditions and removes automatic expiry as a confound.

## Deterministic test, no model calls

```sh
npm run check:radix-toast
npm run check:radix-toast -- --condition=original
npm run check:radix-toast -- --condition=corrected
```

The matrix command requires three failing original sessions, three passing corrected sessions, and the expected observations from separate controls. Original-only intentionally exits **1**; corrected-only exits **0**. Artifacts, screenshots and trace ZIPs go to ignored `output/playwright/radix-toast-check-*`.

The primary assertion requires three initial notifications, one Escape originating inside Draft saved, no Dismiss-button activation, and preservation of both other notifications. All keyboard test actions use the existing TabProof keyboard executor. The oracle only reads DOM/focus state.

Additional checks:

- Escape focused on the middle notification reproduces the same extra-dismissal pattern in the original.
- Clicking Draft saved's actual close button dismisses only Draft saved in both versions. Pointer interaction is a separate control, never an agent tool.
- Escape with focus outside all notifications closes only the latest notification in both versions.

In the raw JSON, a `middle-toast-control` row with `passed:true` means its version-specific **expected observation** matched. It does not mean the original middle-toast behavior is correct.

## Real Muse Spark runs

```sh
npm run check:radix-toast:agent
```

This uses the existing local Meta key and spends API credits. It runs actual TabProof `openWebsiteSession`, `runAgent` and `nextAction`, with the original action/token limits and stopping policy. No decisions are scripted. Original and corrected conditions use the same starting URL sequentially, with a fresh browser each time. The package selection is outside model observations.

Actual notification and focus measurements are recorded separately during the live sessions; they are never included in model observations. An example-specific contract checks the result. An erroneous original model completion, if it occurs in a future attempt, remains explicitly marked as a false completion rather than being relabeled as model detection.

## Comparison limits

The upgrade intentionally changes both the Toast package **and its locked transitive dependency graph**. This is a real dependency upgrade test, not an experiment isolating one changed source line. Complete graphs and npm integrity values are retained in `package-lock.json`. The published source fingerprints show identical host code and agent configurations.

This is a local minimal integration, not a public production website, and it is tested in one Chromium/macOS configuration. Two live model attempts and three deterministic repeats per condition are not evidence of general reliability or WCAG certification. See [the saved measurements and comparison](../../docs/radix-toast-2026-10-27/README.md).
