import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'postcss';
import stylelint from 'stylelint';

// Focus cues must never surround a control. Outlines are allowed only as the forced-colors
// fallback (2px solid CanvasText); focus-state shadows may paint at most one edge, such as the
// bottom field marker or the start-edge list bar. var() lengths are proven against every value
// the authored stylesheets bind; values that cannot be verified statically are rejected instead
// of trusted; stylelint.config.mjs ignores disable comments.
const {
  createPlugin,
  utils: { report, ruleMessages, validateOptions },
} = stylelint;

export const ruleName = 'genux/focus-no-surround';

export const messages = ruleMessages(ruleName, {
  outline: (prop, value) =>
    `'${prop}: ${value}' paints an outline outside forced-colors; only none or 0 is allowed`,
  forced: (prop, value) =>
    `'${prop}: ${value}' in forced-colors must be none, 0 or 2px solid CanvasText on a keyboard-gated :focus-visible subject`,
  shadow: (selector, value) =>
    `'${selector}' focus shadow '${value}' surrounds the control, paints several edges or hides lengths in var()`,
});

const FOCUS =
  /:focus(?:-visible|-within)?(?![\w-])|\[data-focus(?:-visible|ed)?(?=[\]=~|^$*])|\w-focused(?![\w-])/i;
const FORCED = /\(\s*forced-colors\s*(?::\s*active\s*)?\)/i;
const SHADOW = /^(?:-webkit-)?box-shadow$/;
const ZERO = /^[+-]?(?:0+\.?0*|\.0+)[a-z]*$/;
const LENGTH = /^[+-]?(?:\d+\.?\d*|\.\d+)[a-z]*$/;
const MATH = /^(?:calc|min|max|clamp)\(/;
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)[a-z%]*$/;
const VAR = /^var\(\s*(--[\w-]+)\s*(?:,([\s\S]*))?\)$/;
const MATH_TOKEN =
  /var\((?:[^()]|\([^()]*\))*\)|(?:calc|min|max|clamp)\(|[+-]?(?:\d+\.?\d*|\.\d+)[a-z%]*|[-+*\/(),]/g;
const project = resolve(import.meta.dirname, '..');
const AUTHORED = ['src', 'docs/src', 'storybook', '.storybook'];
const SKIPPED = new Set(['node_modules', 'dist', 'storybook-static']);

// Every authored stylesheet; tools/docs-lint.mjs lints the same set.
export function authoredStylesheets(root) {
  const walk = directory => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
    return entries.flatMap(entry => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return SKIPPED.has(entry.name) ? [] : walk(path);
      return entry.name.endsWith('.css') ? [path] : [];
    });
  };
  return AUTHORED.flatMap(path => walk(resolve(root, path)));
}

// Splits at top-level separators so var(), calc() and color functions stay intact.
function split(value, separator) {
  const parts = [];
  let depth = 0;
  let part = '';
  for (const char of value) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (depth === 0 && separator.test(char)) {
      if (part) parts.push(part);
      part = '';
    } else part += char;
  }
  if (part) parts.push(part);
  return parts;
}

// :not(:focus-visible) describes the resting state, so negated arguments are not focus context.
function withoutNegation(selector) {
  let kept = '';
  for (let index = 0; index < selector.length; index++) {
    if (selector.startsWith(':not(', index)) {
      let depth = 0;
      for (index += 4; index < selector.length; index++) {
        if (selector[index] === '(') depth++;
        if (selector[index] === ')' && --depth === 0) break;
      }
    } else kept += selector[index];
  }
  return kept;
}

// A media query proves forced colors only when every comma branch is a plain conjunction that
// includes (forced-colors: active); not, or, nested groups and unknown words prove nothing.
const CONJUNCT = /^(?:only|all|screen|print|and|\([^()]*\))$/;
function forcedQuery(params) {
  const branches = split(params.toLowerCase(), /,/);
  return (
    branches.length > 0 &&
    branches.every(branch => {
      const parts = split(branch, /\s/);
      return parts.every(part => CONJUNCT.test(part)) && parts.some(part => FORCED.test(part));
    })
  );
}

// Nested rules and :has()/:focus-within ancestors all put a declaration in focus context.
function state(node) {
  let focus = null;
  let forced = false;
  for (let parent = node.parent; parent && parent.type !== 'root'; parent = parent.parent) {
    if (parent.type === 'rule' && !focus && FOCUS.test(withoutNegation(parent.selector)))
      focus = parent.selector;
    if (parent.type === 'atrule' && parent.name.toLowerCase() === 'media')
      forced ||= forcedQuery(parent.params);
  }
  return { focus, forced };
}

function sign(token) {
  if (ZERO.test(token)) return 0;
  if (LENGTH.test(token)) return token.startsWith('-') ? -1 : 1;
  return NaN;
}

function paintsOutline(prop, tokens) {
  if (prop === 'outline') return !tokens.some(token => token === 'none' || ZERO.test(token));
  if (prop === 'outline-width') return !tokens.every(token => ZERO.test(token));
  if (prop === 'outline-style') return !tokens.every(token => token === 'none');
  return false;
}

// Custom properties from every authored stylesheet plus the linted file, keyed by lowercase
// name. Each name keeps every authored value whatever its selector, media query or theme, so a
// var() passes only when all of its bindings do. Values set from script are invisible here and
// stay opaque. The authored set is parsed once per process.
let authored;
function customProperties(root) {
  authored ??= collect(
    authoredStylesheets(project).map(path => parse(readFileSync(path, 'utf8'), { from: path })),
  );
  return collect([root], new Map([...authored].map(([name, values]) => [name, new Set(values)])));
}

function collect(roots, graph = new Map()) {
  for (const root of roots)
    root.walkDecls(/^--/, decl => {
      const name = decl.prop.toLowerCase();
      if (!graph.has(name)) graph.set(name, new Set());
      graph.get(name).add(decl.value.trim().toLowerCase());
    });
  return graph;
}

// Matches one whole var() token, not a value that merely starts and ends with var().
function variable(token) {
  const match = VAR.exec(token);
  if (!match) return null;
  let depth = 0;
  for (let index = 0; index < token.length - 1; index++) {
    if (token[index] === '(') depth++;
    if (token[index] === ')' && --depth === 0) return null;
  }
  return match;
}

// A var() can take any authored binding of its name or its fallback.
function sources([, name, fallback], graph) {
  const values = [...(graph.get(name) ?? [])];
  if (fallback !== undefined) values.push(fallback.trim());
  return values;
}

// Every final value a token can take, or null for undefined names and alias cycles.
function bindings(token, graph, seen = new Set()) {
  const match = variable(token);
  if (!match) return [token];
  if (seen.has(match[1])) return null;
  const values = [];
  for (const source of sources(match, graph)) {
    const nested = bindings(source, graph, new Set([...seen, match[1]]));
    if (!nested) return null;
    values.push(...nested);
  }
  return values.length ? values : null;
}

// The signs (-1, 0, 1) a length can take, or null when one is not provable: unknown tokens,
// undefined or cyclic var(), non-length bindings, or math that may divide by zero.
function lengthSigns(token, graph, seen = new Set()) {
  if (LENGTH.test(token)) return new Set([sign(token)]);
  if (MATH.test(token)) return mathSigns(token, graph, seen);
  const match = variable(token);
  if (!match || seen.has(match[1])) return null;
  const signs = new Set();
  for (const source of sources(match, graph)) {
    const nested = lengthSigns(source, graph, new Set([...seen, match[1]]));
    if (!nested) return null;
    nested.forEach(item => signs.add(item));
  }
  return signs.size ? signs : null;
}

function combine(left, right, operation) {
  const result = new Set();
  for (const a of left) for (const b of right) operation(a, b).forEach(item => result.add(item));
  return result;
}

// min(), max() and clamp() resolve to one of their arguments, so the union of argument signs
// covers them; a sum of opposite signs may take any sign.
function mathSigns(text, graph, seen) {
  if (text.replace(MATH_TOKEN, '').trim()) return null;
  const tokens = text.match(MATH_TOKEN);
  let index = 0;
  const closed = value => (value && tokens[index++] === ')' ? value : null);
  const factor = () => {
    const token = tokens[index++];
    if (token === '(' || token === 'calc(') return closed(sum());
    if (token === 'min(' || token === 'max(' || token === 'clamp(') {
      const args = [sum()];
      while (args.at(-1) && tokens[index] === ',') {
        index++;
        args.push(sum());
      }
      if (!args.every(Boolean) || (token === 'clamp(' && args.length !== 3)) return null;
      return closed(new Set(args.flatMap(arg => [...arg])));
    }
    if (token && NUMBER.test(token)) return new Set([Math.sign(parseFloat(token))]);
    return token?.startsWith('var(') ? lengthSigns(token, graph, seen) : null;
  };
  const product = () => {
    let left = factor();
    while (left && (tokens[index] === '*' || tokens[index] === '/')) {
      const divide = tokens[index++] === '/';
      const right = factor();
      if (!right || (divide && right.has(0))) return null;
      left = combine(left, right, (a, b) => [a * b]);
    }
    return left;
  };
  const sum = () => {
    let left = product();
    while (left && (tokens[index] === '+' || tokens[index] === '-')) {
      const subtract = tokens[index++] === '-';
      const right = product();
      if (!right) return null;
      left = combine(left, right, (a, b) => {
        const term = subtract ? -b : b;
        if (a === 0 || a === term) return [term];
        return term === 0 ? [a] : [-1, 0, 1];
      });
    }
    return left;
  };
  const result = sum();
  return index === tokens.length ? result : null;
}

const CONTAINER = /^(?:media|supports|layer|container)$/i;
const GATE = /^(?::root|html)\[data-input-modality=(['"]?)keyboard\1\]/i;
const SUBJECT_FOCUS = /:focus-visible(?![\w-])/i;
const PSEUDO_ELEMENT = /::|:(?:before|after|first-line|first-letter)(?![\w-])/i;

// Top-level compound selectors of one branch, split at combinators outside brackets, parens
// and strings.
function compounds(branch) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let part = '';
  for (const char of branch) {
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === '(' || char === '[') depth++;
    else if (char === ')' || char === ']') depth--;
    if (!quote && depth === 0 && /[\s>+~]/.test(char)) {
      if (part) parts.push(part);
      part = '';
    } else part += char;
  }
  if (part) parts.push(part);
  return parts;
}

// The parts of a compound outside () and [], so :not(), :is() and :has() arguments prove nothing.
function outside(compound) {
  let kept = '';
  let depth = 0;
  for (const char of compound) {
    if (char === '(' || char === '[') depth++;
    if (depth === 0) kept += char;
    if (char === ')' || char === ']') depth--;
  }
  return kept;
}

// The forced fallback may paint only when every selector branch starts with the central :root
// or html keyboard modality gate and the outlined subject itself is :focus-visible at top level.
// Nested rules, &, escapes and focus carried only by selector functions stay unproven.
function keyboardFocusSubject(decl) {
  const rule = decl.parent;
  if (rule?.type !== 'rule') return false;
  for (let parent = rule.parent; parent && parent.type !== 'root'; parent = parent.parent)
    if (parent.type !== 'atrule' || !CONTAINER.test(parent.name)) return false;
  return rule.selectors.every(branch => {
    if (branch.includes('&') || branch.includes('\\')) return false;
    const parts = compounds(branch.trim());
    const subject = outside(parts.at(-1) ?? '');
    return (
      parts.length > 0 &&
      GATE.test(parts[0]) &&
      SUBJECT_FOCUS.test(subject) &&
      !PSEUDO_ELEMENT.test(subject)
    );
  });
}

// Forced colors allow exactly 2px solid CanvasText on a keyboard-gated :focus-visible subject;
// a var() width counts as 2px only when every authored binding is exactly 2px.
function forcedFallback(prop, tokens, graph, decl) {
  const resolved = tokens.map(token =>
    bindings(token, graph)?.every(value => value === '2px') ? '2px' : token,
  );
  const value = resolved.join(' ');
  if (prop === 'outline-color') return value === 'canvastext';
  if (!paintsOutline(prop, resolved)) return true;
  if (!keyboardFocusSubject(decl)) return false;
  if (prop === 'outline') return [...resolved].sort().join(' ') === '2px canvastext solid';
  return value === (prop === 'outline-width' ? '2px' : 'solid');
}

// A focus shadow may paint one edge only. Blur, positive spread, diagonal offsets, several
// edges and unprovable lengths all fail because they can draw a ring or halo. A var() is a
// length once every authored binding has a provable sign; any other var() stays opaque, so
// the layer then needs all four lengths before its final color.
function surrounds(value, graph) {
  if (value === 'none') return false;
  const edges = new Set();
  for (const layer of split(value, /,/)) {
    const tokens = split(layer, /\s/);
    const lengths = [];
    let opaque = false;
    for (const token of tokens) {
      const literal = LENGTH.test(token) || MATH.test(token);
      const signs = literal || variable(token) ? lengthSigns(token, graph) : null;
      if (literal && !signs) return true;
      if (signs) lengths.push(signs);
      else if (token.startsWith('var(')) opaque = true;
    }
    if (lengths.length < 2 || lengths.length > 4 || (opaque && lengths.length < 4)) return true;
    const [x, y, blur = new Set([0]), spread = new Set([0])] = lengths;
    if ([...blur].some(item => item !== 0) || [...spread].some(item => item > 0)) return true;
    const dx = [...x].filter(item => item !== 0);
    const dy = [...y].filter(item => item !== 0);
    if (dx.length && dy.length) return true;
    if (!dx.length && !dy.length) continue;
    const moves = dx.length ? dx : dy;
    const direction = moves.length === 1 ? moves[0] * (tokens.includes('inset') ? -1 : 1) : '?';
    edges.add(`${dx.length ? 'x' : 'y'}${direction}`);
  }
  return edges.size > 1;
}

const rule = primary => (root, result) => {
  if (!validateOptions(result, ruleName, { actual: primary, possible: [true] })) return;
  let graph;
  const properties = () => (graph ??= customProperties(root));
  root.walkDecls(decl => {
    const prop = decl.prop.toLowerCase();
    const outline = prop.startsWith('outline');
    if (!outline && !SHADOW.test(prop)) return;
    const value = decl.value.trim().toLowerCase();
    const tokens = split(value, /\s/);
    const { focus, forced } = state(decl);
    let message = null;
    if (outline && forced && !forcedFallback(prop, tokens, properties(), decl))
      message = messages.forced(decl.prop, decl.value);
    else if (outline && !forced && paintsOutline(prop, tokens))
      message = messages.outline(decl.prop, decl.value);
    else if (!outline && focus && surrounds(value, properties()))
      message = messages.shadow(focus, decl.value);
    if (message) report({ ruleName, result, node: decl, message, word: decl.prop });
  });
};

rule.ruleName = ruleName;
rule.messages = messages;

export default createPlugin(ruleName, rule);
