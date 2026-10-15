import { ESLint } from 'eslint';
import { render, root } from './build.mjs';

// The runtime is one ordered classic scope. Lint that exact scope, excluding the
// unchanged third-party bundle, instead of inventing globals for each fragment.
const { script, manifest } = await render();
const { readFile } = await import('node:fs/promises');
const { resolve } = await import('node:path');
const vendor = await readFile(resolve(root, manifest.vendor.path), 'utf8');
const globals = Object.fromEntries(
  [
    'document',
    'window',
    'localStorage',
    'setTimeout',
    'clearTimeout',
    'requestAnimationFrame',
    'getComputedStyle',
    'IntersectionObserver',
    'Blob',
    'URL',
    'AtlasDropdowns',
    'Event',
    'CustomEvent',
    'MutationObserver',
  ].map(name => [name, 'readonly']),
);
const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    {
      languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals },
      rules: {
        'no-undef': 'error',
        'no-dupe-args': 'error',
        'no-dupe-keys': 'error',
        'no-unreachable': 'error',
        'no-constant-binary-expression': 'error',
        'valid-typeof': 'error',
        'no-unsafe-finally': 'error',
      },
    },
  ],
});
const results = await eslint.lintText(script.replace(vendor, ''), {
  filePath: 'atlas.authored.js',
});
const formatter = await eslint.loadFormatter('stylish');
process.stdout.write(formatter.format(results));
if (results.some(result => result.errorCount || result.warningCount)) process.exitCode = 1;
else console.log('Authored offline runtime lint: pass');
