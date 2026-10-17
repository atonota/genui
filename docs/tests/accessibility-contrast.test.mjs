import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import postcss from 'postcss';
import { mountPattern } from './harness.mjs';

const compiled = await build({
  stdin: {
    contents:
      "export {docsAccessibleThemeColors as themeColors,docsAccessibilityVariables} from './docs/src/data/accessibility';export {contrastRatio} from './docs/src/data/color-system';export {docsBrandColors} from './docs/src/data/docs-brand';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
});
const { themeColors, contrastRatio, docsBrandColors, docsAccessibilityVariables } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].contents).toString('base64')
);
const composite = (fg, bg, alpha) =>
  '#' +
  fg
    .slice(1)
    .match(/../g)
    .map((value, index) =>
      Math.round(
        parseInt(value, 16) * alpha + parseInt(bg.slice(1).match(/../g)[index], 16) * (1 - alpha),
      )
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

test('documentation input appearance retains the exact final user opacity values', () => {
  for (const mode of ['light', 'dark']) {
    const values = docsAccessibilityVariables(mode);
    assert.equal(values['--docs-placeholder-opacity'], '0.75');
    assert.equal(values['--docs-placeholder-active-opacity'], '0.75');
    assert.equal(values['--docs-placeholder-hover-opacity'], '0.5');
    assert.equal(values['--docs-input-underline-opacity'], '0.5');
    assert.doesNotMatch(values['--docs-input-transition-properties'], /box-shadow/);
  }
});

test('readable placeholders keep4.5 contrast at rest and focus on both field surfaces in both themes', async () => {
  const css = postcss.parse(await readFile('docs/src/styles/web.css', 'utf8'));
  const approved = {};
  css.walkDecls(decl => {
    if (['--placeholder-opacity', '--placeholder-active-opacity'].includes(decl.prop))
      approved[decl.prop] = Number(decl.value);
  });
  assert.deepEqual(approved, { '--placeholder-opacity': 0.7, '--placeholder-active-opacity': 0.5 });
  const sheet = postcss.parse(await readFile('docs/src/styles/docs-accessibility.css', 'utf8'));
  const values = {};
  sheet.walkDecls(decl => {
    if (!['--placeholder-opacity', '--placeholder-active-opacity'].includes(decl.prop)) return;
    assert.match(decl.parent.selector, /body\[data-genux-surface='docs'\]/);
    assert.match(decl.parent.selector, /\[data-genux-appearance='docs'\]/);
    const variable = decl.value.match(/^var\((--docs-placeholder(?:-active)?-opacity)\)$/)?.[1];
    assert.ok(variable, 'documentation alpha comes from its central accessibility roles');
    values[decl.prop] = Number(docsAccessibilityVariables('light')[variable]);
  });
  // Documentation uses native owner rules rather than inherited aliases, so a
  // nested approved provider retains its original .7/.5 placeholder profile.
  assert.equal(Object.keys(values).length, 0);
  values.rest = Number(docsAccessibilityVariables('light')['--docs-placeholder-opacity']);
  values.focus = Number(docsAccessibilityVariables('light')['--docs-placeholder-active-opacity']);
  for (const [mode, colors] of Object.entries(themeColors))
    for (const bg of [colors.fieldBg, colors.fieldHoverBg])
      for (const [name, alpha] of Object.entries(values)) {
        const ratio = contrastRatio(composite(colors.ink, bg, alpha), bg);
        assert.ok(ratio >= 4.5, `${mode} ${name} on ${bg}: ${ratio.toFixed(3)} <4.5`);
      }
});

test('native documentation control boundaries identify controls at3to1 on every supported surface', async t => {
  const file = `docs/tests/.a11y-tokens-${randomUUID()}.tsx`;
  await writeFile(
    file,
    `import {theme} from 'antd';import {genuxDocsTheme,genuxDocsDarkTheme} from '../src/react/GenUXProvider';export default function Probe(){return <output>{JSON.stringify({light:theme.getDesignToken(genuxDocsTheme),dark:theme.getDesignToken(genuxDocsDarkTheme)})}</output>;}`,
  );
  let h;
  try {
    h = await mountPattern('default', file);
  } catch (error) {
    await unlink(file);
    throw error;
  }
  t.after(async () => {
    await h.dispose();
    await unlink(file);
  });
  const tokens = JSON.parse(h.document.querySelector('output').textContent);
  for (const mode of ['light', 'dark'])
    for (const bg of ['paper', 'panel', 'surface', 'fieldBg', 'fieldHoverBg'].map(
      key => themeColors[mode][key],
    )) {
      const ratio = contrastRatio(tokens[mode].colorBorder, bg);
      assert.ok(ratio >= 3, `${mode} native control edge on ${bg}: ${ratio.toFixed(3)} <3`);
      assert.ok(
        contrastRatio(tokens[mode].colorIcon, bg) >= 3,
        `${mode} native actionable icon on ${bg}`,
      );
    }
});

test(
  'native documentation status text consumes readable emitted roles in live, portal and local themes',
  { timeout: 5000 },
  async t => {
    const roles = ['Error', 'Warning', 'Success', 'Info'].flatMap(status =>
      ['', 'Text', 'TextHover', 'TextActive'].map(suffix => `color${status}${suffix}`),
    );
    const file = `docs/tests/.a11y-native-status-${randomUUID()}.tsx`;
    await writeFile(
      file,
      `import {ConfigProvider,Form,Input,Tag,Typography,theme} from 'antd';
import {useState} from 'react';
import {createPortal} from 'react-dom';
import GenUXProvider,{genuxDocsTheme,genuxDocsDarkTheme} from '../src/react/GenUXProvider';
const roles=${JSON.stringify(roles)};
function StatusSurface({id,mode}:{id:string;mode?:'light'|'dark'}){const{token}=theme.useToken();return <div data-native-status-scope={id} data-native-status-mode={mode}><output>{JSON.stringify(Object.fromEntries(roles.map(key=>[key,(token as unknown as Record<string,unknown>)[key]])))}</output><Form layout="vertical"><Form.Item name="error" label="Error" validateStatus="error" help="Native error message"><Input/></Form.Item><Form.Item name="warning" label="Warning" validateStatus="warning" help="Native warning message"><Input/></Form.Item></Form><Typography.Text type="success" data-native-status="success">Success message</Typography.Text><Typography.Text type="danger" data-native-status="error-text">Error text</Typography.Text><Typography.Text type="warning" data-native-status="warning-text">Warning text</Typography.Text><Tag color="processing" data-native-status="info">Information</Tag></div>}
export default function Probe(){const[mode,setMode]=useState<'light'|'dark'>('light');return <div className="live-preview"><GenUXProvider appearance="docs"><StatusSurface id="live"/>{createPortal(<div className="genux-demo"><StatusSurface id="portal"/></div>,document.body)}<button onClick={()=>setMode('light')}>Native local light</button><button onClick={()=>setMode('dark')}>Native local dark</button><ConfigProvider theme={{...(mode==='dark'?genuxDocsDarkTheme:genuxDocsTheme),inherit:false,cssVar:{key:'css-var-genux-status-preview'}}}><StatusSurface id="local" mode={mode}/></ConfigProvider></GenUXProvider></div>}`,
    );
    let h;
    try {
      h = await mountPattern('default', file);
    } catch (error) {
      await unlink(file);
      throw error;
    }
    t.after(async () => {
      await h.dispose();
      await unlink(file);
    });
    h.document.body.dataset.genuxSurface = 'docs';
    const variableName = name =>
      '--ant-' + name.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
    const nativeConsumers = [
      ['.ant-form-item-explain-error', 'colorError'],
      ['.ant-form-item-explain-warning', 'colorWarning'],
      ['[data-native-status="success"]', 'colorSuccessText'],
      ['[data-native-status="error-text"]', 'colorErrorText'],
      ['[data-native-status="warning-text"]', 'colorWarningText'],
      ['[data-native-status="info"]', 'colorInfo'],
    ];
    const failures = [];
    for (const mode of ['dark', 'light']) {
      await h.act(async () => {
        h.document.documentElement.dataset.theme = mode;
        h.window.dispatchEvent(new h.window.Event('genux-theme-change'));
      });
      const local = mode === 'dark' ? 'light' : 'dark';
      await h.click(
        [...h.document.querySelectorAll('button')].find(
          node => node.textContent === `Native local ${local}`,
        ),
      );
      const sheets = [...h.document.querySelectorAll('style')].map(style =>
        postcss.parse(style.textContent),
      );
      for (const scope of h.document.querySelectorAll('[data-native-status-scope]')) {
        const scopeMode = scope.dataset.nativeStatusMode || mode;
        const realTokens = JSON.parse(scope.querySelector('output').textContent);
        const owner = scope.querySelector('.ant-form');
        const key = [...owner.classList].find(name => name.startsWith('css-var-'));
        assert.ok(key, 'the actual native Form declares its theme variable owner');
        const emitted = {};
        for (const sheet of sheets)
          sheet.walkRules(rule => {
            if (rule.selector !== `.${key}`) return;
            rule.walkDecls(decl => {
              emitted[decl.prop] = decl.value;
            });
          });
        for (const [selector, role] of nativeConsumers) {
          const consumer = scope.querySelector(selector);
          assert.ok(
            consumer,
            `${scope.dataset.nativeStatusScope}: actual ${role} consumer is mounted`,
          );
          let consumesRole = false;
          for (const sheet of sheets)
            sheet.walkRules(rule => {
              const color = rule.nodes.find(
                node =>
                  node.type === 'decl' &&
                  node.prop === 'color' &&
                  node.value === `var(${variableName(role)})`,
              );
              if (color && !rule.selector.includes('::') && consumer.matches(rule.selector))
                consumesRole = true;
            });
          assert.ok(consumesRole, `${selector}: native CSS must consume ${variableName(role)}`);
        }
        for (const role of roles) {
          const ink = emitted[variableName(role)];
          assert.match(
            ink ?? '',
            /^#[\da-f]{6}$/i,
            `${scopeMode}/${role}: native emitted color missing`,
          );
          assert.equal(
            ink,
            realTokens[role],
            `${scopeMode}/${role}: emitted color differs from native resolved token`,
          );
          for (const surface of ['paper', 'panel', 'surface', 'fieldBg', 'fieldHoverBg']) {
            const background = themeColors[scopeMode][surface];
            const ratio = contrastRatio(ink, background);
            if (ratio < 4.5)
              failures.push(
                `${mode}/${scope.dataset.nativeStatusScope}/${scopeMode}: ${role} ${ink} on ${surface} ${background} = ${ratio.toFixed(4)} <4.5`,
              );
          }
        }
      }
    }
    assert.deepEqual(failures, [], 'native emitted status text must meet normal-text contrast');
  },
);

test('native mixed Checkbox marks contrast with their actual container in live, portal and local themes', async t => {
  const file = `docs/tests/.a11y-mixed-${randomUUID()}.tsx`;
  await writeFile(
    file,
    `import {Checkbox,ConfigProvider,theme} from 'antd';
import {useState} from 'react';
import {createPortal} from 'react-dom';
import GenUXProvider,{genuxDocsTheme,genuxDocsDarkTheme} from '../src/react/GenUXProvider';
import {docsAccessibleThemeColors,docsAccessibilityVariables} from '../src/data/accessibility';
function Surface({id,mode}:{id:string;mode?:'light'|'dark'}){const{token}=theme.useToken();return <div data-mixed-scope={id} data-mixed-mode={mode}><output>{JSON.stringify({container:token.colorBgContainer,ink:token.colorText})}</output><Checkbox indeterminate>Mixed</Checkbox><Checkbox indeterminate disabled>Disabled mixed</Checkbox></div>}
export default function Probe(){const[mode,setMode]=useState<'light'|'dark'>('light');return <div className="live-preview"><GenUXProvider appearance="docs"><Surface id="live"/>{createPortal(<div className="genux-demo"><Surface id="portal"/></div>,document.body)}<button onClick={()=>setMode('light')}>Local light</button><button onClick={()=>setMode('dark')}>Local dark</button><ConfigProvider theme={{...(mode==='dark'?genuxDocsDarkTheme:genuxDocsTheme),inherit:false,cssVar:{key:'css-var-genux-color-preview'}}}><div style={{...docsAccessibilityVariables(mode),'--ink':docsAccessibleThemeColors[mode].ink,'--selection-mark-ink':mode==='dark'?'#000000':'#FFFFFF'}}><Surface id="local" mode={mode}/></div></ConfigProvider></GenUXProvider></div>}`,
  );
  let h;
  try {
    h = await mountPattern('default', file);
  } catch (error) {
    await unlink(file);
    throw error;
  }
  t.after(async () => {
    await h.dispose();
    await unlink(file);
  });
  h.document.body.dataset.genuxSurface = 'docs';
  const native = await readFile('node_modules/antd/es/checkbox/style/index.js', 'utf8');
  assert.match(native, /'&-indeterminate':\s*\{\s*backgroundColor: token\.colorBgContainer/);
  // Follow the authored sheet order on the real native elements, including the
  // earlier blanket web/size mark rules that caused the original regression.
  const sheets = await Promise.all(
    ['web', 'size-profiles', 'docs-accessibility'].map(async name =>
      postcss.parse(await readFile(`docs/src/styles/${name}.css`, 'utf8')),
    ),
  );
  const authoredMark = node => {
    let value;
    for (const sheet of sheets)
      sheet.walkRules(rule => {
        if (!rule.selector.includes('::after') || rule.selector.includes(':hover')) return;
        if (!node.matches(rule.selector.replaceAll('::after', ''))) return;
        rule.walkDecls('background-color', decl => {
          value = decl.value;
        });
      });
    return value;
  };
  for (const mode of ['dark', 'light']) {
    await h.act(async () => {
      h.document.documentElement.dataset.theme = mode;
      h.window.dispatchEvent(new h.window.Event('genux-theme-change'));
    });
    for (const local of ['light', 'dark']) {
      const button = [...h.document.querySelectorAll('button')].find(
        node => node.textContent === `Local ${local}`,
      );
      await h.click(button);
      const localTokens = JSON.parse(
        h.document.querySelector('[data-mixed-scope="local"] output').textContent,
      );
      const emitted = {};
      for (const style of h.document.querySelectorAll('style'))
        postcss.parse(style.textContent).walkRules(rule => {
          if (rule.selector !== '.css-var-genux-color-preview') return;
          rule.walkDecls(decl => {
            emitted[decl.prop] = decl.value;
          });
        });
      assert.equal(emitted['--ant-color-bg-container'], localTokens.container);
      assert.equal(emitted['--ant-color-text'], localTokens.ink);
      for (const scope of h.document.querySelectorAll('[data-mixed-scope]')) {
        const tokens = JSON.parse(scope.querySelector('output').textContent);
        const localMode = scope.dataset.mixedMode || mode;
        const node = scope.querySelector('.ant-checkbox-indeterminate:not(.ant-checkbox-disabled)');
        const variables = {
          ...docsAccessibilityVariables(localMode),
          '--ink': tokens.ink,
          '--docs-brand-on-primary': docsBrandColors[localMode].onPrimary,
        };
        if (scope.dataset.mixedMode)
          variables['--selection-mark-ink'] =
            scope.parentElement.style.getPropertyValue('--selection-mark-ink');
        let mark = authoredMark(node);
        for (let depth = 0; /^var\(/.test(mark) && depth < 8; depth++)
          mark = variables[mark.match(/^var\((--[\w-]+)\)$/)?.[1]];
        assert.match(mark ?? '', /^#[\da-f]{6}$/i, 'the matched native mark resolves to a color');
        const ratio = contrastRatio(mark, tokens.container);
        assert.ok(
          ratio >= 3,
          `${mode}/${scope.dataset.mixedScope}: mixed ${mark} on native ${tokens.container} = ${ratio.toFixed(4)} <3`,
        );
        assert.equal(
          authoredMark(scope.querySelector('.ant-checkbox-disabled.ant-checkbox-indeterminate')),
          undefined,
          'disabled mixed controls retain their native mark styling',
        );
      }
    }
  }
});

test('enabled native clear actions and Select/Picker suffixes consume the local accessible icon role', async t => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(`<body data-genux-surface="docs"><div class="genux-demo">
    <span class="ant-input-affix-wrapper css-var-genux-docs"><button id="clear" class="ant-input-clear-icon"></button></span>
    <div class="ant-select css-var-genux-docs"><button id="select-clear" class="ant-select-clear"></button><span id="suffix" class="ant-select-suffix"></span></div>
    <div class="ant-select css-var-genux-color-preview"><span id="preview-suffix" class="ant-select-suffix"></span></div>
    <div class="ant-picker css-var-genux-docs"><button id="picker-clear" class="ant-picker-clear"></button><span id="picker-suffix" class="ant-picker-suffix"></span></div>
    <div class="ant-picker ant-picker-disabled css-var-genux-docs"><span id="picker-disabled" class="ant-picker-suffix"></span></div>
    <div class="ant-select ant-select-disabled css-var-genux-docs"><span id="disabled" class="ant-select-suffix"></span></div>
    <div class="ant-select css-var-genux"><span id="approved" class="ant-select-suffix"></span></div>
  </div></body>`);
  t.after(() => dom.window.close());
  // Installed AntD6 uses quaternary text here rather than its colorIcon alias.
  for (const path of [
    'input/style/index.js',
    'select/style/index.js',
    'select/style/select-input.js',
    'date-picker/style/index.js',
  ])
    assert.match(
      await readFile(`node_modules/antd/es/${path}`, 'utf8'),
      /color: (?:token\.)?colorTextQuaternary/,
    );
  const sheet = postcss.parse(await readFile('docs/src/styles/docs-accessibility.css', 'utf8'));
  const colors = id => {
    const result = [];
    sheet.walkRules(rule => {
      if (rule.selector.includes('::') || rule.selector.includes(':hover')) return;
      if (dom.window.document.getElementById(id).matches(rule.selector))
        rule.walkDecls('color', decl => result.push(decl.value));
    });
    return result;
  };
  for (const id of [
    'clear',
    'select-clear',
    'suffix',
    'preview-suffix',
    'picker-clear',
    'picker-suffix',
  ])
    assert.ok(
      colors(id).includes('var(--ant-color-icon)'),
      `${id}: enabled icon lacks the accessible role`,
    );
  for (const id of ['disabled', 'picker-disabled', 'approved'])
    assert.ok(
      !colors(id).includes('var(--ant-color-icon)'),
      `${id}: existing consumer is outside the override`,
    );
});

test('documentation accessibility styles identify selection and portal controls without surrounding focus rings', async t => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(
    `<body data-genux-surface="docs"><div class="genux-demo"><label class="ant-checkbox-wrapper css-var-genux-docs"><span id="portal" class="ant-checkbox ant-checkbox-checked"></span></label><label class="ant-checkbox-wrapper css-var-genux"><span id="approved" class="ant-checkbox ant-checkbox-checked"></span></label><div class="genux-segmented css-var-genux-docs"><label class="ant-segmented-item-selected"><span id="selected" class="ant-segmented-item-label"></span></label></div></div></body>`,
  );
  t.after(() => dom.window.close());
  const css = postcss.parse(await readFile('docs/src/styles/docs-accessibility.css', 'utf8'));
  const matching = (id, prop, value) => {
    let match = false;
    css.walkRules(rule => {
      if (rule.selector?.includes('::after') || id === 'selected') {
        if (
          dom.window.document
            .getElementById(id)
            .matches(rule.selector.replace(/::(?:before|after)/g, '')) &&
          rule.nodes.some(
            node => node.type === 'decl' && node.prop === prop && node.value === value,
          )
        )
          match = true;
      }
    });
    return match;
  };
  assert.ok(
    matching('portal', 'background-color', 'var(--selection-mark-ink)'),
    'portalled check/radio marks keep the readable foreground',
  );
  assert.equal(
    matching('approved', 'background-color', 'var(--selection-mark-ink)'),
    false,
    'approved controls are outside the documentation override',
  );
  assert.equal(
    matching('selected', 'background', 'currentColor'),
    false,
    'selected segments use their surface instead of a persistent underline',
  );
  css.walkRules(rule => {
    if (rule.selector?.includes('focus'))
      rule.walkDecls(decl => {
        if (['outline', 'outline-style'].includes(decl.prop)) assert.equal(decl.value, 'none');
        if (decl.prop === 'box-shadow')
          assert.doesNotMatch(decl.value, /0 0 0/, 'focus cannot introduce a surrounding ring');
      });
  });
});

test('body, helper, validation and exact-blue action text meet normal-text contrast in both themes', () => {
  for (const [mode, colors] of Object.entries(themeColors)) {
    for (const fg of ['ink', 'muted', 'error', 'warning', 'success'].map(key => colors[key]))
      for (const bg of ['paper', 'panel', 'surface', 'fieldBg', 'fieldHoverBg'].map(
        key => colors[key],
      ))
        assert.ok(contrastRatio(fg, bg) >= 4.5, `${mode} ${fg} on ${bg}`);
    for (const key of ['primary', 'primaryHover', 'primaryActive'])
      assert.ok(
        contrastRatio(docsBrandColors[mode][key], docsBrandColors[mode].onPrimary) >= 4.5,
        `${mode} ${key}`,
      );
  }
});

test('color-workspace action text remains readable on its actual normal, hover and active seed colors', async t => {
  const h = await mountPattern('default', 'docs/src/react/color/ColorSystemDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  const preview = h.document.querySelector('.color-seed-preview');
  assert.ok(preview);
  const button = preview.querySelector('.color-preview-button');
  const sheet = postcss.parse(await readFile('docs/src/styles/color-system.css', 'utf8'));
  let opacity;
  sheet.walkRules(rule => {
    if (rule.selector.includes(':hover') || rule.selector.includes('::')) return;
    if (button.matches(rule.selector))
      rule.walkDecls('opacity', decl => {
        opacity = decl.value;
      });
  });
  assert.equal(
    opacity,
    '1',
    'arbitrary seed contrast must not be reduced by the shared rest opacity',
  );
  for (const mode of ['light', 'dark']) {
    const radio = [...h.document.querySelectorAll('[aria-label="Preview theme"] label')]
      .find(node => node.textContent.trim() === (mode === 'dark' ? 'Dark' : 'Light'))
      ?.querySelector('input');
    await h.click(radio);
    assert.equal(preview.dataset.previewTheme, mode);
    for (const state of ['primary', 'hover', 'active']) {
      const fg =
        preview.style.getPropertyValue(
          `--color-preview-${state === 'primary' ? 'ink' : state + '-ink'}`,
        ) || preview.style.getPropertyValue('--button-text');
      const bg = preview.style.getPropertyValue(`--color-preview-${state}`);
      assert.ok(
        contrastRatio(fg, bg) >= 4.5,
        `${state} actual preview color: ${contrastRatio(fg, bg).toFixed(3)}`,
      );
    }
  }
});

test('preview native icon roles follow the preview theme when the documentation theme differs', async t => {
  const h = await mountPattern('default', 'docs/src/react/color/ColorSystemDemo.tsx', {
    documentation: true,
  });
  t.after(() => h.dispose());
  for (const outer of ['light', 'dark']) {
    await h.act(async () => {
      h.document.documentElement.dataset.theme = outer;
      h.window.dispatchEvent(new h.window.Event('genux-theme-change'));
    });
    const mode = outer === 'light' ? 'dark' : 'light';
    const radio = [...h.document.querySelectorAll('[aria-label="Preview theme"] label')]
      .find(node => node.textContent.trim() === (mode === 'dark' ? 'Dark' : 'Light'))
      ?.querySelector('input');
    await h.click(radio);
    const preview = h.document.querySelector('.color-seed-preview');
    assert.equal(preview.dataset.previewTheme, mode);
    assert.equal(h.document.querySelector('.genux-demo').dataset.themeMode, outer);
    const nativeSelect = preview.querySelector('.ant-select.css-var-genux-color-preview');
    assert.ok(nativeSelect, 'native Select consumes the local preview token key');
    const roles = {};
    for (const style of h.document.querySelectorAll('style')) {
      postcss.parse(style.textContent).walkRules(rule => {
        if (!rule.selector.includes('.css-var-genux-color-preview')) return;
        rule.walkDecls(decl => {
          if (['--ant-color-icon', '--ant-color-icon-hover'].includes(decl.prop))
            roles[decl.prop] = decl.value;
        });
      });
    }
    for (const role of ['--ant-color-icon', '--ant-color-icon-hover']) {
      assert.ok(roles[role], `${outer} → ${mode}: actual native icon token missing`);
      assert.match(
        roles[role],
        /^#[\da-f]{6}$/i,
        'native icon role uses the explicit semantic color',
      );
      for (const bg of ['panel', 'fieldBg', 'fieldHoverBg'].map(key => themeColors[mode][key]))
        assert.ok(
          contrastRatio(roles[role], bg) >= 3,
          `${outer} → ${mode}: ${role} ${roles[role]} on ${bg} is below 3:1`,
        );
    }
  }
});

test(
  'color-workspace native status roles follow its independent light and dark preview algorithm',
  { timeout: 5000 },
  async t => {
    const h = await mountPattern('default', 'docs/src/react/color/ColorSystemDemo.tsx', {
      documentation: true,
    });
    t.after(() => h.dispose());
    const roles = ['error', 'warning', 'success', 'info'].flatMap(status =>
      ['', '-text', '-text-hover', '-text-active'].map(suffix => `--ant-color-${status}${suffix}`),
    );
    const failures = [];
    for (const mode of ['light', 'dark']) {
      const radio = [...h.document.querySelectorAll('[aria-label="Preview theme"] label')]
        .find(node => node.textContent.trim() === (mode === 'dark' ? 'Dark' : 'Light'))
        ?.querySelector('input');
      await h.click(radio);
      assert.equal(h.document.querySelector('.color-seed-preview').dataset.previewTheme, mode);
      const emitted = {};
      for (const style of h.document.querySelectorAll('style'))
        postcss.parse(style.textContent).walkRules(rule => {
          if (rule.selector !== '.css-var-genux-color-preview') return;
          rule.walkDecls(decl => {
            emitted[decl.prop] = decl.value;
          });
        });
      for (const role of roles) {
        const ink = emitted[role];
        assert.match(
          ink ?? '',
          /^#[\da-f]{6}$/i,
          `${mode}/${role}: actual preview native status role missing`,
        );
        for (const surface of ['paper', 'panel', 'surface', 'fieldBg', 'fieldHoverBg']) {
          const ratio = contrastRatio(ink, themeColors[mode][surface]);
          if (ratio < 4.5)
            failures.push(`${mode}/${role} ${ink} on ${surface} = ${ratio.toFixed(4)} <4.5`);
        }
      }
    }
    assert.deepEqual(
      failures,
      [],
      'the actual independent preview must retain native status text contrast',
    );
  },
);

test('documentation clear actions expose their localized purpose and still clear the field', async () => {
  for (const entry of ['InputDemo', 'SelectDemo']) {
    const h = await mountPattern('default', `docs/src/react/${entry}.tsx`, { documentation: true });
    try {
      for (const locale of ['en', 'tr']) {
        await h.act(() => h.setLocale(locale));
        const clear = h.document.querySelector('.ant-input-clear-icon,.ant-select-clear');
        const icon = clear?.querySelector('[role="img"][aria-label]');
        assert.ok(clear && icon, `${entry}: actual clear action has a declared purpose`);
        assert.equal(
          icon.getAttribute('aria-label'),
          locale === 'en' ? 'Clear value' : 'Değeri temizle',
        );
      }
      if (entry === 'InputDemo') {
        const input = h.document.querySelector('#input-filled');
        await h.type(input, 'Workspace');
        await h.click(h.document.querySelector('.ant-input-clear-icon'));
        assert.equal(input.value, '');
      }
    } finally {
      await h.act(() => h.setLocale('en'));
      await h.dispose();
    }
  }
});
