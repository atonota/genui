import assert from 'node:assert/strict';
import test from 'node:test';
import { mountPattern } from './harness.mjs';

const items = [
  { key: 'review', label: 'Add review note' },
  { key: 'publish', label: 'Publish remotely', disabled: true },
  { type: 'divider' },
  { key: 'clear', label: 'Clear local notes', danger: true },
];

test('an optional native semantic callback can return undefined without losing the owned popup', async t => {
  const actions = [];
  const h = await mountPattern('default', 'docs/src/react/AtlasDropdown.tsx', {
    label: 'Optional styles',
    items,
    onAction: key => actions.push(key),
    classNames: () => undefined,
    styles: () => undefined,
  });
  t.after(() => h.dispose());
  await h.click(h.document.querySelector('button'));
  await h.waitFor(
    () => h.document.querySelector('.atlas-dropdown-popup [role="menuitem"]'),
    'owned native popup remains present',
  );
  await h.click(h.document.querySelector('.atlas-dropdown-popup [role="menuitem"]'));
  assert.deepEqual(actions, ['review']);
});

test('action Dropdown exposes a named button and opens on ArrowDown with immediate menu relationships', async t => {
  const actions = [];
  const h = await mountPattern('default', 'docs/src/react/AtlasDropdown.tsx', {
    label: 'Workspace actions',
    items,
    onAction: key => actions.push(key),
  });
  t.after(() => h.dispose());
  const trigger = h.document.querySelector('button');
  assert.equal(trigger.textContent.trim(), 'Workspace actions');
  assert.equal(trigger.getAttribute('aria-haspopup'), 'menu');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  await h.act(() => {
    trigger.dispatchEvent(
      new h.window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    );
  });
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  await h.waitFor(() => h.document.querySelector('[role="menu"]'), 'native action menu opens');
  const menu = h.document.querySelector('[role="menu"]');
  await h.waitFor(
    () => h.document.activeElement?.getAttribute('role') === 'menuitem',
    'native autofocus reaches a real menu item',
  );
  assert.equal(h.document.activeElement, menu.querySelector('[role="menuitem"]'));
  // Native arrow navigation uses rc-util/isVisible. JSDOM has no layout, so
  // mark only this open menu's connected items as laid out; disabled items keep
  // their real native tabindex/ARIA. This fixture supplies no geometry evidence.
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
    () => menu.querySelectorAll('[role="menuitem"]')[2].contains(h.document.activeElement),
    'native ArrowDown skips the disabled action',
  );
  assert.equal(menu.id, trigger.getAttribute('aria-controls'));
  assert.equal(menu.getAttribute('aria-label'), 'Workspace actions');
  assert.deepEqual(actions, []);
});

test('pointer, Enter and Space dispatch each native menu action once; disabled items remain inert', async t => {
  const actions = [];
  const h = await mountPattern('default', 'docs/src/react/AtlasDropdown.tsx', {
    label: 'Workspace actions',
    items,
    onAction: key => actions.push(key),
  });
  t.after(() => h.dispose());
  const trigger = h.document.querySelector('button');
  for (const key of ['pointer', 'Enter', ' ']) {
    await h.click(trigger);
    await h.waitFor(() => h.document.querySelector('[role="menuitem"]'), 'native action appears');
    const item = h.document.querySelector('[role="menuitem"]');
    if (key === 'pointer') await h.click(item);
    else
      await h.act(() => {
        item.focus();
        item.dispatchEvent(
          new h.window.KeyboardEvent('keydown', {
            key,
            keyCode: key === 'Enter' ? 13 : 32,
            which: key === 'Enter' ? 13 : 32,
            bubbles: true,
            cancelable: true,
          }),
        );
      });
    assert.equal(actions.length, ['pointer', 'Enter', ' '].indexOf(key) + 1);
    assert.equal(actions.at(-1), 'review');
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  }
  await h.click(trigger);
  const disabled = h.document.querySelector('[role="menuitem"][aria-disabled="true"]');
  await h.click(disabled);
  assert.equal(actions.length, 3);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  await h.act(() => {
    disabled.dispatchEvent(
      new h.window.KeyboardEvent('keydown', {
        key: ' ',
        keyCode: 32,
        which: 32,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  assert.equal(actions.length, 3);
  await h.act(() => {
    h.document
      .querySelector('[role="menu"]')
      .dispatchEvent(
        new h.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
  });
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(h.document.activeElement, trigger);
});

test('an outside pointer closes the native menu without dispatching an action or stealing focus', async t => {
  const actions = [];
  const h = await mountPattern('default', 'docs/src/react/AtlasDropdown.tsx', {
    label: 'Workspace actions',
    items,
    onAction: key => actions.push(key),
  });
  t.after(() => h.dispose());
  const trigger = h.document.querySelector('button');
  await h.click(trigger);
  await h.waitFor(
    () => h.document.activeElement?.getAttribute('role') === 'menuitem',
    'native menu is focused',
  );
  const outside = h.document.createElement('button');
  outside.textContent = 'Outside action';
  h.document.body.append(outside);
  await h.act(() => {
    outside.focus();
    outside.dispatchEvent(
      new h.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }),
    );
    outside.click();
  });
  await h.waitFor(
    () => trigger.getAttribute('aria-expanded') === 'false',
    'outside pointer closes native dropdown',
  );
  assert.equal(h.document.activeElement, outside);
  assert.deepEqual(actions, []);
});

test('native cascading menus open deliberately, brand their portal and preserve disabled groups', async t => {
  const actions = [];
  const h = await mountPattern('default', 'docs/src/react/AtlasDropdown.tsx', {
    label: 'Organize workspace',
    items: [
      {
        type: 'group',
        key: 'group',
        label: 'Workspace',
        children: [
          {
            key: 'move',
            label: 'Move to folder',
            children: [
              { key: 'planning', label: 'Planning' },
              { key: 'delivery', label: 'Delivery' },
            ],
          },
          {
            key: 'access',
            label: 'Access settings',
            disabled: true,
            children: [{ key: 'permissions', label: 'Manage access' }],
          },
        ],
      },
      { type: 'divider' },
      { key: 'reset', label: 'Reset local organization', danger: true },
    ],
    onAction: key => actions.push(key),
  });
  t.after(() => h.dispose());
  const trigger = h.document.querySelector('button');
  await h.click(trigger);
  const menu = h.document.querySelector('[role="menu"]');
  assert.equal(menu.querySelector('.ant-dropdown-menu-item-group-title').textContent, 'Workspace');
  assert.ok(menu.querySelector('[role="separator"]'));
  assert.ok(menu.querySelector('.ant-dropdown-menu-item-danger'));
  const move = [...menu.querySelectorAll('[aria-haspopup="true"]')].find(
    item => item.textContent === 'Move to folder',
  );
  const unavailable = [...menu.querySelectorAll('[aria-haspopup="true"]')].find(
    item => item.textContent === 'Access settings',
  );
  assert.ok(move);
  assert.equal(move.getAttribute('aria-expanded'), 'false');
  await h.click(unavailable);
  assert.equal(unavailable.getAttribute('aria-expanded'), 'false');
  await h.click(move);
  assert.equal(move.getAttribute('aria-expanded'), 'true');
  await h.waitFor(
    () => h.document.querySelector('.atlas-dropdown-subpopup [role="menuitem"]'),
    'native submenu portal opens',
  );
  const subpopup = h.document.querySelector('.atlas-dropdown-subpopup');
  assert.equal(subpopup.querySelector('[inert]'), null);
  const planning = [...subpopup.querySelectorAll('[role="menuitem"]')].find(
    item => item.textContent === 'Planning',
  );
  await h.click(planning);
  assert.deepEqual(actions, ['planning']);
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(h.document.activeElement, trigger);
});

test('resize reveals an off-viewport owned submenu without replacing focus, open keys or action state', async t => {
  const actions = [];
  const h = await mountPattern('default', 'docs/src/react/AtlasDropdown.tsx', {
    label: 'Organize workspace',
    items: [
      { key: 'move', label: 'Move to folder', children: [{ key: 'planning', label: 'Planning' }] },
    ],
    onAction: key => actions.push(key),
  });
  t.after(() => h.dispose());
  const trigger = h.document.querySelector('button');
  const scrolls = [];
  trigger.scrollIntoView = options => scrolls.push(options);
  await h.click(trigger);
  const move = h.document.querySelector('[role="menuitem"][aria-haspopup="true"]');
  await h.waitFor(() => h.document.activeElement === move, 'native root menu autofocus settles');
  await h.click(move);
  await h.waitFor(
    () => h.document.querySelector('.atlas-dropdown-subpopup [role="menuitem"]'),
    'owned submenu appears',
  );
  const planning = h.document.querySelector('.atlas-dropdown-subpopup [role="menuitem"]');
  assert.ok(planning.closest('[data-atlas-dropdown-owner]'));
  // Synthetic rects model the observed desktop-to-phone page reflow. They
  // exercise ownership and event order, not browser alignment or layout proof.
  let offscreen = false;
  planning.getBoundingClientRect = () => ({
    left: 20,
    right: 120,
    top: offscreen ? 2700 : 100,
    bottom: offscreen ? 2732 : 132,
    width: 100,
    height: 32,
  });
  await h.act(() => {
    planning.focus();
    h.window.dispatchEvent(new h.window.Event('resize'));
  });
  await h.act(() => new Promise(resolve => h.window.requestAnimationFrame(resolve)));
  assert.deepEqual(scrolls, [], 'visible owned focus does not scroll');
  offscreen = true;
  await h.act(() => {
    h.window.dispatchEvent(new h.window.Event('resize'));
    h.window.dispatchEvent(new h.window.Event('resize'));
  });
  await h.waitFor(() => scrolls.length === 1, 'coalesced resize reveals the native trigger');
  assert.deepEqual(scrolls, [{ block: 'nearest', inline: 'nearest', behavior: 'instant' }]);
  assert.equal(h.document.activeElement, planning);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(move.getAttribute('aria-expanded'), 'true');
  assert.deepEqual(actions, []);
  const outside = h.document.createElement('button');
  h.document.body.append(outside);
  outside.getBoundingClientRect = planning.getBoundingClientRect;
  await h.act(() => {
    outside.focus();
    h.window.dispatchEvent(new h.window.Event('resize'));
  });
  await h.act(() => new Promise(resolve => h.window.requestAnimationFrame(resolve)));
  assert.equal(scrolls.length, 1, 'unowned focus never scrolls this menu');
  await h.act(() => {
    planning.focus();
    h.window.dispatchEvent(new h.window.Event('resize'));
    planning.dispatchEvent(
      new h.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
  });
  await h.act(() => new Promise(resolve => h.window.requestAnimationFrame(resolve)));
  assert.equal(scrolls.length, 1, 'closing cancels pending visibility reconciliation');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(h.document.activeElement, trigger);
});

test('object and function semantic APIs render their actual native roles and local outcomes persist across presentation changes', async t => {
  const h = await mountPattern('default', 'docs/src/react/DropdownDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  const catalog = h.document.querySelector('[data-dropdown-catalog]');
  assert.deepEqual(
    [...catalog.querySelectorAll(':scope > section')].map(section => section.id),
    ['dropdown-basic', 'dropdown-surfaces', 'dropdown-cascading'],
  );
  assert.deepEqual(
    [...catalog.querySelectorAll(':scope > nav a')].map(link => link.hash),
    ['#dropdown-basic', '#dropdown-surfaces', '#dropdown-cascading'],
  );
  const triggers = [...catalog.querySelectorAll('button.atlas-dropdown-trigger')];
  assert.equal(triggers.length, 4);
  await h.click(triggers[0]);
  const note = [...h.document.querySelectorAll('[role="menuitem"]')].find(
    item => item.textContent === 'Add review note',
  );
  await h.click(note);
  assert.match(catalog.querySelector('[role="status"]').textContent, /1 local notes/);
  assert.equal(catalog.querySelectorAll('.dropdown-notes li').length, 1);
  await h.click(triggers[1]);
  const quiet = h.document.querySelector('.atlas-dropdown-quiet');
  assert.equal(quiet.style.borderRadius, 'var(--radius)');
  assert.equal(
    quiet.querySelector('.atlas-dropdown-quiet-item').style.borderRadius,
    'var(--radius-sm)',
  );
  await h.act(() =>
    quiet.dispatchEvent(
      new h.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    ),
  );
  await h.click(triggers[2]);
  const contextual = h.document.querySelector('.atlas-dropdown-context-open');
  assert.equal(contextual.style.boxShadow, 'var(--shadow-soft)');
  assert.ok(contextual.querySelector('.atlas-dropdown-context-content'));
  const ready = [...contextual.querySelectorAll('[role="menuitem"]')].find(
    item => item.textContent === 'Mark ready for review',
  );
  await h.click(ready);
  assert.match(catalog.querySelector('.dropdown-facts').textContent, /Ready for review/);
  await h.act(() => h.setLocale('tr'));
  assert.equal(catalog.querySelectorAll('.dropdown-notes li').length, 1);
  assert.match(catalog.querySelector('.dropdown-facts').textContent, /İncelemeye hazır/);
  assert.equal(catalog.querySelectorAll('button.atlas-dropdown-trigger')[2], triggers[2]);
  await h.act(() => {
    h.document.documentElement.dataset.theme = 'dark';
    h.window.dispatchEvent(new h.window.Event('atlas-theme-change'));
  });
  assert.equal(catalog.querySelectorAll('.dropdown-notes li').length, 1);
  await h.click(h.document.querySelector('[data-tweaker-trigger]'));
  await h.click(h.document.querySelectorAll('[data-size-control] input[type="radio"]')[2]);
  assert.equal(catalog.closest('[data-size-profile]').dataset.sizeProfile, 'lg');
  assert.equal(catalog.querySelectorAll('button.atlas-dropdown-trigger')[2], triggers[2]);
  assert.equal(catalog.querySelectorAll('.dropdown-notes li').length, 1);
});
