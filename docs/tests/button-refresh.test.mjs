import assert from 'node:assert/strict';
import test from 'node:test';
import { mountPattern } from './harness.mjs';

test('Double and triple buttons keep exactly one native selection across clicks and theme changes', async t => {
  const h = await mountPattern('WebButtonDemo', 'docs/src/react/ButtonDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  const groups = [
    ...h.document.querySelectorAll('[data-button-group-examples] .genux-button-group'),
  ];
  assert.deepEqual(
    groups.map(group => Number(group.dataset.buttonGroupCount)),
    [2, 3],
  );
  for (const group of groups) {
    const radios = [...group.querySelectorAll('input[type="radio"]')];
    assert.equal(radios.filter(radio => radio.checked).length, 1);
    await h.act(async () => radios.at(-1).click());
    assert.equal(radios.filter(radio => radio.checked).length, 1);
    assert.equal(radios.at(-1).checked, true);
    await h.act(async () => {
      h.document.documentElement.dataset.theme = 'dark';
      h.window.dispatchEvent(new h.window.Event('genux-theme-change'));
    });
    assert.equal(group.querySelector('input:checked'), radios.at(-1));
  }
});

test('Button families inherit all active color presets and every approved corner has a named icon action', async t => {
  const h = await mountPattern('WebButtonDemo', 'docs/src/react/ButtonDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  const paletteButtons = [
    ...h.document.querySelectorAll('[data-approved-axis="palette"] .genux-button'),
  ];
  assert.equal(paletteButtons.length, 24);
  assert.equal(new Set(paletteButtons.map(button => button.dataset.colorPreset)).size, 24);
  const corners = [...h.document.querySelectorAll('[data-icon-radius]')];
  assert.deepEqual(
    corners.map(item => item.dataset.iconRadius),
    ['0', '3', '5', 'pill'],
  );
  for (const corner of corners) {
    const button = corner.querySelector('.genux-icon-button');
    assert.ok(button.getAttribute('aria-label'));
    assert.equal(button.querySelector('svg').dataset.iconLibrary, 'phosphor');
  }
  const search = [...h.document.querySelectorAll('[data-search-button-examples] .genux-button')];
  assert.equal(search.length, 4);
  assert.equal(search.filter(button => button.dataset.iconOnly === 'true').length, 2);
  assert.deepEqual(
    search.map(button => button.dataset.fill),
    ['solid', 'solid', 'outline', 'outline'],
  );
});

test('Button exposes only three minimum heights and one busy state', async t => {
  const h = await mountPattern('WebButtonDemo', 'docs/src/react/ButtonDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  const sizes = [...h.document.querySelectorAll('[data-approved-size] .genux-button')];
  assert.deepEqual(
    sizes.map(button => [button.dataset.size, button.style.minHeight]),
    [
      ['sm', '48px'],
      ['md', '56px'],
      ['lg', '64px'],
    ],
  );
  const normal = h.document.querySelector('[data-approved-state="default"] .genux-button');
  assert.equal(normal.dataset.size, 'md');
  await h.click(h.document.querySelector('[data-tweaker-trigger]'));
  const sharedSizes = h.document.querySelectorAll('[data-size-control] input[type="radio"]');
  await h.act(async () => sharedSizes[0].click());
  assert.equal(normal.dataset.size, 'sm');
  assert.equal(
    h.document.querySelector('[data-button-group-examples] .genux-button-group').dataset.size,
    'sm',
  );
  assert.equal(h.document.querySelector('[data-approved-state="default"] .genux-button'), normal);
  const busy = [...h.document.querySelectorAll('[data-approved-state] [aria-busy="true"]')];
  assert.equal(busy.length, 1);
  assert.equal(busy[0].textContent, 'Processing');
  assert.equal(busy[0].getAttribute('aria-disabled'), 'true');
  const fills = [...h.document.querySelectorAll('[data-approved-axis="fill"]')];
  assert.deepEqual(
    fills.map(item => item.dataset.approvedValue),
    ['solid', 'outline', 'tint', 'text', 'link', 'disabled'],
  );
});

test('documentation Button examples have a linked five-part reading order without duplicate galleries', async t => {
  const h = await mountPattern('WebButtonDemo', 'docs/src/react/ButtonDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  const catalog = h.document.querySelector('[data-button-catalog]');
  assert.ok(catalog, 'documentation examples have one organized catalog');
  const sections = [...catalog.querySelectorAll(':scope > section')];
  assert.deepEqual(
    sections.map(section => section.querySelector('h3').textContent),
    ['Playground', 'Action patterns', 'Surfaces and states', 'Size and shape', 'Color and depth'],
  );
  const links = [...catalog.querySelectorAll('nav a')];
  assert.deepEqual(
    links.map(link => link.hash),
    sections.map(section => '#' + section.id),
  );
  assert.ok(links.every(link => h.document.querySelectorAll(link.hash).length === 1));
  assert.equal(sections[0].querySelectorAll('.playground-preview .genux-button').length, 1);
  assert.equal(sections[1].querySelectorAll('[data-search-button-examples]').length, 1);
  assert.equal(sections[1].querySelectorAll('[data-button-group-examples]').length, 1);
  assert.equal(sections[2].querySelectorAll('[data-approved-state]').length, 5);
  assert.equal(sections[2].querySelectorAll('[data-approved-axis="fill"]').length, 6);
  assert.equal(sections[3].querySelectorAll('[data-approved-size]').length, 3);
  assert.equal(sections[3].querySelectorAll('[data-approved-width]').length, 3);
  assert.equal(sections[3].querySelectorAll('[data-icon-radius]').length, 4);
  assert.equal(sections[4].querySelectorAll('[data-approved-axis="palette"]').length, 24);
  assert.equal(catalog.querySelectorAll('[data-approved-axis="palette"]').length, 24);
  assert.equal(h.document.querySelectorAll('[data-tweaker-trigger]').length, 1);
  const preview = sections[0].querySelector('.playground-preview .genux-button');
  await h.act(() => h.setLocale('tr'));
  assert.equal(catalog.querySelector('h3').textContent, 'Deneme alanı');
  assert.equal(links[0].textContent, 'Deneme alanı');
  assert.equal(sections[0].querySelector('.playground-preview .genux-button'), preview);
  assert.deepEqual(
    links.map(link => link.hash),
    sections.map(section => '#' + section.id),
  );
});
