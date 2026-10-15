import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import docsPixelStyles from '../tools/docs-pixel-styles.mjs';
import docsPresentation from '../tools/docs-presentation.mjs';
import docsPages, { PAGES_BASE, PAGES_SITE } from '../tools/docs-pages.mjs';

// GENUI_DOCS_PAGES=1 builds the GitHub Pages artifact; local builds keep root base and docs/dist.
const pages = process.env.GENUI_DOCS_PAGES === '1';

export default defineConfig({
  ...(pages ? { site: PAGES_SITE, base: PAGES_BASE, outDir: './pages/dist' } : {}),
  // The Pages adapter runs after the presentation gate has checked the canonical root paths.
  integrations: [react(), docsPresentation(), ...(pages ? [docsPages()] : [])],
  output: 'static',
  server: { host: '127.0.0.1', port: 4321 },
  devToolbar: { enabled: false },
  build: { inlineStylesheets: 'auto' },
  vite: { css: { postcss: { plugins: [docsPixelStyles()] } } },
});
