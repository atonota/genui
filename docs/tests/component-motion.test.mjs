import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import postcss from 'postcss';

const files = [
  'atlas-splitter.css',
  'atlas-breadcrumb.css',
  'breadcrumb-catalog.css',
  'splitter-catalog.css',
  'card-catalog.css',
  'atlas-dropdown.css',
  'dropdown-catalog.css',
  'atlas-card.css',
  'genui-card-lab.css',
  'genui-runtime.css',
  'atlas-pagination.css',
  'pagination-catalog.css',
  'atlas-steps.css',
  'steps-catalog.css',
  'atlas-autocomplete.css',
  'autocomplete-catalog.css',
  'atlas-cascader.css',
  'cascader-catalog.css',
  'atlas-selection-variants.css',
  'atlas-feedback.css',
  'atlas-drawer-extensions.css',
  'atlas-date-time.css',
  'atlas-media.css',
  'atlas-screenshot.css',
  'atlas-content-patterns.css',
  'atlas-carousel.css',
  'atlas-upload.css',
  'atlas-rich-menu.css',
  'atlas-chart.css',
  'kit-identity.css',
];
function motionFailures(source) {
  const failures = [];
  postcss.parse(source).walkDecls(declaration => {
    let reduced = false;
    for (let parent = declaration.parent; parent; parent = parent.parent)
      if (
        parent.type === 'atrule' &&
        parent.name === 'media' &&
        /prefers-reduced-motion:\s*reduce/.test(parent.params)
      )
        reduced = true;
    if (reduced) return;
    const { prop, value } = declaration;
    if (prop === 'transition-timing-function' && value !== 'var(--motion-easing)')
      failures.push(prop);
    if (
      prop === 'transition-duration' &&
      value !== 'var(--transition-duration)' &&
      !/^var\(--motion-duration-[\w-]+\)$/.test(value)
    )
      failures.push(prop);
    if (prop === 'transition-delay' && value !== 'var(--motion-delay)') failures.push(prop);
    if (
      prop === 'animation' &&
      (!value.includes('var(--motion-easing)') || !/var\(--motion-duration-[\w-]+\)/.test(value))
    )
      failures.push(prop);
    if (prop === 'transition' && value !== 'var(--control-transition)') failures.push(prop);
  });
  return failures;
}

test('new Splitter, Breadcrumb and changed Card layers consume central positive symmetric motion', async () => {
  const motion = JSON.parse(
    await readFile(new URL('../src/data/motion.json', import.meta.url), 'utf8'),
  );
  assert.equal(motion.easing, 'cubic-bezier(0.65, 0, 0.35, 1)');
  assert.equal(motion.delayMs, 0);
  const aliases = postcss.parse(
    await readFile(new URL('../src/styles/docs.css', import.meta.url), 'utf8'),
  );
  let aliasFound = false;
  aliases.walkDecls('--transition-duration', declaration => {
    let reduced = false;
    for (let parent = declaration.parent; parent; parent = parent.parent)
      if (
        parent.type === 'atrule' &&
        parent.name === 'media' &&
        /prefers-reduced-motion:\s*reduce/.test(parent.params)
      )
        reduced = true;
    if (reduced) {
      assert.equal(declaration.value, '0ms');
      return;
    }
    assert.equal(declaration.value, 'var(--motion-duration-standard)');
    aliasFound = true;
  });
  assert.ok(aliasFound, 'the Card duration alias resolves to the central standard token');
  for (const duration of Object.values(motion.durationMs))
    assert.ok(Number.isFinite(duration) && duration > 0);
  for (const file of files)
    assert.deepEqual(
      motionFailures(await readFile(new URL('../src/styles/' + file, import.meta.url), 'utf8')),
      [],
      file,
    );
});

test('component motion gate rejects local, asymmetric and zero normal motion while retaining the reduced-motion exception', () => {
  for (const declaration of [
    'transition-timing-function:ease-out',
    'transition-timing-function:linear',
    'transition-duration:0ms',
    'transition-duration:200ms',
    'transition-delay:50ms',
    'animation:fade 1s linear',
    'transition:all 1s ease',
  ])
    assert.ok(motionFailures('.new-component{' + declaration + '}').length, declaration);
  assert.deepEqual(
    motionFailures(
      '@media(prefers-reduced-motion:reduce){.new-component{transition-duration:0ms;animation:none}}',
    ),
    [],
  );
  assert.deepEqual(
    motionFailures(
      '.new-component{transition-duration:var(--motion-duration-standard);transition-timing-function:var(--motion-easing);transition-delay:var(--motion-delay)}',
    ),
    [],
  );
});
