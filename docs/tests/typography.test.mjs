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
import GenUXProvider,{genuxDocsTheme,genuxDocsDarkTheme,genuxTheme} from '../src/react/GenUXProvider';
import GenUXButton from '../src/react/GenUXButton';
function Probe(){const {token}=theme.useToken();return <output data-nested-tokens>{JSON.stringify({fontSize:token.fontSize,lineHeight:token.lineHeight,fontWeightStrong:token.fontWeightStrong})}</output>}
export default function Fixture(){return <>
<output data-docs-tokens>{JSON.stringify([genuxDocsTheme,genuxDocsDarkTheme].map(config=>theme.getDesignToken(config)))}</output>
<output data-approved-tokens>{JSON.stringify(theme.getDesignToken(genuxTheme))}</output>
<GenUXProvider><GenUXProvider appearance="docs"><GenUXButton text="Documentation action"/><GenUXProvider appearance="approved"><Probe/><GenUXButton text="Reset approved action"/></GenUXProvider></GenUXProvider><GenUXButton text="Approved action"/></GenUXProvider>
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
  const doc = h.document.querySelector('[data-genux-appearance="docs"]');
  assert.equal(doc.style.getPropertyValue('--genux-component-height'), '56px');
  assert.equal(doc.style.getPropertyValue('--text'), '14px');
  assert.equal(doc.style.getPropertyValue('--font-weight-label'), '400');
  assert.equal(doc.style.getPropertyValue('--font-weight-min'), '300');
  assert.equal(doc.style.getPropertyValue('--font-weight-light'), '300');
  assert.equal(
    doc.style.getPropertyValue('--line-height'),
    String(22 / 14),
    'caption calc needs a unitless line-height multiplier',
  );
  assert.equal(doc.querySelector('.genux-button').style.minHeight, '56px');
  assert.equal(
    h.document.querySelector('.genux-demo:not([data-genux-appearance]) > .genux-button').style
      .minHeight,
    '3.5rem',
  );
  const approvedChild = doc.querySelector('.genux-demo:not([data-genux-appearance])');
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
      if (declaration.parent.selector?.includes('.css-var-genux-docs'))
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

test('theme builder enforces 14px text floors, migrates stored 12-13px text and keeps 300 weight and 14px Outfit defaults', async t => {
  const file = `docs/tests/.typography-${randomUUID()}.tsx`;
  await writeFile(
    file,
    `
import * as model from '../src/theme-builder/model';
import {LISTY_SURFACE_TOKEN_ID,createDefaultRecipe,parseRecipe,resolveThemeBuilder,tokenDefinitions,validateRecipe} from '../src/theme-builder/model';
const modes=['light','dark'] as const;
type Mode=(typeof modes)[number];
// Looked up dynamically: before storage migration exists the strict-floor assertions must fail, not the import.
const storedName=['parseStored','Recipe'].join('');
const storedExport=(model as unknown as Record<string,unknown>)[storedName];
const parseStored=(typeof storedExport==='function'?storedExport:parseRecipe) as typeof parseRecipe;
const clone=(value:unknown):any=>JSON.parse(JSON.stringify(value));
function withValues(mode:Mode,values:Record<string,unknown>){const recipe=clone(createDefaultRecipe());recipe[mode]={...recipe[mode],...values};return recipe}
function attempt(id:string,mode:Mode,value:number){const recipe=withValues(mode,{[id]:value});const parsedOk=parseRecipe(JSON.stringify(recipe)).ok;const result=validateRecipe(recipe);if(!result.ok)return {ok:false,parsedOk,error:result.error};const resolved=resolveThemeBuilder(result.recipe,mode);return {ok:true,parsedOk,variables:resolved.variables,fontSize:resolved.token.fontSize}}
function stored(input:unknown,expected?:unknown,mode?:Mode,css?:string){const text=JSON.stringify(input);const result=parseStored(text);if(!result.ok)return {ok:false,error:result.error};return {ok:true,recipe:clone(result.recipe),expected,emitted:mode&&css?resolveThemeBuilder(result.recipe,mode).variables[css]:undefined,inputUnchanged:JSON.stringify(input)===text}}
const typography=tokenDefinitions.filter(def=>def.group==='typography'&&def.kind==='number');
const sizes=typography.filter(def=>def.unit==='px');
const weightId=String(typography.find(def=>def.unit==='')?.id);
function migration(id:string,css:string,mode:Mode,value:number){const other=String(sizes.find(def=>def.id!==id)?.id);const custom={[weightId]:300,[other]:15};return stored(withValues(mode,{...custom,[id]:value}),withValues(mode,{...custom,[id]:14}),mode,css)}
const legacyInput=clone(createDefaultRecipe());
const legacyExpected=clone(createDefaultRecipe());
for(const mode of modes){for(const [index,def] of sizes.entries()){legacyInput[mode][def.id]=index%2?13:12;legacyExpected[mode][def.id]=14}legacyInput[mode][weightId]=300;legacyExpected[mode][weightId]=300;delete legacyInput[mode][LISTY_SURFACE_TOKEN_ID]}
function broken(label:string,edit:(recipe:any)=>void){const recipe=withValues('light',{[sizes[0].id]:12});edit(recipe);return {label,result:stored(recipe)}}
const report={
sizes:sizes.map(def=>({id:def.id,css:def.css,defaults:def.defaults,cases:modes.map(mode=>({mode,at11:attempt(def.id,mode,11),at12:attempt(def.id,mode,12),at13:attempt(def.id,mode,13),at14:attempt(def.id,mode,14),stored11:stored(withValues(mode,{[def.id]:11})),stored12:migration(def.id,def.css,mode,12),stored13:migration(def.id,def.css,mode,13)}))})),
legacy:stored(legacyInput,legacyExpected),
invalidStored:[
broken('a null text size',recipe=>{recipe.light[sizes[0].id]=null}),
broken('a string text size',recipe=>{recipe.light[sizes[0].id]='12'}),
broken('an unknown token field',recipe=>{recipe.light.unexpected=14}),
broken('an unknown recipe field',recipe=>{recipe.extra=true}),
broken('a partial mode',recipe=>{delete recipe.light[sizes[1].id]}),
broken('an unknown version',recipe=>{recipe.version=String(recipe.version)+'-unknown'}),
],
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
  assert.equal(report.sizes.length, 6, 'the builder exposes six editable text sizes');
  const body = report.sizes.find(size => size.css === '--text-body');
  assert.ok(body, 'body text stays an editable builder size');
  for (const size of report.sizes) {
    for (const mode of ['light', 'dark'])
      assert.ok(size.defaults[mode] >= 14, `${size.id}: ${mode} default stays at least 14px`);
    for (const { mode, at11, at12, at13, at14 } of size.cases) {
      for (const [value, below] of [
        [12, at12],
        [13, at13],
        [11, at11],
      ]) {
        assert.equal(below.ok, false, `${size.id}: ${mode} accepts ${value}px text below 14px`);
        assert.ok(
          below.error.includes(`"${size.id}"`),
          `${size.id}: ${mode} rejection names the token`,
        );
        assert.equal(below.parsedOk, false, `${size.id}: ${mode} parseRecipe accepts ${value}px`);
      }
      assert.equal(at14.ok, true, `${size.id}: ${mode} rejects 14px (${at14.error})`);
      assert.equal(at14.parsedOk, true, `${size.id}: ${mode} parseRecipe rejects 14px`);
      assert.equal(at14.variables[size.css], '14px', `${size.id}: ${mode} emits accepted 14px`);
    }
  }
  for (const { mode, at14 } of body.cases)
    assert.equal(at14.fontSize, 14, `${mode}: accepted 14px body text resolves to 14px`);
  // Storage alone upgrades earlier 12-13px recipes; strict validation above stays at 14px.
  for (const size of report.sizes)
    for (const { mode, stored11, stored12, stored13 } of size.cases) {
      for (const [value, migrated] of [
        [12, stored12],
        [13, stored13],
      ]) {
        assert.equal(
          migrated.ok,
          true,
          `${size.id}: ${mode} stored ${value}px is rejected instead of migrated (${migrated.error})`,
        );
        assert.deepEqual(
          migrated.recipe,
          migrated.expected,
          `${size.id}: ${mode} stored ${value}px becomes 14px and keeps every other value`,
        );
        assert.equal(migrated.emitted, '14px', `${size.id}: ${mode} migrated text emits 14px`);
        assert.equal(migrated.inputUnchanged, true, `${size.id}: ${mode} stored input is kept`);
      }
      assert.equal(stored11.ok, false, `${size.id}: ${mode} storage accepts 11px text`);
    }
  assert.equal(
    report.legacy.ok,
    true,
    `earlier-generation 12-13px storage is rejected (${report.legacy.error})`,
  );
  assert.deepEqual(
    report.legacy.recipe,
    report.legacy.expected,
    'earlier-generation storage gains defaults, migrates text to 14px and keeps weight 300',
  );
  for (const { label, result } of report.invalidStored)
    assert.equal(result.ok, false, `storage migration accepts ${label}`);
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
