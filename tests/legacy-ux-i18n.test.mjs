import assert from 'node:assert/strict';
import test from 'node:test';
import postcss from 'postcss';
import { render } from '../tools/build.mjs';
import { setup, settle } from './harness.mjs';

const result = await render();

test('legacy filter and math controls keep their focused nodes after selection', t => {
  const h = setup(result.html);
  t.after(h.close);
  h.click('tab-gallery');
  const filter = h.el('familyFilters').lastElementChild;
  filter.focus();
  filter.click();
  assert.equal(h.doc.activeElement, filter);
  assert.equal(filter.isConnected, true);
  h.click('tab-math');
  const check = h.el('mathControls').querySelector('input');
  check.focus();
  check.click();
  assert.equal(h.doc.activeElement, check);
  assert.equal(check.isConnected, true);
  assert.equal(check.checked, false);
});

test('keyboard gallery-to-studio navigation moves focus to the selected visible tab', t => {
  const h = setup(result.html);
  t.after(h.close);
  h.click('tab-gallery');
  const open = h.el('galleryGrid').querySelector('.card-actions button');
  open.focus();
  open.dispatchEvent(new h.window.MouseEvent('click', { bubbles: true, detail: 0 }));
  assert.equal(h.el('panel-studio').hidden, false);
  assert.equal(h.doc.activeElement, h.el('tab-studio'));
  assert.equal(h.el('tab-studio').getAttribute('aria-selected'), 'true');
});

test('desktop reduced-motion scroll declaration wins the active cascade', () => {
  let scroll;
  postcss.parse(result.css).walkRules(rule => {
    if (rule.selector !== 'html') return;
    for (let parent = rule.parent; parent; parent = parent.parent) {
      if (parent.type !== 'atrule' || parent.name !== 'media') continue;
      if (/print|max-width/.test(parent.params)) return;
      if (
        /prefers-reduced-motion/.test(parent.params) &&
        !/prefers-reduced-motion\s*:\s*reduce\b/.test(parent.params)
      )
        return;
    }
    rule.walkDecls('scroll-behavior', declaration => {
      scroll = declaration.value;
    });
  });
  assert.equal(scroll, 'auto');
});

test('offline English default and Turkish switch preserve form values, selection, focus and adapters', async t => {
  const h = setup(result.html);
  t.after(h.close);
  assert.equal(h.doc.documentElement.lang, 'en');
  assert.equal(h.el('tab-forms').textContent, 'Form components');
  assert.equal(h.read('t("Continue")'), 'Continue');
  h.click('tab-forms');
  await settle();
  const input = h.el('ff-text');
  input.value = 'User text İstanbul';
  input.focus();
  input.setSelectionRange(2, 7);
  const count = h.read('formDropdowns.length');
  const dropdown = h.el('ff-select-single-trigger');
  h.read('setLocale("tr")');
  await settle();
  assert.equal(h.doc.documentElement.lang, 'tr');
  assert.equal(h.read('t("Continue")'), 'Devam et');
  assert.match(h.el('comboDescription').textContent, /açık eksen/);
  for (const key of ['constructor', 'toString', '__proto__'])
    assert.equal(h.read('t(' + JSON.stringify(key) + ')'), key);
  assert.equal(h.el('tab-forms').textContent, 'Form bileşenleri');
  assert.equal(h.el('ff-text'), input);
  assert.equal(input.value, 'User text İstanbul');
  assert.equal(input.selectionStart, 2);
  assert.equal(input.selectionEnd, 7);
  assert.equal(h.doc.activeElement, input);
  assert.equal(h.el('ff-select-single-trigger'), dropdown);
  assert.equal(h.read('formDropdowns.length'), count);
  h.read('setLocale("en")');
  assert.equal(h.el('tab-forms').textContent, 'Form components');
  assert.equal(h.read('normalizeSearch("İSTANBUL")'), h.read('normalizeSearch("istanbul")'));
  assert.equal(h.read('formatNumber(1234)'), '1,234');
});

test('authored dictionary-phrase button labels survive locale switches and HTML export', t => {
  const h = setup(result.html);
  t.after(h.close);
  h.click('tab-studio');
  h.el('buttonText').value = 'Continue';
  h.el('buttonText').dispatchEvent(new h.window.Event('input', { bubbles: true }));
  h.read('setLocale("tr")');
  assert.equal(h.el('liveButton').querySelector('.btx-label').textContent, 'Continue');
  assert.match(h.read('standaloneButton()'), />Continue<\/span>/);
  assert.equal(JSON.parse(h.read('JSON.stringify(exportedRecipe())')).metin, 'Continue');
  h.read('setLocale("en")');
  assert.equal(h.el('liveButton').querySelector('.btx-label').textContent, 'Continue');
});

test('a saved explicit locale is restored while fresh sessions default to English', t => {
  const saved = new Map([['atlas-locale', 'tr']]);
  const h = setup(result.html, {
    storage: {
      getItem: key => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
    },
  });
  t.after(h.close);
  assert.equal(h.doc.documentElement.lang, 'tr');
  assert.match(h.el('comboDescription').textContent, /açık eksen/);
  h.read('setLocale("en")');
  assert.equal(saved.get('atlas-locale'), 'en');
});
