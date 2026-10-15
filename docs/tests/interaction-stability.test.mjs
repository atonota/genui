import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import ts from 'typescript';

const styles = resolve(dirname(fileURLToPath(import.meta.url)), '../src/styles');
const sources = resolve(styles, '..');
const storybook = resolve(sources, '../../.storybook');
const stories = resolve(sources, '../../storybook');
const transitionToken = '--control-transition-properties';
const paintProperties = ['background-color', 'border-color', 'color', 'opacity', 'box-shadow'];
// Provider-owned property lists are authored in TypeScript and emitted as inline
// variables. Inspect their actual literal values, alongside every CSS override.
const semanticPropertyValues = new Map();
const accessibilitySource = ts.createSourceFile(
  'accessibility.ts',
  await readFile(resolve(sources, 'data/accessibility.ts'), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
);
function collectPropertyValues(node) {
  if (
    ts.isPropertyAssignment(node) &&
    ts.isStringLiteral(node.name) &&
    /^--[\w-]+transition-properties$/.test(node.name.text)
  ) {
    assert.ok(
      ts.isStringLiteral(node.initializer),
      'semantic property lists must be explicit literals',
    );
    semanticPropertyValues.set(node.name.text, [node.initializer.text]);
  }
  ts.forEachChild(node, collectPropertyValues);
}
collectPropertyValues(accessibilitySource);
assert.ok(
  semanticPropertyValues.has('--docs-input-transition-properties'),
  'documentation inputs require a normal provider-owned transition property list',
);
const motion = JSON.parse(await readFile(resolve(styles, '../data/motion.json'), 'utf8'));
const motionDurations = new Map(
  Object.entries(motion.durationMs).map(([name, value]) => [
    `--motion-duration-${name}`,
    `${value}ms`,
  ]),
);

async function readAuthored(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async entry => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return readAuthored(path);
      if (!entry.isFile() || !/\.(?:css|astro|[cm]?[jt]sx?)$/.test(entry.name)) return [];
      return [{ path, source: await readFile(path, 'utf8') }];
    }),
  );
  return files.flat();
}

function parseStyles(files) {
  return files.flatMap(({ path, source }) => {
    if (path.endsWith('.css')) return [postcss.parse(source, { from: path })];
    if (!path.endsWith('.astro')) return [];
    return [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(match =>
      postcss.parse(match[1], { from: path }),
    );
  });
}

function inspectInlineMotion(source, path = 'fixture.tsx') {
  const issues = [];
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const directMotion =
    /^(?:transition(?:Property|Duration|TimingFunction|Delay)?|animation(?:Name|Duration|TimingFunction|Delay|IterationCount|Direction|FillMode|PlayState)?|(?:transition|animation)(?:-[a-z]+)*)$/;
  const nativeMotion = /^(?:motionEase\w+|motionDuration\w+)$/;
  const insideTheme = node => {
    for (let parent = node.parent; parent; parent = parent.parent)
      if (
        (ts.isPropertyAssignment(parent) || ts.isJsxAttribute(parent)) &&
        (ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name)) &&
        /^(?:theme|token)$/.test(parent.name.text)
      )
        return true;
    return false;
  };
  const walk = node => {
    if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
      const name = ts.isComputedPropertyName(node.name) ? node.name.expression : node.name;
      if ((ts.isIdentifier(name) || ts.isStringLiteral(name)) && directMotion.test(name.text)) {
        issues.push(
          `${path}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1} ${name.text}: use shared authored CSS motion policy instead of inline motion`,
        );
      }
      if (
        (ts.isIdentifier(name) || ts.isStringLiteral(name)) &&
        (nativeMotion.test(name.text) ||
          (name.text === 'motion' &&
            (insideTheme(node) ||
              (ts.isPropertyAssignment(node) &&
                (node.initializer.kind === ts.SyntaxKind.FalseKeyword ||
                  node.initializer.kind === ts.SyntaxKind.TrueKeyword))))) &&
        (path !== resolve(sources, 'react/AtlasProvider.tsx') ||
          (name.text === 'motion' &&
            ts.isPropertyAssignment(node) &&
            node.initializer.kind === ts.SyntaxKind.FalseKeyword))
      ) {
        issues.push(
          `${path}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1} ${name.text}: native motion configuration belongs to the canonical AtlasProvider`,
        );
      }
      if (
        (ts.isIdentifier(name) || ts.isStringLiteral(name)) &&
        name.text.startsWith('--') &&
        /(?:^|-)(?:duration|easing|delay)(?:-|$)/.test(name.text.slice(2))
      ) {
        const kind = /(?:^|-)duration(?:-|$)/.test(name.text.slice(2))
          ? 'duration'
          : /(?:^|-)easing(?:-|$)/.test(name.text.slice(2))
            ? 'easing'
            : 'delay';
        const allowed =
          kind === 'duration'
            ? [...motionDurations.keys()].map(token => `var(${token})`)
            : [`var(--motion-${kind})`];
        if (
          !ts.isPropertyAssignment(node) ||
          !ts.isStringLiteral(node.initializer) ||
          !allowed.includes(node.initializer.text)
        )
          issues.push(
            `${path}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1} ${name.text}: inline motion aliases must reference canonical tokens`,
          );
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(file);
  return issues;
}

function changesLayout(property) {
  const prop = property.replace(/^-(?:webkit|moz|ms|o)-/, '');
  return (
    /^(?:(?:min|max)-)?(?:width|height|inline-size|block-size)$/.test(prop) ||
    /^(?:padding|margin|inset)(?:-|$)/.test(prop) ||
    /^border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?(?:-(?:width|style))?$/.test(
      prop,
    ) ||
    /^border(?:-[\w-]+)?-radius$/.test(prop) ||
    /^(?:display|position|top|right|bottom|left|font|font-size|font-weight|line-height|letter-spacing|transform|translate|scale|rotate|gap|row-gap|column-gap)$/.test(
      prop,
    ) ||
    /^(?:flex|grid)(?:-|$)/.test(prop)
  );
}

function layoutVariable(value) {
  return (value.match(/--[\w-]+/g) ?? []).some(
    name =>
      !/(?:color|bg)$/.test(name) &&
      /(?:^|-)(?:size|width|height|padding|margin|inset|gap|font|scale|transform|translate|rotate|radius)(?:-|$)/.test(
        name.slice(2),
      ),
  );
}

function decorativeMotion(selector) {
  // Only the target can opt in; a marked ancestor must not exempt a control.
  const target = postcss.list.space(selector).at(-1)?.split(/[>+~]/).at(-1) ?? '';
  return (
    /^\.atlas-motion-layer(?:$|[.:#\[])/.test(target) ||
    /^\.(?:ant-switch-handle|atlas-button-lip)(?:$|[.:#\[])/.test(target) ||
    /^\.(?:atlas-button|ant-btn-primary)[^\s]*::(?:before|after)$/.test(target)
  );
}

function inspect(sheets) {
  const hover = [];
  const transitions = [];
  let tokenCount = 0;
  const issue = (declaration, reason) =>
    `${relative(styles, declaration.source?.input.file ?? 'fixture.css')}:${declaration.source?.start?.line ?? 0} ${declaration.prop}: ${reason}`;
  const propertyValues = new Map(
    [...semanticPropertyValues].map(([name, values]) => [name, [...values]]),
  );
  for (const sheet of sheets)
    sheet.walkDecls(declaration => {
      if (!/^--[\w-]+transition-properties$/.test(declaration.prop)) return;
      const values = propertyValues.get(declaration.prop) ?? [];
      values.push(declaration.value);
      propertyValues.set(declaration.prop, values);
    });
  const clauses = (value, visited = new Set()) =>
    postcss.list.comma(value).flatMap(clause => {
      const name = /^var\((--[\w-]+)\)$/.exec(clause)?.[1];
      if (!name || visited.has(name) || !propertyValues.has(name)) return [clause];
      const next = new Set(visited).add(name);
      const resolved = propertyValues.get(name).flatMap(value => clauses(value, next));
      return resolved.some(value => value.toLowerCase() === 'none') ? [clause] : resolved;
    });

  for (const sheet of sheets) {
    sheet.walkRules(rule => {
      const guarded = rule.selectors.some(
        selector => /:hover\b/.test(selector) && !decorativeMotion(selector),
      );
      if (!guarded) return;
      rule.each(declaration => {
        if (declaration.type !== 'decl') return;
        if (changesLayout(declaration.prop)) {
          hover.push(issue(declaration, 'hover changes control geometry'));
        } else if (
          declaration.prop.startsWith('--') &&
          (layoutVariable(declaration.prop) || layoutVariable(declaration.value))
        ) {
          hover.push(issue(declaration, 'hover changes a layout variable'));
        }
      });
    });

    sheet.walkDecls(declaration => {
      if (declaration.prop === transitionToken) {
        tokenCount += 1;
        const properties = postcss.list.comma(declaration.value);
        if (
          properties.length !== paintProperties.length ||
          !paintProperties.every(property => properties.includes(property))
        ) {
          transitions.push(
            issue(
              declaration,
              'central transition token must contain only the five paint properties',
            ),
          );
        }
      }
      const prop = declaration.prop.replace(/^-(?:webkit|moz|ms|o)-/, '');
      if (prop !== 'transition' && prop !== 'transition-property') return;
      for (const clause of clauses(declaration.value)) {
        const first = postcss.list.space(clause)[0];
        const keyword = first.toLowerCase();
        if (keyword === 'none' && postcss.list.comma(declaration.value).length === 1) continue;
        if (
          keyword === 'all' ||
          keyword === 'none' ||
          !/^(?:--)?[a-z][\w-]*$/i.test(first) ||
          /^(?:initial|inherit|unset|revert|revert-layer|ease|linear|ease-in|ease-out|ease-in-out|step-start|step-end|normal|allow-discrete)$/.test(
            keyword,
          )
        ) {
          transitions.push(
            issue(
              declaration,
              'transition must name an explicit property; all and implicit properties are forbidden',
            ),
          );
        }
      }
    });
  }
  if (!tokenCount) transitions.push(`Missing ${transitionToken}`);
  return { hover, transitions };
}

function reducedMotion(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (
      parent.type === 'atrule' &&
      parent.name === 'media' &&
      /\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/.test(parent.params) &&
      !/\bnot\b/.test(parent.params)
    )
      return true;
  }
  return false;
}

const statePseudo = /:(?:hover|active|focus(?:-visible|-within)?|checked)\b/;
const stateClass = /\.(?:[\w-]+-)?(?:active|checked|selected|open|focused|hover|pressed)\b/;
const stateAttribute = /\[(?:data-(?:state|pressed|checked)|aria-(?:checked|expanded))\s*=/;
const stateSelector = selector =>
  statePseudo.test(selector) || stateClass.test(selector) || stateAttribute.test(selector);

function baseSelector(selector) {
  return selector
    .replace(/:(?:is|where|not|has)\(([^()]*)\)/g, (whole, contents) =>
      stateSelector(contents) ? '' : whole,
    )
    .replace(/:(?:hover|active|focus(?:-visible|-within)?|checked)\b/g, '')
    .replace(/\[(?:data-(?:state|pressed|checked)|aria-(?:checked|expanded))\s*=[^\]]*\]/g, '')
    .replace(
      /\.([\w-]+)-(?:active|checked|selected|open|focused|hover|pressed)\b/g,
      (whole, name) =>
        ['is', 'has'].includes(name)
          ? ''
          : `.${name.replace(/-(?:motion-)?(?:appear|enter|leave)$/, '')}`,
    )
    .replace(/\.(?:active|checked|selected|open|focused|hover|pressed)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function ownsSelector(owner, target) {
  if (/^:where\(body[, )]/.test(owner) && owner.includes('body *')) return true;
  const base = postcss.list.space(owner);
  const state = postcss.list.space(baseSelector(target));
  if (base.at(-1) !== state.at(-1)) return false;
  let index = 0;
  for (const part of state.slice(0, -1)) if (base[index] === part) index += 1;
  return index === base.length - 1;
}

function motionProperties(rule, kind) {
  const properties = [];
  rule.each(declaration => {
    if (declaration.type !== 'decl') return;
    if (
      declaration.prop === `${kind}-property` ||
      (kind === 'animation' && declaration.prop === 'animation-name')
    ) {
      properties.push(
        ...postcss.list
          .comma(declaration.value)
          .flatMap(value => (value === `var(${transitionToken})` ? paintProperties : [value])),
      );
    } else if (declaration.prop === kind) {
      properties.push(
        ...postcss.list.comma(declaration.value).map(value => postcss.list.space(value)[0]),
      );
    }
  });
  return properties.filter(property => property !== 'none');
}

function inspectStateOwners(sheets) {
  const owners = [];
  const states = [];
  for (const sheet of sheets)
    sheet.walkRules(rule => {
      if (reducedMotion(rule)) return;
      for (const selector of rule.selectors) {
        if (stateSelector(selector)) states.push({ rule, selector });
        else
          owners.push({
            selector,
            transition: motionProperties(rule, 'transition'),
            animation: motionProperties(rule, 'animation'),
          });
      }
    });
  const issues = [];
  for (const { rule, selector } of states) {
    for (const kind of ['transition', 'animation']) {
      if (
        !rule.nodes.some(
          node => node.type === 'decl' && (node.prop === kind || node.prop.startsWith(`${kind}-`)),
        )
      )
        continue;
      const base = owners
        .filter(owner => ownsSelector(owner.selector, selector))
        .flatMap(owner => owner[kind]);
      const requested = motionProperties(rule, kind);
      if (!requested.length && kind === 'transition') {
        rule.each(declaration => {
          if (
            declaration.type === 'decl' &&
            /^(?:background(?:-color)?|border(?:-[\w-]+)?-(?:color|width|radius)|color|opacity|box-shadow|transform|translate|scale|rotate|inset(?:-[\w-]+)?|top|right|bottom|left|width|height|filter|backdrop-filter)$/.test(
              declaration.prop,
            )
          )
            requested.push(declaration.prop);
        });
      }
      if (
        !base.length ||
        requested.some(
          property =>
            !base.includes(property) &&
            !(property === 'background' && base.includes('background-color')) &&
            !(
              property.startsWith('border-') &&
              property.endsWith('-color') &&
              base.includes('border-color')
            ) &&
            !(property.startsWith('inset-') && base.includes('inset')),
        )
      ) {
        issues.push(
          `${rule.source?.input.file ?? 'fixture.css'}:${rule.source?.start?.line ?? 0} ${selector}: state-only ${kind} lacks a matching base property owner`,
        );
      }
    }
  }
  return issues;
}

function inspectMotion(sheets, requireFoundation = true) {
  const issues = [];
  const variables = new Map();
  const declarations = sheets.flatMap(sheet => {
    const items = [];
    sheet.walkDecls(declaration => {
      if (reducedMotion(declaration)) return;
      items.push(declaration);
      if (declaration.prop.startsWith('--')) {
        const values = variables.get(declaration.prop) ?? [];
        values.push(declaration.value);
        variables.set(declaration.prop, values);
      }
    });
    return items;
  });
  const issue = (declaration, reason) =>
    issues.push(
      `${declaration.source?.input.file ?? 'fixture.css'}:${declaration.source?.start?.line ?? 0} ${declaration.prop}: ${reason}`,
    );
  const resolveTime = (value, seen = new Set(), canonical = false) => {
    const literal = /^(-?(?:\d+(?:\.\d*)?|\.\d+))(ms|s)$/.exec(value);
    if (literal)
      return [{ milliseconds: Number(literal[1]) * (literal[2] === 's' ? 1000 : 1), canonical }];
    const name = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
    if (!name || seen.has(name)) return [];
    return (variables.get(name) ?? []).flatMap(alias =>
      resolveTime(alias, new Set([...seen, name]), canonical || motionDurations.has(name)),
    );
  };
  const positive = value => {
    const times = resolveTime(value);
    return times.length > 0 && times.every(time => time.milliseconds > 0 && time.canonical);
  };

  for (const [name, expected] of motionDurations) {
    const values = variables.get(name);
    if (!values?.length || values.some(value => value !== expected))
      issues.push(`${name} must be ${expected}`);
  }
  const easing = variables.get('--motion-easing');
  if (
    !easing?.length ||
    easing.some(value => value.replace(/\s/g, '') !== motion.easing.replace(/\s/g, ''))
  )
    issues.push('Shared motion easing must match the canonical source');
  if (!variables.get('--motion-delay')?.every(value => value === `${motion.delayMs}ms`))
    issues.push('Shared motion delay must match the canonical source');

  for (const declaration of declarations) {
    const prop = declaration.prop.replace(/^-(?:webkit|moz|ms|o)-/, '');
    if (prop === 'transition' || prop === 'animation') {
      for (const clause of postcss.list.comma(declaration.value)) {
        const parts = postcss.list.space(clause);
        if (!parts.includes('var(--motion-easing)'))
          issue(declaration, 'motion must explicitly use shared ease-in/out');
        if (
          parts.some(part =>
            /^(?:(?:linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end)$|(?:steps|cubic-bezier|linear)\()/.test(
              part,
            ),
          )
        )
          issue(declaration, 'local timing functions must not override the shared curve');
        const times = parts.filter(part => resolveTime(part).length > 0);
        const duration = times[0];
        if (!duration || !positive(duration))
          issue(
            declaration,
            'motion requires a positive canonical duration, including continuous animations',
          );
        if (times.length > 2 || (times.length === 2 && times[1] !== 'var(--motion-delay)'))
          issue(declaration, 'shorthand delay must use the shared delay token');
      }
    } else if (/^(?:transition|animation)-timing-function$/.test(prop)) {
      if (postcss.list.comma(declaration.value).some(value => value !== 'var(--motion-easing)'))
        issue(declaration, 'timing must use shared ease-in/out');
    } else if (/^(?:transition|animation)-duration$/.test(prop)) {
      if (postcss.list.comma(declaration.value).some(value => !positive(value)))
        issue(declaration, 'duration must resolve to a positive canonical token');
    } else if (/^(?:transition|animation)-delay$/.test(prop)) {
      if (postcss.list.comma(declaration.value).some(value => value !== 'var(--motion-delay)'))
        issue(declaration, 'delay must use the shared delay token');
    } else if (prop === 'transition-property' && declaration.value.toLowerCase() === 'none') {
      issue(declaration, 'normal motion must not be disabled');
    }
  }

  if (requireFoundation) {
    const foundation = declarations.find(
      declaration =>
        declaration.prop === 'transition-property' &&
        declaration.value === `var(${transitionToken})` &&
        declaration.parent.type === 'rule' &&
        declaration.parent.selectors.some(selector => selector.trim() === '.atlas-control'),
    )?.parent;
    for (const prop of [
      'transition-property',
      'transition-duration',
      'transition-timing-function',
      'transition-delay',
    ]) {
      const declaration = foundation?.nodes.find(
        node => node.type === 'decl' && node.prop === prop,
      );
      if (!declaration || declaration.important)
        issues.push(`Shared .atlas-control foundation requires normal-priority ${prop}`);
      else if (prop === 'transition-delay' && declaration.value !== 'var(--motion-delay)')
        issue(declaration, 'foundation delay must use shared token');
    }
  }
  return [...issues, ...inspectStateOwners(sheets)];
}

const authoredFiles = Promise.all([
  readAuthored(sources),
  readAuthored(storybook),
  readAuthored(stories),
]).then(groups => groups.flat());
const authoredStyles = authoredFiles.then(parseStyles);
const fixture = css =>
  postcss.parse(`.atlas-demo { ${transitionToken}: ${paintProperties.join(', ')}; }\n${css}`);

test('authored hover rules preserve control geometry and transitions name explicit properties', async () => {
  assert.equal(motion.easing.replace(/\s/g, ''), 'cubic-bezier(0.65,0,0.35,1)');
  assert.ok(Object.values(motion.durationMs).every(value => Number.isFinite(value) && value > 0));
  assert.equal(motion.delayMs, 0);
  const result = inspect(await authoredStyles);
  assert.deepEqual(result.hover, []);
  assert.deepEqual(result.transitions, []);
  assert.deepEqual(inspectMotion(await authoredStyles), []);
  const rules = [];
  for (const sheet of await authoredStyles) sheet.walkRules(rule => rules.push(rule));
  for (const [selector, excluded] of [
    [
      ':root[data-theme] .atlas-demo :is(.ant-input, .ant-input-affix-wrapper, .ant-input-number, .ant-select)',
      ['all', 'border', 'border-color', 'border-bottom', 'border-bottom-color'],
    ],
    ['.atlas-demo .atlas-pill .atlas-pill-close', ['all', 'box-shadow']],
    ['.table-scroll', ['all', 'border', 'border-color', 'border-bottom', 'border-bottom-color']],
    ['.kit-table-scroll', ['all', 'border', 'border-color', 'border-block-end-color']],
    ['.kit-board', ['all', 'border', 'border-color', 'border-block-end-color']],
    [
      '.kit-records .kit-contained-scroll',
      ['all', 'border', 'border-color', 'border-block-end-color'],
    ],
    ['.color-presets-viewport', ['all', 'border', 'border-color', 'border-block-end-color']],
    ['.workspace-lab .collection-detail', ['all', 'box-shadow']],
    ['.workspace-lab .collection-table-scroll .ant-table-row-expand-icon', ['all', 'box-shadow']],
  ]) {
    const matches = rules.filter(rule =>
      rule.selectors.some(value => value.replace(/\s/g, '') === selector.replace(/\s/g, '')),
    );
    const properties = matches.flatMap(rule => motionProperties(rule, 'transition'));
    assert.ok(properties.length > 0, `${selector} owns immediate focus-marker exclusions`);
    assert.ok(
      excluded.every(property => !properties.includes(property)),
      `${selector} must not animate its focus marker on entry or exit`,
    );
  }
  const inlineIssues = (await authoredFiles).flatMap(({ path, source }) =>
    /\.[cm]?[jt]sx?$/.test(path) &&
    (path.startsWith(resolve(sources, 'react')) ||
      path.startsWith(storybook) ||
      path.startsWith(stories))
      ? inspectInlineMotion(source, path)
      : [],
  );
  assert.deepEqual(inlineIssues, []);
  const provider = await readFile(resolve(styles, '../react/AtlasProvider.tsx'), 'utf8');
  assert.match(provider, /import\s+motion\s+from\s+['"]\.\.\/data\/motion\.json['"]/);
  const easeFields = [
    'motionEaseInOut',
    'motionEaseInOutCirc',
    'motionEaseOutCirc',
    'motionEaseInBack',
    'motionEaseOutBack',
    'motionEaseInQuint',
    'motionEaseOutQuint',
    'motionEaseOut',
  ];
  for (const field of easeFields)
    assert.match(provider, new RegExp(`${field}:\\s*motion\\.easing\\b`));
  for (const [field, source] of [
    ['motionDurationFast', 'fast'],
    ['motionDurationMid', 'feedback'],
    ['motionDurationSlow', 'standard'],
  ]) {
    assert.match(provider, new RegExp(`${field}:.*motion\\.durationMs\\.${source}\\s*\\/\\s*1000`));
  }
});

test('semantic transition lists resolve their real values and reject unsafe overrides', () => {
  const token = '--docs-input-transition-properties';
  assert.deepEqual(
    inspect([fixture(`.field {transition-property:var(${token});}`)]).transitions,
    [],
  );
  for (const value of [
    'all',
    'none',
    'NONE',
    'AlL',
    'var(--unknown-properties)',
    `var(${token})`,
  ]) {
    const result = inspect([
      fixture(`.field {${token}:${value};transition-property:var(${token});}`),
    ]);
    assert.ok(result.transitions.length, `${value} must not bypass the property guard`);
  }
});

test('new component hover geometry and unrestricted transitions fail the guard', () => {
  const result = inspect([
    fixture(`
    .new-control:hover { width: 80px; font-weight: 700; border-radius: 30px; --control-height: 48px; --local: var(--control-padding); }
    .new-control { transition: all 140ms ease, 140ms ease; transition-property: all; }
    .new-control { transition: var(--duration) ease; }
  `),
  ]);
  assert.equal(result.hover.length, 5);
  assert.equal(result.transitions.length, 4);
  assert.match(result.hover.join('\n'), /width/);
  assert.match(result.hover.join('\n'), /font-weight/);
  assert.match(result.hover.join('\n'), /--control-height/);
  assert.match(result.hover.join('\n'), /--local/);
  const badToken = inspect([postcss.parse(`.atlas-demo { ${transitionToken}: color, height; }`)]);
  assert.equal(badToken.transitions.length, 1);
  for (const css of [
    'transition: color var(--motion-duration-standard) linear',
    'transition: color var(--motion-duration-standard) var(--motion-easing) linear',
    'animation: pulse var(--motion-duration-standard) ease-in',
    'transition-timing-function: ease-out',
    'animation-timing-function: steps(2)',
    'transition: color var(--motion-duration-standard)',
    'transition: none',
    'animation: none',
    'transition-property: none',
    'transition-duration: 0ms',
    'animation-duration: var(--zero)',
    'transition-duration: var(--cycle)',
    'animation: pulse 1200ms var(--motion-easing) infinite',
    'transition-delay: 60s',
    'animation-delay: 60s',
    'transition: color var(--motion-duration-standard) var(--motion-easing) 60s',
    'animation: pulse var(--motion-duration-standard) var(--motion-easing) 60s',
  ]) {
    assert.ok(inspectMotion([motionFixture(`.new-control { ${css}; }`)], false).length > 0, css);
  }
  assert.equal(
    inspectInlineMotion(`const Example = () => <div style={{ transition: 'none' }} />;`).length,
    1,
  );
  for (const property of [
    'motion: false',
    "motionEaseOut: 'linear'",
    "motionDurationFast: '0s'",
    'token: { motion }',
  ]) {
    assert.equal(inspectInlineMotion(`const theme = { ${property} };`).length, 1, property);
  }
  assert.equal(
    inspectInlineMotion(
      'const theme = { motion: false };',
      resolve(sources, 'react/AtlasProvider.tsx'),
    ).length,
    1,
  );
  for (const property of [
    "'--press-duration': '0ms'",
    "'--switch-motion-duration': '500ms'",
    "'--motion-easing': 'linear'",
    "'--motion-delay': '60s'",
  ]) {
    assert.equal(inspectInlineMotion(`const style = { ${property} };`).length, 1, property);
  }
  const stateOnly = inspectMotion(
    [
      motionFixture(`
    .new-control:hover .atlas-motion-layer { transition: transform var(--motion-duration-standard) var(--motion-easing); transform: translateX(2px); }
    .new-control:focus { animation: pulse var(--motion-duration-pulse) var(--motion-easing) infinite; }
  `),
    ],
    false,
  );
  assert.equal(stateOnly.filter(issue => issue.includes('state-only')).length, 2);
});

test('paint changes and explicit decorative motion pass without exempting ancestor controls', () => {
  const result = inspect([
    fixture(`
    .new-control:hover { color: red; opacity: 1; --control-color: blue; }
    .new-control { transition: color 140ms ease; transition-property: var(${transitionToken}); }
    .new-control:hover .atlas-motion-layer { transform: translateX(2px); }
    .ant-switch:hover .ant-switch-handle { inset-inline-start: 2px; }
    .atlas-motion-layer .new-control:hover { height: 60px; }
  `),
  ]);
  assert.equal(result.hover.length, 1);
  assert.match(result.hover[0], /height/);
  assert.deepEqual(result.transitions, []);
  assert.deepEqual(
    inspectMotion(
      [
        motionFixture(`
    .new-control { transition: color var(--duration-alias) var(--motion-easing) var(--motion-delay); }
    .new-icon { animation: spin var(--motion-duration-spin) var(--motion-easing) infinite; }
    .new-icon { transition-delay: var(--motion-delay); animation-delay: var(--motion-delay); }
    @media (prefers-reduced-motion: reduce) {
      .new-control { transition: none; transition-duration: 0ms; animation: none; }
    }
  `),
      ],
      false,
    ),
    [],
  );
  assert.deepEqual(
    inspectInlineMotion(
      `const style = { '--duration': 'var(--motion-duration-deliberate)', '--height': '500px', color: 'red' };`,
    ),
    [],
  );
  assert.deepEqual(
    inspectInlineMotion(`const icon = { motion: 'spin' }; const props = { motion };`),
    [],
  );
  assert.deepEqual(
    inspectInlineMotion(
      'const theme = { motionEaseOut: motion.easing };',
      resolve(sources, 'react/AtlasProvider.tsx'),
    ),
    [],
  );
  assert.deepEqual(
    inspectMotion(
      [
        motionFixture(`
    .new-control .atlas-motion-layer { transition: transform var(--motion-duration-standard) var(--motion-easing); }
    .new-control:hover .atlas-motion-layer { transition: transform var(--motion-duration-standard) var(--motion-easing); transform: translateX(2px); }
    .new-control:active .atlas-motion-layer { transition-duration: var(--motion-duration-fast); transform: translateX(1px); }
  `),
      ],
      false,
    ),
    [],
  );
  const astro = parseStyles([
    { path: 'new-component.astro', source: '<style>.new-control { transition: none; }</style>' },
  ]);
  assert.equal(astro.length, 1);
  assert.ok(inspectMotion([motionFixture(''), ...astro], false).length > 0);
});

function motionFixture(css) {
  return postcss.parse(`:root {
    --motion-easing: ${motion.easing};
    --motion-delay: ${motion.delayMs}ms;
    ${[...motionDurations].map(([name, value]) => `${name}: ${value};`).join('\n')}
    --duration-alias: var(--motion-duration-standard);
    --zero: 0ms;
    --cycle: var(--cycle);
  }\n${css}`);
}
