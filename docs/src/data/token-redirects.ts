import { tokenDefinitions } from '../theme-builder/model';

// The former /token-standards/ page was merged: token tables live on /tokens/, rules on /standards/.
export const LEGACY_TOKENS_ROUTE = '/token-standards/';
export const TOKENS_ROUTE = '/tokens/';
export const STANDARDS_ROUTE = '/standards/';

export type TokenRedirect = Readonly<{
  oldId: string;
  newRoute: typeof TOKENS_ROUTE | typeof STANDARDS_ROUTE;
  /** Canonical section id on the new page. */
  newId: string;
  /** Hash the redirect lands on; on /standards/ it is a legacy alias of newId. */
  anchor: string;
}>;

export const tokenGroupId = (group: string): string => `token-group-${group}`;

const moved = (id: string): TokenRedirect => ({
  oldId: id,
  newRoute: TOKENS_ROUTE,
  newId: id,
  anchor: id,
});
const rule = (oldId: string, newId: string): TokenRedirect => ({
  oldId,
  newRoute: STANDARDS_ROUTE,
  newId,
  anchor: oldId,
});

// Group ids follow the definitions, so a new token group gets its redirect without edits here.
export const tokenRedirects: readonly TokenRedirect[] = Object.freeze([
  moved('token-catalog'),
  ...[...new Set(tokenDefinitions.map(definition => definition.group))].map(group =>
    moved(tokenGroupId(group)),
  ),
  moved('using-tokens'),
  rule('measurement-scales', 'layout'),
  rule('surface-states', 'surfaces'),
  rule('motion-focus', 'motion'),
  rule('layers', 'layers'),
  rule('overlay-standard', 'layers'),
]);

/** Legacy hash id to destination href, consumed by the redirect page. */
export const legacyTokenTargets = (): Record<string, string> =>
  Object.fromEntries(
    tokenRedirects.map(entry => [entry.oldId, `${entry.newRoute}#${entry.anchor}`]),
  );
