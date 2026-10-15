import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ESLint } from 'eslint';
import stylelint from 'stylelint';
import ts from 'typescript';
import { authoredStylesheets } from './stylelint-focus-plugin.mjs';

// TypeScript's pinned compiler removes types/JSX without executing application code.
// Strict tsc remains the type gate; ESLint checks the emitted authored module scope.
const root = resolve(import.meta.dirname, '..');
async function modules(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(entry => {
        const path = resolve(directory, entry.name);
        return entry.isDirectory()
          ? modules(path)
          : /\.(?:ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')
            ? [path]
            : [];
      }),
    )
  ).flat();
}
const globals = Object.fromEntries(
  [
    'document',
    'window',
    'navigator',
    'localStorage',
    'sessionStorage',
    'matchMedia',
    'location',
    'history',
    'console',
    'fetch',
    'URL',
    'URLSearchParams',
    'Blob',
    'File',
    'FileReader',
    'FormData',
    'Event',
    'MouseEvent',
    'KeyboardEvent',
    'FocusEvent',
    'PointerEvent',
    'CustomEvent',
    'HTMLElement',
    'HTMLInputElement',
    'HTMLTextAreaElement',
    'HTMLFormElement',
    'HTMLDialogElement',
    'Element',
    'SVGElement',
    'Node',
    'Document',
    'DocumentFragment',
    'ShadowRoot',
    'MutationObserver',
    'ResizeObserver',
    'IntersectionObserver',
    'getComputedStyle',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'innerWidth',
    'innerHeight',
    'scrollX',
    'scrollY',
    'performance',
    'structuredClone',
    'Intl',
    'AbortController',
    'AbortSignal',
    'DOMException',
    'Headers',
    'ReadableStream',
    'TransformStream',
    'Response',
    'TextEncoder',
    'TextDecoder',
  ].map(key => [key, 'readonly']),
);
const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    {
      languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals },
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
let errors = 0;
const paths = await modules(resolve(root, 'docs/src'));
const formatter = await eslint.loadFormatter('stylish');
for (const path of paths) {
  const text = await readFile(path, 'utf8');
  const compiled = ts.transpileModule(text, {
    fileName: path,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const results = await eslint.lintText(compiled.outputText, {
    filePath: path.replace(/\.tsx?$/, '.js'),
  });
  errors += results.reduce((total, result) => total + result.errorCount + result.warningCount, 0);
  if (results.some(result => result.errorCount || result.warningCount))
    process.stdout.write(formatter.format(results));
}
console.log(
  `Authored docs module lint: ${errors ? 'fail' : 'pass'} (${paths.length} modules; ${errors} findings).`,
);

// Stylelint adds the local focus gate for every authored stylesheet; the config ignores
// disable comments, so no file or declaration can opt out. The plugin resolves var() lengths
// against this same stylesheet set.
const sheets = authoredStylesheets(root);
let findings = 0;
for (const path of sheets) {
  const { results, report } = await stylelint.lint({
    code: await readFile(path, 'utf8'),
    codeFilename: path,
    configFile: resolve(root, 'stylelint.config.mjs'),
    formatter: 'string',
  });
  const count = results.reduce(
    (total, result) => total + result.warnings.length + result.invalidOptionWarnings.length,
    0,
  );
  findings += count;
  if (count) process.stdout.write(report);
}
const styleFailed = findings > 0 || sheets.length === 0;
console.log(
  `Authored stylesheet focus lint: ${styleFailed ? 'fail' : 'pass'} (${sheets.length} stylesheets; ${findings} findings).`,
);
process.exitCode = errors || styleFailed ? 1 : 0;
