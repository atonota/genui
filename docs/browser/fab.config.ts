import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const browsers = ['chromium', 'firefox', 'webkit'] as const;

// GENUX_SOURCE_STAGE only names an evidence folder, so separators and dots are dropped.
function evidenceStage(value = ''): string {
  const stage = value.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return stage.slice(0, 64) || 'local';
}

// FAB evidence sits inside the uploaded adaptive evidence folder, e.g. fab-ci in CI.
const evidenceRoot = join(projectRoot, 'evidence', 'adaptive-browser');
const stageRoot = join(evidenceRoot, `fab-${evidenceStage(process.env.GENUX_SOURCE_STAGE)}`);
const resultsRoot = join(stageRoot, 'results');
const reportFolder = join(stageRoot, 'report');
// The JSON receipt sits beside the html report, which empties its own folder on each run.
const reportFile = join(stageRoot, 'report.json');

export default defineConfig({
  testDir: '.',
  testMatch: ['fab.spec.ts'],
  outputDir: resultsRoot,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  // Engines run side by side; fullyParallel false keeps each engine's cases serial.
  workers: 2,
  timeout: 60_000,
  globalTimeout: 300_000,
  expect: { timeout: 5_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: reportFolder, open: 'never' }],
    ['json', { outputFile: reportFile }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4340',
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    // One page photo at the failure keeps the failing visual; the specs' explicit evidence photos are unaffected.
    screenshot: 'only-on-failure',
    // Traces record during every run and are dropped on pass, so per-action capture costs passing cases too.
    // Before and after DOM snapshots ran about 500 times per case; failure traces keep actions, network and sources.
    trace: { mode: 'retain-on-failure', screenshots: false, snapshots: false, sources: true },
  },
  // Per-engine outputDir keeps testInfo.outputPath screenshots from overwriting across engines.
  // Desktop default for the docs and action journeys; narrow journeys set 320 CSS px themselves.
  projects: browsers.map(browserName => ({
    name: browserName,
    outputDir: join(resultsRoot, browserName),
    use: { browserName, viewport: { width: 1440, height: 1000 }, hasTouch: false },
  })),
  // Serves the production output of `npm run docs:build` on its own port; no dev server is involved.
  webServer: {
    command: 'python3 -m http.server 4340 --bind 127.0.0.1 --directory docs/dist',
    cwd: projectRoot,
    url: 'http://127.0.0.1:4340',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
