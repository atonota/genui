import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import seo from '../docs/src/data/seo-policy.json' with { type: 'json' };

// Explicit maintainer command, not part of the site build: uses the installed browser only.
const root = resolve(import.meta.dirname, '..');
const output = await build({
  entryPoints: [resolve(root, 'docs/src/data/docs-brand.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
});
const { DOCS_BRAND_SEED } = await import(
  `data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`
);
const font = (await readFile(resolve(root, 'src/assets/outfit-latin.woff2'))).toString('base64');
const browser = await chromium.launch({ channel: 'chromium' });
try {
  const page = await browser.newPage({
    viewport: { width: seo.social.width, height: seo.social.height },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<style>@font-face{font-family:Outfit;src:url(data:font/woff2;base64,${font})}*{box-sizing:border-box}body{margin:0;background:#fff;color:#222;font-family:Outfit}main{padding:72px;display:flex;flex-direction:column;gap:28px}.brand{font-size:42px;color:${DOCS_BRAND_SEED};font-weight:600}h1{font-size:72px;font-weight:550;line-height:1.06;letter-spacing:-2px;margin:0;max-width:1000px}p{font-size:30px;line-height:1.4;max-width:900px;margin:0}.note{font-size:22px;color:#555;margin-top:12px}</style><main><div class="brand">Gen UX</div><h1>Components that<br>work together.</h1><p>Shared design tokens. Adaptive interfaces.<br>Documented examples and APIs.</p><div class="note">GenUX component documentation</div></main>`,
  );
  await page.evaluate(() => document.fonts.ready);
  const directory = resolve(root, 'docs/public/social');
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'genux.png'), await page.screenshot({ type: 'png' }));
  console.log('Generated docs/public/social/genux.png from approved brand seed and Outfit.');
} finally {
  await browser.close();
}
