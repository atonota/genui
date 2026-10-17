import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { mountPattern } from './harness.mjs';

// Local tree: repeated Review leaves, an accented leaf/ancestor keyword and a
// disabled branch whose descendants must never commit.
const tree = `[{value:'studio',label:'Studio',children:[{value:'design',label:'Design',children:[{value:'review',label:'Review',description:'Review design systems'}]},{value:'engineering',label:'Engineering',keywords:['Mühendislik'],children:[{value:'review',label:'Review',description:'Review release quality'},{value:'release',label:'Sürüm planning'}]},{value:'archive',label:'Archive',disabled:true,children:[{value:'old',label:'Old work'}]}]}]`;
// Long mixed English/Turkish segments for full-path search results.
const longTree = `[{value:'operations',label:'International Customer Experience Operations',children:[{value:'renewals',label:'Uluslararası Müşteri Sözleşmeleri ve Yenileme Süreçleri',children:[{value:'escalations',label:'Enterprise Escalation Review Coordination Workspace',description:'Kurumsal öncelikli inceleme ve yeniden değerlendirme süreci'}]}]}]`;
// The host reveals children only after the native lazy callback.
const collection = `revealed=>[{value:'collection',label:'Collection',isLeaf:false,...(revealed?{children:[{value:'records',label:'Records',children:[{value:'active',label:'Active records'},{value:'drafts',label:'Draft records'}]}]}:{})}]`;

async function fixture(t, mode = {}) {
  const {
    multiple = false,
    strategy = 'parent',
    disabled = false,
    changeOnSelect = false,
    initial = [],
    lazy = false,
    long = false,
    host,
  } = mode;
  const file = `docs/tests/.cascader-${randomUUID()}.tsx`;
  const selection = multiple
    ? `multiple checkedStrategy="${strategy}"`
    : changeOnSelect
      ? 'changeOnSelect'
      : '';
  const source = lazy
    ? 'searchable={false} loadData={path=>{setLoaded(path.join("/"));setRevealed(true)}}'
    : '';
  const options = lazy ? 'collection(revealed)' : long ? 'longTree' : 'tree';
  // A host-owned value update bypasses onChange, like data arriving from elsewhere.
  const update = host
    ? `<button type="button" data-host-value onClick={()=>setValue(${JSON.stringify(host)})}>Host update</button>`
    : '';
  await writeFile(
    file,
    `import{useState}from'react';import GenUXProvider from'../src/react/GenUXProvider';import GenUXCascader from'../src/react/GenUXCascader';const tree=${tree};const longTree=${longTree};const collection=${collection};export default function Demo(){const[value,setValue]=useState(${JSON.stringify(initial)});const[count,setCount]=useState(0);const[loaded,setLoaded]=useState('');const[revealed,setRevealed]=useState(false);return <GenUXProvider appearance="docs"><GenUXCascader label="Destination" options={${options}} ${selection} ${source} disabled={${disabled}} help="Choose a full path" value={value} onChange={next=>{setValue(next);setCount(n=>n+1)}}/><output data-value>{JSON.stringify(value)}</output><output data-count>{count}</output><output data-loaded>{loaded}</output>${update}</GenUXProvider>}`,
  );
  let h;
  t.after(async () => {
    await h?.dispose();
    await unlink(file);
  });
  h = await mountPattern('default', file);
  // Handler exceptions are reported to window by JSDOM rather than thrown here.
  const errors = [];
  h.window.addEventListener('error', event => errors.push(event.error ?? event.message));
  return Object.assign(h, { errors });
}

const field = h => h.document.querySelector('input[role="combobox"]');
const count = h => Number(h.document.querySelector('[data-count]').textContent);
const items = scope => [...scope.querySelectorAll('[role="treeitem"]')];
const item = (scope, title) => items(scope).find(node => node.title === title);
const sorted = paths => paths.map(path => JSON.stringify(path)).sort();
const ids = node => (node.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
function value(h) {
  const text = h.document.querySelector('[data-value]').textContent;
  return text === '' ? undefined : JSON.parse(text);
}

// Native Select opens on root mousedown, and Cascader items commit on click after
// a prevented mousedown. Emit the browser's complete primary-pointer sequence.
async function press(h, element) {
  if (!element) throw new Error('Press target missing');
  const Pointer = h.window.PointerEvent ?? h.window.MouseEvent;
  const init = { bubbles: true, cancelable: true, button: 0, buttons: 1 };
  const pointer = { ...init, pointerType: 'mouse', isPrimary: true };
  await h.act(async () => {
    element.dispatchEvent(new Pointer('pointerdown', pointer));
    const down = new h.window.MouseEvent('mousedown', init);
    element.dispatchEvent(down);
    if (!down.defaultPrevented) element.closest('input, button, [tabindex]')?.focus();
    element.dispatchEvent(new Pointer('pointerup', { ...pointer, buttons: 0 }));
    element.dispatchEvent(new h.window.MouseEvent('mouseup', { ...init, buttons: 0 }));
    element.click();
    await delay(5);
  });
}

// A real key press emits keyup too; native Select releases its Enter lock on keyup.
async function key(h, target, name, keyCode, extra = {}) {
  const init = { key: name, keyCode, which: keyCode, bubbles: true, cancelable: true, ...extra };
  const down = new h.window.KeyboardEvent('keydown', init);
  await h.act(async () => {
    target.dispatchEvent(down);
    target.dispatchEvent(new h.window.KeyboardEvent('keyup', init));
  });
  return down;
}

async function popup(h, input) {
  await h.waitFor(
    () =>
      input.getAttribute('aria-expanded') === 'true' &&
      h.document.getElementById(input.getAttribute('aria-controls') ?? ''),
    'combobox controls its open popup',
  );
  return h.document.getElementById(input.getAttribute('aria-controls'));
}

async function open(h, input) {
  await press(h, input);
  return popup(h, input);
}

// Popup nodes may be replaced across transitions; always inspect the tree the
// combobox controls now, never a reference cached before the transition.
async function current(h, input) {
  const tree = await popup(h, input);
  assert.ok(tree.isConnected, 'aria-controls resolves to the connected tree');
  assert.equal(tree.getAttribute('role'), 'tree');
  return tree;
}

test('full-path search combines ancestor and leaf terms and commits a stable path once', async t => {
  const h = await fixture(t);
  const input = field(h);
  await h.type(input, 'engineering review');
  const results = items(await popup(h, input));
  assert.deepEqual(
    results.map(node => node.title),
    ['Studio / Engineering / Review'],
  );
  assert.match(results[0].textContent, /Studio.*Engineering.*Review/s);
  assert.deepEqual(value(h), []);
  assert.equal(count(h), 0, 'typing does not commit');
  await press(h, results[0]);
  assert.deepEqual(value(h), ['studio', 'engineering', 'review']);
  assert.equal(count(h), 1);
  assert.equal(input.getAttribute('aria-expanded'), 'false');
});

test('search is accent-insensitive across local labels and ancestor keywords', async t => {
  const h = await fixture(t);
  const input = field(h);
  await h.type(input, 'surum');
  assert.deepEqual(
    items(await popup(h, input)).map(node => node.title),
    ['Studio / Engineering / Sürüm planning'],
  );
  await h.type(input, 'MUHENDISLIK review');
  assert.deepEqual(
    items(await popup(h, input)).map(node => node.title),
    ['Studio / Engineering / Review'],
  );
  assert.equal(count(h), 0);
});

test('repeated leaf names remain distinguishable by path, description and identity', async t => {
  const h = await fixture(t);
  const input = field(h);
  await h.type(input, 'review');
  const results = items(await popup(h, input));
  assert.deepEqual(
    results.map(node => node.title),
    ['Studio / Design / Review', 'Studio / Engineering / Review'],
  );
  assert.ok(results.every(node => node.id));
  assert.equal(new Set(results.map(node => node.id)).size, 2);
  assert.match(results[0].textContent, /Review design systems/);
  assert.match(results[1].textContent, /Review release quality/);
  await press(h, results[1]);
  assert.deepEqual(value(h), ['studio', 'engineering', 'review']);
  assert.equal(count(h), 1);
});

test('long English and Turkish full paths stay searchable, complete and stable', async t => {
  // JSDOM has no layout: wrapping and popup width containment are accepted in a
  // real 320 px browser run, never from zero-sized JSDOM rectangles.
  const h = await fixture(t, { long: true });
  const input = field(h);
  const title =
    'International Customer Experience Operations / Uluslararası Müşteri Sözleşmeleri ve Yenileme Süreçleri / Enterprise Escalation Review Coordination Workspace';
  const complete = result => {
    for (const segment of title.split(' / '))
      assert.ok(result.textContent.includes(segment), `result keeps "${segment}"`);
    assert.match(result.textContent, /Kurumsal öncelikli inceleme/);
    assert.doesNotMatch(result.textContent, /…|\.\.\./, 'labels are not shortened in text');
  };
  await h.type(input, 'customer sozlesmeleri escalation');
  let results = items(await popup(h, input));
  assert.deepEqual(
    results.map(node => node.title),
    [title],
  );
  complete(results[0]);
  await h.type(input, 'ULUSLARARASI yenileme surecleri');
  results = items(await popup(h, input));
  assert.deepEqual(
    results.map(node => node.title),
    [title],
  );
  complete(results[0]);
  assert.deepEqual(value(h), []);
  assert.equal(count(h), 0, 'typing does not commit');
  await press(h, results[0]);
  assert.deepEqual(value(h), ['operations', 'renewals', 'escalations']);
  assert.equal(count(h), 1);
  assert.ok(input.closest('[data-cascader-field]').textContent.includes(title));
  assert.deepEqual(h.errors, []);
});

test('pointer browsing opens levels without committing until a leaf is chosen', async t => {
  const h = await fixture(t);
  const input = field(h);
  const tree = await open(h, input);
  await press(h, item(tree, 'Studio'));
  await press(h, item(tree, 'Studio / Design'));
  assert.deepEqual(value(h), []);
  assert.equal(count(h), 0);
  await press(h, item(tree, 'Studio / Design / Review'));
  assert.deepEqual(value(h), ['studio', 'design', 'review']);
  assert.equal(count(h), 1);
  assert.equal(input.getAttribute('aria-expanded'), 'false');
});

test('native arrows browse choices and levels, Enter commits once and Escape keeps focus', async t => {
  const h = await fixture(t);
  const input = field(h);
  await h.act(async () => input.focus());
  await key(h, input, 'ArrowDown', 40);
  const tree = await popup(h, input);
  assert.equal(input.getAttribute('aria-haspopup'), 'tree');
  assert.equal(tree.getAttribute('role'), 'tree');
  const active = () => {
    const id = input.getAttribute('aria-activedescendant');
    const node = id && h.document.getElementById(id);
    assert.ok(node && tree.contains(node), 'active descendant is a real popup item');
    assert.equal(node.getAttribute('role'), 'treeitem');
    return node;
  };
  await key(h, input, 'ArrowDown', 40);
  assert.equal(active().title, 'Studio');
  assert.equal(active().getAttribute('aria-level'), '1');
  await key(h, input, 'ArrowRight', 39);
  assert.equal(active().title, 'Studio / Design');
  assert.equal(active().getAttribute('aria-level'), '2');
  assert.equal(item(tree, 'Studio').getAttribute('aria-expanded'), 'true');
  await key(h, input, 'ArrowDown', 40);
  assert.equal(active().title, 'Studio / Engineering');
  await key(h, input, 'ArrowDown', 40);
  assert.equal(active().title, 'Studio / Design', 'disabled Archive is skipped');
  await key(h, input, 'ArrowUp', 38);
  assert.equal(active().title, 'Studio / Engineering');
  await key(h, input, 'ArrowRight', 39);
  assert.equal(active().title, 'Studio / Engineering / Review');
  assert.equal(active().getAttribute('aria-level'), '3');
  await key(h, input, 'ArrowLeft', 37);
  assert.equal(active().title, 'Studio / Engineering');
  await key(h, input, 'ArrowRight', 39);
  assert.equal(active().title, 'Studio / Engineering / Review');
  assert.equal(
    tree.querySelectorAll('[role="menu"], [role="menuitem"], [role="menuitemcheckbox"]').length,
    0,
    'popup roles are valid for a tree combobox',
  );
  assert.ok(items(tree).every(node => node.hasAttribute('aria-level')));
  assert.equal(item(tree, 'Studio / Archive').getAttribute('aria-disabled'), 'true');
  assert.deepEqual(value(h), []);
  assert.equal(count(h), 0, 'arrow browsing does not commit');
  await key(h, input, 'Enter', 13);
  assert.deepEqual(value(h), ['studio', 'engineering', 'review']);
  assert.equal(count(h), 1);
  assert.equal(input.getAttribute('aria-expanded'), 'false');
  assert.equal(input.hasAttribute('aria-activedescendant'), false);
  assert.equal(h.document.activeElement, input);
  await key(h, input, 'Enter', 13);
  await popup(h, input);
  assert.equal(count(h), 1, 'Enter on a closed field only opens it');
  await key(h, input, 'Escape', 27);
  assert.equal(input.getAttribute('aria-expanded'), 'false');
  assert.equal(input.hasAttribute('aria-activedescendant'), false);
  assert.equal(h.document.activeElement, input);
  assert.deepEqual(value(h), ['studio', 'engineering', 'review']);
  assert.equal(count(h), 1);
});

test('popup guidance describes the combobox from outside the labelled tree', async t => {
  const h = await fixture(t);
  const input = field(h);
  const resolve = () => ids(input).map(id => h.document.getElementById(id));
  assert.ok(resolve().every(Boolean), 'a closed field has no dangling descriptions');
  await press(h, input);
  const guided = (tree, pattern) => {
    assert.equal(input.getAttribute('aria-controls'), tree.id);
    const name =
      tree.getAttribute('aria-label') ??
      (tree.getAttribute('aria-labelledby') ?? '')
        .split(/\s+/)
        .map(id => h.document.getElementById(id)?.textContent)
        .join(' ');
    assert.equal(name, 'Destination', 'the tree is named by its field');
    const descriptions = resolve();
    assert.ok(descriptions.every(Boolean), 'every description exists');
    assert.ok(
      descriptions.some(node => /Choose a full path/.test(node.textContent)),
      'help stays described',
    );
    const guidance = descriptions.find(node => pattern.test(node.textContent));
    assert.ok(guidance, 'open popup guidance is associated with the combobox');
    assert.equal(tree.contains(guidance), false, 'guidance is not owned by the tree');
    assert.equal(guidance.contains(tree), false, 'guidance does not describe the whole tree');
    assert.doesNotMatch(tree.textContent, pattern, 'the tree contains only levels and items');
  };
  guided(await current(h, input), /Escape closes/);
  // Searching may replace the popup content; check the tree controlled now.
  await h.type(input, 'review');
  guided(await current(h, input), /Escape closes/);
  await key(h, input, 'Escape', 27);
  assert.equal(input.getAttribute('aria-expanded'), 'false');
  assert.ok(resolve().every(Boolean), 'closing leaves no dangling descriptions');
  assert.equal(count(h), 0);
});

test('IME Enter preserves the search draft and does not commit the active result', async t => {
  const h = await fixture(t);
  const input = field(h);
  await h.type(input, 'engineering review');
  await popup(h, input);
  await key(h, input, 'ArrowDown', 40);
  await h.act(async () =>
    input.dispatchEvent(new h.window.CompositionEvent('compositionstart', { bubbles: true })),
  );
  await key(h, input, 'Enter', 13, { isComposing: true });
  assert.deepEqual(value(h), []);
  assert.equal(count(h), 0);
  assert.equal(input.value, 'engineering review');
  assert.equal(input.getAttribute('aria-expanded'), 'true');
  await h.act(async () =>
    input.dispatchEvent(new h.window.CompositionEvent('compositionend', { bubbles: true })),
  );
  await key(h, input, 'Enter', 13);
  assert.deepEqual(value(h), ['studio', 'engineering', 'review']);
  assert.equal(count(h), 1);
});

test('a host value update while open reconciles selected paths without a callback', async t => {
  const h = await fixture(t, {
    initial: ['studio', 'design', 'review'],
    host: ['studio', 'engineering', 'review'],
  });
  const input = field(h);
  const paths = ['Studio / Design / Review', 'Studio / Engineering / Review'];
  const selected = tree =>
    items(tree)
      .filter(node => node.getAttribute('aria-selected') === 'true')
      .map(node => node.title);
  const exclusive = tree =>
    assert.ok(
      items(tree).every(
        node =>
          ['true', 'false'].includes(node.getAttribute('aria-selected')) &&
          !node.hasAttribute('aria-checked'),
      ),
      'single selection exposes one current selected state per item',
    );
  // Search renders both repeated Review leaves in one native column.
  await h.type(input, 'review');
  let tree = await current(h, input);
  assert.deepEqual(
    items(tree).map(node => node.title),
    paths,
  );
  assert.deepEqual(selected(tree), ['Studio / Design / Review']);
  exclusive(tree);
  // A programmatic click has no outside mousedown, so the popup remains open.
  await h.click(h.document.querySelector('[data-host-value]'));
  assert.equal(input.getAttribute('aria-expanded'), 'true');
  assert.equal(input.value, 'review', 'the search draft is untouched');
  assert.deepEqual(value(h), ['studio', 'engineering', 'review']);
  assert.equal(count(h), 0, 'a host update is not a user change');
  tree = await current(h, input);
  assert.deepEqual(
    items(tree).map(node => node.title),
    paths,
  );
  assert.equal(item(tree, 'Studio / Design / Review').getAttribute('aria-selected'), 'false');
  assert.equal(item(tree, 'Studio / Engineering / Review').getAttribute('aria-selected'), 'true');
  assert.deepEqual(selected(tree), ['Studio / Engineering / Review']);
  exclusive(tree);
  assert.ok(items(tree).every(node => node.id));
  assert.equal(new Set(items(tree).map(node => node.id)).size, 2, 'paths keep distinct ids');
  await press(h, item(tree, 'Studio / Design / Review'));
  assert.deepEqual(value(h), ['studio', 'design', 'review']);
  assert.equal(count(h), 1);
  assert.deepEqual(h.errors, []);
});

test('empty results and disabled ancestor descendants cannot commit a path', async t => {
  const h = await fixture(t);
  const input = field(h);
  await h.type(input, 'not a destination');
  const tree = await popup(h, input);
  assert.match(tree.textContent, /No paths match/);
  await key(h, input, 'ArrowDown', 40);
  await key(h, input, 'Enter', 13);
  assert.deepEqual(value(h), []);
  await h.type(input, 'old work');
  const results = items(await popup(h, input));
  assert.deepEqual(
    results.map(node => node.title),
    ['Studio / Archive / Old work'],
  );
  assert.equal(results[0].getAttribute('aria-disabled'), 'true');
  assert.match(results[0].getAttribute('aria-label'), /Unavailable/);
  await press(h, results[0]);
  await key(h, input, 'Enter', 13);
  assert.deepEqual(value(h), []);
  assert.equal(count(h), 0);
});

test('multiple selection exposes mixed state, completes a branch, excludes disabled items and clears once', async t => {
  const h = await fixture(t, { multiple: true, initial: [['studio', 'design', 'review']] });
  const input = field(h);
  const tree = await open(h, input);
  assert.equal(tree.getAttribute('aria-multiselectable'), 'true');
  assert.equal(item(tree, 'Studio').getAttribute('aria-checked'), 'mixed');
  await press(h, item(tree, 'Studio'));
  assert.deepEqual(
    value(h),
    [['studio', 'design', 'review']],
    'opening a branch does not check it',
  );
  assert.equal(item(tree, 'Studio / Design').getAttribute('aria-checked'), 'true');
  assert.equal(item(tree, 'Studio / Engineering').getAttribute('aria-checked'), 'false');
  await press(h, item(tree, 'Studio / Engineering').querySelector('.ant-cascader-checkbox'));
  assert.deepEqual(value(h), [['studio']]);
  assert.equal(count(h), 1);
  assert.equal(item(tree, 'Studio').getAttribute('aria-checked'), 'true');
  const archive = item(tree, 'Studio / Archive');
  assert.equal(archive.getAttribute('aria-disabled'), 'true');
  assert.equal(archive.getAttribute('aria-checked'), 'false');
  await press(h, archive);
  assert.equal(item(tree, 'Studio / Archive / Old work'), undefined);
  await press(h, archive.querySelector('.ant-cascader-checkbox'));
  assert.deepEqual(value(h), [['studio']]);
  assert.equal(count(h), 1);
  await press(h, h.document.querySelector('button[aria-label="Clear value"]'));
  assert.deepEqual(value(h), []);
  assert.equal(count(h), 2);
  assert.deepEqual(h.errors, []);
});

test('child summaries return individual stable leaves and tag removal keeps full paths', async t => {
  const h = await fixture(t, {
    multiple: true,
    strategy: 'child',
    initial: [['studio', 'design', 'review']],
  });
  const input = field(h);
  const tree = await open(h, input);
  await press(h, item(tree, 'Studio'));
  await press(h, item(tree, 'Studio / Engineering').querySelector('.ant-cascader-checkbox'));
  const leaves = [
    ['studio', 'design', 'review'],
    ['studio', 'engineering', 'review'],
    ['studio', 'engineering', 'release'],
  ];
  assert.deepEqual(sorted(value(h)), sorted(leaves));
  assert.equal(count(h), 1);
  await key(h, input, 'Escape', 27);
  assert.equal(input.getAttribute('aria-expanded'), 'false');
  await key(h, input, 'Backspace', 8);
  const remaining = value(h);
  assert.equal(count(h), 2);
  assert.equal(remaining.length, 2);
  assert.ok(remaining.every(path => sorted(leaves).includes(JSON.stringify(path))));
});

test('single pointer clear normalizes native undefined to an empty path once', async t => {
  const h = await fixture(t, { initial: ['studio', 'design', 'review'] });
  const clear = h.document.querySelector('button[aria-label="Clear value"]');
  assert.ok(clear, 'clear is a named native button');
  await press(h, clear);
  assert.deepEqual(value(h), []);
  assert.equal(count(h), 1);
  assert.deepEqual(h.errors, []);
  assert.equal(field(h).getAttribute('aria-expanded'), 'false');
});

test('single keyboard clear keeps native activation and emits one empty path', async t => {
  const h = await fixture(t, { initial: ['studio', 'design', 'review'] });
  const clear = h.document.querySelector('button[aria-label="Clear value"]');
  assert.ok(clear);
  await h.act(async () => clear.focus());
  const enter = await key(h, clear, 'Enter', 13);
  assert.equal(enter.defaultPrevented, false, 'Enter remains the native button activation');
  assert.equal(field(h).getAttribute('aria-expanded'), 'false');
  assert.deepEqual(value(h), ['studio', 'design', 'review']);
  // JSDOM omits the browser's activation click after an unprevented Enter.
  await h.act(async () => clear.click());
  assert.deepEqual(value(h), []);
  assert.equal(count(h), 1);
  assert.deepEqual(h.errors, []);
});

test('disabled field preserves its path and has no usable clear action', async t => {
  const h = await fixture(t, { initial: ['studio', 'design', 'review'], disabled: true });
  const input = field(h);
  assert.equal(input.disabled, true);
  assert.match(input.closest('[data-cascader-field]').textContent, /Studio \/ Design \/ Review/);
  assert.equal(h.document.querySelector('button[aria-label="Clear value"]'), null);
  await press(h, input);
  assert.equal(input.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(value(h), ['studio', 'design', 'review']);
  assert.equal(count(h), 0);
});

test('changeOnSelect commits an intentional earlier branch', async t => {
  const h = await fixture(t, { changeOnSelect: true });
  const tree = await open(h, field(h));
  await press(h, item(tree, 'Studio'));
  assert.deepEqual(value(h), ['studio']);
  await press(h, item(tree, 'Studio / Engineering'));
  assert.deepEqual(value(h), ['studio', 'engineering']);
  assert.equal(count(h), 2);
});

test('browse-only lazy reveal passes stable paths to the host and commits only a chosen leaf', async t => {
  const h = await fixture(t, { lazy: true });
  const input = field(h);
  assert.equal(input.readOnly, true, 'lazy mode has no search draft');
  const tree = await open(h, input);
  await press(h, item(tree, 'Collection'));
  assert.equal(h.document.querySelector('[data-loaded]').textContent, 'collection');
  assert.deepEqual(value(h), []);
  assert.equal(count(h), 0);
  await h.waitFor(() => item(tree, 'Collection / Records'), 'host reveals local children');
  await press(h, item(tree, 'Collection / Records'));
  await press(h, item(tree, 'Collection / Records / Active records'));
  assert.deepEqual(value(h), ['collection', 'records', 'active']);
  assert.equal(count(h), 1);
});
