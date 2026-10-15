import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { build } from 'esbuild';
import { generate } from '@ant-design/colors';
import postcss from 'postcss';
import { JSDOM } from 'jsdom';
import { mountPattern } from './harness.mjs';

test('documentation portal buttons own full-opacity blue paint without an appearance ancestor', async t => {
  const css = postcss.parse(
    await readFile(new URL('../src/styles/docs-brand.css', import.meta.url), 'utf8'),
  );
  const dom = new JSDOM(`<body data-atlas-surface="docs"><div class="atlas-demo live-preview">
    <button id="portal-shared" class="ant-btn ant-btn-primary atlas-button" data-docs-brand-default="true" data-docs-brand-tone="middle" data-fill="solid" data-state="hover" data-pressed="true"></button>
    <button id="portal-native" class="ant-btn ant-btn-primary css-var-atlas-docs" data-state="hover" data-pressed="true"></button>
    <button id="portal-approved" class="ant-btn ant-btn-primary atlas-button"></button>
    <button id="portal-approved-native" class="ant-btn ant-btn-primary css-var-atlas"></button>
    <button id="seed-preview" class="ant-btn ant-btn-primary atlas-button color-preview-button"></button>
  </div></body>`);
  t.after(() => dom.window.close());
  const document = dom.window.document;
  const matches = (button, selector) => button.matches(selector.replaceAll('::before', ''));
  const rules = [];
  css.walkRules(rule => rules.push(rule));
  const declarations = rule =>
    Object.fromEntries(
      rule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]),
    );
  for (const id of ['portal-shared', 'portal-native']) {
    const button = document.getElementById(id);
    assert.ok(
      rules.some(rule => declarations(rule).opacity === '1' && matches(button, rule.selector)),
      `${id}: missing full-opacity owner`,
    );
    for (const state of ['hover', 'active'])
      assert.ok(
        rules.some(
          rule =>
            declarations(rule)['background-color'] === `var(--docs-brand-primary-${state})` &&
            matches(button, rule.selector),
        ),
        `${id}: missing ${state} paint owner`,
      );
  }
  const native = document.getElementById('portal-native');
  for (const [property, value] of [
    ['--button-face', 'var(--docs-brand-primary)'],
    ['--button-edge', 'var(--docs-brand-primary-edge)'],
    ['--button-text', 'var(--docs-brand-on-primary)'],
  ])
    assert.ok(
      rules.some(rule => declarations(rule)[property] === value && matches(native, rule.selector)),
      `native portal: missing ${property}`,
    );
  const approved = document.getElementById('portal-approved-native');
  for (const property of ['face', 'edge', 'text'])
    assert.ok(
      rules.some(
        rule =>
          declarations(rule)[`--button-${property}`] ===
            `var(--docs-approved-button-${property})` && matches(approved, rule.selector),
      ),
      `approved native: missing ${property} ownership`,
    );
  for (const id of ['portal-approved', 'portal-approved-native', 'seed-preview']) {
    const button = document.getElementById(id);
    assert.equal(
      rules.some(rule => declarations(rule).opacity === '1' && matches(button, rule.selector)),
      false,
      `${id}: explicit palette/seed preview must stay outside the documentation default adapter`,
    );
  }
});

const compiled = await build({
  entryPoints: ['docs/src/data/docs-brand.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  target: 'node24',
});
const brand = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].contents).toString('base64')
);
const luminance = hex => {
  const values = hex
    .slice(1)
    .match(/../g)
    .map(value => parseInt(value, 16) / 255)
    .map(value => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
};
const contrast = (a, b) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);

test('documentation Switch content keeps its exact blue text readable at rest without changing other switches', async t => {
  const css = postcss.parse(
    await readFile(new URL('../src/styles/web.css', import.meta.url), 'utf8'),
  );
  const dom = new JSDOM(`<html data-theme="dark"><body data-atlas-surface="docs">
    <div class="live-preview"><div class="atlas-demo" data-atlas-appearance="docs">
      <button id="content" class="ant-switch ant-switch-checked atlas-switch-with-content"></button>
      <button id="plain" class="ant-switch ant-switch-checked"></button>
    </div></div>
    <div class="atlas-demo"><button id="story" class="ant-switch ant-switch-checked atlas-switch-with-content"></button></div>
  </body></html>`);
  t.after(() => dom.window.close());
  const rules = [];
  css.walkRules(rule => {
    if (
      rule.nodes.some(node => node.type === 'decl' && node.prop === 'opacity' && node.value === '1')
    )
      rules.push(rule);
  });
  const matches = id =>
    rules.filter(rule => dom.window.document.getElementById(id).matches(rule.selector));
  assert.ok(matches('content').length, 'readable content needs an explicit fully opaque owner');
  assert.equal(matches('plain').length, 0, 'existing plain switches keep their opacity contract');
  assert.equal(matches('story').length, 0, 'Storybook stays outside the documentation adapter');
  for (const mode of ['light', 'dark']) {
    const roles = brand.docsBrandColors[mode];
    for (const key of ['primary', 'primaryHover', 'primaryActive'])
      assert.ok(contrast(roles[key], roles.onPrimary) >= 4.5, `${mode}: ${key} content contrast`);
  }
});

test('documentation uses the exact blue seed and official palette while every normal text role stays readable', () => {
  assert.equal(brand.DOCS_BRAND_SEED, '#0099ff');
  assert.deepEqual(brand.docsBrandPalette, generate('#0099ff'));
  assert.deepEqual(
    brand.docsBrandDarkPalette,
    generate('#0099ff', { theme: 'dark', backgroundColor: '#2c2c2c' }),
  );
  for (const mode of ['light', 'dark']) {
    const roles = brand.docsBrandColors[mode];
    assert.equal(roles.primary, '#0099ff');
    assert.equal(roles.primaryActive, '#0099ff');
    assert.equal(roles.onPrimary, '#000000');
    assert.ok(contrast(roles.primary, roles.onPrimary) >= 4.5);
    assert.ok(contrast(roles.primaryHover, roles.onPrimary) >= 4.5);
    for (const surface of mode === 'light'
      ? ['#f5f3ee', '#fffefa', '#eeeee8']
      : ['#242424', '#2c2c2c', '#343434'])
      for (const key of ['accent', 'accentHover', 'accentActive', 'actionInk'])
        assert.ok(contrast(roles[key], surface) >= 4.5, `${mode} ${key} on ${surface}`);
  }
  for (const tone of Object.values(brand.docsBrandTones))
    assert.ok(contrast(tone.color, tone.ink) >= 4.5);
  assert.ok(
    contrast('#0099ff', '#FFFFFF') < 4.5,
    'white is not a readable normal-text foreground for this exact seed',
  );
});

async function probe(t, appearance) {
  const name = `.docs-brand-probe-${randomUUID()}.tsx`;
  const path = new URL(name, import.meta.url);
  await writeFile(
    path,
    `import {Button,theme} from 'antd';
import {createPortal} from 'react-dom';
import AtlasProvider,{atlasTheme} from '../src/react/AtlasProvider';
import AtlasButton from '../src/react/AtlasButton';
function PortalActions(){return createPortal(<div className="atlas-demo live-preview" data-brand-portal><Button id="actual-native-portal" type="primary">Native portal action</Button><AtlasButton id="actual-shared-portal"/></div>,document.body);}
function Tokens(){const{token}=theme.useToken();return <><output data-primary>{token.colorPrimary}</output><output data-hover>{token.colorPrimaryHover}</output><output data-active>{token.colorPrimaryActive}</output><output data-link>{token.colorLink}</output><output data-legacy-primary>{atlasTheme.token?.colorPrimary}</output><Button id="native-primary" type="primary">Native action</Button><AtlasButton id="brand-default"/><AtlasButton id="explicit-coral" palette="coral"/><AtlasButton id="brand-dark" tone="dark"/><AtlasButton id="brand-light" tone="light"/><AtlasButton id="brand-pastel" tone="pastel"/><AtlasProvider><AtlasButton id="inherited-default"/></AtlasProvider><AtlasProvider appearance="approved"><AtlasButton id="approved-default"/><Button id="approved-native" type="primary">Approved native action</Button></AtlasProvider><PortalActions/></>;}
export default function Probe({appearance}:{appearance?:'approved'|'docs'}){return <AtlasProvider appearance={appearance}><Tokens/></AtlasProvider>;}`,
    'utf8',
  );
  let h;
  try {
    h = await mountPattern('default', `docs/tests/${name}`, { appearance });
  } catch (error) {
    await unlink(path);
    throw error;
  }
  t.after(async () => {
    await h.dispose();
    await unlink(path);
  });
  return h;
}

test('explicit documentation context changes native and omitted-palette defaults while approved calls stay canonical', async t => {
  const h = await probe(t, 'docs');
  const doc = h.document;
  assert.ok(doc.querySelector('.atlas-demo[data-atlas-appearance="docs"]'));
  assert.equal(doc.querySelector('[data-primary]').textContent, '#0099ff');
  assert.equal(doc.querySelector('[data-legacy-primary]').textContent, '#cf1322');
  for (const id of ['brand-default', 'inherited-default']) {
    const button = doc.getElementById(id);
    assert.equal(button.dataset.docsBrandDefault, 'true');
    assert.equal(button.style.getPropertyValue('--button-face'), '#0099ff');
    assert.equal(button.style.getPropertyValue('--button-text'), '#000000');
  }
  for (const id of ['explicit-coral', 'approved-default']) {
    const button = doc.getElementById(id);
    assert.equal(button.dataset.docsBrandDefault, undefined);
    assert.equal(button.style.getPropertyValue('--button-face'), '#cf1322');
  }
  for (const [id, ink] of [
    ['brand-dark', '#FFFFFF'],
    ['brand-light', '#000000'],
    ['brand-pastel', '#000000'],
  ]) {
    const button = doc.getElementById(id);
    assert.equal(button.style.getPropertyValue('--button-text'), ink);
    assert.ok(contrast(button.style.getPropertyValue('--button-face'), ink) >= 4.5);
  }
  await h.act(async () => {
    doc.documentElement.dataset.theme = 'dark';
    h.window.dispatchEvent(new h.window.Event('atlas-theme-change'));
  });
  assert.equal(
    doc.querySelector('[data-primary]').textContent,
    '#0099ff',
    'dark native derivation must not replace the exact documentation seed',
  );
  assert.equal(doc.querySelector('[data-active]').textContent, '#0099ff');
  assert.equal(doc.querySelector('[data-link]').textContent, brand.docsBrandColors.dark.accent);
  for (const surface of ['#242424', '#2c2c2c', '#343434'])
    assert.ok(contrast(doc.querySelector('[data-link]').textContent, surface) >= 4.5);
  assert.equal(
    doc.getElementById('brand-default').style.getPropertyValue('--button-face'),
    '#0099ff',
  );
});

test('unopted provider and Button defaults retain the approved red identity', async t => {
  const h = await probe(t, undefined);
  assert.equal(h.document.querySelector('.atlas-demo').dataset.atlasAppearance, undefined);
  assert.equal(h.document.querySelector('[data-primary]').textContent.toLowerCase(), '#cf1322');
  assert.equal(h.document.getElementById('brand-default').dataset.docsBrandDefault, undefined);
  assert.equal(
    h.document.getElementById('brand-default').style.getPropertyValue('--button-face'),
    '#cf1322',
  );
});

test('React portal context owns documentation paint and nested approved native buttons escape blue inheritance', async t => {
  const h = await probe(t, 'docs');
  h.document.body.dataset.atlasSurface = 'docs';
  const portal = h.document.querySelector('[data-brand-portal]');
  assert.equal(portal.closest('[data-atlas-appearance="docs"]'), null);
  const shared = h.document.getElementById('actual-shared-portal');
  const native = h.document.getElementById('actual-native-portal');
  const approved = h.document.getElementById('approved-native');
  assert.equal(shared.dataset.docsBrandDefault, 'true');
  assert.equal(shared.style.getPropertyValue('--button-face'), '#0099ff');
  assert.ok(native.classList.contains('css-var-atlas-docs'));
  assert.ok(approved.classList.contains('css-var-atlas'));
  const css = postcss.parse(
    await readFile(new URL('../src/styles/docs-brand.css', import.meta.url), 'utf8'),
  );
  const owners = [];
  css.walkRules(rule => owners.push(rule));
  const declarations = rule =>
    Object.fromEntries(
      rule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]),
    );
  for (const button of [shared, native])
    assert.ok(
      owners.some(
        rule =>
          declarations(rule).opacity === '1' &&
          button.matches(rule.selector.replaceAll('::before', '')),
      ),
    );
  assert.ok(
    owners.some(
      rule =>
        declarations(rule)['--button-face'] === 'var(--docs-approved-button-face)' &&
        approved.matches(rule.selector),
    ),
  );
  assert.equal(
    owners.some(
      rule =>
        declarations(rule).opacity === '1' &&
        approved.matches(rule.selector.replaceAll('::before', '')),
    ),
    false,
  );
  const atlas = JSON.parse(
    await readFile(new URL('../src/data/atlas.json', import.meta.url), 'utf8'),
  );
  assert.equal(brand.docsApprovedButtonColors.face, atlas.palettes.coral.color);
  assert.equal(brand.docsApprovedButtonColors.edge, atlas.palettes.coral.dark);
  assert.equal(brand.docsApprovedButtonColors.text, '#FFFFFF');
});

test('documentation brand styles are scoped, retain symmetric motion and reserve opacity one for the new brand', async () => {
  const css = postcss.parse(
    await readFile(new URL('../src/styles/docs-brand.css', import.meta.url), 'utf8'),
  );
  const opacity = [];
  css.walkDecls('opacity', declaration => opacity.push(declaration));
  assert.equal(opacity.length, 2);
  const buttonOpacity = opacity.find(declaration =>
    declaration.parent.selector.includes('data-docs-brand-default'),
  );
  assert.equal(buttonOpacity.value, '1');
  assert.match(buttonOpacity.parent.selector, /body\[data-atlas-surface='docs'\]/);
  assert.match(buttonOpacity.parent.selector.replace(/\s+/g, ''), /:not\(:disabled\)/);
  assert.doesNotMatch(buttonOpacity.parent.selector, /color-preview-button/);
  const base = [];
  css.walkDecls('transition', declaration => {
    if (declaration.value !== 'none') base.push(declaration);
  });
  assert.equal(base.length, 3);
  assert.ok(
    base.some(declaration =>
      /background-color var\(--release-duration\) var\(--motion-easing\)/.test(declaration.value),
    ),
  );
  const cta = base.find(declaration => declaration.parent.selector.includes('.docs-action'));
  assert.match(
    cta.value,
    /background-color var\(--motion-duration-button-feedback\) var\(--motion-easing\)/,
  );
  const ctaStyles = Object.fromEntries(
    cta.parent.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]),
  );
  assert.equal(ctaStyles['background-color'], 'var(--docs-brand-primary)');
  assert.equal(ctaStyles.color, 'var(--docs-brand-on-primary)');
  assert.equal(ctaStyles.opacity, '1');
  css.walkRules(rule => {
    if (/\.docs-action:(?:hover|active)/.test(rule.selector))
      assert.equal(
        rule.nodes.find(node => node.prop === 'color')?.value,
        'var(--docs-brand-on-primary)',
      );
  });
  assert.match(
    brand.docsBrandStyleText,
    /:root\[data-theme='light'\] body\[data-atlas-surface='docs'\]/,
  );
  assert.match(
    brand.docsBrandStyleText,
    /:root\[data-theme='dark'\] body\[data-atlas-surface='docs'\]/,
  );
  const layout = await readFile(
    new URL('../src/layouts/DocsLayout.astro', import.meta.url),
    'utf8',
  );
  assert.match(layout, /data-docs-brand-tokens/);
  assert.match(layout, /docsBrandStyleText/);
});
