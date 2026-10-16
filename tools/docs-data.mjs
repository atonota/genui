import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';
import postcss from 'postcss';
import { format, resolveConfig } from 'prettier';
import { root } from './build.mjs';
import { checkCurrentDecisions } from './docs-decisions.mjs';

// Current direct human decisions gate every docs build and check before anything is derived.
await checkCurrentDecisions(root);

// Build-only bridge. The existing model remains the single source of decisions.
const source = (
  await Promise.all(
    ['decisions.js', 'palettes.js', 'icons.js'].map(name =>
      readFile(resolve(root, 'src/model', name), 'utf8'),
    ),
  )
).join('\n');
const data = JSON.parse(
  vm.runInNewContext(
    source +
      `\nJSON.stringify({
  decisions: COMPONENT_DECISIONS, experiments: BUTTON_EXPERIMENTS,
  palettes: PALETTES, tones: TONE_PALETTES, icons: ICON_CATALOG
})`,
    Object.create(null),
    { timeout: 1000 },
  ),
);
const dir = resolve(root, 'docs/src/data');
const fontSource = await readFile(resolve(root, 'src/styles/fonts.css'), 'utf8');
const fontComment = fontSource.match(/\/\*([\s\S]*?)\*\//)?.[1];
if (!fontComment?.includes('SIL OPEN FONT LICENSE')) throw new Error('Outfit license missing');
data.outfitLicense = fontComment.trim();
await mkdir(dir, { recursive: true });
await writeFile(resolve(dir, 'atlas.json'), JSON.stringify(data, null, 2) + '\n');
const shadowTokens = new Map();
postcss.parse(await readFile(resolve(root, 'src/styles/atlas.css'), 'utf8')).walkRules(rule => {
  if (rule.selector === ':root' || rule.selector === '.btx,.shadow-swatch')
    rule.walkDecls(decl => {
      if (decl.prop.startsWith('--shadow-')) shadowTokens.set(decl.prop, decl.value);
    });
});
await mkdir(resolve(root, 'docs/src/styles'), { recursive: true });
await writeFile(
  resolve(root, 'docs/src/styles/atlas-shadows.css'),
  await format(
    ':root {\n' +
      [...shadowTokens].map(([name, value]) => `  ${name}: ${value};`).join('\n') +
      '\n}\n',
    { ...(await resolveConfig(resolve(root, 'docs/src/styles/atlas-shadows.css'))), parser: 'css' },
  ),
);
const motion = JSON.parse(await readFile(resolve(dir, 'motion.json'), 'utf8'));
await writeFile(
  resolve(root, 'docs/src/styles/atlas-motion.css'),
  await format(
    ':root {\n' +
      `  --motion-easing: ${motion.easing};\n` +
      Object.entries(motion.durationMs)
        .map(([name, value]) => `  --motion-duration-${name}: ${value}ms;`)
        .join('\n') +
      `\n  --motion-delay: ${motion.delayMs}ms;\n}\n`,
    { ...(await resolveConfig(resolve(root, 'docs/src/styles/atlas-motion.css'))), parser: 'css' },
  ),
);
console.log('Documentation data derived from the canonical atlas model.');
