import assert from 'node:assert/strict';
import test from 'node:test';
import { mountPattern } from './harness.mjs';

const destinations = [
  { key: 'data-table', label: 'Data table', href: '/components/data-table/' },
  { key: 'collection-views', label: 'Collection views', href: '/components/collection-views/' },
  { key: 'record-details', label: 'Record details', href: '/components/record-details/' },
  { key: 'record-forms', label: 'Record forms', href: '/components/record-forms/' },
  { key: 'record-workspace', label: 'Record workspace', href: '/components/record-workspace/' },
];
const items = [
  { key: 'home', label: 'Overview', href: '/', icon: 'house', iconOnly: true },
  {
    key: 'workspace',
    label: 'Data workspace',
    href: '/components/record-workspace/',
    menuLabel: 'Navigate Data workspace pages',
    menu: destinations,
  },
  { key: 'record-details', label: 'Record details' },
];

test('icon-only requests without an icon retain visible ancestor and current labels', async t => {
  const h = await mountPattern('default', 'docs/src/react/GenUXBreadcrumb.tsx', {
    label: 'Fallback path',
    items: [
      { key: 'home', label: 'Overview', href: '/', iconOnly: true },
      { key: 'current', label: 'Record details', iconOnly: true },
    ],
  });
  t.after(() => h.dispose());
  assert.equal(h.document.querySelector('nav a span').textContent, 'Overview');
  assert.equal(
    h.document.querySelector('nav [aria-current="page"] span').textContent,
    'Record details',
  );
});

test('native Breadcrumb has an operable sibling trigger, real links and one non-link current page', async t => {
  const h = await mountPattern('default', 'docs/src/react/GenUXBreadcrumb.tsx', {
    label: 'Workspace path',
    items,
  });
  t.after(() => h.dispose());
  const nav = h.document.querySelector('nav[aria-label="Workspace path"]');
  assert.ok(nav?.classList.contains('ant-breadcrumb'));
  const trigger = nav.querySelector('button[aria-haspopup="menu"]');
  assert.ok(trigger, 'sibling navigation has a real keyboard and touch button');
  assert.equal(trigger.getAttribute('aria-label'), 'Navigate Data workspace pages');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(nav.querySelectorAll('a button, button a').length, 0);
  assert.equal(nav.querySelector('a[aria-label="Overview"]').getAttribute('href'), '/');
  assert.equal(nav.querySelectorAll('[aria-current="page"]').length, 1);
  assert.equal(nav.querySelector('[aria-current="page"]').textContent, 'Record details');
  assert.notEqual(nav.querySelector('[aria-current="page"]').tagName, 'A');
  assert.equal(nav.querySelectorAll('.ant-breadcrumb-separator [aria-hidden="true"]').length, 2);
  assert.equal(nav.querySelectorAll('[href="#"]').length, 0);
});

test('sibling menu opens from click or ArrowDown and Escape closes immediately with trigger focus', async t => {
  const h = await mountPattern('default', 'docs/src/react/GenUXBreadcrumb.tsx', {
    label: 'Workspace path',
    items,
  });
  t.after(() => h.dispose());
  const trigger = h.document.querySelector('button[aria-haspopup="menu"]');
  assert.ok(trigger);
  await h.click(trigger);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  await h.waitFor(() => h.document.querySelector('[role="menu"]'), 'native sibling menu opens');
  const menu = h.document.querySelector('[role="menu"]');
  await h.waitFor(
    () => h.document.activeElement?.getAttribute('role') === 'menuitem',
    'native autofocus reaches a real menu item',
  );
  assert.equal(h.document.activeElement, menu.querySelector('[role="menuitem"]'));
  // rc-menu filters arrow targets through rc-util/isVisible. JSDOM has no
  // layout (offsetParent=null and zero rects), so expose only this open menu's
  // connected items as laid out. This is an event-order fixture, not reflow proof.
  const menuItems = [...menu.querySelectorAll('[role="menuitem"]')];
  for (const item of menuItems)
    Object.defineProperty(item, 'offsetParent', {
      configurable: true,
      get: () =>
        item.isConnected && !item.closest('[inert], [aria-hidden="true"], [style*="display: none"]')
          ? menu.parentElement
          : null,
    });
  t.after(() => {
    for (const item of menuItems) delete item.offsetParent;
  });
  await h.act(() => {
    h.document.activeElement.dispatchEvent(
      new h.window.KeyboardEvent('keydown', {
        key: 'ArrowDown',
        keyCode: 40,
        which: 40,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await h.waitFor(
    () => menu.querySelectorAll('[role="menuitem"]')[1].contains(h.document.activeElement),
    'native ArrowDown moves focus to the second destination',
  );
  assert.equal(menu.id, trigger.getAttribute('aria-controls'));
  assert.equal(menu.getAttribute('aria-label'), 'Navigate Data workspace pages');
  assert.deepEqual(
    [...menu.querySelectorAll('a')].map(link => link.getAttribute('href')),
    destinations.map(item => item.href),
  );
  await h.act(() => {
    menu.dispatchEvent(
      new h.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
  });
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(h.document.activeElement, trigger);
  await h.act(() => {
    trigger.dispatchEvent(
      new h.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    );
  });
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(h.document.querySelector('nav [aria-current="page"]').textContent, 'Record details');
});

test('Breadcrumb catalog presents two linked variants and preserves its menu owner through locale and profile changes', async t => {
  const h = await mountPattern('default', 'docs/src/react/BreadcrumbDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  const catalog = h.document.querySelector('[data-breadcrumb-catalog]');
  assert.deepEqual(
    [...catalog.querySelectorAll(':scope > section')].map(section => section.id),
    ['breadcrumb-quick', 'breadcrumb-icons'],
  );
  assert.deepEqual(
    [...catalog.querySelectorAll(':scope > nav a')].map(link => link.hash),
    ['#breadcrumb-quick', '#breadcrumb-icons'],
  );
  const navs = [...catalog.querySelectorAll('.ant-breadcrumb')];
  assert.equal(navs.length, 2);
  assert.equal(catalog.querySelectorAll('.ant-breadcrumb [aria-current="page"]').length, 2);
  const home = catalog.querySelector('#breadcrumb-icons a[aria-label="Overview"]');
  assert.equal(home.getAttribute('href'), '/');
  assert.equal(home.querySelector('svg').dataset.iconName, 'house');
  assert.equal(home.querySelector('svg').getAttribute('aria-hidden'), 'true');
  const trigger = catalog.querySelector('button[aria-haspopup="menu"]');
  await h.click(trigger);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  await h.act(() => h.setLocale('tr'));
  assert.equal(catalog.querySelector('button[aria-haspopup="menu"]'), trigger);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(trigger.getAttribute('aria-label'), 'Veri çalışma alanı sayfalarına git');
  assert.equal(
    catalog.querySelector('#breadcrumb-quick [aria-current="page"]').textContent,
    'Kayıt ayrıntıları',
  );
  await h.act(() => {
    h.document.documentElement.dataset.theme = 'dark';
    h.window.dispatchEvent(new h.window.Event('genux-theme-change'));
  });
  assert.equal(catalog.querySelector('button[aria-haspopup="menu"]'), trigger);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  await h.act(() => {
    trigger.dispatchEvent(
      new h.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
  });
  const tweaker = h.document.querySelector('[data-tweaker-trigger]');
  assert.equal(tweaker.getAttribute('aria-expanded'), 'false');
  await h.click(tweaker);
  await h.click(h.document.querySelectorAll('[data-size-control] input[type="radio"]')[2]);
  assert.equal(catalog.closest('[data-size-profile]').dataset.sizeProfile, 'lg');
  assert.equal(catalog.querySelector('button[aria-haspopup="menu"]'), trigger);
  assert.equal(
    catalog.querySelector('#breadcrumb-quick [aria-current="page"]').textContent,
    'Kayıt ayrıntıları',
  );
});

test('pointer, Enter and Space activate exactly one real destination from the native menu', async t => {
  const h = await mountPattern('default', 'docs/src/react/GenUXBreadcrumb.tsx', {
    label: 'Workspace path',
    items,
  });
  t.after(() => h.dispose());
  const trigger = h.document.querySelector('button[aria-haspopup="menu"]');
  for (const key of ['pointer', 'Enter', ' ']) {
    await h.click(trigger);
    await h.waitFor(
      () => h.document.querySelector('[role="menuitem"]'),
      'native sibling item appears',
    );
    const item = h.document.querySelector('[role="menuitem"]');
    const link = item.querySelector('a');
    const activated = [];
    const recordActivation = event => {
      event.preventDefault();
      activated.push(link.getAttribute('href'));
    };
    link.addEventListener('click', recordActivation);
    try {
      if (key === 'pointer') await h.click(link);
      else
        await h.act(() => {
          item.focus();
          item.dispatchEvent(
            new h.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
          );
        });
    } finally {
      link.removeEventListener('click', recordActivation);
    }
    assert.deepEqual(activated, ['/components/data-table/']);
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  }
});
