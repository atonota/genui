import assert from 'node:assert/strict';
import test from 'node:test';
import { mountPattern, mountStory } from './harness.mjs';

const surfaces = [
  {
    name: 'documentation',
    input: () => mountPattern('WebInputDemo', 'docs/src/react/InputDemo.tsx'),
    select: () => mountPattern('WebSelectDemo', 'docs/src/react/SelectDemo.tsx'),
  },
  {
    name: 'Storybook CSF and preview',
    input: () => mountStory('storybook/Input.stories.tsx'),
    select: () => mountStory('storybook/Select.stories.tsx'),
  },
];

for (const surface of surfaces) {
  test(`${surface.name}: quantity uses the master stepper and locale changes preserve its draft`, async t => {
    const h = await surface.input();
    t.after(() => h.dispose());
    if (surface.name.startsWith('Storybook'))
      assert.ok(
        h.document.querySelector('.atlas-story-frame .live-preview'),
        'shared field stylesheet scope',
      );
    const input = h.document.querySelector('#input-number');
    const owner = input.closest('.atlas-number-stepper');
    assert.ok(owner, 'quantity must compose the shared stepper');
    assert.equal(owner.querySelectorAll('svg[data-icon-library="phosphor"]').length, 2);
    assert.equal(input.value, '1');
    await h.click(owner.querySelector('button[aria-label="Increase"]'));
    assert.equal(input.value, '2');
    const draft = h.document.querySelector('#input-filled');
    await h.type(draft, 'Keep my draft');
    await h.act(async () => {
      draft.focus();
      draft.setSelectionRange(2, 6);
      await h.setLocale('tr');
    });
    assert.equal(h.document.querySelector('#input-number'), input);
    assert.equal(input.value, '2');
    assert.equal(h.document.activeElement, draft);
    assert.equal(draft.value, 'Keep my draft');
    assert.deepEqual([draft.selectionStart, draft.selectionEnd], [2, 6]);
    await h.act(async () => h.setLocale('en'));
    assert.equal(draft.value, 'Keep my draft');
  });

  test(`${surface.name}: master Pill removal stays isolated and translated labels select stable options`, async t => {
    const h = await surface.select();
    t.after(() => h.dispose());
    if (surface.name.startsWith('Storybook'))
      assert.ok(h.document.querySelector('.atlas-story-frame .live-preview'));
    const multiple = h.document.querySelector('#select-multiple');
    const owner = multiple.closest('.ant-select');
    assert.equal(owner.querySelectorAll('.atlas-pill').length, 2);
    for (const key of ['Enter', ' ']) {
      const close = owner.querySelector('.atlas-pill-close');
      const count = owner.querySelectorAll('.atlas-pill').length;
      await h.act(async () => {
        close.focus();
        close.dispatchEvent(
          new h.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
        );
      });
      assert.equal(owner.querySelectorAll('.atlas-pill').length, count - 1);
      assert.equal(multiple.getAttribute('aria-expanded'), 'false');
      assert.equal(h.document.activeElement, multiple);
    }
    const tags = h.document.querySelector('#select-tags');
    const tagOwner = tags.closest('.ant-select');
    for (const [locale, label] of [
      ['en', 'Engineering'],
      ['tr', 'Mühendislik'],
    ]) {
      await h.act(async () => h.setLocale(locale));
      assert.equal(h.document.querySelector('#select-tags'), tags);
      if (tagOwner.querySelector('.atlas-pill')) {
        assert.equal(tagOwner.querySelector('.atlas-pill-label').textContent, label);
        await h.click(tagOwner.querySelector('.atlas-pill-close'));
      }
      await h.act(async () =>
        tags
          .closest('.ant-select')
          .dispatchEvent(new h.window.MouseEvent('mousedown', { bubbles: true, cancelable: true })),
      );
      await h.type(tags, label);
      const options = () => {
        const list = h.document.getElementById(tags.getAttribute('aria-controls'));
        return [
          ...(list
            ?.closest('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
            ?.querySelectorAll('.ant-select-item-option') ?? []),
        ];
      };
      await h.waitFor(
        () => options().some(option => option.textContent.trim() === label),
        'translated visible option',
      );
      const matches = options().filter(option => option.textContent.trim() === label);
      assert.equal(matches.length, 1, 'no duplicate free-tag option for an existing label');
      await h.click(matches[0]);
      await h.act(async () =>
        tags.dispatchEvent(
          new h.window.KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
        ),
      );
      assert.equal(tagOwner.querySelectorAll('.atlas-pill').length, 1);
      assert.equal(tagOwner.querySelector('.atlas-pill-label').textContent, label);
    }
  });
}

test('unflagged Storybook controls retain their native demo scope', async () => {
  for (const component of ['Checkbox', 'Radio', 'Switch']) {
    const h = await mountStory(`storybook/${component}.stories.tsx`);
    try {
      assert.ok(h.document.querySelector('.atlas-story-frame .atlas-demo'), component);
      assert.equal(h.document.querySelector('.atlas-story-frame .live-preview'), null, component);
      assert.equal(h.document.querySelector('.atlas-story-toolbar .live-preview'), null, component);
    } finally {
      await h.dispose();
    }
  }
});
