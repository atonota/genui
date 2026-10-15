import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../storybook/*.stories.tsx'],
  framework: '@storybook/react-vite',
  staticDirs: [{ from: '../src/assets', to: '/atlas-assets' }],
  core: { disableTelemetry: true },
  // Match Astro's React JSX runtime for the shared TSX sources.
  viteFinal: async config => ({
    ...config,
    esbuild: { ...(config.esbuild || {}), jsx: 'automatic' },
  }),
};

export default config;
