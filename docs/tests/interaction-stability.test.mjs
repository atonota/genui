import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import ts from 'typescript';
import { fabMotionFailures, validateFabMotionOwner } from '../../tools/fab-motion-guard.mjs';

const styles = resolve(dirname(fileURLToPath(import.meta.url)), '../src/styles');
const sources = resolve(styles, '..');
const storybook = resolve(sources, '../../.storybook');
const stories = resolve(sources, '../../storybook');
// The validated FAB factory emits these roles inline with bounded computed values. They are trusted
// only in that one file, and FAB CSS only uses its delay role, after both FAB guards pass.
const fabMotionOwner = resolve(sources, 'fab/motion.ts');
const fabStylesheet = resolve(styles, 'genux-fab.css');
const fabFactoryRoles = new Set([
  '--fab-open-duration',
  '--fab-close-duration',
  '--fab-easing',
  '--fab-delay',
]);
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
// The overlay provider emits its motion roles inline. Read their actual literals from that one
// owner; authored CSS still adds its own branches, so mixed, cyclic or unknown values fail.
const overlayOwner = resolve(sources, 'data/overlay-tokens.ts');
const overlayMotionRoles = new Map();
function collectOverlayMotion(node) {
  if (
    ts.isPropertyAssignment(node) &&
    ts.isStringLiteral(node.name) &&
    /^--overlay-[a-z-]+$/.test(node.name.text) &&
    /(?:^|-)(?:duration|easing|delay)(?:-|$)/.test(node.name.text.slice(2))
  ) {
    assert.ok(
      ts.isStringLiteral(node.initializer),
      `${node.name.text} must be an explicit literal in ${overlayOwner}`,
    );
    overlayMotionRoles.set(node.name.text, [
      ...(overlayMotionRoles.get(node.name.text) ?? []),
      node.initializer.text,
    ]);
  }
  ts.forEachChild(node, collectOverlayMotion);
}
collectOverlayMotion(
  ts.createSourceFile(
    'overlay-tokens.ts',
    await readFile(overlayOwner, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  ),
);
for (const role of ['--overlay-open-duration', '--overlay-close-duration', '--overlay-easing'])
  assert.ok(overlayMotionRoles.has(role), `${role} requires its provider-owned literal`);
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

// The canonical provider may turn AntD motion off for its hydration render only. That one branch
// is proven from the file's own syntax: a const flag read through React's useSyncExternalStore
// with a non-live subscription, a client snapshot of true and a server snapshot of false, which
// selects the owned theme once hydrated and otherwise a copy that changes only token.motion.
function unparenthesized(node) {
  while (node && ts.isParenthesizedExpression(node)) node = node.expression;
  return node;
}

function parentExpression(node) {
  let parent = node?.parent;
  while (parent && ts.isParenthesizedExpression(parent)) parent = parent.parent;
  return parent;
}

// A helper resolves only when the file declares that name once, as a function or const function.
function topLevelFunction(file, name) {
  const found = [];
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) found.push(statement);
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name) continue;
      const initializer = unparenthesized(declaration.initializer);
      found.push(
        statement.declarationList.flags & ts.NodeFlags.Const &&
          initializer &&
          (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
          ? initializer
          : undefined,
      );
    }
  }
  return found.length === 1 ? found[0] : undefined;
}

function returnedExpression(fn) {
  if (!fn?.body) return undefined;
  if (!ts.isBlock(fn.body)) return unparenthesized(fn.body);
  const [statement, ...rest] = fn.body.statements;
  return statement && !rest.length && ts.isReturnStatement(statement)
    ? unparenthesized(statement.expression)
    : undefined;
}

function emptyFunction(node) {
  return (
    node !== undefined &&
    (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
    (ts.isBlock(node.body)
      ? node.body.statements.length === 0
      : ts.isIdentifier(node.body) && node.body.text === 'undefined')
  );
}

function constantSnapshot(fn, kind) {
  return fn !== undefined && fn.parameters.length === 0 && returnedExpression(fn)?.kind === kind;
}

function hydrationMotionGate(node, file) {
  const tokenObject = node.parent;
  const tokenProperty = parentExpression(tokenObject);
  const themeObject = tokenProperty?.parent;
  const choice = parentExpression(themeObject);
  if (
    !ts.isObjectLiteralExpression(tokenObject) ||
    tokenObject.properties.length !== 2 ||
    !tokenProperty ||
    !ts.isPropertyAssignment(tokenProperty) ||
    !(ts.isIdentifier(tokenProperty.name) || ts.isStringLiteral(tokenProperty.name)) ||
    tokenProperty.name.text !== 'token' ||
    unparenthesized(tokenProperty.initializer) !== tokenObject ||
    !themeObject ||
    !ts.isObjectLiteralExpression(themeObject) ||
    themeObject.properties.length !== 2 ||
    !choice ||
    !ts.isConditionalExpression(choice) ||
    unparenthesized(choice.whenFalse) !== themeObject
  )
    return false;
  // Ready selects the owned theme itself; the fallback spreads it and its token unchanged.
  const owned = unparenthesized(choice.whenTrue);
  const flag = unparenthesized(choice.condition);
  const tokenSpread = tokenObject.properties.find(property => property !== node);
  const themeSpread = themeObject.properties.find(property => property !== tokenProperty);
  if (
    !ts.isIdentifier(owned) ||
    !ts.isIdentifier(flag) ||
    !tokenSpread ||
    !ts.isSpreadAssignment(tokenSpread) ||
    !themeSpread ||
    !ts.isSpreadAssignment(themeSpread)
  )
    return false;
  const tokenSource = unparenthesized(tokenSpread.expression);
  const themeSource = unparenthesized(themeSpread.expression);
  if (
    !ts.isIdentifier(themeSource) ||
    themeSource.text !== owned.text ||
    !ts.isPropertyAccessExpression(tokenSource) ||
    tokenSource.name.text !== 'token' ||
    !ts.isIdentifier(unparenthesized(tokenSource.expression)) ||
    unparenthesized(tokenSource.expression).text !== owned.text
  )
    return false;
  // The flag is the enclosing component's one const read of React's external-store hook.
  let scope = choice.parent;
  while (scope && !ts.isFunctionLike(scope)) scope = scope.parent;
  if (
    !scope?.body ||
    scope.parameters.some(
      parameter => ts.isIdentifier(parameter.name) && parameter.name.text === flag.text,
    )
  )
    return false;
  const declarations = [];
  const collect = child => {
    if (ts.isFunctionLike(child)) return;
    if (
      ts.isVariableDeclaration(child) &&
      ts.isIdentifier(child.name) &&
      child.name.text === flag.text
    )
      declarations.push(child);
    ts.forEachChild(child, collect);
  };
  ts.forEachChild(scope.body, collect);
  const [declaration] = declarations;
  const read = unparenthesized(declaration?.initializer);
  if (
    declarations.length !== 1 ||
    !(declaration.parent.flags & ts.NodeFlags.Const) ||
    !read ||
    !ts.isCallExpression(read) ||
    !ts.isIdentifier(read.expression) ||
    read.expression.text !== 'useSyncExternalStore' ||
    read.arguments.length !== 3 ||
    !read.arguments.every(argument => ts.isIdentifier(argument))
  )
    return false;
  const reactHook = file.statements.some(
    statement =>
      ts.isImportDeclaration(statement) &&
      !statement.importClause?.isTypeOnly &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === 'react' &&
      statement.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(statement.importClause.namedBindings) &&
      statement.importClause.namedBindings.elements.some(
        element =>
          !element.propertyName &&
          !element.isTypeOnly &&
          element.name.text === 'useSyncExternalStore',
      ),
  );
  const [subscribe, client, server] = read.arguments.map(argument =>
    topLevelFunction(file, argument.text),
  );
  return (
    reactHook &&
    emptyFunction(returnedExpression(subscribe)) &&
    constantSnapshot(client, ts.SyntaxKind.TrueKeyword) &&
    constantSnapshot(server, ts.SyntaxKind.FalseKeyword)
  );
}

function inspectInlineMotion(source, path = 'fixture.tsx', trustedRoles = new Set()) {
  const issues = [];
  // Factory role trust is bound to the one validated owner file, never to a caller-chosen path.
  const trusted = path === fabMotionOwner ? trustedRoles : new Set();
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
        (path !== resolve(sources, 'react/GenUXProvider.tsx') ||
          (name.text === 'motion' &&
            ts.isPropertyAssignment(node) &&
            node.initializer.kind === ts.SyntaxKind.FalseKeyword &&
            !hydrationMotionGate(node, file)))
      ) {
        issues.push(
          `${path}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1} ${name.text}: native motion configuration belongs to the canonical GenUXProvider`,
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
          !trusted.has(name.text) &&
          (!ts.isPropertyAssignment(node) ||
            !ts.isStringLiteral(node.initializer) ||
            !allowed.includes(node.initializer.text))
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
    /^\.genux-motion-layer(?:$|[.:#\[])/.test(target) ||
    /^\.(?:ant-switch-handle|genux-button-lip)(?:$|[.:#\[])/.test(target) ||
    /^\.(?:genux-button|ant-btn-primary)[^\s]*::(?:before|after)$/.test(target)
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
  // Authored variables may carry whole transition clauses; reduced-motion overrides stay out.
  const shorthandValues = new Map();
  for (const sheet of sheets)
    sheet.walkDecls(declaration => {
      if (declaration.prop.startsWith('--') && !reducedMotion(declaration)) {
        const authored = shorthandValues.get(declaration.prop) ?? [];
        authored.push(declaration.value);
        shorthandValues.set(declaration.prop, authored);
      }
      if (!/^--[\w-]+transition-properties$/.test(declaration.prop)) return;
      const values = propertyValues.get(declaration.prop) ?? [];
      values.push(declaration.value);
      propertyValues.set(declaration.prop, values);
    });
  const clauses = (value, shorthand, visited = new Set()) =>
    postcss.list.comma(value).flatMap(clause => {
      const name = /^var\((--[\w-]+)\)$/.exec(clause)?.[1];
      if (name && !visited.has(name) && propertyValues.has(name)) {
        const next = new Set(visited).add(name);
        const resolved = propertyValues.get(name).flatMap(value => clauses(value, shorthand, next));
        return resolved.some(value => value.toLowerCase() === 'none') ? [clause] : resolved;
      }
      // A shorthand clause may be one whole alias. Every authored value and the fallback expand
      // and are checked; unknown, cyclic or none-valued aliases stay unresolved and fail.
      const reference = shorthand ? varReference(clause) : undefined;
      if (!reference || reference.name.startsWith('--motion-') || visited.has(reference.name))
        return [clause];
      const branches = [...(shorthandValues.get(reference.name) ?? [])];
      if (reference.fallback !== undefined) branches.push(reference.fallback);
      if (!branches.length) return [clause];
      const next = new Set(visited).add(reference.name);
      const resolved = branches.flatMap(value => clauses(value, shorthand, next));
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
      for (const clause of clauses(declaration.value, prop === 'transition')) {
        const first = postcss.list.space(clause)[0];
        const keyword = first.toLowerCase();
        if (keyword === 'none' && postcss.list.comma(declaration.value).length === 1) continue;
        if (
          keyword === 'all' ||
          keyword === 'none' ||
          !/^(?:--|-(?:webkit|moz|ms|o)-)?[a-z][\w-]*$/i.test(first) ||
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

// Native rc-motion phase classes (X-appear-active, X-enter-active, X-leave-active) are lifecycle
// steps. Enter and appear pair with leave; the swap renames only that motion's own phase classes.
function phaseCounterparts(selector) {
  const match = /\.([\w-]+-)(appear|enter|leave)-active(?![\w-])/.exec(selector);
  if (!match) return [];
  const [, prefix, phase] = match;
  return (phase === 'leave' ? ['enter', 'appear'] : ['leave']).map(other =>
    selector
      .replace(/\.([\w-]+)/g, (whole, name) =>
        name === `${prefix}${phase}`
          ? `.${prefix}${other}`
          : name === `${prefix}${phase}-active`
            ? `.${prefix}${other}-active`
            : whole,
      )
      .replace(/\s+/g, ' ')
      .trim(),
  );
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
  const phaseRules = new Map();
  for (const { rule, selector } of states) {
    const key = selector.replace(/\s+/g, ' ').trim();
    phaseRules.set(key, [...(phaseRules.get(key) ?? []), rule]);
  }
  const longhands = (rule, kind) =>
    rule.nodes
      .filter(
        node => node.type === 'decl' && (node.prop === kind || node.prop.startsWith(`${kind}-`)),
      )
      .map(node => node.prop)
      .sort()
      .join();
  for (const { rule, selector } of states) {
    for (const kind of ['transition', 'animation']) {
      if (
        !rule.nodes.some(
          node => node.type === 'decl' && (node.prop === kind || node.prop.startsWith(`${kind}-`)),
        )
      )
        continue;
      // A native phase pairs with its opposite phase only when both declare the same motion
      // longhands; otherwise it still needs a matching base owner like any other state.
      const own = longhands(rule, kind);
      if (
        phaseCounterparts(selector).some(other =>
          (phaseRules.get(other) ?? []).some(match => longhands(match, kind) === own),
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

// var(--alias) or var(--alias, fallback); a nested var() fallback stays whole.
function varReference(value) {
  const match = /^var\(\s*(--[\w-]+)\s*(?:,\s*([\s\S]+?))?\s*\)$/.exec(value);
  return match ? { name: match[1], fallback: match[2] } : undefined;
}

function inspectMotion(sheets, requireFoundation = true, trust = {}) {
  const issues = [];
  // Inline provider roles from one validated owner seed the resolver; authored CSS adds branches.
  const variables = new Map(
    [...(trust.inlineRoles ?? [])].map(([name, values]) => [name, [...values]]),
  );
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
    const reference = varReference(value);
    if (!reference || seen.has(reference.name)) return [];
    // Every authored value and the fallback must resolve; an unknown or cyclic branch fails the alias.
    const next = new Set([...seen, reference.name]);
    const branches = (variables.get(reference.name) ?? []).map(alias =>
      resolveTime(alias, next, canonical || motionDurations.has(reference.name)),
    );
    if (reference.fallback !== undefined)
      branches.push(resolveTime(reference.fallback, next, canonical));
    return branches.length && branches.every(times => times.length) ? branches.flat() : [];
  };
  const positive = value => {
    const times = resolveTime(value);
    return times.length > 0 && times.every(time => time.milliseconds > 0 && time.canonical);
  };
  // An easing alias is shared only when every authored value and fallback ends at the central token.
  const sharedEasing = (value, seen = new Set()) => {
    if (value === 'var(--motion-easing)') return true;
    const reference = varReference(value);
    if (!reference || reference.name.startsWith('--motion-') || seen.has(reference.name))
      return false;
    const next = new Set([...seen, reference.name]);
    const branches = [...(variables.get(reference.name) ?? [])];
    if (reference.fallback !== undefined) branches.push(reference.fallback);
    return branches.length > 0 && branches.every(branch => sharedEasing(branch, next));
  };
  // A whole transition/animation clause may be one authored alias; every authored value and the
  // fallback expand and are checked, while unknown or cyclic aliases stay unresolved and fail.
  const wholeClauses = (value, seen = new Set()) =>
    postcss.list.comma(value).flatMap(clause => {
      const reference = varReference(clause);
      if (!reference || reference.name.startsWith('--motion-') || seen.has(reference.name))
        return [clause];
      const branches = [...(variables.get(reference.name) ?? [])];
      if (reference.fallback !== undefined) branches.push(reference.fallback);
      if (!branches.length) return [clause];
      const next = new Set([...seen, reference.name]);
      return branches.flatMap(branch => wholeClauses(branch, next));
    });
  // A delay alias is shared only when every authored value and fallback ends at the central token;
  // the FAB delay role stays trusted only at use sites in its validated stylesheet.
  const sharedDelay = (declaration, value, seen = new Set()) => {
    if (value === 'var(--motion-delay)') return true;
    if (value === 'var(--fab-delay)')
      return (
        trust.fabStylesheet !== undefined && declaration.source?.input.file === trust.fabStylesheet
      );
    const reference = varReference(value);
    if (
      !reference ||
      reference.name.startsWith('--motion-') ||
      reference.name === '--fab-delay' ||
      seen.has(reference.name)
    )
      return false;
    const next = new Set([...seen, reference.name]);
    const branches = [...(variables.get(reference.name) ?? [])];
    if (reference.fallback !== undefined) branches.push(reference.fallback);
    return branches.length > 0 && branches.every(branch => sharedDelay(declaration, branch, next));
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
      for (const clause of wholeClauses(declaration.value)) {
        const parts = postcss.list.space(clause);
        if (!parts.some(part => sharedEasing(part)))
          issue(declaration, 'motion must explicitly use shared ease-in/out');
        if (
          parts.some(part =>
            /^(?:(?:linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end)$|(?:steps|cubic-bezier|linear)\()/.test(
              part,
            ),
          )
        )
          issue(declaration, 'local timing functions must not override the shared curve');
        // An unresolved non-easing alias still takes a timing slot, so it cannot slip past the checks.
        const times = parts.filter(
          part => resolveTime(part).length > 0 || (varReference(part) && !sharedEasing(part)),
        );
        const duration = times[0];
        if (!duration || !positive(duration))
          issue(
            declaration,
            'motion requires a positive canonical duration, including continuous animations',
          );
        if (times.length > 2 || (times.length === 2 && !sharedDelay(declaration, times[1])))
          issue(declaration, 'shorthand delay must use the shared delay token');
      }
    } else if (/^(?:transition|animation)-timing-function$/.test(prop)) {
      if (postcss.list.comma(declaration.value).some(value => !sharedEasing(value)))
        issue(declaration, 'timing must use shared ease-in/out');
    } else if (/^(?:transition|animation)-duration$/.test(prop)) {
      if (postcss.list.comma(declaration.value).some(value => !positive(value)))
        issue(declaration, 'duration must resolve to a positive canonical token');
    } else if (/^(?:transition|animation)-delay$/.test(prop)) {
      if (postcss.list.comma(declaration.value).some(value => !sharedDelay(declaration, value)))
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
        declaration.parent.selectors.some(selector => selector.trim() === '.genux-control'),
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
        issues.push(`Shared .genux-control foundation requires normal-priority ${prop}`);
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
  postcss.parse(`.genux-demo { ${transitionToken}: ${paintProperties.join(', ')}; }\n${css}`);

test('authored hover rules preserve control geometry and transitions name explicit properties', async () => {
  assert.equal(motion.easing.replace(/\s/g, ''), 'cubic-bezier(0.65,0,0.35,1)');
  assert.ok(Object.values(motion.durationMs).every(value => Number.isFinite(value) && value > 0));
  assert.equal(motion.delayMs, 0);
  // Validate the FAB factory and stylesheet once before their exact roles are trusted below.
  await validateFabMotionOwner();
  assert.deepEqual(fabMotionFailures(await readFile(fabStylesheet, 'utf8')), []);
  const result = inspect(await authoredStyles);
  assert.deepEqual(result.hover, []);
  assert.deepEqual(result.transitions, []);
  assert.deepEqual(
    inspectMotion(await authoredStyles, true, { fabStylesheet, inlineRoles: overlayMotionRoles }),
    [],
  );
  const rules = [];
  for (const sheet of await authoredStyles) sheet.walkRules(rule => rules.push(rule));
  for (const [selector, excluded] of [
    [
      ':root[data-theme] .genux-demo :is(.ant-input, .ant-input-affix-wrapper, .ant-input-number, .ant-select)',
      ['all', 'border', 'border-color', 'border-bottom', 'border-bottom-color'],
    ],
    ['.genux-demo .genux-pill .genux-pill-close', ['all', 'box-shadow']],
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
      path === fabMotionOwner ||
      path.startsWith(storybook) ||
      path.startsWith(stories))
      ? inspectInlineMotion(source, path, fabFactoryRoles)
      : [],
  );
  assert.deepEqual(inlineIssues, []);
  const provider = await readFile(resolve(styles, '../react/GenUXProvider.tsx'), 'utf8');
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
  const badToken = inspect([postcss.parse(`.genux-demo { ${transitionToken}: color, height; }`)]);
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
      resolve(sources, 'react/GenUXProvider.tsx'),
    ).length,
    1,
  );
  // Only the canonical provider's hydration render may turn AntD motion off; every broken proof
  // of that one branch, or the same skeleton in another file, still fails.
  const providerPath = resolve(sources, 'react/GenUXProvider.tsx');
  const hydrationFallback = '{ ...ownedTheme, token: { ...ownedTheme.token, motion: false } }';
  const hydrationSkeleton = ({
    subscribe = '() => () => {}',
    client = '() => true',
    server = '() => false',
    flag = 'useSyncExternalStore(subscribeNothing, hydratedSnapshot, hydratingSnapshot)',
    choice = `motionReady ? ownedTheme : ${hydrationFallback}`,
  } = {}) => `import { useSyncExternalStore } from 'react';
const subscribeNothing = ${subscribe};
const hydratedSnapshot = ${client};
const hydratingSnapshot = ${server};
export default function GenUXProvider({ ownedTheme }) {
  const motionReady = ${flag};
  const providerTheme = ${choice};
  return providerTheme;
}`;
  assert.deepEqual(inspectInlineMotion(hydrationSkeleton(), providerPath), []);
  for (const [label, variant, path = providerPath] of [
    ['another file', {}, resolve(sources, 'react/Fab.tsx')],
    ['client snapshot false', { client: '() => false' }],
    ['server snapshot true', { server: '() => true' }],
    [
      'swapped snapshots',
      { flag: 'useSyncExternalStore(subscribeNothing, hydratingSnapshot, hydratedSnapshot)' },
    ],
    [
      'live subscription',
      { subscribe: `callback => { addEventListener('resize', callback); return () => {}; }` },
    ],
    ['unverified caller', { flag: 'useHydrated()' }],
    ['unknown condition', { choice: `otherFlag ? ownedTheme : ${hydrationFallback}` }],
    ['flipped branch', { choice: `motionReady ? ${hydrationFallback} : ownedTheme` }],
    [
      'extra fallback override',
      {
        choice:
          'motionReady ? ownedTheme : { ...ownedTheme, token: { ...ownedTheme.token, motion: false, motionDurationFast: 0 } }',
      },
    ],
  ])
    assert.equal(inspectInlineMotion(hydrationSkeleton(variant), path).length, 1, label);
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
    .new-control:hover .genux-motion-layer { transition: transform var(--motion-duration-standard) var(--motion-easing); transform: translateX(2px); }
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
    .new-control:hover .genux-motion-layer { transform: translateX(2px); }
    .ant-switch:hover .ant-switch-handle { inset-inline-start: 2px; }
    .genux-motion-layer .new-control:hover { height: 60px; }
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
      resolve(sources, 'react/GenUXProvider.tsx'),
    ),
    [],
  );
  assert.deepEqual(
    inspectMotion(
      [
        motionFixture(`
    .new-control .genux-motion-layer { transition: transform var(--motion-duration-standard) var(--motion-easing); }
    .new-control:hover .genux-motion-layer { transition: transform var(--motion-duration-standard) var(--motion-easing); transform: translateX(2px); }
    .new-control:active .genux-motion-layer { transition-duration: var(--motion-duration-fast); transform: translateX(1px); }
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

test('canonical aliases, native motion phases and the validated FAB owner resolve without blanket exemptions', () => {
  assert.deepEqual(
    inspect([fixture('.layer { transition-property: background-color, -webkit-backdrop-filter; }')])
      .transitions,
    [],
  );
  assert.equal(
    inspect([fixture('.layer { transition-property: -unknown-filter; }')]).transitions.length,
    1,
  );
  const aliases =
    ':root { --overlay-easing: var(--motion-easing); --overlay-open-duration: var(--motion-duration-standard); --local-curve: linear; }';
  // Whole-clause transition aliases expand through every authored value and fallback.
  const shorthands = `:root { --layer-transition: background-color var(--overlay-open-duration) var(--overlay-easing), box-shadow var(--motion-duration-fast) var(--motion-easing); --nested-transition: var(--layer-transition); --mixed-transition: color var(--motion-duration-standard) var(--motion-easing); --zero-transition: color var(--zero) var(--motion-easing); --curve-transition: color var(--motion-duration-standard) var(--local-curve); --all-transition: all var(--motion-duration-standard) var(--motion-easing); --implicit-transition: var(--motion-duration-standard) var(--motion-easing); --none-transition: none; --loop-transition: var(--loop-transition); }
    .mixed-scope { --mixed-transition: all var(--motion-duration-standard) linear; }`;
  const wholeAlias =
    '.layer { transition: var(--nested-transition), var(--undeclared-transition, opacity var(--motion-duration-fast) var(--motion-easing)); }';
  assert.deepEqual(inspect([fixture(`${aliases} ${shorthands} ${wholeAlias}`)]).transitions, []);
  assert.deepEqual(
    inspectMotion([motionFixture(`${aliases} ${shorthands} ${wholeAlias}`)], false),
    [],
  );
  for (const value of [
    'var(--mixed-transition)',
    'var(--all-transition)',
    'var(--implicit-transition)',
    'var(--none-transition)',
    'var(--undeclared-transition)',
    'var(--loop-transition)',
    'var(--nested-transition), var(--all-transition)',
    'var(--undeclared-transition, all var(--motion-duration-fast) var(--motion-easing))',
  ])
    assert.ok(
      inspect([fixture(`${aliases} ${shorthands} .new-control { transition: ${value}; }`)])
        .transitions.length > 0,
      value,
    );
  for (const value of [
    'var(--mixed-transition)',
    'var(--zero-transition)',
    'var(--curve-transition)',
    'var(--undeclared-transition)',
    'var(--loop-transition)',
    'var(--nested-transition), var(--zero-transition)',
    'var(--layer-transition, color var(--motion-duration-standard) linear)',
    'var(--undeclared-transition, color 0ms var(--motion-easing))',
  ])
    assert.ok(
      inspectMotion(
        [motionFixture(`${aliases} ${shorthands} .new-control { transition: ${value}; }`)],
        false,
      ).length > 0,
      value,
    );
  assert.deepEqual(
    inspectMotion(
      [
        motionFixture(`${aliases}
    .layer { transition: background-color var(--overlay-open-duration, var(--duration-alias)) var(--overlay-easing, var(--motion-easing)), -webkit-backdrop-filter var(--overlay-open-duration, var(--duration-alias)) var(--overlay-easing, var(--motion-easing)); }
    .layer { transition-duration: var(--undeclared-duration, var(--motion-duration-fast)); transition-timing-function: var(--overlay-easing, var(--motion-easing)); }
  `),
      ],
      false,
    ),
    [],
  );
  for (const css of [
    'transition-duration: var(--motion-duration-standard, 0ms)',
    'transition-duration: var(--undeclared-duration)',
    'transition-duration: var(--cycle, var(--motion-duration-standard))',
    'transition: color var(--duration-alias, 0ms) var(--motion-easing)',
    'transition-timing-function: var(--local-curve, var(--motion-easing))',
    'transition-timing-function: var(--undeclared-easing)',
    'transition-timing-function: var(--motion-easing, linear)',
    'transition: color var(--motion-duration-standard) var(--undeclared-easing, linear)',
  ])
    assert.ok(
      inspectMotion([motionFixture(`${aliases} .new-control { ${css}; }`)], false).length > 0,
      css,
    );
  const phaseIssues = css =>
    inspectMotion([motionFixture(css)], false).filter(issue => issue.includes('state-only'));
  assert.deepEqual(
    phaseIssues(`
    .new-toast-appear.new-toast-appear-active, .new-toast-enter.new-toast-enter-active { animation-name: new-in; animation-play-state: running; }
    .new-toast-leave.new-toast-leave-active { animation-name: new-out; animation-play-state: running; }
    .new-mask-motion-enter-active { animation-duration: var(--motion-duration-standard); }
    .new-mask-motion-leave-active { animation-duration: var(--motion-duration-standard); }
  `),
    [],
  );
  assert.equal(
    phaseIssues(`
    .one-way-enter-active { animation-duration: var(--motion-duration-standard); }
    .uneven-enter-active { animation-name: grow; animation-duration: var(--motion-duration-standard); }
    .uneven-leave-active { animation-duration: var(--motion-duration-standard); }
  `).length,
    3,
  );
  const fabRules =
    '.genux-fab-action { transition: opacity var(--motion-duration-standard) var(--motion-easing) var(--fab-delay); transition-delay: var(--fab-delay); }';
  const fabSheet = postcss.parse(fabRules, { from: fabStylesheet });
  const otherSheet = postcss.parse(fabRules, { from: resolve(styles, 'new-component.css') });
  assert.equal(inspectMotion([motionFixture(''), fabSheet], false).length, 2);
  assert.deepEqual(inspectMotion([motionFixture(''), fabSheet], false, { fabStylesheet }), []);
  assert.equal(inspectMotion([motionFixture(''), otherSheet], false, { fabStylesheet }).length, 2);
  const factoryRole = "const style = { '--fab-delay': `${rank * stagger}ms` };";
  assert.equal(inspectInlineMotion(factoryRole, fabMotionOwner).length, 1);
  assert.deepEqual(inspectInlineMotion(factoryRole, fabMotionOwner, fabFactoryRoles), []);
  assert.equal(
    inspectInlineMotion(factoryRole, resolve(sources, 'react/Fab.tsx'), fabFactoryRoles).length,
    1,
  );
  assert.equal(
    inspectInlineMotion(
      "const style = { '--fab-press-duration': '0ms' };",
      fabMotionOwner,
      fabFactoryRoles,
    ).length,
    1,
  );
  // Overlay motion roles are inline provider literals: they resolve only through the roles read
  // from the validated owner, and every authored branch still has to stay canonical.
  const pressRoles =
    ':root { --press-duration: var(--motion-duration-fast); --release-duration: var(--motion-duration-standard); }';
  const overlayRules =
    '.overlay { transition-duration: var(--overlay-open-duration); transition-timing-function: var(--overlay-easing); } .overlay-close { transition-duration: var(--overlay-close-duration); }';
  assert.equal(inspectMotion([motionFixture(`${pressRoles} ${overlayRules}`)], false).length, 3);
  assert.deepEqual(
    inspectMotion([motionFixture(`${pressRoles} ${overlayRules}`)], false, {
      inlineRoles: overlayMotionRoles,
    }),
    [],
  );
  for (const css of [
    ':root { --press-duration: 0ms; }',
    ':root { --release-duration: var(--release-duration); }',
    ':root { --overlay-open-duration: 0ms; }',
    ':root { --overlay-easing: linear; }',
  ])
    assert.ok(
      inspectMotion([motionFixture(`${pressRoles} ${css} ${overlayRules}`)], false, {
        inlineRoles: overlayMotionRoles,
      }).length > 0,
      css,
    );
  // Delay aliases resolve through every authored value and fallback to the central token; the
  // FAB delay role never becomes shared through an alias outside its validated stylesheet.
  const delays =
    ':root { --layer-delay: var(--motion-delay); --nested-delay: var(--layer-delay); --local-delay: 60s; --mixed-delay: var(--motion-delay); --loop-delay: var(--loop-delay); --fab-alias: var(--fab-delay); } .mixed-scope { --mixed-delay: 60s; }';
  assert.deepEqual(
    inspectMotion(
      [
        motionFixture(
          `${delays} .layer { transition-delay: var(--nested-delay); animation-delay: var(--layer-delay); }`,
        ),
      ],
      false,
    ),
    [],
  );
  for (const value of [
    'var(--motion-delay, 0s)',
    'var(--layer-delay, 60s)',
    'var(--local-delay)',
    'var(--mixed-delay)',
    'var(--loop-delay)',
    'var(--undeclared-delay)',
    'var(--fab-alias)',
  ])
    assert.ok(
      inspectMotion(
        [motionFixture(`${delays} .new-control { transition-delay: ${value}; }`)],
        false,
        { fabStylesheet },
      ).length > 0,
      value,
    );
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
