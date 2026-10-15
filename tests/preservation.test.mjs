import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { render, sha256 } from '../tools/build.mjs';
import { setup, record as rawRecord, settle } from './harness.mjs';
import { originalLegacyCss as originalCss } from '../tools/legacy-css-contract.mjs';

const before = await readFile(new URL('./fixtures/before.html', import.meta.url), 'utf8');
const after = (await render()).html;
const stateBaseline = setup(before);
const originalStates = JSON.parse(
  stateBaseline.read('JSON.stringify(BUTTON_EXPERIMENTS.state_variants)'),
);
const originalAxes = JSON.parse(stateBaseline.read('JSON.stringify(AXES)'));
const originalPalettes = JSON.parse(stateBaseline.read('JSON.stringify(PALETTES)'));
const originalTones = JSON.parse(stateBaseline.read('JSON.stringify(TONE_PALETTES)'));
const originalToneVariants = JSON.parse(
  stateBaseline.read('JSON.stringify(BUTTON_EXPERIMENTS.tone_variants)'),
);
const originalShadowVariants = JSON.parse(
  stateBaseline.read('JSON.stringify(BUTTON_EXPERIMENTS.shadow_variants)'),
);
stateBaseline.close();

const translations = JSON.parse(
  await readFile(new URL('../src/i18n/tr.json', import.meta.url), 'utf8'),
);
const englishPattern = new RegExp(
  Object.keys(translations)
    .sort((a, b) => b.length - a.length)
    .map(value => {
      const boundaryStart = /^[\p{L}\p{N}]/u.test(value) ? '(?<![\\p{L}\\p{N}])' : '';
      const boundaryEnd = /[\p{L}\p{N}]$/u.test(value) ? '(?![\\p{L}\\p{N}])' : '';
      return boundaryStart + value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + boundaryEnd;
    })
    .join('|'),
  'gu',
);
const originalTexts = new Set(Object.values(translations));
function historicalText(value) {
  if (Object.hasOwn(translations, value)) return translations[value];
  if (originalTexts.has(value) || /[çğıöşüÇĞİÖŞÜ]/.test(value)) return value;
  return value.replace(englishPattern, phrase => translations[phrase]);
}
function historicalData(value) {
  if (Array.isArray(value)) return value.map(historicalData);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, historicalData(item)]),
    );
  return typeof value === 'string' ? historicalText(value) : value;
}
// Only approved EN/TR text, locale controls/markers and retained-node metadata are
// normalized. Machine values, styles, attributes, control state and vendor stay compared.
function historicalMarkup(markup) {
  const document = new stateBaseline.window.DOMParser().parseFromString(markup, 'text/html');
  // Only the new experimental subtree and its one jump link are excluded.
  // workspace-examples.test.mjs independently checks integration and state.
  const workspace = document.querySelector('#panel-forms > #workspaceLab');
  if (workspace) {
    if (workspace.previousSibling?.nodeValue === '\n  ') workspace.previousSibling.remove();
    workspace.remove();
  }
  document.querySelector('#formLab .jump > [data-workspace-jump]')?.remove();
  document.querySelector('.language-control')?.remove();
  const dictionary = document.querySelector('#atlas-i18n-tr');
  if (dictionary?.nextSibling?.nodeValue === '\n') dictionary.nextSibling.remove();
  dictionary?.remove();
  document.documentElement.lang = 'tr';
  document.documentElement.removeAttribute('data-locale');
  for (const element of document.querySelectorAll('*')) {
    for (const attribute of [...element.attributes]) {
      if (/^data-i18n(?:-|$)/.test(attribute.name)) element.removeAttribute(attribute.name);
      else if (['aria-label', 'title', 'placeholder', 'content'].includes(attribute.name))
        element.setAttribute(attribute.name, historicalText(attribute.value));
    }
  }
  for (const node of document.querySelectorAll('#familyFilters [data-family]'))
    node.removeAttribute('data-family');
  for (const node of document.querySelectorAll('#mathControls input[data-axis]'))
    node.removeAttribute('data-axis');
  for (const button of document.querySelectorAll('.btx[data-user-label]'))
    button.removeAttribute('data-user-label');
  const walk = node => {
    if (node.nodeType === 3) node.nodeValue = historicalText(node.nodeValue);
    else if (!['STYLE', 'SCRIPT', 'PRE', 'CODE', 'TEXTAREA'].includes(node.tagName))
      for (const child of node.childNodes) walk(child);
  };
  walk(document.documentElement);
  for (const style of document.querySelectorAll('style'))
    style.textContent = originalCss(style.textContent);
  return /<html[\s>]/i.test(markup)
    ? '<!DOCTYPE html>\n' + document.documentElement.outerHTML
    : document.body.outerHTML;
}

const approvedVisualKeys = ['fill', 'palette', 'tone', 'duration', 'shadow'];
const approvedAxisExplanations = {
  tone: 'Onaylanan Dark, Middle, Light ve Pastel tonları. Ant Design renk skalaları kullanılır; açık ve saydam yüzeylerde metin okunabilirliği korunur.',
  shadow:
    'Gölgesiz, yumuşak, renkli yayılma, 6 px uzun ve 4 px katmanlı gölgeler onaylıdır; diğer eski seçenekler denemedir. Onaylı 8 px katman ayrı React bileşenidir. İç gölge ve desen kullanılmaz.',
};
// Normalize only explicitly approved metadata. Original fixture, CSS, every old
// option, recipes and runtime journeys remain independently compared.
function withoutApprovedMarkup(markup) {
  markup = historicalMarkup(markup);
  for (const [key, explanation] of Object.entries(approvedAxisExplanations))
    markup = markup.replaceAll(explanation, originalAxes.find(axis => axis.key === key).explain);
  return markup
    .replace(
      /<section class="decision-group" aria-labelledby="decision-state-heading">[\s\S]*?<\/section>/,
      '',
    )
    .replace(
      /<section class="decision-group" aria-labelledby="decision-width-heading">[\s\S]*?<\/section>/,
      '',
    )
    .replace(
      'Gölge ve diğer beş işlem durumu denemedir. Sekiz onaylı buton durumu karar listesinde kayıtlıdır.',
      'Gölge ve işlem durumları denemedir.',
    );
}
function originalAntdRecipe(recipe, config) {
  const copy = structuredClone(recipe);
  if (copy.button?.state)
    for (const key of ['label', 'text', 'description']) {
      if (typeof copy.button.state[key] === 'string')
        copy.button.state[key] = historicalText(copy.button.state[key]);
    }
  if (config?.width === 'wide' && copy.button.styles.root.minWidth === 'min(100%, 175px)')
    delete copy.button.styles.root.minWidth;
  return copy;
}
function originalDecisionData(data) {
  const copy = historicalData(structuredClone(data));
  if (copy.buttons) delete copy.buttons.state_variants;
  if (copy.buttons) delete copy.buttons.width_variants;
  if (copy.kararlar) delete copy.kararlar.state_variants;
  if (copy.kararlar) delete copy.kararlar.width_variants;
  if (copy.denemeler) copy.denemeler.state_variants = originalStates;
  if (copy.denemeler) delete copy.denemeler.width_variants;
  for (const target of [copy.buttons, copy.kararlar])
    if (target) for (const key of approvedVisualKeys) delete target[`${key}_variants`];
  if (copy.denemeler) {
    copy.denemeler.tone_variants = originalToneVariants;
    copy.denemeler.shadow_variants = originalShadowVariants;
    delete copy.denemeler.palette_variants;
    delete copy.denemeler.duration_variants;
  }
  if (copy.antd) copy.antd = originalAntdRecipe(copy.antd, copy.tasarim);
  return copy;
}
function originalAxisData(axes) {
  return axes.map(axis => {
    const baseline = originalAxes.find(item => item.key === axis.key);
    assert.equal(axis.english, baseline.english, axis.key + ': public English alias remains exact');
    const copy = historicalData(structuredClone(axis));
    copy.english = axis.english;
    if (axis.key === 'palette')
      copy.options = copy.options.filter(([value]) => value !== 'magenta');
    if (Object.hasOwn(approvedAxisExplanations, axis.key)) {
      const previous = originalAxes.find(item => item.key === axis.key).explain;
      if (copy.explain !== previous) assert.equal(copy.explain, approvedAxisExplanations[axis.key]);
      copy.explain = previous;
    }
    return copy;
  });
}
function originalPaletteData(palettes) {
  return Object.fromEntries(Object.entries(palettes).filter(([name]) => name !== 'magenta'));
}
// Compare historical DOM after verifying only the exact ninth palette and its
// derived counts are new. The new palette has independent rendering coverage.
function originalPaletteMarkup(h, markup) {
  const paletteOptions = JSON.parse(h.read('JSON.stringify(axisMap.palette.options)'));
  if (!paletteOptions.some(([value]) => value === 'magenta')) return markup;
  const oldOptions = originalAxes.find(axis => axis.key === 'palette').options;
  assert.deepEqual(paletteOptions, [...oldOptions, ['magenta', 'Magenta']]);
  const body = new h.window.DOMParser().parseFromString(markup, 'text/html').body;
  for (const selector of [
    '#select-palette > option[value="magenta"]',
    '#ff-palette-magenta',
    '#axis-palette .axis-example:has(.btx[data-palette="magenta"])',
  ]) {
    const added = body.querySelectorAll(selector);
    const originalChoice = body.querySelectorAll(selector.replaceAll('magenta', 'coral'));
    assert.equal(originalChoice.length <= 1, true, `${selector}: at most one initialized choice`);
    assert.equal(
      added.length,
      originalChoice.length,
      `${selector}: new choice follows lazy initialization`,
    );
    added[0]?.remove();
  }
  const paletteCount = oldOptions.length;
  for (const [node, suffix] of [
    [body.querySelector('#select-palette').parentElement.querySelector('small'), ' seçenek'],
    [body.querySelector('#axis-palette .axis-header > strong'), ''],
    [
      body
        .querySelector('#mathControls input[aria-label="Renk ailesi eksenini hesaba kat"]')
        .closest('label').lastElementChild,
      '',
    ],
  ]) {
    assert.equal(node.textContent, `${paletteCount + 1}${suffix}`);
    node.textContent = `${paletteCount}${suffix}`;
  }
  const primitiveCount = originalAxes.reduce((sum, axis) => sum + axis.options.length, 0);
  assert.equal(body.querySelector('#primitiveCount').textContent, String(primitiveCount + 1));
  body.querySelector('#primitiveCount').textContent = String(primitiveCount);
  const factors = JSON.parse(
    h.read(
      'JSON.stringify(AXES.filter(axis => mathKeys.has(axis.key)).map(axis => ({ key: axis.key, count: axis.options.length })))',
    ),
  );
  const normalizeMath = counts => {
    const total = counts
      .reduce((product, count) => product * BigInt(count), 1n)
      .toLocaleString('tr-TR');
    return { total, formula: `${counts.length ? counts.join(' × ') : '1'} = ${total}` };
  };
  const currentMath = normalizeMath(factors.map(({ count }) => count));
  const originalMath = normalizeMath(
    factors.map(({ key, count }) => (key === 'palette' ? count - 1 : count)),
  );
  assert.equal(body.querySelector('#comboTotal').textContent, currentMath.total);
  assert.equal(body.querySelector('#comboFormula').textContent, currentMath.formula);
  body.querySelector('#comboTotal').textContent = originalMath.total;
  body.querySelector('#comboFormula').textContent = originalMath.formula;
  return body.outerHTML;
}
function record(h) {
  const snapshot = rawRecord(h);
  snapshot.controls = snapshot.controls
    .filter(control => !h.doc.getElementById(control.id)?.closest('#workspaceLab'))
    .map(control => ({
      ...control,
      value: historicalText(control.value),
    }));
  snapshot.markup = withoutApprovedMarkup(
    originalPaletteMarkup(h, historicalMarkup(snapshot.markup)),
  ).replace(
    /(<pre[^>]*id="recipeOutput"[^>]*>)([\s\S]*?)(<\/pre>)/,
    (_, open, json, close) =>
      open + JSON.stringify(originalDecisionData(JSON.parse(json)), null, 2) + close,
  );
  return snapshot;
}

test('fonts, vendor and unrelated CSS/DOM remain exact after approved i18n and UX changes', () => {
  const strip = html =>
    withoutApprovedMarkup(html.replace(/<script>[\s\S]*?<\/script>/, '<script></script>'));
  assert.equal(strip(after), strip(before));
  assert.equal(
    sha256(originalCss(after.match(/<style id="atlas-styles">([\s\S]*?)<\/style>/)[1])),
    sha256(before.match(/<style id="atlas-styles">([\s\S]*?)<\/style>/)[1]),
  );
});

test('two clean builds are deterministic and introduce no runtime resource URLs', async () => {
  assert.equal((await render()).html, after);
  assert.doesNotMatch(after, /<script[^>]+src=|<link[^>]+(?:stylesheet|modulepreload)/i);
  assert.doesNotMatch(after, /\/Users\/w6x\/Developer\/button-atlas|built_at|build_timestamp/);
});

test('all real tab, studio, form, theme and math journeys preserve DOM and control state', async t => {
  const a = setup(before),
    b = setup(after);
  b.read('setLocale("tr")');
  t.after(() => {
    a.close();
    b.close();
  });
  // Compare interaction with identical authored fixture data, independently of
  // translated English defaults. Do not normalize later user selections/carets.
  for (const h of [a, b]) h.read('buildFormLab()');
  await settle();
  for (const baseline of a.doc.querySelectorAll('input,textarea')) {
    if (!baseline.id) continue;
    const current = b.el(baseline.id);
    if (current.value === baseline.value) continue;
    assert.equal(
      translations[current.value],
      baseline.value,
      baseline.id + ': only translated seed data differs',
    );
    current.value = baseline.value;
    if (typeof baseline.selectionStart === 'number')
      current.setSelectionRange(
        baseline.selectionStart,
        baseline.selectionEnd,
        baseline.selectionDirection,
      );
  }
  const same = label => assert.deepEqual(record(b), record(a), label);
  const step = (label, action) => {
    for (const h of [a, b]) action(h);
    same(label);
  };
  same();
  step('keyboard tab journey', h => {
    for (const tab of [...h.doc.querySelectorAll('.tab')]) {
      h.click(tab.id);
      h.key(tab.id, 'End');
      h.key(h.doc.activeElement.id, 'ArrowRight');
      h.key(h.doc.activeElement.id, 'Home');
      h.key(h.doc.activeElement.id, 'ArrowLeft');
    }
  });
  step('custom text and round radius before reset', h => {
    h.click('tab-studio');
    h.el('buttonText').value = 'Türkçe Çalışıyor';
    h.el('buttonText').dispatchEvent(new h.window.Event('input'));
    h.el('radiusChoices').querySelector('[data-radius="pill"]').click();
    assert.equal(h.read('current.radius'), 'pill');
    assert.equal(h.el('buttonText').value, 'Türkçe Çalışıyor');
  });
  step('custom palette before reset', h => {
    h.change('customColorsOn', true);
    h.el('color-bg').value = '#123456';
    h.el('color-bg').dispatchEvent(new h.window.Event('input'));
  });
  step('random combination before reset', h => h.click('randomize'));
  step('reset studio', h => h.click('resetStudio'));
  step('form appearance keeps entered value and focus', h => {
    h.click('tab-forms');
    h.el('ff-text').value = 'Kalıcı İstanbul';
    h.el('ff-text').focus();
    h.click('ff-size-tall');
    h.click('ff-radius-pill');
    h.click('ff-tone-pastel');
    h.click('ff-surface-filled');
    assert.equal(h.el('ff-text').value, 'Kalıcı İstanbul');
    assert.equal(h.doc.activeElement.id, 'ff-text');
  });
  step('form selection and theme before tab changes', h => {
    h.click('ff-check-all');
    h.click('ff-radio-segmented-2');
    h.click('ff-switch-basic');
    h.click('themeToggle');
  });
  step('form state after tab round trip', h => {
    h.click('tab-studio');
    h.click('tab-forms');
  });
  await settle();
  same();
  for (const h of [a, b]) {
    h.click('tab-math');
    h.click('mathVisual');
    h.click('mathAll');
    const count = h.el('mathControls').querySelectorAll('input').length;
    for (let index = 0; index < count; index++)
      h.el('mathControls').querySelectorAll('input')[index].click();
    assert.match(h.el('comboFormula').textContent, /1 = 1/);
  }
  same();
});

test('every historical axis value × all 13 states preserves buttons and unrelated AntD recipe fields', t => {
  const a = setup(before),
    b = setup(after);
  b.read('setLocale("tr")');
  t.after(() => {
    a.close();
    b.close();
  });
  const expression = `JSON.stringify(AXES.flatMap(axis=>axis.options.filter(([value])=>axis.key!=='palette'||value!=='magenta').flatMap(([value])=>STATES.map(([state])=>{
    const config={...BASE,[axis.key]:value};return {config:safeConfig(config),button:buttonFor(config,state,'Devam et').outerHTML,recipe:buildAntdRecipe(config,state)};
  }))))`;
  const actualRecipes = JSON.parse(b.read(expression));
  assert.deepEqual(
    actualRecipes.map(item => ({
      ...item,
      button: historicalMarkup(item.button),
      recipe: originalAntdRecipe(item.recipe, item.config),
    })),
    JSON.parse(a.read(expression)).map(item => ({
      ...item,
      button: historicalMarkup(item.button),
    })),
  );
  assert.deepEqual(
    historicalData(JSON.parse(b.read('JSON.stringify(BUTTON_VARIANTS.state)'))),
    originalStates,
    'Approval only changes ownership; all thirteen state descriptors remain exact',
  );
  for (const name of ['ICON_CATALOG', 'ARCHIVED_PRESETS', 'FORM_EXPERIMENTS'])
    assert.deepEqual(
      historicalData(JSON.parse(b.read(`JSON.stringify(${name})`))),
      JSON.parse(a.read(`JSON.stringify(${name})`)),
    );
  assert.deepEqual(originalAxisData(JSON.parse(b.read('JSON.stringify(AXES)'))), originalAxes);
  for (const [name, original] of [
    ['PALETTES', originalPalettes],
    ['TONE_PALETTES', originalTones],
  ]) {
    const current = JSON.parse(b.read(`JSON.stringify(${name})`));
    assert.deepEqual(Object.keys(current), [...Object.keys(original), 'magenta']);
    assert.deepEqual(
      originalPaletteData(current),
      original,
      `${name}: all eight original palettes stay exact`,
    );
  }
  const expected = JSON.parse(a.read('JSON.stringify(COMPONENT_DECISIONS)'));
  expected.buttons.state_variants = originalStates.slice(0, 8);
  expected.buttons.width_variants = [
    { value: 'content', label: 'Metne göre', min_width_px: null, block: false },
    { value: 'wide', label: 'Geniş', min_width_px: 175, block: false },
    { value: 'full', label: 'Alanı dolduran', min_width_px: null, block: true },
  ];
  const currentDecisions = historicalData(
    JSON.parse(b.read('JSON.stringify(COMPONENT_DECISIONS)')),
  );
  for (const key of approvedVisualKeys) delete currentDecisions.buttons[`${key}_variants`];
  assert.deepEqual(currentDecisions, expected);
  for (const locale of ['en', 'tr']) {
    b.read('setLocale(' + JSON.stringify(locale) + ')');
    assert.deepEqual(
      JSON.parse(b.read('JSON.stringify(Object.keys(exportedRecipe().aciklama))')),
      originalAxes.map(axis => axis.name),
      'export explanation keys preserve the baseline schema in ' + locale,
    );
  }
});

test('unknown and inherited-name states retain the original default fallback', t => {
  const a = setup(before),
    b = setup(after);
  b.read('setLocale("tr")');
  t.after(() => {
    a.close();
    b.close();
  });
  for (const state of ['unknown', '__proto__', 'constructor', 'toString', '', null]) {
    const expression = `JSON.stringify({button:buttonFor(BASE,${JSON.stringify(state)}).outerHTML,recipe:buildAntdRecipe(BASE,${JSON.stringify(state)})})`;
    const actual = JSON.parse(b.read(expression));
    const expected = JSON.parse(a.read(expression));
    assert.deepEqual(
      {
        ...actual,
        button: historicalMarkup(actual.button),
        recipe: originalAntdRecipe(actual.recipe),
      },
      { ...expected, button: historicalMarkup(expected.button) },
    );
  }
});

test('storage normalization, duplicate/limit/remove and write failures preserve session behavior', t => {
  const snapshots = [];
  for (const html of [before, after]) {
    let saved = '[{"name":"eski","config":{"radius":"large","border":"solid"}}]';
    const h = setup(html, {
      storage: {
        getItem: () => saved,
        setItem: (_, value) => {
          saved = value;
        },
      },
    });
    if (html === after) h.read('setLocale("tr")');
    t.after(h.close);
    h.read(
      "saveSelection(BASE,'ilk');saveSelection(BASE,'aynı');for(const palette of ['violet','cobalt','teal','moss'])saveSelection({...BASE,palette},palette)",
    );
    assert.equal(h.read('selected.length'), 4);
    h.read('removeSelection(selected[0].id)');
    assert.equal(h.read('selected.length'), 3);
    snapshots.push({ saved, dom: record(h) });
    h.click('clearSaved');
    assert.equal(h.read('selected.length'), 0);
  }
  assert.deepEqual(snapshots[1], snapshots[0]);
  for (const html of [before, after])
    for (const getItem of [
      () => '{broken',
      () => {
        throw new Error('denied');
      },
    ]) {
      const h = setup(html, {
        storage: {
          getItem,
          setItem() {
            throw new Error('full');
          },
        },
      });
      t.after(h.close);
      h.read("saveSelection(BASE,'çalışıyor')");
      assert.equal(h.read('selected.length'), 1);
    }
});

test('standalone button export keeps its exact CSS, markup, fonts and licenses', t => {
  const a = setup(before),
    b = setup(after);
  b.read('setLocale("tr")');
  t.after(() => {
    a.close();
    b.close();
  });
  for (const h of [a, b]) h.el('buttonText').value = 'User label';
  assert.equal(
    historicalMarkup(b.read('standaloneButton()')),
    historicalMarkup(a.read('standaloneButton()')),
  );
  assert.doesNotMatch(b.read('standaloneButton()'), /AtlasDropdowns|ff-control/);
});

test('all download actions preserve names, MIME and data; full atlas reopens without duplicates', async t => {
  const outputs = [];
  for (const html of [before, after]) {
    const h = setup(html);
    if (html === after) h.read('setLocale("tr")');
    t.after(h.close);
    h.el('buttonText').value = 'User label';
    const blobs = [],
      links = [],
      revoked = [];
    h.window.Blob = class {
      constructor(parts, options) {
        this.text = parts.join('');
        this.type = options.type;
      }
    };
    h.window.URL.createObjectURL = blob => {
      blobs.push(blob);
      return 'blob:atlas-' + blobs.length;
    };
    h.window.URL.revokeObjectURL = url => revoked.push(url);
    h.window.HTMLAnchorElement.prototype.click = function () {
      links.push({ name: this.download, url: this.href });
    };
    const timers = [];
    h.window.setTimeout = (callback, delay) => {
      timers.push({ callback, delay });
      return timers.length;
    };
    for (const id of ['downloadDecisions', 'downloadAll', 'downloadRecipe', 'downloadButton'])
      h.click(id);
    assert.deepEqual(
      links.map(link => link.name),
      html === after
        ? [
            'component-decisions.json',
            'button-atlas.html',
            'button-design-recipe.json',
            'selected-button.html',
          ]
        : [
            'component-kararlari.json',
            'buton-atlasi.html',
            'buton-tasarim-tarifi.json',
            'secili-buton.html',
          ],
    );
    assert.deepEqual(
      blobs.map(blob => blob.type),
      [
        'application/json;charset=utf-8',
        'text/html;charset=utf-8',
        'application/json;charset=utf-8',
        'text/html;charset=utf-8',
      ],
    );
    for (const timer of timers.filter(timer => timer.delay === 30000)) timer.callback();
    assert.equal(revoked.length, 4);
    outputs.push(blobs.map(({ text, type }) => ({ text, type })));
    const reopened = setup(blobs[1].text);
    t.after(reopened.close);
    assert.equal(reopened.doc.querySelectorAll('#heroBoard .hero-item').length, 4);
    assert.equal(reopened.doc.querySelectorAll('#studioControls #buttonText').length, 1);
    reopened.click('tab-forms');
    reopened.click('tab-studio');
    reopened.click('tab-forms');
    await settle();
    assert.equal(reopened.doc.querySelectorAll('#ff-input-grid>.ff-sample').length, 21);
    const ids = [...reopened.doc.querySelectorAll('[id]')].map(node => node.id);
    assert.equal(new Set(ids).size, ids.length);
  }
  for (const index of [0, 2])
    assert.deepEqual(
      { ...outputs[1][index], text: originalDecisionData(JSON.parse(outputs[1][index].text)) },
      { ...outputs[0][index], text: originalDecisionData(JSON.parse(outputs[0][index].text)) },
    );
  assert.deepEqual(
    { ...outputs[1][3], text: historicalMarkup(outputs[1][3].text) },
    { ...outputs[0][3], text: historicalMarkup(outputs[0][3].text) },
  );
});
