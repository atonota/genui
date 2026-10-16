import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const browsers = ['chromium', 'firefox', 'webkit'] as const;

// ATLAS_SOURCE_STAGE only names an evidence folder, so separators and dots are dropped.
function evidenceStage(value = ''): string {
  const stage = value.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return stage.slice(0, 64) || 'local';
}

const evidenceRoot = join(projectRoot, 'evidence', 'adaptive-browser');
const stageRoot = join(evidenceRoot, evidenceStage(process.env.ATLAS_SOURCE_STAGE));
const resultsRoot = join(stageRoot, 'results');
const reportFolder = join(stageRoot, 'report');

export default defineConfig({
  testDir: '.',
  testMatch: ['adaptive-ui.spec.ts'],
  outputDir: resultsRoot,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 60_000,
  globalTimeout: 240_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['html', { outputFolder: reportFolder, open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4339',
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    screenshot: 'off',
    trace: 'retain-on-failure',
  },
  // Per-engine outputDir keeps testInfo.outputPath screenshots from overwriting across engines.
  projects: browsers.map(browserName => ({
    name: browserName,
    outputDir: join(resultsRoot, browserName),
    use: { browserName, viewport: { width: 320, height: 720 }, hasTouch: false },
  })),
  // Serves the production output of `npm run docs:build`; no dev server is involved.
  webServer: {
    command: 'python3 -m http.server 4339 --bind 127.0.0.1 --directory docs/dist',
    cwd: projectRoot,
    url: 'http://127.0.0.1:4339',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
