import assert from 'node:assert/strict';
import test from 'node:test';
import { mountPattern, buttonByText, selectOption } from './harness.mjs';

test('Pagination presents four linked sections, an initially closed Tweaker and the requested current range', async t => {
  const h = await mountPattern('default', 'docs/src/react/PaginationDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  const catalog = h.document.querySelector('[data-pagination-catalog]');
  const sections = [...catalog.querySelectorAll(':scope > section')];
  assert.deepEqual(
    sections.map(section => section.id),
    [
      'pagination-explore',
      'pagination-boundaries',
      'pagination-surfaces',
      'pagination-availability',
    ],
  );
  assert.deepEqual(
    [...catalog.querySelectorAll(':scope > nav a')].map(link => link.hash),
    sections.map(section => '#' + section.id),
  );
  assert.equal(
    h.document.querySelector('[data-tweaker-trigger]').getAttribute('aria-expanded'),
    'false',
  );
  const primary = catalog.querySelector('[data-pagination-primary]');
  assert.match(primary.querySelector('[role="status"]').textContent, /411–420 of 500/);
  assert.deepEqual(
    [...primary.querySelectorAll('[data-pagination-page]')].map(el => el.textContent),
    ['1', '2', '41', '42', '43', '49', '50'],
  );
  assert.equal(
    catalog.querySelectorAll('[data-pagination-single] [data-pagination-page]').length,
    1,
  );
  assert.equal(
    catalog.querySelectorAll('[data-pagination-empty] [data-pagination-page]').length,
    0,
  );
  assert.ok(
    [...catalog.querySelectorAll('[data-pagination-disabled] button')].every(
      button => button.disabled,
    ),
  );
});

test('five canonical Button variants own independent pages and use the shared master', async t => {
  const h = await mountPattern('default', 'docs/src/react/PaginationDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  const variants = [...h.document.querySelectorAll('[data-pagination-surface]')];
  assert.deepEqual(
    new Set(variants.map(variant => variant.dataset.paginationSurface)),
    new Set(['solid', 'outline', 'tint', 'text', 'link']),
  );
  for (const variant of variants) {
    assert.equal(variant.querySelectorAll('.genux-pagination').length, 1);
    await h.click(buttonByText(variant, 'Next page'));
    assert.equal(variant.querySelector('[aria-current="page"]').textContent, '5');
    assert.ok(
      [...variant.querySelectorAll('button')].every(
        button => button.dataset.fill === variant.dataset.paginationSurface,
      ),
    );
  }
  assert.equal(
    h.document.querySelector('[data-pagination-primary] [aria-current="page"]').textContent,
    '42',
  );
});

test('note and jump drafts survive navigation, Tweaker size/surface changes and translation', async t => {
  const h = await mountPattern('default', 'docs/src/react/PaginationDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  const primary = h.document.querySelector('[data-pagination-primary]');
  const note = h.document.querySelector('[data-pagination-note]');
  const jump = primary.querySelector('input[aria-label="Go to page"]');
  await h.type(note, 'Keep review context');
  await h.type(jump, '12');
  await h.click(buttonByText(primary, 'Last page'));
  await h.click(h.document.querySelector('[data-tweaker-trigger]'));
  await h.click(h.document.querySelectorAll('[data-size-control] input[type="radio"]')[0]);
  await selectOption(
    h,
    h.document.querySelector('[data-pagination-button-surface] input'),
    'Outline',
  );
  assert.equal(primary.querySelector('[data-page-direction]').dataset.fill, 'outline');
  assert.equal(h.document.querySelector('[data-pagination-note]'), note);
  assert.equal(primary.querySelector('input[aria-label="Go to page"]'), jump);
  assert.equal(jump.value, '12');
  await h.act(() => h.setLocale('tr'));
  assert.equal(note.value, 'Keep review context');
  assert.equal(jump.value, '12');
  assert.equal(primary.querySelector('.genux-pagination').dataset.paginationCurrent, '50');
});
