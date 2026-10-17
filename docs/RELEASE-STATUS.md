# Release status

Technical release contents and verification scope. Publication is confirmed by the [Pages workflow](https://github.com/atonota/genux/actions/workflows/pages.yml), rather than this source document.

## Changes

- Source naming renamed to GenUX.
- Previews: native vertical scrolling restored.
- Grid: each preview toolbar uses the real controlled Switch component to show or hide its grid.
- Release preparation for the requested public repository and the GitHub Pages migration to `/genux`.
- Canonical local checkout moved from `genui` to `genux`; localhost keeps serving the same current files on port 4324, with a temporary `genui` compatibility symlink only. No code, style or contract change.

## Mandatory CI gates (`.github/workflows/adaptive-ui.yml`)

- `npm ci`, decision admission tests and adaptive contract tests (`npm run docs:adaptive:test`).
- Focused FAB gates: `docs/tests/fab.test.mjs`, `component-motion.test.mjs`, `interaction-stability.test.mjs`.
- Docs format, lint and check (`npm run docs:format`, `docs:lint`, `docs:check`).
- Browser config type check (`docs/tsconfig.browser.json`) and production docs build (`npm run docs:build`).
- Adaptive browser tests on Chromium, Firefox and WebKit (`npm run docs:adaptive:browser`).
- FAB browser tests (`docs/browser/fab.config.ts`).

Pages calls this workflow through `workflow_call`, so a deploy requires these gates on its own revision.

## Broad legacy suite

- `npm run docs:test` remains available and unchanged; it is not a gate for this release.
- A prior snapshot recorded 88/597 failures (docs-verify 10 comparison). The current suite has not been rerun; that result is not acceptance evidence and does not imply the current state is the same.
- A newly added, unpublished `Docs tests` workflow step was removed only because it fell outside the frozen user-approved coverage. This is not a claim that the suite passes.
- The CI governance assertion in `docs/tests/fab.test.mjs` now follows the restored focused gates (decision admission, adaptive contract and the single FAB, motion and interaction `node --test` step) instead of requiring `docs:test`. The legacy suite stays available, has not been rerun and is known red; this is not an approval.

## Verification status

- No CI run, live commit or Pages deployment is claimed until an actual receipt exists.
- Local Chromium results are not evidence for physical devices, macOS Safari or Firefox. The three-engine CI job provides bounded emulation only; real-device checks are not run.
