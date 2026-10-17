import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import postcss from 'postcss';
import { render, root, sha256 } from './build.mjs';
import { writeAntdFixtures } from './antd-fixtures.mjs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { originalLegacyCss } from './legacy-css-contract.mjs';

const result = await render();
postcss.parse(result.css);
const baseline = await readFile(resolve(root, 'tests/fixtures/before.html'), 'utf8');
if (sha256(baseline) !== result.manifest.baseline_sha256)
  throw new Error('Baseline changed without review.');
const beforeCss = baseline.match(/<style id="genux-styles">([\s\S]*?)<\/style>/)[1];
if (originalLegacyCss(result.css) !== beforeCss)
  throw new Error('Visual CSS contract changed; independent rendered review is required.');
new vm.Script(result.script);
const fixtures = await writeAntdFixtures();
const compile = spawnSync(
  process.execPath,
  [resolve(root, 'node_modules/typescript/bin/tsc'), '--project', 'tsconfig.compat.json'],
  { cwd: root, encoding: 'utf8' },
);
if (compile.stdout) process.stdout.write(compile.stdout);
if (compile.stderr) process.stderr.write(compile.stderr);
if (compile.error || compile.status !== 0)
  throw compile.error || new Error(`AntD type contract failed (${compile.status})`);
console.log(
  JSON.stringify({
    js: 'pass',
    css: 'pass',
    css_preserved: 'pass_except_requested_locale_layout_reduced_motion_order_and_scoped_workspace',
    visual_review: 'not_run',
    css_sha256: sha256(result.css),
    antd_types: 'pass',
    fixtures,
  }),
);
