import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root, sha256 } from './build.mjs';

// Compatibility patch for @rc-component/picker@1.12.2; no newer ~1.12 release fixes it.
// A Tab field-switch away from an empty RangePicker field that does not allow empty resolved
// to 'resetCurrent' ('abort' with needConfirm), which kept the old currentIndex so
// useFocusLock pulled focus back. The patch resolves that switch to the existing
// 'resetCurrentAndSwitchNext' action before the needConfirm branch: the empty draft is
// discarded, currentIndex follows the focused field, nothing is submitted and allowEmpty is
// unchanged. Valid-field transitions are untouched.
// Remove this helper and its package.json wiring when the picker dependency is upgraded.
// Any other version or source fails closed; every file is validated before writing.
const version = '1.12.2';
const dir = 'node_modules/@rc-component/picker';
const targets = [
  {
    path: `${dir}/lib/PickerInput/hooks/useRangeValueChange.js`,
    before_sha256: 'a6c8e9945225515a75fd7b3460d2a4e4d1465d9ca532d98b6e68581ddea2c5d4',
  },
  {
    path: `${dir}/es/PickerInput/hooks/useRangeValueChange.js`,
    before_sha256: 'a4048e8b6a91bc0efea826ada2e421b2915b447a018e0d20c0d26a6dbf08b60b',
  },
];
// Installed sources use LF; a real newline avoids escape mistakes in the anchor text.
const nl = String.fromCharCode(10);
const guard = ['      if (index !== nextIndex) {', "        return 'abort';", '      }'];
const focusSwitch = [
  '      // GenUX compatibility patch (tools/patch-picker-focus.mjs): an empty field that does',
  '      // not allow empty discards its draft and follows the focused next field unsubmitted.',
  '      if (currentEmpty && !allowEmpty[currentIndex]) {',
  "        return 'resetCurrentAndSwitchNext';",
  '      }',
];
const tail =
  '      const nextFieldTriggered = triggeredFieldsRef.current.some(field => field.index === nextIndex);';
const old = [...guard, tail].join(nl);
const patched = [...guard, ...focusSwitch, tail].join(nl);

const pkg = JSON.parse(await readFile(resolve(root, `${dir}/package.json`), 'utf8'));
if (pkg.version !== version)
  throw new Error(`Re-review picker focus patch for @rc-component/picker@${pkg.version}`);
const writes = [];
for (const target of targets) {
  const file = resolve(root, target.path),
    source = await readFile(file, 'utf8');
  const applied =
    source.split(patched).length === 2 &&
    source.split(old).length === 1 &&
    sha256(source.replace(patched, () => old)) === target.before_sha256;
  if (applied) continue;
  if (sha256(source) !== target.before_sha256 || source.split(old).length !== 2)
    throw new Error(`Picker source drift: ${target.path}`);
  const next = source.replace(old, () => patched);
  if (next.split(patched).length !== 2 || next.split(old).length !== 1)
    throw new Error(`Invalid patch: ${target.path}`);
  writes.push({ file, next });
}
for (const { file, next } of writes) await writeFile(file, next);
console.log(JSON.stringify({ picker_focus_files_patched: writes.length }));
