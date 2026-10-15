import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import postcss from 'postcss';
import { render } from '../tools/build.mjs';
import { setup, settle } from './harness.mjs';

const { html } = await render();
function mount(t) {
  const h = setup(html);
  t.after(h.close);
  h.click('tab-forms');
  return h;
}
function type(h, id, value) {
  const node = h.el(id);
  node.value = value;
  node.dispatchEvent(new h.window.Event('input', { bubbles: true }));
  return node;
}

test('workspace examples stay experimental and do not mutate approved decisions', () => {
  const h = setup(html);
  try {
    assert.ok(h.el('workspaceLab'));
    assert.equal(h.doc.querySelector('#panel-decisions #workspaceLab'), null);
    assert.equal(h.doc.querySelector('#workspaceExamples input'), null, 'examples build lazily');
    const decisions = h.read('JSON.stringify(COMPONENT_DECISIONS)');
    h.click('tab-forms');
    h.click('ws-desktop');
    h.click('ws-mobile');
    assert.equal(h.read('JSON.stringify(COMPONENT_DECISIONS)'), decisions);
    assert.doesNotMatch(decisions, /workspace|SP-26-0401/);
  } finally {
    h.close();
  }
});

test('mobile groups, search and record details retain a clear return route', t => {
  const h = mount(t);
  assert.equal(h.el('ws-mobile').getAttribute('aria-pressed'), 'true');
  h.doc.querySelector('[data-ws-group="all"]').click();
  const search = type(h, 'ws-search', 'SP-26-0401');
  const open = h.doc.querySelector('[data-ws-open="SP-26-0401"]');
  assert.ok(open, 'search finds the visible record ID');
  open.click();
  assert.equal(h.read('workspaceState.activeId'), 'SP-26-0401');
  h.click('ws-back-list');
  assert.equal(h.el('ws-search'), search);
  assert.equal(search.value, 'SP-26-0401');
  assert.equal(h.read('workspaceState.group'), 'all');
  h.click('ws-back-groups');
  assert.equal(h.read('workspaceState.mobileStage'), 'groups');
});

test('mobile and desktop presentations share the same mounted draft and active record', t => {
  const h = mount(t);
  h.doc.querySelector('[data-ws-group="all"]').click();
  h.doc.querySelector('[data-ws-open="SP-26-0401"]').click();
  const note = type(h, 'ws-note', 'Keep my authored note');
  h.click('ws-form-single');
  note.focus();
  note.setSelectionRange(2, 7);
  h.click('ws-desktop');
  assert.equal(h.el('ws-desktop').getAttribute('aria-pressed'), 'true');
  assert.equal(h.read('workspaceState.activeId'), 'SP-26-0401');
  assert.equal(h.el('ws-note'), note);
  assert.equal(note.value, 'Keep my authored note');
  h.click('ws-mobile');
  assert.equal(h.el('ws-note'), note);
  assert.equal(note.value, 'Keep my authored note');
  assert.equal(
    h.doc.activeElement,
    note,
    'profile change reveals the step containing actual focus',
  );
  assert.deepEqual([note.selectionStart, note.selectionEnd], [2, 7]);
  h.click('tab-studio');
  h.click('tab-forms');
  assert.equal(h.el('ws-note'), note);
  const ids = [...h.doc.querySelectorAll('[id]')].map(node => node.id);
  assert.equal(new Set(ids).size, ids.length, 'one active shell, no duplicate form IDs');
});

test('record navigation and group filtering preserve mounted rows and independent detail context', t => {
  const h = mount(t);
  h.click('ws-desktop');
  const open = h.doc.querySelector('[data-ws-open="SP-26-0401"]');
  open.click();
  h.click('ws-next-record');
  assert.equal(h.read('workspaceState.activeId'), 'SP-26-0402');
  h.click('ws-prev-record');
  assert.equal(h.read('workspaceState.activeId'), 'SP-26-0401');
  h.doc.querySelector('[data-ws-group="approved"]').click();
  assert.equal(h.read('workspaceState.activeId'), 'SP-26-0401');
  assert.match(h.el('ws-record-position').textContent, /outside the current filter/);
  assert.equal(h.el('ws-next-record').disabled, true);
  h.doc.querySelector('[data-ws-group="all"]').click();
  assert.equal(h.doc.querySelector('[data-ws-open="SP-26-0401"]'), open);
  assert.equal(h.el('ws-next-record').disabled, false);
});

test('single-page and multistep validation keep the draft and reveal the invalid field', t => {
  const h = mount(t);
  h.click('ws-form-single');
  type(h, 'ws-customer', '');
  type(h, 'ws-amount', '0');
  h.click('ws-save');
  assert.equal(h.el('ws-customer').getAttribute('aria-invalid'), 'true');
  assert.equal(h.doc.activeElement, h.el('ws-customer'));
  type(h, 'ws-customer', 'Example customer');
  h.click('ws-save');
  assert.equal(h.el('ws-amount').getAttribute('aria-invalid'), 'true');
  assert.equal(h.doc.activeElement, h.el('ws-amount'));
  type(h, 'ws-amount', '1200.50');
  type(h, 'ws-due', '');
  const note = type(h, 'ws-note', 'Draft across steps');
  h.click('ws-form-steps');
  h.click('ws-step-next');
  h.click('ws-step-prev');
  assert.equal(h.el('ws-note'), note);
  assert.equal(note.value, 'Draft across steps');
  h.click('ws-step-next');
  h.click('ws-save');
  assert.equal(h.el('ws-due').getAttribute('aria-invalid'), 'true');
  assert.equal(h.doc.activeElement, h.el('ws-due'));
  assert.equal(h.el('ws-due').closest('.ws-pane').getAttribute('aria-hidden'), 'false');
  type(h, 'ws-due', '2026-10-27');
  h.click('ws-save');
  assert.match(h.el('ws-form-status').textContent, /local|example/i);
  assert.equal(h.el('ws-customer').value, 'Example customer');
  assert.equal(note.value, 'Draft across steps');
});

test('locale changes preserve user input, focused fields and the selected record', async t => {
  const h = mount(t);
  h.click('ws-desktop');
  h.doc.querySelector('[data-ws-open="SP-26-0401"]').click();
  h.click('ws-form-single');
  const note = type(h, 'ws-note', 'A user-authored note');
  note.focus();
  note.setSelectionRange(3, 8);
  h.read('setLocale("tr")');
  await settle();
  assert.equal(h.el('ws-note'), note);
  assert.equal(note.value, 'A user-authored note');
  assert.equal(h.doc.activeElement, note);
  assert.deepEqual([note.selectionStart, note.selectionEnd], [3, 8]);
  assert.equal(h.read('workspaceState.activeId'), 'SP-26-0401');
  assert.equal(h.el('ws-mobile').textContent.trim(), 'Mobil örnek');
  assert.equal(h.el('ws-desktop').textContent.trim(), 'Masaüstü örnek');
  h.read('setLocale("en")');
  await settle();
  assert.equal(h.el('ws-mobile').textContent.trim(), 'Mobile example');
});

test('workspace styles remain scoped and reject unsafe motion on new controls', async () => {
  const css = await readFile(new URL('../src/styles/workspace.css', import.meta.url), 'utf8');
  const sheet = postcss.parse(css);
  let transitions = 0;
  sheet.walkRules(rule => {
    for (const selector of rule.selectors)
      assert.match(selector, /#workspaceLab|\.workspace-lab/, selector);
  });
  sheet.walkDecls(declaration => {
    if (declaration.prop === 'outline') assert.match(declaration.value.trim(), /^(none|0)$/);
    if (declaration.prop === 'word-break') assert.notEqual(declaration.value, 'break-all');
    if (!/^(?:transition|animation)/.test(declaration.prop)) return;
    let parent = declaration.parent;
    let reduced = false;
    while (parent) {
      if (
        parent.type === 'atrule' &&
        parent.params?.replace(/\s+/g, '') === '(prefers-reduced-motion:reduce)'
      )
        reduced = true;
      parent = parent.parent;
    }
    const off = /\[data-motion\s*=\s*['"]?off/.test(declaration.parent.selector ?? '');
    if (reduced || off) return;
    assert.doesNotMatch(
      declaration.value,
      /\b(?:none|linear|all|ease-in|ease-out)\b|(?:^|[ ,])0(?:ms|s)(?:$|[ ,])/,
    );
    if (
      [
        'transition',
        'animation',
        'transition-timing-function',
        'animation-timing-function',
      ].includes(declaration.prop)
    )
      assert.match(declaration.value, /var\(--motion-easing\)/);
    if (declaration.prop === 'transition') {
      transitions++;
      assert.match(declaration.value, /var\(--[\w-]*(?:duration|release|motion)[\w-]*\)/);
      assert.doesNotMatch(declaration.parent.selector, /:hover|:active|\[aria-pressed=true\]/);
    }
  });
  assert.ok(transitions > 0, 'new stateful controls require reversible base transitions');
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
  assert.doesNotMatch(css, /transition:\s*all/);
  const rules = [];
  sheet.walkRules(rule => rules.push(rule));
  const focusedPane = rules.find(rule => rule.selector.includes('[data-open=true]:focus-within'));
  assert.ok(focusedPane, 'opening content with actual focus must not clip or fade the indicator');
  const focusedTiming = focusedPane.nodes.find(node => node.prop === 'transition');
  assert.ok(focusedTiming);
  assert.doesNotMatch(focusedTiming.value, /grid-template-rows|opacity|padding/);
  const actionFocus = rules.find(
    rule => rule.selector === '#workspaceLab .ws-action:focus-visible',
  );
  assert.ok(
    actionFocus?.nodes.some(node => node.prop === 'text-decoration' && node.value === 'none'),
    'the inherited global underline must not duplicate the leading focus marker',
  );
  const scroll = rules.find(rule => rule.selector === '#workspaceLab .ws-table-scroll');
  const scrollFocus = rules.find(
    rule => rule.selector === '#workspaceLab .ws-table-scroll:focus-visible',
  );
  assert.ok(
    scroll.nodes.some(node => node.prop === 'border-block-end' && /transparent/.test(node.value)),
  );
  assert.ok(scrollFocus.nodes.some(node => node.prop === 'border-block-end-color'));
  assert.ok(!scrollFocus.nodes.some(node => /width|padding|box-shadow|outline/.test(node.prop)));
  const tokens = new Map();
  for (const source of ['atlas.css', 'forms.css', 'workspace.css']) {
    const sourceSheet = postcss.parse(
      await readFile(new URL('../src/styles/' + source, import.meta.url), 'utf8'),
    );
    sourceSheet.walkDecls(declaration => {
      if (declaration.prop.startsWith('--')) tokens.set(declaration.prop, declaration.value);
    });
  }
  let duration = tokens.get('--ws-duration');
  for (let depth = 0; depth < 5 && /^var\(/.test(duration); depth++)
    duration = tokens.get(duration.match(/^var\((--[\w-]+)\)$/)?.[1]);
  assert.match(duration, /^\d+(?:\.\d+)?ms$/);
  assert.ok(Number.parseFloat(duration) > 0 && Number.parseFloat(duration) <= 2000);
  const fieldFocus = rules.find(rule =>
    rule.selector.includes('.ff-control-wrap:has(:focus-visible)::after'),
  );
  assert.ok(fieldFocus, 'the inherited field marker must stay inside the collapsing pane clip');
  assert.equal(
    fieldFocus.nodes.find(node => node.prop === 'inset-inline-start')?.value,
    'var(--ws-focus-inset)',
  );
  const inset = Number.parseFloat(tokens.get('--ws-focus-inset'));
  const markerWidth = Number.parseFloat(tokens.get('--focus-marker-size'));
  assert.ok(inset >= 0 && markerWidth > 0, 'a negative marker inset would be fully clipped');
  assert.ok(inset + markerWidth <= 44, 'marker remains within the minimum control width');
  const source = await readFile(new URL('../src/workspace/examples.js', import.meta.url), 'utf8');
  assert.doesNotMatch(
    source,
    /\b(?:setTimeout|setInterval|requestAnimationFrame)\s*\(|\.blur\s*\(/,
  );
});
