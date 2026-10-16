// Build-time code payloads for ExamplePreview's Code view. TSX under docs/src/react is
// parsed with the TypeScript compiler and never executed. Each wrapper with a literal id
// yields its authored children plus the imports and same-module definitions they reference,
// so an excerpt such as {iconExamples} ships with the real definition, not a stub.
// Missing, duplicate, non-literal and nested wrapper ids fail the build.
import ts from 'typescript';

export const ALLOWED_ROOT = 'docs/src/react/';
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const wrapperModule = /(?:^|[/])ExamplePreview(?:[.][cm]?[jt]sx?)?$/;

// Same guard as the raw source exports in docs/src/pages/source/[...path].txt.ts:
// credential-shaped text fails without echoing it; Pages builds redact home prefixes.
const machineHome = /\/Users\/[^/\s'"`)\]>]*/g;
const credential =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{20,}|\bAKIA[0-9A-Z]{16}\b|\bsk-[A-Za-z0-9_-]{20,}/;

/**
 * @typedef {{ path: string, text: string }} PreviewSource
 * @typedef {{ id: string, code: string, sourcePath: string, sourceUrl: string }} PreviewCode
 */

const where = (sf, node) => {
  const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
  return `${sf.fileName}:${line + 1}:${character + 1}`;
};

const dedent = text => {
  const lines = text.trimEnd().split(/\r?\n/);
  while (lines.length > 0 && !lines[0].trim()) lines.shift();
  const indents = lines
    .filter(line => line.trim())
    .map(line => line.length - line.trimStart().length);
  const cut = indents.length > 0 ? Math.min(...indents) : 0;
  return lines.map(line => line.slice(cut)).join('\n');
};

// Whole source lines of a statement, so dedent sees its first-line indentation.
const linesOf = (sf, node) => {
  const start = node.getStart(sf);
  const lineStart = sf.getPositionOfLineAndCharacter(
    sf.getLineAndCharacterOfPosition(start).line,
    0,
  );
  const from = sf.text.slice(lineStart, start).trim() ? start : lineStart;
  return dedent(sf.text.slice(from, node.end));
};

const isWrapperImport = statement =>
  ts.isImportDeclaration(statement) &&
  ts.isStringLiteral(statement.moduleSpecifier) &&
  wrapperModule.test(statement.moduleSpecifier.text);

const bindingNames = (name, out = []) => {
  if (ts.isIdentifier(name)) out.push(name.text);
  else
    for (const element of name.elements)
      if (!ts.isOmittedExpression(element)) bindingNames(element.name, out);
  return out;
};

// Names a statement binds in its scope.
const declaredNames = statement => {
  if (ts.isImportDeclaration(statement)) {
    const clause = statement.importClause;
    const bindings = clause?.namedBindings;
    const names = clause?.name ? [clause.name.text] : [];
    if (bindings && ts.isNamespaceImport(bindings)) names.push(bindings.name.text);
    else for (const element of bindings?.elements ?? []) names.push(element.name.text);
    return names;
  }
  if (ts.isVariableStatement(statement))
    return statement.declarationList.declarations.flatMap(({ name }) => bindingNames(name));
  return statement.name && ts.isIdentifier(statement.name) ? [statement.name.text] : [];
};

// Identifiers a node may refer to; property, member and attribute names are not references.
const referencedNames = root => {
  const names = new Set();
  const visit = node => {
    if (ts.isIdentifier(node)) {
      const { parent } = node;
      const isMemberName =
        ts.isJsxAttribute(parent) ||
        (ts.isQualifiedName(parent) && parent.right === node) ||
        ((ts.isPropertyAccessExpression(parent) ||
          ts.isPropertyAssignment(parent) ||
          ts.isPropertySignature(parent) ||
          ts.isPropertyDeclaration(parent) ||
          ts.isMethodDeclaration(parent)) &&
          parent.name === node);
      if (!isMemberName) names.add(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return names;
};

// Local names bound to the ExamplePreview default export.
const wrapperNames = sf => {
  const names = new Set();
  for (const statement of sf.statements.filter(isWrapperImport)) {
    const clause = statement.importClause;
    const bindings = clause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings))
      throw new Error(`${where(sf, bindings)}: import ExamplePreview as a default binding`);
    if (clause?.name) names.add(clause.name.text);
    for (const element of bindings?.elements ?? [])
      if ((element.propertyName ?? element.name).text === 'default') names.add(element.name.text);
  }
  return names;
};

const isMarkupOrImport = node => {
  const { parent } = node;
  return (
    ts.isImportClause(parent) ||
    ts.isImportSpecifier(parent) ||
    ts.isTypeQueryNode(parent) ||
    ((ts.isJsxOpeningElement(parent) ||
      ts.isJsxSelfClosingElement(parent) ||
      ts.isJsxClosingElement(parent)) &&
      parent.tagName === node)
  );
};

const literalId = (sf, opening) => {
  let id;
  for (const attribute of opening.attributes.properties) {
    if (ts.isJsxSpreadAttribute(attribute))
      throw new Error(
        `${where(sf, attribute)}: write ExamplePreview props out; a spread can hide a dynamic id`,
      );
    if (attribute.name.getText(sf) !== 'id') continue;
    const value = attribute.initializer;
    const literal = value && ts.isJsxExpression(value) ? value.expression : value;
    if (id !== undefined || !literal || !ts.isStringLiteral(literal))
      throw new Error(
        `${where(sf, attribute)}: ExamplePreview needs one string-literal id, not a variable, call or template`,
      );
    id = literal.text;
  }
  if (id === undefined) throw new Error(`${where(sf, opening)}: ExamplePreview needs a literal id`);
  if (!idPattern.test(id))
    throw new Error(`${where(sf, opening)}: ExamplePreview id '${id}' must be kebab-case`);
  return id;
};

const findWrappers = sf => {
  const names = wrapperNames(sf);
  const found = [];
  const visit = (node, outer) => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node;
      if (ts.isIdentifier(opening.tagName) && names.has(opening.tagName.text)) {
        if (outer)
          throw new Error(
            `${where(sf, node)}: ExamplePreview nested inside '${outer}'; wrap each example cluster once`,
          );
        if (!ts.isJsxElement(node))
          throw new Error(`${where(sf, node)}: ExamplePreview needs authored JSX children`);
        const id = literalId(sf, opening);
        found.push({ id, element: node, at: where(sf, node) });
        ts.forEachChild(node, child => visit(child, id));
        return;
      }
    } else if (ts.isIdentifier(node) && names.has(node.text) && !isMarkupOrImport(node)) {
      throw new Error(
        `${where(sf, node)}: render ExamplePreview as JSX with a literal id, not as a value`,
      );
    }
    ts.forEachChild(node, child => visit(child, outer));
  };
  if (names.size > 0) visit(sf, undefined);
  return found;
};

// The module-level statement that holds node.
const topLevelOf = node => {
  while (node.parent && !ts.isSourceFile(node.parent)) node = node.parent;
  return node;
};

// Statements the excerpt depends on: imports, module definitions and earlier locals of
// enclosing function bodies, followed transitively. The wrapper's own statement is skipped
// unless the excerpt forwards a parameter of an enclosing function, such as {children}:
// a parameter has no definition here, so the owning top-level definition and the
// same-module statements that render or call it ship as written instead of a bare stub.
// Statements nested inside another shipped statement are not repeated.
const contextFor = (sf, element) => {
  const enclosing = new Set();
  for (let node = element; node; node = node.parent) enclosing.add(node);
  const declarations = new Map();
  const owners = new Set();
  for (let node = element.parent; node; node = node.parent) {
    if (ts.isFunctionLike(node)) {
      const owner = topLevelOf(node);
      owners.add(owner);
      for (const parameter of node.parameters)
        for (const name of bindingNames(parameter.name))
          if (!declarations.has(name)) declarations.set(name, owner);
      continue;
    }
    if (!ts.isBlock(node) && !ts.isSourceFile(node)) continue;
    for (const statement of node.statements) {
      if (enclosing.has(statement)) {
        if (ts.isBlock(node)) break;
        continue;
      }
      if (isWrapperImport(statement)) continue;
      for (const name of declaredNames(statement))
        if (!declarations.has(name)) declarations.set(name, statement);
    }
  }
  const included = new Set();
  const pending = element.children.flatMap(child => [...referencedNames(child)]);
  const include = statement => {
    if (included.has(statement)) return;
    included.add(statement);
    if (!ts.isImportDeclaration(statement)) pending.push(...referencedNames(statement));
    if (!owners.has(statement)) return;
    const names = declaredNames(statement);
    for (const caller of sf.statements) {
      if (caller === statement || ts.isImportDeclaration(caller)) continue;
      const references = referencedNames(caller);
      if (names.some(name => references.has(name))) include(caller);
    }
  };
  while (pending.length > 0) {
    const statement = declarations.get(pending.pop());
    if (statement) include(statement);
  }
  const statements = [...included].sort((a, b) => a.pos - b.pos);
  return statements
    .filter(
      statement =>
        !statements.some(
          other => other !== statement && other.pos <= statement.pos && statement.end <= other.end,
        ),
    )
    .map(statement => linesOf(sf, statement));
};

const codeFor = (sf, element) => {
  const { openingElement, closingElement } = element;
  const children = dedent(sf.text.slice(openingElement.end, closingElement.getStart(sf)));
  if (!children)
    throw new Error(`${where(sf, element)}: ExamplePreview needs authored JSX children`);
  return [...contextFor(sf, element), children].join('\n\n');
};

/**
 * One payload per ExamplePreview wrapper in the given docs/src/react TSX sources.
 * @param {Iterable<PreviewSource>} sources
 * @param {{ sourceUrl: (sourcePath: string) => string, redactHome?: boolean }} options
 * @returns {PreviewCode[]}
 */
export const collectPreviewCode = (sources, { sourceUrl, redactHome = false }) => {
  /** @type {Map<string, string>} */
  const locations = new Map();
  /** @type {PreviewCode[]} */
  const payloads = [];
  const ordered = [...sources].sort((a, b) => a.path.localeCompare(b.path));
  for (const { path, text } of ordered) {
    if (!path.startsWith(ALLOWED_ROOT) || !path.endsWith('.tsx') || path.split('/').includes('..'))
      throw new Error(
        `Refusing preview code from ${path}: only ${ALLOWED_ROOT}**/*.tsx is scanned`,
      );
    const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    for (const { id, element, at } of findWrappers(sf)) {
      const previous = locations.get(id);
      if (previous) throw new Error(`Duplicate ExamplePreview id '${id}' at ${at} and ${previous}`);
      locations.set(id, at);
      const code = codeFor(sf, element);
      if (credential.test(code))
        throw new Error(
          `Refusing to publish preview code '${id}' from ${path}: credential-shaped content`,
        );
      payloads.push({
        id,
        code: redactHome ? code.replace(machineHome, '<workspace>') : code,
        sourcePath: path,
        sourceUrl: sourceUrl(path),
      });
    }
  }
  return payloads;
};
