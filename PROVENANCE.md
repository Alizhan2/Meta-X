# Provenance

| Item | Source | License / rights | Our contribution | Date |
| --- | --- | --- | --- | --- |
| README and evaluation protocol | Original planning in this repository, with AI assistance | Project-authored; project license not yet selected | Scope, action boundary, benchmark design, schedule | 2026-10-26 |
| Fixture, keyboard executor, runner and checks | Original implementation with AI assistance | Project-authored; project license not yet selected | Booking UI, server-held conditions and records, keyboard-only tool boundary, Meta loop | 2026-10-26 |
| Playwright 1.64.1 | https://github.com/microsoft/playwright | Apache-2.0; distributed dependency and browser notices apply | Used as a dependency; not authored by this project | 2026-10-26 |
| First-run screenshot | Our controlled fixture with synthetic inputs | Project-authored screenshot | Evidence of one successful run | 2026-10-26 |
| Evidence probes, replay, HTML report and comparison | Original implementation with AI assistance | Project-authored; project license not yet selected | Three-repeat fixture probes and corrected controls, independent outcome checks, exact-key replay, fresh agent comparison | 2026-10-26 |
| 25-run benchmark and navigation regression | Actual Meta responses plus our controlled fixture; AI-assisted engineering | Synthetic data and project-authored code | Original raw records, explicitly scoped metrics, separate replay follow-up; no model reasoning or credentials | 2026-10-26 |
| React Aria Components 1.19.0 / React Aria 3.50.0 | https://github.com/adobe/react-spectrum ; npm package pinned in examples/react-aria-scroll/package-lock.json | Apache-2.0; upstream library is unmodified | Minimal integration reproducing already published issue https://github.com/adobe/react-spectrum/issues/10395 ; application workaround adds an explicit tabIndex=0 | 2026-10-27 |
| React / React DOM 18.3.1 and esbuild 0.25.12 | https://github.com/facebook/react ; https://github.com/evanw/esbuild | MIT; transitive dependency notices apply | Dependency use for the minimal third-party host application and local bundle; not project-authored libraries | 2026-10-27 |
| React Aria reproduction, contract and evidence | This repository; upstream issue 10395 supplies the known failure pattern and workaround | Project-authored host/check/report with AI assistance; no upstream authorship or original-discovery claim | Identical keyboard regression before/after, native and pointer controls, real Meta attempts and separate read-only task oracle | 2026-10-27 |

No external application template, fonts, or media assets were copied into this implementation. The React Aria example implements the pattern from the linked upstream report using the actual dependency; that library and the original bug discovery are explicitly attributed above. Typography uses system fonts. Add entries as materials are introduced; dependencies are pinned by the lockfile.
