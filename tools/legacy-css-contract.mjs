import { readFileSync } from 'node:fs';

// Reverse only the explicitly requested additions for byte preservation.
// This does not approve the new layout visually or normalize any other CSS.
export function originalLegacyCss(css) {
  const workspace = readFileSync(new URL('../src/styles/workspace.css', import.meta.url), 'utf8');
  // The new stylesheet is appended verbatim and checked separately for strict
  // workspace scoping. Never strip or normalize any historical rule within it.
  if (workspace && css.endsWith(workspace)) css = css.slice(0, -workspace.length);
  css = css.replace(
    '\n/* Locale controls use the existing control tokens and wrap on narrow screens. */\n.utility{flex-wrap:wrap;justify-content:flex-end;min-width:0}.language-control{display:flex;align-items:center;gap:inherit}\n',
    '',
  );
  const desktop = css.match(/^@media\(min-width:1000px\).*$/m)?.[0];
  const reduced = css.match(/^@media\(prefers-reduced-motion:reduce\).*$/m)?.[0];
  if (desktop && reduced && css.indexOf(desktop) < css.indexOf(reduced))
    css = css.replace(desktop + '\n' + reduced, reduced + '\n' + desktop);
  return css;
}
