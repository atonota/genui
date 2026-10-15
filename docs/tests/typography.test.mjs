import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import postcss from 'postcss';
import { mountPattern } from './harness.mjs';
import docsPixelStyles from '../../tools/docs-pixel-styles.mjs';

test('documentation uses native 14px Outfit 400 tokens without changing the approved profile', async t => {
  const file = `docs/tests/.typography-${randomUUID()}.tsx`;
  await writeFile(
    file,
    `
import {theme} from 'antd';
import AtlasProvider,{atlasDocsTheme,atlasDocsDarkTheme,atlasTheme} from '../src/react/AtlasProvider';
import AtlasButton from '../src/react/AtlasButton';
function Probe(){const {token}=theme.useToken();return <output data-nested-tokens>{JSON.stringify({fontSize:token.fontSize,lineHeight:token.lineHeight,fontWeightStrong:token.fontWeightStrong})}</output>}
export default function Fixture(){return <>
<output data-docs-tokens>{JSON.stringify([atlasDocsTheme,atlasDocsDarkTheme].map(config=>theme.getDesignToken(config)))}</output>
<output data-approved-tokens>{JSON.stringify(theme.getDesignToken(atlasTheme))}</output>
<AtlasProvider><AtlasProvider appearance="docs"><AtlasButton text="Documentation action"/><AtlasProvider appearance="approved"><Probe/><AtlasButton text="Reset approved action"/></AtlasProvider></AtlasProvider><AtlasButton text="Approved action"/></AtlasProvider>
</>}`,
  );
  let h;
  try {
    h = await mountPattern('default', file);
  } catch (error) {
    await unlink(file);
    throw error;
  }
  t.after(async () => {
    await h.dispose();
    await unlink(file);
  });
  const docs = JSON.parse(h.document.querySelector('[data-docs-tokens]').textContent);
  for (const tokens of docs) {
    assert.equal(tokens.fontSize, 14);
    assert.equal(tokens.fontSizeSM, 14);
    assert.equal(tokens.fontSizeLG, 16);
    assert.equal(tokens.lineHeight, 22 / 14);
    assert.equal(tokens.fontWeightStrong, 400);
    assert.match(tokens.fontFamily, /^Outfit,/);
  }
  assert.equal(
    JSON.parse(h.document.querySelector('[data-approved-tokens]').textContent).fontSize,
    16,
  );
  const doc = h.document.querySelector('[data-atlas-appearance="docs"]');
  assert.equal(doc.style.getPropertyValue('--atlas-component-height'), '56px');
  assert.equal(doc.style.getPropertyValue('--text'), '14px');
  assert.equal(doc.style.getPropertyValue('--font-weight-label'), '400');
  assert.equal(doc.style.getPropertyValue('--font-weight-min'), '300');
  assert.equal(doc.style.getPropertyValue('--font-weight-light'), '300');
  assert.equal(
    doc.style.getPropertyValue('--line-height'),
    String(22 / 14),
    'caption calc needs a unitless line-height multiplier',
  );
  assert.equal(doc.querySelector('.atlas-button').style.minHeight, '56px');
  assert.equal(
    h.document.querySelector('.atlas-demo:not([data-atlas-appearance]) > .atlas-button').style
      .minHeight,
    '3.5rem',
  );
  const approvedChild = doc.querySelector('.atlas-demo:not([data-atlas-appearance])');
  assert.equal(approvedChild.style.getPropertyValue('--text'), '1rem');
  assert.equal(approvedChild.style.getPropertyValue('--font-weight-label'), 'initial');
  assert.equal(approvedChild.style.getPropertyValue('--font-weight-min'), 'initial');
  const approved = JSON.parse(h.document.querySelector('[data-approved-tokens]').textContent);
  const nested = JSON.parse(h.document.querySelector('[data-nested-tokens]').textContent);
  for (const key of ['fontSize', 'lineHeight', 'fontWeightStrong'])
    assert.equal(nested[key], approved[key], `explicit approved child resets ${key}`);
  const declarations = [];
  for (const style of h.document.querySelectorAll('style'))
    postcss.parse(style.textContent).walkDecls('--ant-font-size', declaration => {
      if (declaration.parent.selector?.includes('.css-var-atlas-docs'))
        declarations.push(declaration.value);
    });
  assert.ok(declarations.includes('14px'), 'documentation CSS-in-JS must emit native pixels');
  assert.ok(
    !declarations.some(value => value.includes('rem')),
    'docs CSS must not pass through px2rem',
  );
});

test('documentation styles use pixel dimensions and retain readable type and touch floors', async () => {
  for (const name of await readdir('docs/src/styles')) {
    if (!name.endsWith('.css')) continue;
    const source = await readFile(`docs/src/styles/${name}`, 'utf8');
    const { root: sheet } = await postcss([docsPixelStyles()]).process(source, {
      from: resolve(`docs/src/styles/${name}`),
    });
    sheet.walkDecls(declaration => {
      assert.doesNotMatch(declaration.value, /-?\d*\.?\d+rem\b/, `${name}: ${declaration.prop}`);
      if (declaration.prop === 'font-size' && /^\d+(?:\.\d+)?px$/.test(declaration.value))
        assert.ok(parseFloat(declaration.value) >= 14, `${name}: readable text below 14px`);
      // Variable font files can contain thinner masters; authored readable text cannot use them.
      if (
        declaration.parent.type === 'rule' &&
        (declaration.prop === 'font-weight' || declaration.prop.startsWith('--font-weight-'))
      ) {
        assert.doesNotMatch(
          declaration.value,
          /\blighter\b/,
          `${name}: implicit lighter can fall below300`,
        );
        for (const value of declaration.value.match(/\b\d+(?:\.\d+)?\b/g) ?? [])
          assert.ok(Number(value) >= 300, `${name}: authored font weight below300`);
      }
    });
    sheet.walkAtRules(rule =>
      assert.doesNotMatch(rule.params, /\d*\.?\d+rem\b/, `${name}: ${rule.name}`),
    );
  }
  const original = 'a{width:1rem}';
  const unrelated = await postcss([docsPixelStyles()]).process(original, {
    from: resolve('storybook/preview.css'),
  });
  assert.equal(unrelated.css, original, 'the documentation build transform cannot touch Storybook');
  const shared = postcss.parse(await readFile('docs/src/styles/docs.css', 'utf8'));
  let baseline;
  shared.walkRules(rule => {
    if (rule.selector === ':root')
      rule.walkDecls('--text', declaration => {
        baseline = declaration.value;
      });
  });
  assert.equal(
    baseline,
    '1rem',
    'approved typography still follows a20px user root instead of fixing it to16px',
  );
});

test('theme builder accepts scoped 12px text and 300 weight floors with 14px Outfit defaults', async t => {
  const file = `docs/tests/.typography-${randomUUID()}.tsx`;
  await writeFile(
    file,
    `
import {createDefaultRecipe,resolveThemeBuilder,tokenDefinitions,validateRecipe} from '../src/theme-builder/model';
const modes=['light','dark'] as const;
function attempt(id:string,mode:'light'|'dark',value:number){const recipe:any=createDefaultRecipe();recipe[mode]={...recipe[mode],[id]:value};const result=validateRecipe(recipe);if(!result.ok)return {ok:false,error:result.error};const resolved=resolveThemeBuilder(result.recipe,mode);return {ok:true,variables:resolved.variables,fontSize:resolved.token.fontSize}}
const typography=tokenDefinitions.filter(def=>def.group==='typography'&&def.kind==='number');
const report={
sizes:typography.filter(def=>def.unit==='px').map(def=>({id:def.id,css:def.css,defaults:def.defaults,cases:modes.map(mode=>({mode,at12:attempt(def.id,mode,12),at11:attempt(def.id,mode,11)}))})),
weights:typography.filter(def=>def.unit==='').map(def=>({id:def.id,defaults:def.defaults,cases:modes.map(mode=>({mode,at300:attempt(def.id,mode,300),at299:attempt(def.id,mode,299),at200:attempt(def.id,mode,200)}))})),
defaults:modes.map(mode=>{const {token,variables}=resolveThemeBuilder(createDefaultRecipe(),mode);return {mode,fontSize:token.fontSize,fontSizeLG:token.fontSizeLG,fontFamily:token.fontFamily,weight:variables['--font-weight-body']}}),
};
export default function Fixture(){return <output data-builder-typography>{JSON.stringify(report)}</output>}`,
  );
  let h;
  try {
    h = await mountPattern('default', file);
  } catch (error) {
    await unlink(file);
    throw error;
  }
  t.after(async () => {
    await h.dispose();
    await unlink(file);
  });
  const report = JSON.parse(h.document.querySelector('[data-builder-typography]').textContent);
  const body = report.sizes.find(size => size.css === '--text-body');
  assert.ok(body, 'body text stays an editable builder size');
  for (const size of report.sizes) {
    for (const mode of ['light', 'dark'])
      assert.ok(size.defaults[mode] >= 14, `${size.id}: ${mode} default stays at least 14px`);
    for (const { mode, at12, at11 } of size.cases) {
      assert.equal(at12.ok, true, `${size.id}: ${mode} rejects 12px (${at12.error})`);
      assert.equal(at12.variables[size.css], '12px', `${size.id}: ${mode} emits accepted 12px`);
      assert.equal(at11.ok, false, `${size.id}: ${mode} accepts text below 12px`);
      assert.ok(
        at11.error.includes(`"${size.id}"`),
        `${size.id}: ${mode} rejection names the token`,
      );
    }
  }
  for (const { mode, at12 } of body.cases)
    assert.equal(at12.fontSize, 12, `${mode}: accepted 12px body text is not clamped back to 14px`);
  assert.equal(report.weights.length, 1, 'the builder exposes exactly one editable font weight');
  const [weight] = report.weights;
  for (const { mode, at300, at299, at200 } of weight.cases) {
    assert.equal(weight.defaults[mode], 400, `${mode}: default weight stays 400`);
    assert.equal(at300.ok, true, `${mode}: rejects weight 300 (${at300.error})`);
    assert.equal(
      at300.variables['--font-weight-body'],
      '300',
      `${mode}: emits accepted weight 300`,
    );
    for (const below of [at299, at200]) {
      assert.equal(below.ok, false, `${mode}: accepts a weight below 300`);
      assert.ok(
        below.error.includes(`"${weight.id}"`),
        `${mode}: rejection names the weight token`,
      );
    }
  }
  for (const resolved of report.defaults) {
    assert.equal(resolved.fontSize, 14, `${resolved.mode}: standard text stays 14px`);
    assert.equal(resolved.fontSizeLG, 16, `${resolved.mode}: reading text stays 16px`);
    assert.match(resolved.fontFamily, /^Outfit,/);
    assert.equal(resolved.weight, '400', `${resolved.mode}: default weight stays 400`);
  }
});
