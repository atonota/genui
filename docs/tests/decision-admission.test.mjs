import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DECISION_PATH,
  GUARD_PATH,
  assertDecisionAdmission,
  captureDecisionSnapshot,
  checkCurrentDecisions,
} from '../../tools/docs-decisions.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const DEVICES = 'docs/src/data/preview-devices.ts';
const DEFINITIONS = 'docs/src/theme-builder/definitions.json';
const read = path => readFile(resolve(root, path), 'utf8');
const sha = text => createHash('sha256').update(text).digest('hex');
const count = (text, part) => text.split(part).length - 1;

test('decision admission keeps the current human facts and never writes', async () => {
  const watched = [DECISION_PATH, GUARD_PATH, DEVICES, DEFINITIONS];
  const before = await Promise.all(watched.map(async path => sha(await read(path))));
  const snapshot = await captureDecisionSnapshot(root);
  assert.equal(snapshot.path, DECISION_PATH);
  assert.equal(snapshot.digest, sha(await read(DECISION_PATH)));
  const fresh = { decisionDigest: snapshot.digest };

  // The device canvas is a human-locked role, independent of editable shell/panel recipes.
  const previewPaintPath = 'docs/src/styles/preview-document.css';
  const previewPaint = await read(previewPaintPath);
  await assert.rejects(
    checkCurrentDecisions(root, [
      {
        path: previewPaintPath,
        content: `${previewPaint}\n.example-preview-screen { --preview-screen-surface: #e6e2d7; }\n`,
      },
    ]),
    { code: 'decision-conflict', message: /preview-screen-surface/ },
  );
  await assert.rejects(
    checkCurrentDecisions(root, [
      {
        path: 'docs/src/styles/foreign-preview-surface.css',
        content:
          ".example-preview-screen[data-theme='dark'] { --preview-screen-surface: #000000; }",
      },
    ]),
    { code: 'decision-conflict', message: /preview-screen-surface/ },
  );
  const manifestEdit = {
    newFiles: [{ path: DECISION_PATH, content: await read(DECISION_PATH) }],
  };

  // A stale or missing digest is rejected first, before any other rule.
  await assert.rejects(
    assertDecisionAdmission(root, manifestEdit, { decisionDigest: '0'.repeat(64) }),
    { code: 'stale-decision' },
  );
  await assert.rejects(assertDecisionAdmission(root, manifestEdit, {}), {
    code: 'missing-decision-digest',
  });

  // A competing paint rule is forbidden even if it leaves the locked role declarations intact.
  await assert.rejects(
    checkCurrentDecisions(root, [
      {
        path: previewPaintPath,
        content: `${previewPaint}\n[data-preview-document][data-theme='dark'] { background: var(--panel); }\n`,
      },
    ]),
    { code: 'decision-conflict', message: /preview-screen-surface/ },
  );
  const providerPath = 'docs/src/react/GenUXProvider.tsx';
  const providerText = await read(providerPath);
  const styleHead = 'const sizeStyle: CSSProperties & Record<`--${string}`, string> = {';
  assert.equal(count(providerText, styleHead), 1);
  await assert.rejects(
    checkCurrentDecisions(root, [
      {
        path: providerPath,
        content: providerText.replace(
          styleHead,
          `${styleHead}\n'--preview-screen-surface': 'var(--paper)',`,
        ),
      },
    ]),
    { code: 'decision-conflict', message: /preview-screen-surface/ },
  );

  // A late spread cannot win over the screen paint, even when the canonical literal remains.
  const styleEnd = '  };\n  const builderTheme = useMemo(';
  assert.equal(count(providerText, styleEnd), 1);
  await assert.rejects(
    checkCurrentDecisions(root, [
      {
        path: providerPath,
        content: providerText.replace(
          styleEnd,
          "    ...(previewPaintVariables ? { backgroundColor: 'var(--panel)' } : {}),\n" + styleEnd,
        ),
      },
    ]),
    { code: 'decision-conflict', message: /preview-screen-surface/ },
  );
  // Read-only inspection consumes the role; it does not acquire paint ownership.
  await checkCurrentDecisions(root, [
    {
      path: providerPath,
      content:
        providerText +
        "\nfunction readPreviewSurface(owner: Element) { return getComputedStyle(owner).getPropertyValue('--preview-screen-surface'); }\n",
    },
  ]);

  // Author proposals never edit the human record or the guard, even when fresh.
  await assert.rejects(assertDecisionAdmission(root, manifestEdit, fresh), {
    code: 'protected-path',
  });
  await assert.rejects(
    assertDecisionAdmission(
      root,
      { replacements: [{ path: GUARD_PATH, old: 'export', new: 'export' }] },
      fresh,
    ),
    { code: 'protected-path' },
  );
  for (const [files, code] of [
    [[{ path: '/tmp/outside.ts', content: '' }], 'invalid-path'],
    [[{ path: '../outside.ts', content: '' }], 'invalid-path'],
    [
      [
        { path: 'docs/src/twice.ts', content: '' },
        { path: 'docs/src/twice.ts', content: '' },
      ],
      'duplicate-path',
    ],
  ])
    await assert.rejects(checkCurrentDecisions(root, files), { code });

  // A fresh digest and exact SHA context still cannot change a human fact.
  const devices = await read(DEVICES);
  const screen = devices.match(/fixedScreen\(\s*1440\s*,\s*900\s*,\s*1024\s*\)/)?.[0];
  assert.ok(screen, 'the MacBook fixed screen call is present');
  assert.equal(count(devices, screen), 1);
  // The coordinator's full-file candidates are checked like replacements, never ignored.
  const fullFile = content => ({
    summary: 'Valid unchanged proposal',
    files: [{ path: DEVICES, before: devices, content }],
  });
  await assert.rejects(
    assertDecisionAdmission(
      root,
      fullFile(devices.replace(screen, () => 'fixedScreen(1440, 900, 1280)')),
      fresh,
    ),
    { code: 'decision-conflict', message: /macbook container 1280px differs from human 1024px/ },
  );
  assert.equal(
    (await assertDecisionAdmission(root, fullFile(devices), fresh)).revision,
    snapshot.record.revision,
  );
  // The summary is string metadata only; other fields and mixed shapes still reject.
  for (const [extra, message] of [
    [{ summary: { text: 'Valid unchanged proposal' } }, /summary must be a string/],
    [{ notes: 'Valid unchanged proposal' }, /Unknown proposal fields: notes/],
    [{ newFiles: [] }, /not both/],
  ])
    await assert.rejects(assertDecisionAdmission(root, { ...fullFile(devices), ...extra }, fresh), {
      code: 'invalid-proposal',
      message,
    });
  // Facts come from parsed structure: a computed key or an inline spread cannot resize the screen.
  for (const override of ["['screenWidthPx']: 1600", '...{ screenWidthPx: 1600 }'])
    await assert.rejects(
      checkCurrentDecisions(root, [
        { path: DEVICES, content: devices.replace(screen, () => `${screen},\n  ${override}`) },
      ]),
      { code: 'decision-conflict', message: /macbook/ },
    );
  await assert.rejects(
    assertDecisionAdmission(
      root,
      {
        replacements: [
          {
            path: DEVICES,
            beforeSHA: sha(devices),
            old: screen,
            new: 'fixedScreen(1440, 900, 1280)',
          },
        ],
      },
      fresh,
    ),
    { code: 'decision-conflict', message: /macbook container 1280px differs from human 1024px/ },
  );
  // The helper is frozen geometry too: an unchanged fixedScreen(1440, 900, 1024) call cannot
  // hide a helper mutation, and each entry has one approved literal value without overrides.
  const helperHead = 'function fixedScreen(width: number, height: number, container = width) {';
  for (const [old, next, message] of [
    [
      'screenWidthPx: width,',
      'screenWidthPx: width + 160,',
      /fixed-screen: fixedScreen maps screenWidthPx to width \+ 160 instead of width/,
    ],
    [
      'containerWidthPx: container,',
      'containerWidthPx: 1280,',
      /fixed-screen: fixedScreen maps containerWidthPx to 1280 instead of container/,
    ],
    [
      helperHead,
      `${helperHead}\n  width = 1600;`,
      /fixed-screen: fixedScreen body must be exactly one return of an object literal/,
    ],
    [
      helperHead,
      helperHead.replace('width: number, height: number', 'height: number, width: number'),
      /fixed-screen: fixedScreen parameter 1 must be plain width/,
    ],
    [
      "value: 'ipad',",
      "value: 'surface',",
      /preview-devices: previewDevices has no ipad device for the human tablet surface/,
    ],
    ["  label: 'MacBook',", "  label: 'MacBook',\n  value: 'tv',", /exactly one value, found 2/],
    [
      "    label: 'iPhone',",
      "    label: 'iPhone',\n    ...{ value: 'tv' },",
      /may only spread fixedScreen/,
    ],
    [
      "    label: 'iPad',",
      "    label: 'iPad',\n    ['value']: 'tv',",
      /computed property \['value'\]/,
    ],
    [
      "  label: 'MacBook',",
      '  get label() { Object.assign(this, { screenWidthPx: 1600 }); return "MacBook"; },',
      /may only hold plain fields with primitive literal values, not get label\(\)/,
    ],
    [
      "  label: 'TV',",
      "  label: `${'T'}V`,",
      /may only hold plain fields with primitive literal values, not label: `/,
    ],
    [
      "    label: 'iPad',",
      "    label: String('iPad'),",
      /may only hold plain fields with primitive literal values, not label: String\('iPad'\)/,
    ],
    [
      "    label: 'iPhone',",
      "    label: 'iPhone',\n    label: 'Phone',",
      /a previewDevices entry repeats the field label/,
    ],
  ]) {
    assert.equal(count(devices, old), 1, `${old} is present exactly once`);
    await assert.rejects(
      checkCurrentDecisions(root, [{ path: DEVICES, content: devices.replace(old, () => next) }]),
      { code: 'decision-conflict', message },
    );
  }
  // Registry objects stay as initialized: a write after the initializers, an alias then a write
  // or a mutating call fails closed from the parsed structure, never by running the candidate.
  for (const [suffix, message] of [
    [
      'Object.assign(macbook, { screenWidthPx: 1600 });',
      /device-registry: .+:\d+ uses macbook outside/,
    ],
    [
      "Object.assign(previewDevices[0], { value: 'surface' });",
      /device-registry: .+:\d+ uses previewDevices outside/,
    ],
    [
      'const alias = macbook;\nalias.screenWidthPx = 1600;',
      /device-registry: .+:\d+ uses macbook outside/,
    ],
    [
      '(previewDevices as PreviewDeviceDefinition[]).push(tv);',
      /device-registry: .+:\d+ uses previewDevices outside/,
    ],
  ])
    await assert.rejects(
      checkCurrentDecisions(root, [{ path: DEVICES, content: `${devices}\n${suffix}\n` }]),
      { code: 'decision-conflict', message },
    );
  // A raw getter hands out the registry object itself, so previewDeviceDefinition must return a
  // detached copy of the one approved lookup: the old raw getter fails closed, directly or through
  // an imported alias. Mutating a detached copy cannot reach the protected facts.
  {
    const current = await read(DEVICES);
    const signature =
      'export function previewDeviceDefinition(device: PreviewDevice): PreviewDeviceDefinition {';
    assert.equal(count(current, signature), 1);
    const start = current.indexOf(signature);
    const end = current.indexOf('\n}\n', start) + 2;
    assert.ok(end > start);
    const rawGetter = `${signature}
  return previewDevices.find(item => item.value === device) ?? macbook;
}`;
    const raw = `${current.slice(0, start)}${rawGetter}${current.slice(end)}`;
    for (const files of [
      [
        {
          path: DEVICES,
          content: `${raw}\nObject.assign(previewDeviceDefinition('macbook'), { screenWidthPx: 1600 });\n`,
        },
      ],
      [
        { path: DEVICES, content: raw },
        {
          path: 'docs/src/react/DeviceGetterMutation.ts',
          content:
            "import { previewDeviceDefinition as definition } from '../data/preview-devices';\n\nObject.assign(definition('macbook'), { screenWidthPx: 1600 });\n",
        },
      ],
    ])
      await assert.rejects(checkCurrentDecisions(root, files), {
        code: 'decision-conflict',
        message: /device-registry: .+ previewDeviceDefinition must return a detached copy/,
      });
  }
  // The approved lookup is exact: an async callback, a callback parameter shadowing device or a
  // renamed getter parameter beside a module-level device keep the old shape yet select another
  // entry; the getter binding itself may only be declared and called directly.
  {
    const current = await read(DEVICES);
    const signature =
      'export function previewDeviceDefinition(device: PreviewDevice): PreviewDeviceDefinition {';
    const lookup = 'previewDevices.find(item => item.value === device)';
    assert.equal(count(current, signature), 1);
    assert.equal(count(current, lookup), 1);
    for (const candidate of [
      current.replace(lookup, () => 'previewDevices.find(async item => item.value === device)'),
      current.replace(lookup, () => 'previewDevices.find(device => device.value === device)'),
      current.replace(
        signature,
        () =>
          `const device: PreviewDevice = 'tv';

${signature.replace('(device:', '(kind:')}`,
      ),
    ])
      await assert.rejects(checkCurrentDecisions(root, [{ path: DEVICES, content: candidate }]), {
        code: 'decision-conflict',
        message: /device-registry: .+ previewDeviceDefinition must return a detached copy/,
      });
    await assert.rejects(
      checkCurrentDecisions(root, [
        {
          path: DEVICES,
          content: `${current}
previewDeviceDefinition = (device: PreviewDevice) => ({ value: device, screenWidthPx: 1600 }) as never;
`,
        },
      ]),
      {
        code: 'decision-conflict',
        message:
          /device-registry: .+:[0-9]+ uses previewDeviceDefinition other than its declaration or a direct call/,
      },
    );
  }
  // An imported previewDevices alias is only read through a map, never mutated.
  await assert.rejects(
    checkCurrentDecisions(root, [
      {
        path: 'docs/src/react/DeviceMutation.ts',
        content:
          "import { previewDevices as devices } from '../data/preview-devices';\n\nconst [first] = devices;\nObject.assign(first, { value: 'surface' });\n",
      },
    ]),
    {
      code: 'decision-conflict',
      message:
        /device-registry: docs\/src\/react\/DeviceMutation\.ts:3 uses the imported previewDevices other than a read-only map/,
    },
  );
  // A map callback reads only the own value and label fields: an inherited member cast to a
  // function and called would hand out the registry object itself.
  await assert.rejects(
    checkCurrentDecisions(root, [
      {
        path: 'docs/src/react/DeviceValueOf.ts',
        content: `import { previewDevices as devices } from '../data/preview-devices';

const raw = devices.map(item => (item.valueOf as () => any)());
Object.assign(raw[2], { screenWidthPx: 1600 });
`,
      },
    ]),
    {
      code: 'decision-conflict',
      message:
        /device-registry: .+DeviceValueOf.ts:3 uses the imported previewDevices other than a read-only map/,
    },
  );
  // A file importing the registry may not evaluate code: a direct eval inside an allowed map
  // sees the raw item, though the identifier scan only reads a string.
  await assert.rejects(
    checkCurrentDecisions(root, [
      {
        path: 'docs/src/react/DeviceEval.ts',
        content: `import { previewDevices as devices } from '../data/preview-devices';

const raw = devices.map(item => eval('item'));
Object.assign(raw[2], { screenWidthPx: 1600 });
`,
      },
    ]),
    {
      code: 'decision-conflict',
      message: /device-registry: .+DeviceEval\.ts:3 uses eval, which is not analyzed/,
    },
  );
  // The macbook array slot must stay the canonical binding: an inline copy with altered geometry
  // beside the untouched top-level const fails closed, since the lookup would select the copy.
  {
    const current = await read(DEVICES);
    const head = 'const macbook: PreviewDeviceDefinition = {';
    assert.equal(count(current, head), 1);
    const start = current.indexOf(head) + head.length - 1;
    const close = current.indexOf('\n};\n', start);
    assert.ok(close > start);
    const body = current.slice(start, close + 2);
    const approved = '...fixedScreen(1440, 900, 1024),';
    assert.equal(count(body, approved), 1);
    const copy = body.replace(approved, () => '...fixedScreen(1600, 900, 1280),');
    const slot = '  macbook,\n';
    assert.equal(count(current, slot), 1);
    const candidate = current.replace(slot, () => `  ${copy},\n`);
    assert.equal(count(candidate, head), 1);
    await assert.rejects(checkCurrentDecisions(root, [{ path: DEVICES, content: candidate }]), {
      code: 'decision-conflict',
      message: /canonical macbook binding/,
    });
  }
  // Only the canonical macbook and tv bindings may be named in the list: an extracted iphone
  // const keeps a valid initializer, yet a later write turns it into a second macbook.
  {
    const current = await read(DEVICES);
    const head = "value: 'iphone',";
    assert.equal(count(current, head), 1);
    const start = current.lastIndexOf('{', current.indexOf(head));
    const close = current.indexOf('\n  },', start);
    assert.ok(start >= 0 && close > start);
    const entry = current.slice(start, close + 4);
    assert.equal(count(current, entry), 1);
    const anchor = 'export const DEFAULT_PREVIEW_DEVICE';
    assert.equal(count(current, anchor), 1);
    const candidate = current
      .replace(entry, () => 'iphone')
      .replace(anchor, () => `const iphone: PreviewDeviceDefinition = ${entry};\n\n${anchor}`);
    const write =
      "Object.assign(iphone, { value: 'macbook', screenWidthPx: 1600, containerWidthPx: 1280 });";
    await assert.rejects(
      checkCurrentDecisions(root, [{ path: DEVICES, content: `${candidate}\n${write}\n` }]),
      {
        code: 'decision-conflict',
        message:
          /previewDevices entries may only name the canonical macbook or tv binding, not iphone/,
      },
    );
  }
  // The raw macbook and tv objects stay private: an exported binding imported under an alias
  // elsewhere could be mutated beyond the reach of the previewDevices import scan.
  {
    const current = await read(DEVICES);
    const head = 'const macbook: PreviewDeviceDefinition = {';
    assert.equal(count(current, head), 1);
    await assert.rejects(
      checkCurrentDecisions(root, [
        { path: DEVICES, content: current.replace(head, () => `export ${head}`) },
        {
          path: 'docs/src/react/DeviceRawMutation.ts',
          content:
            "import { macbook as alias } from '../data/preview-devices';\n\nObject.assign(alias, { screenWidthPx: 1600 });\n",
        },
      ]),
      {
        code: 'decision-conflict',
        message:
          /device-registry: .+ exports macbook; the raw registry binding must remain private/,
      },
    );
  }
  const definitions = JSON.parse(await read(DEFINITIONS));
  definitions.find(item => item.id === 'canvas').defaults.dark = '#111111';
  await assert.rejects(
    checkCurrentDecisions(root, [
      { path: DEFINITIONS, content: `${JSON.stringify(definitions, null, 2)}\n` },
    ]),
    {
      code: 'decision-conflict',
      message: /palette canvas\.dark default #111111 differs from human #000000/,
    },
  );
  await assert.rejects(
    checkCurrentDecisions(root, [
      {
        path: 'docs/src/react/LegacyFrame.tsx',
        content: 'export const LegacyFrame = () => <iframe title="Legacy" />;\n',
      },
    ]),
    { code: 'decision-conflict', message: /LegacyFrame\.tsx:1 renders an <iframe>/ },
  );

  // Current sources pass, and an unrelated comment naming old values is not a fact.
  assert.equal((await checkCurrentDecisions(root)).digest, snapshot.digest);
  const firstLine = devices.slice(0, devices.indexOf('\n') + 1);
  assert.equal(count(devices, firstLine), 1);
  const admitted = await assertDecisionAdmission(
    root,
    {
      replacements: [
        {
          path: DEVICES,
          beforeSHA: sha(devices),
          old: firstLine,
          new: `// Historical note: container 1280px, rails 240px.\n${firstLine}`,
        },
      ],
      newFiles: [],
    },
    fresh,
  );
  assert.equal(admitted.revision, snapshot.record.revision);

  // The guard only reads.
  assert.deepEqual(await Promise.all(watched.map(async path => sha(await read(path)))), before);
});
