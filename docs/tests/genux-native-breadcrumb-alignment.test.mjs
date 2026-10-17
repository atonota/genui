// Claude-authored proposal refined by master before admission. DOM/source checks
// are partial evidence: actual alignment/wrapping is measured in the browser.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import postcss from 'postcss';
import { mountPattern } from './harness.mjs';

const labels = [
  'Müşteri sözleşmeleri ve uyumluluk belgeleri çalışma alanı',
  'Customer onboarding documentation and approval history',
  'Kayıt ayrıntıları ve değişiklik geçmişi incelemesi',
];
const items = [
  { key: 'home', label: 'Overview', href: '/' },
  {
    key: 'workspace',
    label: labels[0],
    href: '/components/record-workspace/',
    menuLabel: 'Navigate customer contract workspace pages',
    menu: [{ key: 'forms', label: 'Kayıt formları', href: '/components/record-forms/' }],
  },
  { key: 'section', label: labels[1], href: '/components/collection-views/' },
  { key: 'current', label: labels[2] },
];

test('long labels remain readable and each decorative separator stays inside its following item', async t => {
  const h = await mountPattern('default', 'docs/src/react/GenUXBreadcrumb.tsx', {
    label: 'Long path',
    items,
  });
  t.after(() => h.dispose());
  const nav = h.document.querySelector('nav[aria-label="Long path"]');
  const owners = [...nav.querySelectorAll(':scope > ol > li')];
  assert.equal(
    owners.length,
    items.length,
    'each wrapping unit owns one destination, never a lone separator',
  );
  assert.equal(nav.querySelectorAll('[aria-current="page"]').length, 1);
  assert.deepEqual(
    [
      ...nav.querySelectorAll('.genux-breadcrumb-link > span, .genux-breadcrumb-current > span'),
    ].map(e => e.textContent),
    ['Overview', ...labels],
  );
  for (const [index, owner] of owners.entries()) {
    const destinations = [
      ...owner.querySelectorAll('.genux-breadcrumb-link,.genux-breadcrumb-current'),
    ];
    assert.equal(destinations.length, 1);
    assert.equal(destinations[0].textContent, items[index].label);
    if (index < items.length - 1)
      assert.equal(destinations[0].getAttribute('href'), items[index].href);
    else assert.equal(destinations[0].getAttribute('aria-current'), 'page');
    const separators = [...owner.querySelectorAll('.ant-breadcrumb-separator')];
    assert.equal(separators.length, index === 0 ? 0 : 1);
    for (const separator of separators) {
      assert.equal(separator.tagName, 'SPAN');
      assert.equal(separator.getAttribute('aria-hidden'), 'true');
      assert.equal(separator.hasAttribute('tabindex'), false);
      assert.equal(separator.closest('a,button'), null);
      assert.ok(
        separator.compareDocumentPosition(destinations[0]) &
          h.window.Node.DOCUMENT_POSITION_FOLLOWING,
      );
      assert.equal(separator.parentElement, destinations[0].parentElement.parentElement);
      assert.equal(
        separator.querySelector('[aria-hidden="true"]')?.textContent,
        '/',
        'retain existing native separator assertion compatibility',
      );
      assert.equal(separator.textContent.trim(), '/');
      assert.equal(separator.querySelectorAll('a,button,[tabindex]').length, 0);
    }
  }
  const trigger = nav.querySelector('button[aria-haspopup="menu"]');
  assert.equal(trigger.previousElementSibling.textContent, labels[0]);
  assert.equal(trigger.getAttribute('aria-label'), 'Navigate customer contract workspace pages');
  assert.equal(trigger.closest('li'), owners[1]);
  assert.equal(nav.querySelectorAll('a button,button a,[href="#"],[title]').length, 0);
});

test('native owners explicitly reset prose margins and inline baselines; spacing aliases are consumed', async () => {
  const source = await readFile(
    new URL('../src/styles/genux-breadcrumb.css', import.meta.url),
    'utf8',
  );
  const root = postcss.parse(source);
  const ownerRules = [];
  const olRules = [];
  const partRules = [];
  let menuAlias = false;
  root.walkRules(rule => {
    const selectors = rule.selectors.map(s => s.replace(/\s+/g, ' ').trim());
    if (selectors.includes('.genux-breadcrumb-nav > ol > li')) ownerRules.push(rule);
    if (selectors.includes('.genux-breadcrumb-nav > ol')) olRules.push(rule);
    if (selectors.includes('.genux-breadcrumb-part')) partRules.push(rule);
    rule.walkDecls(d => {
      if (d.prop === '--breadcrumb-menu-gap') {
        assert.match(d.value, /^var\(--space-[a-z]+\)$/);
        menuAlias = true;
      }
      if (
        selectors.some(s => /\.genux-breadcrumb-nav.*> ol > li(?:[.:][^ ]+)?$/.test(s)) &&
        /^margin(?:-|$)/.test(d.prop)
      )
        assert.match(
          d.value,
          /^0(?:px)?(?: 0(?:px)?){0,3}$/,
          'every applicable native-owner margin declaration must remain zero',
        );
    });
  });
  const values = rules => {
    const result = new Map();
    for (const rule of rules)
      rule.each(d => {
        if (d.type === 'decl') result.set(d.prop, d.value);
      });
    return result;
  };
  const owner = values(ownerRules);
  assert.ok(['flex', 'inline-flex'].includes(owner.get('display')));
  assert.equal(owner.get('align-items'), 'center');
  assert.equal(owner.get('margin'), '0');
  const ol = values(olRules);
  const row = ol.get('row-gap') ?? ol.get('gap')?.split(/\s+/)[0];
  assert.match(
    row ?? '',
    /^var\(--(?:space|breadcrumb)-[a-z-]+\)$/,
    'positive token row gap must belong to wrapping ol itself',
  );
  assert.ok(menuAlias);
  assert.equal(
    values(partRules).get('gap'),
    'var(--breadcrumb-menu-gap)',
    'label-trigger owner consumes its spacing alias',
  );
});
