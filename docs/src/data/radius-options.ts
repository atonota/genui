/**
 * The general corner radius role: four approved choices shared by the Theme Builder, the Tweaker
 * and the resolver. Radius SM, MD and LG are edited together in both schemes. Recipes saved while
 * the roles were whole px numbers (0-32) keep their exact value until the user picks a choice.
 */
export const RADIUS_OPTIONS = Object.freeze(['0px', '3px', '5px', '100%'] as const);
export type RadiusOption = (typeof RADIUS_OPTIONS)[number];
export const DEFAULT_RADIUS: RadiusOption = '5px';
export const RADIUS_TOKEN_IDS = Object.freeze(['radius-sm', 'radius-md', 'radius-lg'] as const);
/** AntD radii are numbers; this fully rounds where CSS keeps 100%, and never yields NaN. */
export const FULL_ROUND_RADIUS_PX = 9999;
const LEGACY_RADIUS_MAX_PX = 32;
const LEGACY_PX = /^(\d{1,2})px$/;

const optionSet: ReadonlySet<string> = new Set<string>(RADIUS_OPTIONS);
const tokenIdSet: ReadonlySet<string> = new Set<string>(RADIUS_TOKEN_IDS);

type RecipeValues = Readonly<Record<string, string | number>>;

export const isRadiusTokenId = (id: string): boolean => tokenIdSet.has(id);

export const isRadiusOption = (value: unknown): value is RadiusOption =>
  typeof value === 'string' && optionSet.has(value);

/** A radius saved before the choices: a whole px number from 0 to 32. */
export const isLegacyRadius = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= LEGACY_RADIUS_MAX_PX;

/** CSS length for a stored radius: the choice itself or the legacy number in px. */
export function radiusCss(value: unknown): string {
  if (isRadiusOption(value)) return value;
  if (isLegacyRadius(value)) return `${value}px`;
  throw new TypeError('Radius must be one of the listed choices or a whole px value from 0 to 32.');
}

/** AntD number for a stored radius; 100% becomes the full-round fallback. */
export function radiusPx(value: unknown): number {
  const css = radiusCss(value);
  return css === '100%' ? FULL_ROUND_RADIUS_PX : Number.parseFloat(css);
}

/** Select value for a stored radius; legacy 0, 3 and 5 read as their matching choice. */
export function radiusChoice(value: unknown): string | undefined {
  if (isRadiusOption(value)) return value;
  return isLegacyRadius(value) ? `${value}px` : undefined;
}

/** The four choices, plus the retained legacy value only while it is current and not a choice. */
export function radiusSelectOptions(current: unknown): readonly string[] {
  const choice = radiusChoice(current);
  return choice === undefined || optionSet.has(choice)
    ? RADIUS_OPTIONS
    : [...RADIUS_OPTIONS, choice];
}

/** Maps a Select value back to a recipe value; the retained legacy px stays a number. */
export function radiusEditValue(choice: string): string | number {
  if (isRadiusOption(choice)) return choice;
  const match = LEGACY_PX.exec(choice);
  const legacy = match ? Number(match[1]) : Number.NaN;
  return isLegacyRadius(legacy) ? legacy : choice;
}

/** One general role: an edit to any radius step sets SM, MD and LG together. */
export function withGeneralRadius(
  values: RecipeValues,
  value: string | number,
): Record<string, string | number> {
  const next: Record<string, string | number> = { ...values };
  for (const id of RADIUS_TOKEN_IDS) next[id] = value;
  return next;
}
