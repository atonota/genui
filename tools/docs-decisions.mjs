import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { posix, relative, resolve, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import postcss from 'postcss';
import ts from 'typescript';

// Read-only admission guard for the direct human decision record. Only the root records human
// decisions; author proposals can never edit the record or this guard. Facts come from parsed
// source structure (TypeScript AST, PostCSS, JSON), never from comments; candidate code is never
// executed and nothing is written.
export const DECISION_PATH = 'docs/decisions/current.json';
export const GUARD_PATH = 'tools/docs-decisions.mjs';
const PROTECTED_PATHS = new Set([DECISION_PATH, GUARD_PATH]);
const SOURCE_ROOT = 'docs/src';
const SOURCES = Object.freeze({
  devices: 'docs/src/data/preview-devices.ts',
  workbenchLayout: 'docs/src/preview/workbench-layout.ts',
  shellLayout: 'docs/src/components/shell/layout.css',
  policy: 'docs/src/adaptive/policy.json',
  definitions: 'docs/src/theme-builder/definitions.json',
  model: 'docs/src/theme-builder/model.ts',
});
const RAIL_ROLE = '--shell-rail-max-inline-size';
// Exactly the roles fixedScreen(width, height, container = width) produces, each mapped to its
// parameter. Other macbook roles, such as the approved hardware screenRadiusPx, are not screen
// geometry and stay with the device.
const FIXED_SCREEN_PARAMETERS = ['width', 'height', 'container'];
const FIXED_SCREEN_MAPPING = Object.freeze({
  screenWidthPx: 'width',
  screenHeightPx: 'height',
  containerWidthPx: 'container',
  displayMaxScreenWidthPx: 'width',
  screenMinHeightPx: 'height',
  screenAspectWidth: 'width',
  screenAspectHeight: 'height',
});
const FIXED_SCREEN_ROLES = new Set(Object.keys(FIXED_SCREEN_MAPPING));
// The one approved preview device for each human surface.
const SURFACE_DEVICES = Object.freeze({
  phone: 'iphone',
  tablet: 'ipad',
  computer: 'macbook',
  tv: 'tv',
});
// Registry objects of the devices module. Only understood read-only AST positions may name them;
// any other reference, alias, write or call fails closed and the candidate is never run.
const REGISTRY_NAMES = ['macbook', 'tv', 'previewDevices'];
const DEVICES_SPECIFIER = /(?:^|\/)preview-devices(?:\.[cm]?[jt]sx?)?$/;
// Markup is not analyzed, so it may not reach previewDevices at all.
const MARKUP_REGISTRY =
  /\bpreviewDevices\b|\*\s*as\s+[\w$]+\s+from\s*['"][^'"]*preview-devices|import\s*\(\s*['"][^'"]*preview-devices/;
const CODE_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const MARKUP_FILE = /\.(?:astro|html)$/;
const IFRAME_MARKUP = /<\s*iframe\b/i;
const DIGEST = /^[0-9a-f]{64}$/;
const MODES = ['light', 'dark'];
const STEPS = ['sm', 'md', 'lg'];
const SIZE_FAMILIES = [
  ['regular', 'size'],
  ['compact', 'size-compact'],
  ['badge', 'size-badge'],
];

export class DecisionAdmissionError extends Error {
  constructor(code, message, violations = []) {
    super(message);
    this.name = 'DecisionAdmissionError';
    this.code = code;
    this.violations = violations;
  }
}

function fail(code, message) {
  throw new DecisionAdmissionError(code, message);
}

const sha256 = data => createHash('sha256').update(data).digest('hex');

/** The current human record and the SHA-256 digest of its exact bytes. */
export async function captureDecisionSnapshot(root) {
  let bytes;
  try {
    bytes = await readFile(resolve(root, DECISION_PATH));
  } catch (error) {
    fail('missing-decision-record', `${DECISION_PATH} could not be read: ${error.message}`);
  }
  let record;
  try {
    record = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    fail('invalid-decision-record', `${DECISION_PATH} is not valid JSON: ${error.message}`);
  }
  if (record?.schemaVersion !== 1 || typeof record.facts !== 'object' || record.facts === null)
    fail(
      'invalid-decision-record',
      `${DECISION_PATH} must be schemaVersion 1 with a facts object.`,
    );
  return { digest: sha256(bytes), record, path: DECISION_PATH };
}

/** Admits an author proposal only against the fresh digest; validation is read-only. */
export async function assertDecisionAdmission(root, proposal, admission) {
  const digest = admission?.decisionDigest;
  if (typeof digest !== 'string' || !DIGEST.test(digest))
    fail(
      'missing-decision-digest',
      'Admission requires the lowercase SHA-256 decisionDigest of the current human record.',
    );
  const snapshot = await captureDecisionSnapshot(root);
  if (digest !== snapshot.digest)
    fail(
      'stale-decision',
      `Admission digest ${digest} is stale; current human decisions are ${snapshot.digest} (${snapshot.record.revision}).`,
    );
  const overlay = candidateMap(await proposalFiles(root, proposal));
  return verify(root, snapshot, overlay);
}

/** Checks the current sources, with optional full candidate files overlaid on the reads. */
export async function checkCurrentDecisions(root, candidateFiles = []) {
  const overlay = candidateMap(candidateFiles);
  return verify(root, await captureDecisionSnapshot(root), overlay);
}

function candidatePath(path) {
  if (typeof path !== 'string' || path === '' || path.includes('\0') || path.includes('\\'))
    fail('invalid-path', `Invalid candidate path ${JSON.stringify(path)}.`);
  if (posix.isAbsolute(path) || /^[A-Za-z]:/.test(path))
    fail('invalid-path', `Absolute candidate path ${path} is not allowed.`);
  const normal = posix.normalize(path);
  if (normal !== path || normal === '.' || normal === '..' || normal.startsWith('../'))
    fail('invalid-path', `Candidate path ${path} must be canonical and stay inside the root.`);
  return normal;
}

function candidateMap(files) {
  if (!Array.isArray(files)) fail('invalid-proposal', 'Candidate files must be an array.');
  const map = new Map();
  for (const file of files) {
    const path = candidatePath(file?.path);
    if (map.has(path)) fail('duplicate-path', `Candidate path ${path} appears more than once.`);
    if (PROTECTED_PATHS.has(path))
      fail('protected-path', `${path} is recorded by the root only; proposals cannot edit it.`);
    if (typeof file.content !== 'string')
      fail('invalid-proposal', `Candidate ${path} must carry full text content.`);
    map.set(path, file.content);
  }
  return map;
}

function occurrences(text, part) {
  let count = 0;
  for (let index = text.indexOf(part); index !== -1; index = text.indexOf(part, index + 1))
    count += 1;
  return count;
}

const PATCH_KEYS = ['replacements', 'newFiles'];

/** The coordinator's full candidate files {path, before, content}; it compares before itself. */
function fullFiles(files) {
  if (!Array.isArray(files)) fail('invalid-proposal', 'Proposal files must be an array.');
  const map = candidateMap(files);
  for (const file of files)
    if (!Object.hasOwn(file, 'before') || (file.before !== null && typeof file.before !== 'string'))
      fail('invalid-proposal', `Candidate ${file.path} needs before text or null.`);
  return [...map].map(([path, content]) => ({ path, content }));
}

/** Full candidate files from {files} or {replacements, newFiles}; paths validated before reads. */
async function proposalFiles(root, proposal) {
  if (typeof proposal !== 'object' || proposal === null || Array.isArray(proposal))
    fail(
      'invalid-proposal',
      'A proposal must be an object with files, or with replacements and newFiles.',
    );
  // An optional summary string is nonoperative metadata; no source fact is ever read from it.
  const unknown = Object.keys(proposal).filter(
    key => key !== 'files' && key !== 'summary' && !PATCH_KEYS.includes(key),
  );
  if (unknown.length) fail('invalid-proposal', `Unknown proposal fields: ${unknown.join(', ')}.`);
  if (Object.hasOwn(proposal, 'summary') && typeof proposal.summary !== 'string')
    fail('invalid-proposal', 'Proposal summary must be a string when present.');
  // Full files and patches never mix: the root admits exactly one candidate shape.
  if (Object.hasOwn(proposal, 'files')) {
    if (PATCH_KEYS.some(key => Object.hasOwn(proposal, key)))
      fail(
        'invalid-proposal',
        'A proposal carries either full files or replacements and newFiles, not both.',
      );
    return fullFiles(proposal.files);
  }
  const { replacements = [], newFiles = [] } = proposal;
  if (!Array.isArray(replacements) || !Array.isArray(newFiles))
    fail('invalid-proposal', 'Proposal replacements and newFiles must be arrays.');
  const created = candidateMap(newFiles);
  const edits = new Map();
  for (const item of replacements) {
    const path = candidatePath(item?.path);
    if (PROTECTED_PATHS.has(path))
      fail('protected-path', `${path} is recorded by the root only; proposals cannot edit it.`);
    if (created.has(path))
      fail('duplicate-path', `${path} is both a new file and a replacement target.`);
    if (typeof item.old !== 'string' || item.old === '' || typeof item.new !== 'string')
      fail('invalid-proposal', `Replacement for ${path} needs non-empty old and string new text.`);
    edits.set(path, [...(edits.get(path) ?? []), item]);
  }
  const files = [...created].map(([path, content]) => ({ path, content }));
  for (const [path, hunks] of edits) {
    let content = await readSource(root, path);
    for (const hunk of hunks) {
      const count = occurrences(content, hunk.old);
      if (count !== 1)
        fail(
          'invalid-hunk',
          `${path}: replacement context must match exactly once, found ${count}.`,
        );
      content = content.replace(hunk.old, () => hunk.new);
    }
    files.push({ path, content });
  }
  return files;
}

async function readSource(root, path) {
  try {
    return await readFile(resolve(root, path), 'utf8');
  } catch (error) {
    fail('missing-source', `${path} could not be read: ${error.message}`);
  }
}

async function sourceFiles(root, overlay) {
  const base = resolve(root);
  let entries;
  try {
    entries = await readdir(resolve(base, SOURCE_ROOT), { recursive: true, withFileTypes: true });
  } catch (error) {
    fail('missing-source', `${SOURCE_ROOT} could not be listed: ${error.message}`);
  }
  const files = new Set(overlay.keys());
  for (const entry of entries)
    if (entry.isFile())
      files.add(relative(base, resolve(entry.parentPath, entry.name)).split(sep).join('/'));
  return [...files].filter(path => !path.split('/').includes('node_modules')).sort();
}

const CHECKS = [
  ['macbook', checkMacbook],
  ['fixed-screen', checkFixedScreen],
  ['preview-devices', checkPreviewDevices],
  ['device-registry', checkDeviceRegistry],
  ['preview-threshold', checkPreviewThreshold],
  ['rail', checkRail],
  ['adaptive-policy', checkAdaptivePolicy],
  ['theme-definitions', checkDefinitions],
  ['preview-screen-surface', checkPreviewScreenSurface],
  ['font-minimum', checkFontMinimum],
  ['inline-preview', checkInlinePreview],
];

async function verify(root, snapshot, overlay) {
  const context = {
    facts: snapshot.record.facts,
    files: await sourceFiles(root, overlay),
    read: async path => (overlay.has(path) ? overlay.get(path) : readSource(root, path)),
  };
  const violations = [];
  for (const [name, check] of CHECKS) {
    try {
      violations.push(...(await check(context)).map(message => `${name}: ${message}`));
    } catch (error) {
      // Missing sources, unknown syntax and missing facts fail closed.
      violations.push(`${name}: ${error.message}`);
    }
  }
  if (violations.length)
    throw new DecisionAdmissionError(
      'decision-conflict',
      `Current human decisions (${snapshot.record.revision}) are not met:\n- ${violations.join('\n- ')}`,
      violations,
    );
  return {
    digest: snapshot.digest,
    revision: snapshot.record.revision,
    path: snapshot.path,
    checked: CHECKS.map(([name]) => name),
  };
}

function requireFact(facts, path) {
  const value = path.split('.').reduce((node, key) => node?.[key], facts);
  if (value === undefined || value === null)
    throw new Error(`the decision record is missing facts.${path}.`);
  return value;
}

/** The device canvas is separate from editable shell/panel recipes. Only a new human record
    may change its two values; duplicate declarations or another paint owner fail admission. */
async function checkPreviewScreenSurface({ facts, files, read }) {
  const role = '--preview-screen-surface';
  const value = `var(${role})`;
  const path = 'docs/src/styles/preview-document.css';
  const want = requireFact(facts, 'previewScreenSurface');
  const owners = [
    [path, 'body[data-preview-body]', 'background'],
    [path, '[data-preview-document]', 'background'],
    ['docs/src/styles/preview-workbench.css', '.example-preview-screen', 'background-color'],
  ];
  // Split only outside quoted values and functions. Qualified/ancestor selectors still target
  // the last compound; descendants keep their own component paint. Ambiguous functional
  // subjects mentioning a protected owner fail closed instead of adding another paint owner.
  const protectedSubject = rule =>
    postcss.list.comma(rule.selector).some(selector => {
      const subject = postcss.list.split(selector, [' ', '\n', '\t', '>', '+', '~']).at(-1) ?? '';
      if (
        /\.example-preview-screen\b|\[data-preview-(?:document|body)\b|\[data-genux-provider-owner\b/.test(
          subject,
        )
      )
        return true;
      if (subject.includes('&') && rule.parent.type === 'rule')
        return protectedSubject(rule.parent);
      return (
        subject.includes(']') &&
        !subject.includes('[') &&
        /preview-(?:screen|document|body)/.test(selector)
      );
    });
  const normal = selector =>
    selector
      .replace(/\s+/g, ' ')
      .replace(/\s*,\s*/g, ',')
      .replace(/\(\s+/g, '(')
      .replace(/\s+\)/g, ')')
      .trim();
  const selectors = new Map(
    [
      [
        ':where(body[data-preview-body], .example-preview-screen, [data-preview-document])',
        'light',
      ],
      [
        ":where(html[data-theme='dark'] body[data-preview-body], .example-preview-screen[data-theme='dark'], [data-preview-document][data-theme='dark'])",
        'dark',
      ],
    ].map(([selector, mode]) => [normal(selector), mode]),
  );
  const violations = [];
  const declarations = [];
  const styles = new Map();
  for (const file of files.filter(file => file.endsWith('.css'))) {
    const sheet = postcss.parse(await read(file), { from: file });
    styles.set(file, sheet);
    sheet.walkDecls(role, declaration => {
      const mode =
        declaration.parent.type === 'rule'
          ? selectors.get(normal(declaration.parent.selector))
          : undefined;
      if (
        file !== path ||
        !mode ||
        declaration.important ||
        declaration.parent.parent.type !== 'root'
      )
        violations.push(`${file}: ${role} may only be declared in its two canonical theme scopes`);
      else {
        declarations.push(mode);
        if (declaration.value.toLowerCase() !== want[mode])
          violations.push(`${role}.${mode} ${declaration.value} differs from human ${want[mode]}`);
      }
    });
    sheet.walkRules(rule => {
      if (!protectedSubject(rule)) return;
      rule.each(declaration => {
        if (
          declaration.type !== 'decl' ||
          !['background', 'background-color', 'background-image'].includes(declaration.prop)
        )
          return;
        const owner = owners.find(
          ([ownerFile, selector]) => ownerFile === file && normal(rule.selector) === selector,
        );
        if (
          !owner ||
          declaration.prop !== owner[2] ||
          declaration.value !== value ||
          declaration.important
        )
          violations.push(`${file} ${rule.selector}: competing paint may not replace ${role}`);
      });
    });
  }
  for (const mode of MODES)
    if (declarations.filter(item => item === mode).length !== 1)
      violations.push(`${role}.${mode} must have exactly one canonical declaration`);
  for (const [file, selector, property] of owners) {
    const paint = [];
    styles.get(file)?.walkRules(rule => {
      if (normal(rule.selector) === selector)
        rule.walkDecls(declaration => {
          if (['background', 'background-color'].includes(declaration.prop))
            paint.push(declaration);
        });
    });
    if (
      paint.length !== 1 ||
      paint[0].prop !== property ||
      paint[0].value !== value ||
      paint[0].important
    )
      violations.push(`${file} ${selector} must paint only ${role}, independently of canvas/panel`);
  }
  // Inspect the actual owner style initializer, including conditional/later literal spreads.
  // Counting the good literal elsewhere in the module would miss a competing late paint.
  for (const [provider, styleName, expectedPaint] of [
    ['docs/src/react/GenUXProvider.tsx', 'sizeStyle', `var(${role}, var(--paper))`],
    ['docs/src/react/PreviewWorkbench.tsx', 'screenStyle', value],
  ]) {
    const source = parseScript(provider, await read(provider));
    const styles = [];
    walk(source, node => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === styleName
      )
        styles.push(node.initializer);
    });
    const paints = [];
    for (const style of styles.filter(Boolean))
      walk(style, node => {
        if (
          ts.isPropertyAssignment(node) &&
          ['background', 'backgroundColor', 'backgroundImage'].includes(propertyName(node))
        )
          paints.push(node);
      });
    if (
      styles.length !== 1 ||
      paints.length !== 1 ||
      propertyName(paints[0]) !== 'backgroundColor' ||
      !ts.isStringLiteralLike(paints[0].initializer) ||
      paints[0].initializer.text !== expectedPaint
    )
      violations.push(
        `${provider} ${styleName} must paint only ${role}, with no competing inline paint`,
      );
  }
  for (const file of files.filter(file => CODE_FILE.test(file)))
    walk(parseScript(file, await read(file)), node => {
      if (!ts.isStringLiteralLike(node) || node.text !== role) return;
      // The literal is legitimate as the first argument of a read-only CSS getter.
      // Object keys, computed writes and mutation calls remain rejected.
      const call = node.parent;
      if (
        ts.isCallExpression(call) &&
        call.arguments[0] === node &&
        ts.isPropertyAccessExpression(call.expression) &&
        call.expression.name.text === 'getPropertyValue'
      )
        return;
      violations.push(`${file}: code may consume ${role} but may not write its value`);
    });
  const definitions = parseJson(SOURCES.definitions, await read(SOURCES.definitions));
  if (definitions.some(definition => definition.id === 'preview-screen-surface'))
    violations.push(`${role} must not become an editable Theme Builder definition`);
  return violations;
}

function parseJson(path, text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error.message}`);
  }
}

function parseCss(path, text) {
  try {
    return postcss.parse(text, { from: path });
  } catch (error) {
    throw new Error(`${path} has a CSS syntax error: ${error.reason ?? error.message}`);
  }
}

function scriptKind(path) {
  if (path.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (path.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (/\.[cm]?ts$/.test(path)) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

function parseScript(path, text) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKind(path));
  const [diagnostic] = source.parseDiagnostics ?? [];
  if (diagnostic)
    throw new Error(
      `${path} has a syntax error: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`,
    );
  return source;
}

function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, child => walk(child, visit));
}

function unwrap(node) {
  while (
    node &&
    (ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isParenthesizedExpression(node) ||
      ts.isTypeAssertionExpression(node))
  )
    node = node.expression;
  return node;
}

function propertyName(property) {
  const name = property.name;
  return name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text : undefined;
}

/** The initializer of the one top-level const with this name. */
function topConst(source, name) {
  const found = [];
  for (const statement of source.statements)
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name) && declaration.name.text === name)
          found.push(declaration);
  if (found.length !== 1 || !found[0].initializer)
    throw new Error(`${source.fileName} must declare exactly one top-level ${name}.`);
  return unwrap(found[0].initializer);
}

function numberLiteral(node, label) {
  const literal = unwrap(node);
  if (!literal || !ts.isNumericLiteral(literal))
    throw new Error(`${label} must be a numeric literal.`);
  return Number(literal.text);
}

async function checkMacbook({ facts, read }) {
  const want = {
    width: requireFact(facts, 'macbook.width'),
    height: requireFact(facts, 'macbook.height'),
    container: requireFact(facts, 'macbook.container'),
  };
  const source = parseScript(SOURCES.devices, await read(SOURCES.devices));
  const macbook = topConst(source, 'macbook');
  if (!ts.isObjectLiteralExpression(macbook))
    throw new Error(`${SOURCES.devices}: macbook must be an object literal.`);
  const calls = macbook.properties
    .filter(property => ts.isSpreadAssignment(property))
    .map(property => unwrap(property.expression))
    .filter(
      call =>
        ts.isCallExpression(call) &&
        ts.isIdentifier(call.expression) &&
        call.expression.text === 'fixedScreen',
    );
  if (calls.length !== 1 || calls[0].arguments.length < 2 || calls[0].arguments.length > 3)
    throw new Error(
      `${SOURCES.devices}: macbook must spread exactly one fixedScreen(width, height, container).`,
    );
  const [width, height, container] = calls[0].arguments;
  const actual = {
    width: numberLiteral(width, 'macbook width'),
    height: numberLiteral(height, 'macbook height'),
  };
  actual.container = container ? numberLiteral(container, 'macbook container') : actual.width;
  const violations = Object.keys(want)
    .filter(key => actual[key] !== want[key])
    .map(key => `macbook ${key} ${actual[key]}px differs from human ${want[key]}px`);
  // Fail closed: only the one fixedScreen spread and plainly named properties are understood.
  for (const property of macbook.properties) {
    if (ts.isSpreadAssignment(property)) {
      if (!calls.includes(unwrap(property.expression)))
        violations.push('macbook spreads a value other than its one fixedScreen call');
      continue;
    }
    if (property.name && ts.isComputedPropertyName(property.name)) {
      violations.push('macbook has a computed property name that could override the fixed screen');
      continue;
    }
    const name = propertyName(property);
    if (name && FIXED_SCREEN_ROLES.has(name))
      violations.push(`macbook overrides the fixed screen role ${name}`);
  }
  return violations;
}

const isFixedScreenCall = node =>
  ts.isCallExpression(node) &&
  ts.isIdentifier(node.expression) &&
  node.expression.text === 'fixedScreen';

/** fixedScreen itself is frozen geometry: fail closed unless it is the one plain mapping. */
async function checkFixedScreen({ read }) {
  const source = parseScript(SOURCES.devices, await read(SOURCES.devices));
  const helpers = source.statements.filter(
    statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'fixedScreen',
  );
  if (helpers.length !== 1)
    return [
      `${SOURCES.devices} must declare exactly one top-level fixedScreen function, found ${helpers.length}`,
    ];
  const [helper] = helpers;
  const violations = [];
  // Every other mention is a direct call: no rebinding, shadowing, import or reassignment.
  walk(source, node => {
    if (
      ts.isIdentifier(node) &&
      node.text === 'fixedScreen' &&
      node !== helper.name &&
      !(isFixedScreenCall(node.parent) && node.parent.expression === node)
    )
      violations.push(
        `fixedScreen is used other than as a direct call at line ${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`,
      );
  });
  if (helper.modifiers?.length || helper.asteriskToken || helper.typeParameters?.length)
    violations.push('fixedScreen must be a plain function without modifiers or type parameters');
  if (helper.parameters.length !== FIXED_SCREEN_PARAMETERS.length)
    violations.push(
      `fixedScreen must take exactly (width, height, container = width), found ${helper.parameters.length} parameters`,
    );
  else
    helper.parameters.forEach((parameter, index) => {
      const want = FIXED_SCREEN_PARAMETERS[index];
      if (
        !ts.isIdentifier(parameter.name) ||
        parameter.name.text !== want ||
        parameter.dotDotDotToken ||
        parameter.questionToken ||
        parameter.modifiers?.length
      )
        violations.push(`fixedScreen parameter ${index + 1} must be plain ${want}`);
      const fallback = parameter.initializer && unwrap(parameter.initializer);
      if (want === 'container') {
        if (!fallback || !ts.isIdentifier(fallback) || fallback.text !== 'width')
          violations.push('fixedScreen container must default to width');
      } else if (fallback) violations.push(`fixedScreen ${want} must not have a default`);
    });
  // One return of plain parameter reads: no statements, side effects, spreads or computed keys.
  const statements = helper.body?.statements ?? [];
  const returned =
    statements.length === 1 && ts.isReturnStatement(statements[0])
      ? unwrap(statements[0].expression)
      : undefined;
  if (!returned || !ts.isObjectLiteralExpression(returned))
    return [...violations, 'fixedScreen body must be exactly one return of an object literal'];
  const seen = new Set();
  for (const property of returned.properties) {
    const name = ts.isPropertyAssignment(property) ? propertyName(property) : undefined;
    if (!name || !Object.hasOwn(FIXED_SCREEN_MAPPING, name)) {
      violations.push(`fixedScreen returns the unexpected entry ${property.getText(source)}`);
      continue;
    }
    if (seen.has(name)) violations.push(`fixedScreen returns ${name} twice`);
    seen.add(name);
    const value = unwrap(property.initializer);
    if (!ts.isIdentifier(value) || value.text !== FIXED_SCREEN_MAPPING[name])
      violations.push(
        `fixedScreen maps ${name} to ${value.getText(source)} instead of ${FIXED_SCREEN_MAPPING[name]}`,
      );
  }
  for (const name of Object.keys(FIXED_SCREEN_MAPPING))
    if (!seen.has(name)) violations.push(`fixedScreen does not return ${name}`);
  return violations;
}

/** The entry's one literal value; only a fixedScreen spread may add roles, never a value. */
function deviceValue(source, element) {
  let node = unwrap(element);
  if (ts.isIdentifier(node)) node = topConst(source, node.text);
  if (!ts.isObjectLiteralExpression(node))
    throw new Error(`${source.fileName}: every previewDevices entry must be an object literal.`);
  const values = [];
  const names = new Set();
  const duplicates = [];
  for (const property of node.properties) {
    if (ts.isSpreadAssignment(property)) {
      const call = unwrap(property.expression);
      if (
        !isFixedScreenCall(call) ||
        call.arguments.length < 2 ||
        call.arguments.length > 3 ||
        !call.arguments.every(argument => ts.isNumericLiteral(unwrap(argument)))
      )
        throw new Error(
          `${source.fileName}: previewDevices entries may only spread fixedScreen(width, height[, container]) with numeric literals, not ${call.getText(source)}.`,
        );
      continue;
    }
    if (property.name && ts.isComputedPropertyName(property.name))
      throw new Error(
        `${source.fileName}: previewDevices entries cannot use the computed property ${property.name.getText(source)}.`,
      );
    // Plain fields with primitive literal values only, so the detached copy fires no accessor.
    const initializer = ts.isPropertyAssignment(property) && unwrap(property.initializer);
    if (
      !initializer ||
      !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) ||
      !(
        ts.isNumericLiteral(initializer) ||
        ts.isStringLiteralLike(initializer) ||
        initializer.kind === ts.SyntaxKind.TrueKeyword ||
        initializer.kind === ts.SyntaxKind.FalseKeyword
      )
    )
      throw new Error(
        `${source.fileName}: previewDevices entries may only hold plain fields with primitive literal values, not ${property.getText(source)}.`,
      );
    const name = property.name.text;
    if (names.has(name)) duplicates.push(name);
    names.add(name);
    if (name === 'value') values.push(property);
  }
  if (values.length !== 1)
    throw new Error(
      `${source.fileName}: every previewDevices entry needs exactly one value, found ${values.length}.`,
    );
  if (duplicates.length)
    throw new Error(
      `${source.fileName}: a previewDevices entry repeats the field ${duplicates.join(', ')}.`,
    );
  const literal = ts.isPropertyAssignment(values[0]) && unwrap(values[0].initializer);
  if (!literal || !ts.isStringLiteralLike(literal))
    throw new Error(`${source.fileName}: every previewDevices entry needs a literal value.`);
  return literal.text;
}

async function checkPreviewDevices({ facts, read }) {
  const surfaces = requireFact(facts, 'supportedSurfaces');
  const source = parseScript(SOURCES.devices, await read(SOURCES.devices));
  const list = topConst(source, 'previewDevices');
  if (!ts.isArrayLiteralExpression(list))
    throw new Error(`${SOURCES.devices}: previewDevices must be an array literal.`);
  const values = list.elements.map(element => deviceValue(source, element));
  const violations = [];
  // The macbook slot must be the canonical binding checkMacbook validated: an inline copy or
  // another identifier could carry altered geometry the lookup would then select. No other
  // const may be named either: a later write could turn it into a second macbook.
  list.elements.forEach((element, index) => {
    let node = element;
    while (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression?.(node) ||
      ts.isNonNullExpression(node) ||
      ts.isTypeAssertionExpression(node)
    )
      node = node.expression;
    if (ts.isIdentifier(node) && node.text !== 'macbook' && node.text !== 'tv')
      violations.push(
        `previewDevices entries may only name the canonical macbook or tv binding, not ${node.text}`,
      );
    if (values[index] !== 'macbook') return;
    if (!ts.isIdentifier(node) || node.text !== 'macbook')
      violations.push(
        'previewDevices must list the canonical macbook binding for the macbook device',
      );
  });
  if (new Set(values).size !== values.length)
    violations.push(`previewDevices repeats a device: ${values.join(', ')}`);
  if (values.length !== surfaces.length)
    violations.push(
      `previewDevices has ${values.length} devices (${values.join(', ')}); the human surfaces are ${surfaces.join(', ')}`,
    );
  // Exactly the approved device for each human surface, and nothing else.
  const approved = [];
  for (const surface of surfaces) {
    const device = Object.hasOwn(SURFACE_DEVICES, surface) ? SURFACE_DEVICES[surface] : undefined;
    if (!device) {
      violations.push(`the human surface ${surface} has no approved preview device`);
      continue;
    }
    approved.push(device);
    if (!values.includes(device))
      violations.push(`previewDevices has no ${device} device for the human ${surface} surface`);
  }
  for (const value of values)
    if (!approved.includes(value))
      violations.push(`previewDevices ${value} is not an approved human surface device`);
  return violations;
}

const lineOf = (source, node) =>
  source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

/** Name slots that never read a binding; a shorthand property still reads its value. */
function isNameOnly(node) {
  const parent = node.parent;
  if (ts.isQualifiedName(parent)) return parent.right === node;
  return (
    parent.name === node &&
    (ts.isPropertyAccessExpression(parent) ||
      ts.isPropertyAssignment(parent) ||
      ts.isPropertySignature(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isMethodSignature(parent) ||
      ts.isJsxAttribute(parent) ||
      ts.isEnumMember(parent))
  );
}

/** Assignment targets, update and delete operands and for-in/of heads write through a node. */
function isWriteSlot(node) {
  const parent = node.parent;
  if (ts.isBinaryExpression(parent))
    return (
      parent.left === node &&
      parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    );
  if (ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent))
    return (
      parent.operator === ts.SyntaxKind.PlusPlusToken ||
      parent.operator === ts.SyntaxKind.MinusMinusToken
    );
  if (ts.isForInStatement(parent) || ts.isForOfStatement(parent))
    return parent.initializer === node;
  return ts.isDeleteExpression(parent);
}

/** Own primitive fields a previewDevices.map callback may read; never inherited members. */
const READ_ONLY_FIELDS = new Set(['value', 'label']);

/** Casts and non-null assertions keep the value: a field cast to a function is still called. */
function isTransparentWrapper(parent, child) {
  return (
    (ts.isParenthesizedExpression(parent) ||
      ts.isAsExpression(parent) ||
      ts.isSatisfiesExpression(parent) ||
      ts.isTypeAssertionExpression(parent) ||
      ts.isNonNullExpression(parent)) &&
    parent.expression === child
  );
}

/** param.value or param.label read as a value: never chained, called, or written anywhere up to
    the callback, even through casts. */
function isFieldRead(node, callback) {
  const access = node.parent;
  if (
    !ts.isPropertyAccessExpression(access) ||
    access.expression !== node ||
    access.questionDotToken ||
    !ts.isIdentifier(access.name) ||
    !READ_ONLY_FIELDS.has(access.name.text)
  )
    return false;
  let outer = access;
  while (isTransparentWrapper(outer.parent, outer)) outer = outer.parent;
  const user = outer.parent;
  if (
    ((ts.isPropertyAccessExpression(user) ||
      ts.isElementAccessExpression(user) ||
      ts.isCallExpression(user) ||
      ts.isNewExpression(user)) &&
      user.expression === outer) ||
    (ts.isTaggedTemplateExpression(user) && user.tag === outer)
  )
    return false;
  for (let child = access; child !== callback; child = child.parent)
    if (isWriteSlot(child)) return false;
  return true;
}

/** list.map(item => ...) whose one plain parameter the callback only reads as fields. */
function isReadOnlyMap(node) {
  const access = node.parent;
  const call = access.parent;
  if (
    !ts.isPropertyAccessExpression(access) ||
    access.expression !== node ||
    access.name.text !== 'map' ||
    !ts.isCallExpression(call) ||
    call.expression !== access ||
    call.arguments.length !== 1
  )
    return false;
  const [callback] = call.arguments;
  if (!ts.isArrowFunction(callback) || callback.parameters.length !== 1) return false;
  const [parameter] = callback.parameters;
  if (!ts.isIdentifier(parameter.name) || parameter.initializer || parameter.dotDotDotToken)
    return false;
  let readOnly = true;
  walk(callback.body, child => {
    if (
      ts.isIdentifier(child) &&
      child.text === parameter.name.text &&
      !isNameOnly(child) &&
      !isFieldRead(child, callback)
    )
      readOnly = false;
  });
  return readOnly;
}

/** One plain parameter with the exact name: no default, rest, optional mark or modifier. */
function isPlainParameter(parameter, name) {
  return (
    ts.isIdentifier(parameter.name) &&
    parameter.name.text === name &&
    !parameter.initializer &&
    !parameter.dotDotDotToken &&
    !parameter.questionToken &&
    !parameter.modifiers?.length
  );
}

/** The one approved lookup returns a detached shallow copy; no caller reaches a registry object:
    return { ...(previewDevices.find(item => item.value === device) ?? macbook) }. */
function registryLookup(source) {
  const functions = source.statements.filter(
    statement =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === 'previewDeviceDefinition',
  );
  // A plain exported synchronous getter whose one parameter is the device the callback compares.
  const getter = functions.length === 1 ? functions[0] : undefined;
  const statements =
    getter &&
    getter.modifiers?.length === 1 &&
    getter.modifiers[0].kind === ts.SyntaxKind.ExportKeyword &&
    !getter.asteriskToken &&
    !getter.typeParameters &&
    getter.parameters.length === 1 &&
    isPlainParameter(getter.parameters[0], 'device')
      ? (getter.body?.statements ?? [])
      : [];
  const copy =
    statements.length === 1 && ts.isReturnStatement(statements[0])
      ? statements[0].expression
      : undefined;
  const spread =
    copy && ts.isObjectLiteralExpression(copy) && copy.properties.length === 1
      ? copy.properties[0]
      : undefined;
  const returned =
    spread && ts.isSpreadAssignment(spread) && ts.isParenthesizedExpression(spread.expression)
      ? spread.expression.expression
      : undefined;
  if (
    !returned ||
    !ts.isBinaryExpression(returned) ||
    returned.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken ||
    !ts.isIdentifier(returned.right) ||
    returned.right.text !== 'macbook'
  )
    return undefined;
  const call = returned.left;
  const access = ts.isCallExpression(call) ? call.expression : undefined;
  if (
    !access ||
    !ts.isPropertyAccessExpression(access) ||
    !ts.isIdentifier(access.expression) ||
    access.expression.text !== 'previewDevices' ||
    access.name.text !== 'find' ||
    call.arguments.length !== 1
  )
    return undefined;
  const [callback] = call.arguments;
  // A plain synchronous arrow whose one parameter is exactly item, so device stays the getter's.
  if (
    !ts.isArrowFunction(callback) ||
    callback.modifiers?.length ||
    callback.typeParameters ||
    callback.parameters.length !== 1
  )
    return undefined;
  const [parameter] = callback.parameters;
  const body = callback.body;
  if (
    !isPlainParameter(parameter, 'item') ||
    !ts.isBinaryExpression(body) ||
    body.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken ||
    !ts.isPropertyAccessExpression(body.left) ||
    !ts.isIdentifier(body.left.expression) ||
    body.left.expression.text !== parameter.name.text ||
    body.left.name.text !== 'value' ||
    !ts.isIdentifier(body.right) ||
    body.right.text !== 'device'
  )
    return undefined;
  return { list: access.expression, fallback: returned.right };
}

const fromDevices = node =>
  Boolean(node) && ts.isStringLiteralLike(node) && DEVICES_SPECIFIER.test(node.text);

/** Imported previewDevices: only a read-only map; re-exports, namespace escapes and loads reject. */
function importedRegistryUses(source) {
  const at = node => `${source.fileName}:${lineOf(source, node)}`;
  const violations = [];
  const locals = new Set();
  const namespaces = new Set();
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && fromDevices(statement.moduleSpecifier)) {
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
      else
        for (const element of bindings?.elements ?? [])
          if ((element.propertyName ?? element.name).text === 'previewDevices')
            locals.add(element.name.text);
    } else if (ts.isExportDeclaration(statement) && fromDevices(statement.moduleSpecifier)) {
      const clause = statement.exportClause;
      if (
        !clause ||
        !ts.isNamedExports(clause) ||
        clause.elements.some(
          element => (element.propertyName ?? element.name).text === 'previewDevices',
        )
      )
        violations.push(`${at(statement)} re-exports previewDevices`);
    }
  }
  walk(source, node => {
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
      fromDevices(node.arguments[0])
    )
      violations.push(`${at(node)} loads the devices module dynamically`);
    if (
      !ts.isIdentifier(node) ||
      isNameOnly(node) ||
      ts.isImportSpecifier(node.parent) ||
      ts.isNamespaceImport(node.parent) ||
      ts.isImportClause(node.parent)
    )
      return;
    if (locals.has(node.text)) {
      if (!isReadOnlyMap(node))
        violations.push(`${at(node)} uses the imported previewDevices other than a read-only map`);
    } else if (namespaces.has(node.text)) {
      const access = node.parent;
      if (!ts.isPropertyAccessExpression(access) || access.expression !== node)
        violations.push(`${at(node)} uses the devices namespace other than a member read`);
      else if (access.name.text === 'previewDevices' && !isReadOnlyMap(access))
        violations.push(`${at(node)} uses the imported previewDevices other than a read-only map`);
    }
  });
  return violations;
}

/** Registry objects stay as initialized: only the understood read-only positions may name them. */
async function checkDeviceRegistry({ files, read }) {
  const source = parseScript(SOURCES.devices, await read(SOURCES.devices));
  const violations = [];
  const declared = new Map(REGISTRY_NAMES.map(name => [name, []]));
  for (const statement of source.statements)
    if (ts.isVariableStatement(statement))
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const name = declaration.name.text;
        if (declared.has(name)) declared.get(name).push(declaration.name);
        // The raw macbook and tv objects stay private; callers get the getter's detached copy.
        if (
          (name === 'macbook' || name === 'tv') &&
          statement.modifiers?.some(
            modifier =>
              modifier.kind === ts.SyntaxKind.ExportKeyword ||
              modifier.kind === ts.SyntaxKind.DefaultKeyword,
          )
        )
          violations.push(
            `${SOURCES.devices}:${lineOf(source, declaration.name)} exports ${name}; the raw registry binding must remain private`,
          );
      }
  for (const [name, names] of declared)
    if (names.length > 1)
      violations.push(`${SOURCES.devices} declares ${name} ${names.length} times at top level`);
  const accepted = new Set([...declared.values()].flat());
  const list = topConst(source, 'previewDevices');
  if (ts.isArrayLiteralExpression(list))
    for (const element of list.elements)
      if (ts.isIdentifier(element) && (element.text === 'macbook' || element.text === 'tv'))
        accepted.add(element);
  const lookup = registryLookup(source);
  if (lookup) accepted.add(lookup.list).add(lookup.fallback);
  else
    violations.push(
      `${SOURCES.devices} previewDeviceDefinition must return a detached copy of the one approved lookup`,
    );
  // The getter binding stays as declared: only its declaration name and direct calls name it.
  const getterNames = new Set(
    source.statements
      .filter(
        statement =>
          ts.isFunctionDeclaration(statement) && statement.name?.text === 'previewDeviceDefinition',
      )
      .map(statement => statement.name),
  );
  walk(source, node => {
    if (!ts.isIdentifier(node)) return;
    if (node.text === 'previewDeviceDefinition') {
      const call = node.parent;
      if (!getterNames.has(node) && !(ts.isCallExpression(call) && call.expression === node))
        violations.push(
          `${SOURCES.devices}:${lineOf(source, node)} uses previewDeviceDefinition other than its declaration or a direct call`,
        );
      return;
    }
    if (accepted.has(node) || isNameOnly(node)) return;
    if (REGISTRY_NAMES.includes(node.text))
      violations.push(
        `${SOURCES.devices}:${lineOf(source, node)} uses ${node.text} outside the understood read-only positions`,
      );
    else if (node.text === 'eval' || node.text === 'Function')
      violations.push(
        `${SOURCES.devices}:${lineOf(source, node)} uses ${node.text}, which is not analyzed`,
      );
  });
  for (const path of files) {
    if (path === SOURCES.devices) continue;
    if (CODE_FILE.test(path)) {
      const imported = parseScript(path, await read(path));
      violations.push(...importedRegistryUses(imported));
      // Like the registry module itself, a file naming it may not evaluate code: a direct eval
      // or Function sees bindings the identifier scan only reads as strings.
      let importsRegistry = false;
      const dynamic = [];
      walk(imported, node => {
        if (
          (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
          /(^|\/)preview-devices(\.[cm]?[jt]sx?)?$/.test(node.text)
        )
          importsRegistry = true;
        else if (
          ts.isIdentifier(node) &&
          (node.text === 'eval' || node.text === 'Function') &&
          !isNameOnly(node)
        )
          dynamic.push(node);
      });
      if (importsRegistry)
        for (const node of dynamic)
          violations.push(
            `${path}:${lineOf(imported, node)} uses ${node.text}, which is not analyzed`,
          );
    } else if (MARKUP_FILE.test(path) && MARKUP_REGISTRY.test(await read(path)))
      violations.push(`${path} reaches previewDevices from markup, which is not analyzed`);
  }
  return violations;
}

async function checkPreviewThreshold({ facts, read }) {
  const want = requireFact(facts, 'previewActualMinWidth');
  const source = parseScript(SOURCES.workbenchLayout, await read(SOURCES.workbenchLayout));
  const actual = numberLiteral(
    topConst(source, 'MACBOOK_WIDE_MIN_VIEWPORT_PX'),
    'MACBOOK_WIDE_MIN_VIEWPORT_PX',
  );
  return actual === want
    ? []
    : [`MACBOOK_WIDE_MIN_VIEWPORT_PX ${actual} differs from human ${want}`];
}

async function checkRail({ facts, files, read }) {
  const want = `${requireFact(facts, 'railMaxWidth')}px`;
  const found = [];
  for (const path of files.filter(file => file.endsWith('.css')))
    parseCss(path, await read(path)).walkDecls(RAIL_ROLE, declaration =>
      found.push({ path, value: declaration.value.trim() }),
    );
  if (found.length !== 1)
    return [
      `${RAIL_ROLE} must be declared exactly once centrally, found ${found.length}${found.length ? ` in ${found.map(item => item.path).join(', ')}` : ''}`,
    ];
  const violations = [];
  if (found[0].path !== SOURCES.shellLayout)
    violations.push(`${RAIL_ROLE} must live in ${SOURCES.shellLayout}, not ${found[0].path}`);
  if (found[0].value !== want)
    violations.push(`${RAIL_ROLE} ${found[0].value} differs from human ${want}`);
  return violations;
}

async function checkAdaptivePolicy({ facts, read }) {
  const want = requireFact(facts, 'adaptivePolicy');
  const actual = parseJson(SOURCES.policy, await read(SOURCES.policy));
  return isDeepStrictEqual(actual, want)
    ? []
    : [`${SOURCES.policy} differs from the human adaptivePolicy`];
}

/** Factory definitions only: user recipes stay editable and are never read or written here. */
async function checkDefinitions({ facts, read }) {
  const palette = requireFact(facts, 'palette');
  const radiusDefault = requireFact(facts, 'radius.default');
  const radiusOptions = requireFact(facts, 'radius.options');
  const minimum = requireFact(facts, 'typography.minimum');
  const textDefault = requireFact(facts, 'typography.default');
  const weightMinimum = requireFact(facts, 'typography.weightMinimum');
  const weightDefault = requireFact(facts, 'typography.weightDefault');
  const path = SOURCES.definitions;
  const definitions = parseJson(path, await read(path));
  if (!Array.isArray(definitions)) throw new Error(`${path} must be an array of definitions.`);
  const violations = [];
  const byId = new Map();
  for (const definition of definitions) {
    if (typeof definition?.id !== 'string')
      throw new Error(`${path} has a definition without a string id.`);
    if (byId.has(definition.id)) violations.push(`${definition.id} is defined twice`);
    byId.set(definition.id, definition);
  }
  const lookup = id => {
    const found = byId.get(id);
    if (!found) violations.push(`${path} is missing the ${id} definition`);
    return found;
  };
  const expectDefaults = (definition, want) => {
    for (const mode of MODES) {
      const actual = definition.defaults?.[mode];
      if (actual !== want)
        violations.push(`${definition.id}.${mode} default ${actual} differs from human ${want}`);
    }
  };

  // Frozen palette: the color definitions are exactly the human palette, each mode on its own.
  for (const definition of definitions)
    if (definition.kind === 'color' && !Object.hasOwn(palette, definition.id))
      violations.push(`color ${definition.id} is not in the human palette`);
  for (const [id, want] of Object.entries(palette)) {
    const definition = lookup(id);
    if (!definition) continue;
    if (definition.kind !== 'color') violations.push(`palette ${id} must stay a color definition`);
    for (const mode of MODES) {
      const actual = definition.defaults?.[mode];
      if (typeof actual !== 'string' || actual.toLowerCase() !== String(want?.[mode]).toLowerCase())
        violations.push(
          `palette ${id}.${mode} default ${actual} differs from human ${want?.[mode]}`,
        );
    }
  }

  for (const step of STEPS) {
    const definition = lookup(`radius-${step}`);
    if (!definition) continue;
    expectDefaults(definition, radiusDefault);
    if (!isDeepStrictEqual(definition.options, radiusOptions))
      violations.push(`radius-${step} options differ from human ${radiusOptions.join(', ')}`);
  }

  for (const [family, prefix] of SIZE_FAMILIES) {
    const heights = requireFact(facts, `sizes.${family}`);
    STEPS.forEach((step, index) => {
      const definition = lookup(`${prefix}-${step}`);
      if (definition) expectDefaults(definition, heights[index]);
    });
  }

  const texts = definitions.filter(definition => definition.id.startsWith('text-'));
  if (!texts.length) violations.push(`${path} has no text-* definitions`);
  for (const definition of texts) {
    if (typeof definition.min !== 'number' || definition.min < minimum)
      violations.push(
        `${definition.id} minimum ${definition.min} is below the human ${minimum} CSS px`,
      );
    if (definition.id !== 'text-heading') expectDefaults(definition, textDefault);
    else
      for (const mode of MODES) {
        const actual = definition.defaults?.[mode];
        if (typeof actual !== 'number' || actual < textDefault)
          violations.push(`text-heading.${mode} default ${actual} is below human ${textDefault}`);
      }
  }
  const weight = lookup('font-weight');
  if (weight) {
    if (typeof weight.min !== 'number' || weight.min < weightMinimum)
      violations.push(`font-weight minimum ${weight.min} is below human ${weightMinimum}`);
    expectDefaults(weight, weightDefault);
  }
  return violations;
}

async function checkFontMinimum({ facts, read }) {
  const minimum = requireFact(facts, 'typography.minimum');
  const source = parseScript(SOURCES.model, await read(SOURCES.model));
  const actual = numberLiteral(topConst(source, 'MIN_FONT_SIZE_PX'), 'MIN_FONT_SIZE_PX');
  return actual >= minimum
    ? []
    : [`MIN_FONT_SIZE_PX ${actual} is below the human ${minimum} CSS px`];
}

const isConcatenation = node =>
  ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken;

function templateText(node) {
  return (
    node.head.text +
    node.templateSpans
      .map(
        span =>
          (ts.isStringLiteralLike(span.expression) ? span.expression.text : '') + span.literal.text,
      )
      .join('')
  );
}

function literalParts(node) {
  const inner = unwrap(node);
  if (isConcatenation(inner)) return [...literalParts(inner.left), ...literalParts(inner.right)];
  if (ts.isStringLiteralLike(inner)) return [inner.text];
  if (ts.isTemplateExpression(inner)) return [templateText(inner)];
  return [''];
}

/** Statically assembled literal text; a concatenation reports once from its root. */
function assembledText(node) {
  if (node.parent && isConcatenation(node.parent)) return undefined;
  if (isConcatenation(node)) return literalParts(node).join('');
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isTemplateExpression(node)) return templateText(node);
  return undefined;
}

function iframeInScript(source) {
  const found = [];
  const at = node =>
    `${source.fileName}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`;
  const contract = /delivery-contract/i.test(posix.basename(source.fileName));
  walk(source, node => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(source).toLowerCase() === 'iframe'
    )
      found.push(`${at(node)} renders an <iframe>`);
    else if (
      ts.isCallExpression(node) &&
      /(?:^|\.)createElement$/.test(node.expression.getText(source)) &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      node.arguments[0].text.toLowerCase() === 'iframe'
    )
      found.push(`${at(node)} creates an iframe element`);
    else if (contract && IFRAME_MARKUP.test(assembledText(node) ?? ''))
      found.push(`${at(node)} generates <iframe> usage`);
  });
  return found;
}

function iframeInMarkup(path, text) {
  const found = [];
  let template = text;
  const frontmatter = path.endsWith('.astro') ? text.match(/^---\r?\n([\s\S]*?)\r?\n---/) : null;
  if (frontmatter) {
    const script = ts.createSourceFile(
      `${path}.ts`,
      frontmatter[1],
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    found.push(...iframeInScript(script));
    template = text.slice(frontmatter[0].length);
  }
  const markup = template
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');
  if (IFRAME_MARKUP.test(markup)) found.push(`${path} renders an <iframe>`);
  return found;
}

function uniqueComponent(files, name) {
  const matches = files.filter(
    path => CODE_FILE.test(path) && posix.basename(path).replace(CODE_FILE, '') === name,
  );
  if (matches.length !== 1)
    throw new Error(
      `expected exactly one ${name} source, found ${matches.length}${matches.length ? `: ${matches.join(', ')}` : ''}`,
    );
  return matches[0];
}

function jsxElements(source, name) {
  const found = [];
  walk(source, node => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === name)
      found.push(node);
    else if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === name)
      found.push(node);
  });
  return found;
}

const openingOf = element => (ts.isJsxElement(element) ? element.openingElement : element);

function passesChildren(element) {
  const attributes = openingOf(element).attributes.properties;
  if (
    attributes.some(
      attribute =>
        ts.isJsxAttribute(attribute) &&
        ts.isIdentifier(attribute.name) &&
        attribute.name.text === 'children' &&
        attribute.initializer,
    )
  )
    return true;
  return (
    ts.isJsxElement(element) &&
    element.children.some(child =>
      ts.isJsxText(child)
        ? !child.containsOnlyTriviaWhiteSpaces
        : !ts.isJsxExpression(child) || Boolean(child.expression),
    )
  );
}

function isNameSlot(node) {
  const parent = node.parent;
  return (
    (ts.isJsxAttribute(parent) && parent.name === node) ||
    (ts.isPropertyAssignment(parent) && parent.name === node)
  );
}

function forwardsChildren(element) {
  const roots = [
    ...openingOf(element).attributes.properties.map(attribute =>
      ts.isJsxAttribute(attribute) ? attribute.initializer : attribute.expression,
    ),
    ...(ts.isJsxElement(element) ? element.children : []),
  ].filter(Boolean);
  let found = false;
  for (const root of roots)
    walk(root, node => {
      if (ts.isIdentifier(node) && node.text === 'children' && !isNameSlot(node)) found = true;
    });
  return found;
}

/** Inline components only: no iframe anywhere, and example children reach the device frame. */
async function checkInlinePreview({ files, read }) {
  const violations = [];
  for (const path of files) {
    if (CODE_FILE.test(path))
      violations.push(...iframeInScript(parseScript(path, await read(path))));
    else if (MARKUP_FILE.test(path)) violations.push(...iframeInMarkup(path, await read(path)));
  }
  try {
    const path = uniqueComponent(files, 'ExamplePreview');
    const source = parseScript(path, await read(path));
    if (!jsxElements(source, 'PreviewWorkbench').some(passesChildren))
      violations.push(`${path} must pass its example as children to PreviewWorkbench`);
  } catch (error) {
    violations.push(error.message);
  }
  try {
    const path = uniqueComponent(files, 'PreviewWorkbench');
    const source = parseScript(path, await read(path));
    const frames = [...jsxElements(source, 'InlinePreview'), ...jsxElements(source, 'DeviceFrame')];
    if (!frames.some(forwardsChildren))
      violations.push(`${path} must render its children inside InlinePreview or DeviceFrame`);
  } catch (error) {
    violations.push(error.message);
  }
  return violations;
}
