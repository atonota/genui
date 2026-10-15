import assert from 'node:assert/strict';
import test from 'node:test';
import { mountPattern } from './harness.mjs';

const pages = [
  ['input', 'WebInputDemo', ['text', 'special', 'validation', 'availability'], 9],
  ['select', 'WebSelectDemo', ['single', 'multiple', 'validation', 'availability'], 9],
  ['checkbox', 'WebCheckboxDemo', ['selection', 'states'], 8],
  ['radio', 'WebRadioDemo', ['single', 'grouped', 'states'], 11],
  ['switch', 'WebSwitchDemo', ['basic', 'content', 'sizes', 'states'], 0],
  ['slider', 'default', ['basics', 'numeric', 'direction', 'states'], 2],
  ['form', 'default', ['flow', 'states'], 4],
];

test('direct documentation consumers retain their explicit Radio and Switch feature gates', async t => {
  for (const [name, selector, count] of [
    ['Radio', 'input[type="radio"]', 9],
    ['Switch', '[role="switch"]', 6],
  ]) {
    await t.test(name, async () => {
      const h = await mountPattern('default', `docs/src/react/${name}Demo.tsx`, {
        documentation: true,
      });
      try {
        const catalog = h.document.querySelector('[data-entry-catalog]');
        assert.equal(catalog.querySelectorAll(selector).length, count);
        assert.equal(
          catalog.querySelector('[name="delivery"],[data-switch-content-examples]'),
          null,
        );
      } finally {
        await h.dispose();
      }
    });
  }
});

for (const [slug, entry, sections, inputs] of pages) {
  const filename = slug[0].toUpperCase() + slug.slice(1) + 'Demo';
  test(`${slug}: example navigation resolves to unique ordered regions without duplicating controls`, async t => {
    const h = await mountPattern(entry, `docs/src/react/${filename}.tsx`, { documentation: true });
    t.after(() => h.dispose());
    const catalog = h.document.querySelector(`[data-entry-catalog="${slug}"]`);
    assert.ok(catalog, 'documentation examples have a navigable reading order');
    const regions = [...catalog.querySelectorAll(':scope > section')];
    assert.deepEqual(
      regions.map(n => n.id),
      sections.map(id => `${slug}-examples-${id}`),
    );
    const links = [...catalog.querySelectorAll(':scope > nav a')];
    assert.deepEqual(
      links.map(n => n.hash),
      regions.map(n => '#' + n.id),
    );
    for (const region of regions) {
      assert.equal(h.document.querySelectorAll('#' + region.id).length, 1);
      assert.ok(region.querySelector('header h3')?.textContent.trim());
      assert.ok(region.querySelector('header p')?.textContent.trim());
      assert.equal(region.getAttribute('aria-labelledby'), region.querySelector('h3').id);
    }
    assert.equal(catalog.querySelectorAll('input').length, inputs, 'one copy of each sample');
    if (slug === 'switch') assert.equal(catalog.querySelectorAll('[role="switch"]').length, 15);
    if (slug === 'slider') assert.equal(catalog.querySelectorAll('[role="slider"]').length, 15);
    const nodes = [...catalog.querySelectorAll('input,textarea,[role="switch"],[role="slider"]')];
    const draft =
      slug === 'input'
        ? catalog.querySelector('#input-filled')
        : slug === 'form'
          ? catalog.querySelector('input[id$="fullName"]')
          : null;
    if (draft) await h.type(draft, 'Preserved example draft');
    const choice =
      slug === 'checkbox'
        ? catalog.querySelector('input[type="checkbox"]')
        : slug === 'radio'
          ? catalog.querySelectorAll('input[name="team"]')[1]
          : slug === 'switch'
            ? catalog.querySelector('#switch-notify')
            : null;
    if (choice) await h.click(choice);
    const selected = choice?.getAttribute('aria-checked') ?? choice?.checked;
    const ids = regions.map(n => n.id);
    const assertCurrentOwners = () => {
      const current = h.document.querySelector(`[data-entry-catalog="${slug}"]`);
      assert.equal(current, catalog, 'the current catalog is the same mounted node');
      assert.equal(current.isConnected, true);
      assert.deepEqual(
        [...current.querySelectorAll('input,textarea,[role="switch"],[role="slider"]')],
        nodes,
        'current native control owners survive presentation changes',
      );
      assert.deepEqual(
        [...current.querySelectorAll(':scope > section')].map(n => n.id),
        ids,
        'translated titles never become identity keys',
      );
      if (draft) assert.equal(h.document.getElementById(draft.id).value, 'Preserved example draft');
      if (choice) {
        assert.equal(choice.isConnected, true);
        assert.equal(choice.getAttribute('aria-checked') ?? choice.checked, selected);
      }
    };
    await h.click(h.document.querySelector('[data-tweaker-trigger]'));
    await h.click(h.document.querySelector('[data-size-control] input[type="radio"]'));
    assertCurrentOwners();
    await h.act(() => h.setLocale('tr'));
    assertCurrentOwners();
    await h.act(() => {
      h.document.documentElement.dataset.theme = 'dark';
      h.window.dispatchEvent(new h.window.Event('atlas-theme-change'));
    });
    assertCurrentOwners();
  });

  test(`${slug}: default/approved consumers do not adopt the documentation catalog`, async t => {
    const h = await mountPattern('default', `docs/src/react/${filename}.tsx`);
    t.after(() => h.dispose());
    assert.equal(h.document.querySelector('[data-entry-catalog]'), null);
  });
}
