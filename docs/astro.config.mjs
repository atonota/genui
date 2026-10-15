import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import docsPixelStyles from '../tools/docs-pixel-styles.mjs';
import docsPresentation from '../tools/docs-presentation.mjs';

export default defineConfig({
  integrations: [react(), docsPresentation()],
  output: 'static',
  server: { host: '127.0.0.1', port: 4321 },
  devToolbar: { enabled: false },
  build: { inlineStylesheets: 'auto' },
  vite: { css: { postcss: { plugins: [docsPixelStyles()] } } },
});
