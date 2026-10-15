import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const browsers = ['chromium', 'firefox', 'webkit'] as const;

export default defineConfig({
  testDir: '.',
  testMatch: [
    'contracts.spec.ts',
    'breadcrumb-alignment.spec.ts',
    'input-focus.spec.ts',
    'wave-default.spec.ts',
    'button-depth.spec.ts',
    'input-inset.spec.ts',
    'theme-builder.spec.ts',
    'selection-variants.spec.ts',
    'drawer-feedback.spec.ts',
    'ux-guidance.spec.ts',
    'hybrid-ui.spec.ts',
    'form-sections.spec.ts',
    'refactoring-ui.spec.ts',
    'ux-completion.spec.ts',
    'ux-collection.spec.ts',
  ],
  outputDir: fileURLToPath(new URL('../../evidence/browser/candidates', import.meta.url)),
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  timeout: 60_000,
  expect: { timeout: 5_000 },
  reporter: [
    ['list'],
    [
      'html',
      {
        outputFolder: fileURLToPath(new URL('../../evidence/browser/report', import.meta.url)),
        open: 'never',
      },
    ],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4337',
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    screenshot: 'off',
    trace: 'retain-on-failure',
  },
  projects: browsers.flatMap(browserName => [
    {
      name: `${browserName}-desktop`,
      testIgnore: browserName === 'chromium' ? [] : ['ux-guidance.spec.ts'],
      use: { browserName, viewport: { width: 1440, height: 1000 }, hasTouch: false },
    },
    {
      name: `${browserName}-touch`,
      testIgnore: browserName === 'chromium' ? [] : ['ux-guidance.spec.ts'],
      use: { browserName, viewport: { width: 320, height: 720 }, hasTouch: true },
    },
  ]),
  webServer: {
    command: 'npm run docs:preview -- --ignore-lock --port 4337',
    cwd: projectRoot,
    url: 'http://127.0.0.1:4337',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
