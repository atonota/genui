import policy from './policy.json';

export type LayoutProfile = 'phone' | 'tablet' | 'laptop' | 'desktop' | 'wide' | 'living-room';
export type ProductSurface = 'web' | 'living-room';
export type ActiveInput = 'unknown' | 'mouse' | 'touch' | 'pen' | 'keyboard' | 'remote';
export type InputLayer = 'coarse' | 'precision' | 'spatial';
export type Orientation = 'portrait' | 'landscape';
export type WidthBand = keyof typeof policy.widths;
export type AntdBreakpoint = keyof typeof policy.antd;

/** Independent signals in CSS px; none of them names a device or claims a keyboard. */
export interface AdaptiveEnvironment {
  readonly width: number;
  readonly height: number;
  readonly visualWidth: number;
  readonly visualHeight: number;
  readonly coarse: boolean;
  readonly fine: boolean;
  readonly hover: boolean;
  readonly anyHover: boolean;
  readonly reducedMotion: boolean;
  readonly forcedColors: boolean;
  readonly saveData: boolean | null;
  readonly activeInput: ActiveInput;
}

/** 'continuous' keeps an established phone across a rotation; 'reset' resolves every read alone. */
export type JourneyContinuity = 'continuous' | 'reset';

export interface AdaptiveOptions {
  readonly surface?: ProductSurface;
  readonly lockedProfile?: LayoutProfile;
  /** Read by stateful hosts only; resolveAdaptive itself stays a pure width resolver. */
  readonly continuity?: JourneyContinuity;
}

export interface AdaptiveResolution {
  readonly band: string;
  readonly layout: LayoutProfile;
  readonly inputLayers: readonly InputLayer[];
  readonly orientation: Orientation;
  readonly shortHeight: boolean;
  readonly usableWidth: number;
  readonly usableHeight: number;
}

/** The one breakpoint source for TS, AntD tokens and verification matrices. */
export const adaptivePolicy = policy;

/** Conservative SSR/static snapshot: base width, short height, no assumed capability. */
export const serverEnvironment: AdaptiveEnvironment = Object.freeze({
  width: policy.widths.base,
  height: policy.shortHeight,
  visualWidth: policy.widths.base,
  visualHeight: policy.shortHeight,
  coarse: false,
  fine: false,
  hover: false,
  anyHover: false,
  reducedMotion: false,
  forcedColors: false,
  saveData: null,
  activeInput: 'unknown',
});

const positive = (value: number, fallback: number): number =>
  Number.isFinite(value) && value > 0 ? value : fallback;

const bands = (Object.keys(policy.widths) as WidthBand[]).sort(
  (a, b) => policy.widths[a] - policy.widths[b],
);

/** Half-open [min, next min) bands; fractions resolve exactly, widths under base use base. */
export function resolveBand(width: number): WidthBand {
  const value = positive(width, policy.widths.base);
  let band = bands[0];
  for (const name of bands) if (value >= policy.widths[name]) band = name;
  return band;
}

const layoutFloors: readonly (readonly [LayoutProfile, number])[] = [
  ['wide', policy.widths.ultraWide],
  ['desktop', policy.widths.desktop],
  ['laptop', policy.widths.laptop],
  ['tablet', policy.widths.smallTablet],
];

/** phone < 600 <= tablet < 960 <= laptop < 1280 <= desktop < 1920 <= wide; never living-room. */
export function layoutForWidth(width: number): LayoutProfile {
  const value = positive(width, policy.widths.base);
  return layoutFloors.find(([, floor]) => value >= floor)?.[0] ?? 'phone';
}

/**
 * Capability hint only: landscape, a short side under smallTablet, a coarse pointer and no
 * fine pointer or hover. resolveAdaptive never calls it, because a keyboard-resized tablet or
 * a touch laptop matches too; known phone journeys pass lockedProfile 'phone' instead.
 */
export function isCoarseLandscapePhone(environment: AdaptiveEnvironment): boolean {
  const { width, height } = environment;
  return (
    width > height &&
    Math.min(width, height) < policy.widths.smallTablet &&
    environment.coarse &&
    !environment.fine &&
    !environment.hover &&
    !environment.anyHover
  );
}

/** Additive input layers; spatial comes only from an explicit living-room product. */
export function resolveInputLayers(
  environment: AdaptiveEnvironment,
  surface: ProductSurface = 'web',
): readonly InputLayer[] {
  const layers: InputLayer[] = [];
  const input = environment.activeInput;
  if (environment.coarse || input === 'touch') layers.push('coarse');
  if ((environment.fine && environment.anyHover) || input === 'mouse' || input === 'pen')
    layers.push('precision');
  if (surface === 'living-room') layers.push('spatial');
  return Object.freeze(layers);
}

/**
 * Pure resolver: explicit living-room wins, then a locked profile, then the width bands.
 * A living-room lock never overrides the web surface, and coarse short viewports are never
 * guessed to be phones; a known phone journey passes lockedProfile 'phone'.
 */
export function resolveAdaptive(
  environment: AdaptiveEnvironment,
  options: AdaptiveOptions = {},
): AdaptiveResolution {
  const surface = options.surface ?? 'web';
  const width = positive(environment.width, policy.widths.base);
  const height = positive(environment.height, policy.shortHeight);
  const locked = options.lockedProfile === 'living-room' ? undefined : options.lockedProfile;
  const layout: LayoutProfile =
    surface === 'living-room' ? 'living-room' : (locked ?? layoutForWidth(width));
  const orientation: Orientation = width > height ? 'landscape' : 'portrait';
  return Object.freeze({
    band: resolveBand(width),
    layout,
    inputLayers: resolveInputLayers(environment, surface),
    orientation,
    shortHeight: height < policy.shortHeight,
    // Pinch zoom and virtual keyboards narrow the usable area, never the layout profile.
    usableWidth: Math.min(width, positive(environment.visualWidth, width)),
    usableHeight: Math.min(height, positive(environment.visualHeight, height)),
  });
}

/** Last measured viewport and the profile it showed: continuity data, never a device identity. */
export interface AdaptiveJourney {
  readonly width: number;
  readonly height: number;
  readonly layout: LayoutProfile;
  /** True while continuity keeps a phone that the width alone would replace. */
  readonly retained: boolean;
}

const isLandscape = (width: number, height: number): boolean => width > height;

/**
 * Pure journey reducer for stateful hosts. The first measured read is the width resolution, so
 * an initial 768x300 stays a tablet. An established phone survives a reciprocal orientation
 * change whose short side stays under smallTablet, then height-only changes of that view
 * (virtual keyboard, toolbars). A width change in the same orientation, an explicit lock or
 * surface, or continuity 'reset' releases it. An unchanged read returns previous itself.
 */
export function advanceJourney(
  previous: AdaptiveJourney | null,
  environment: AdaptiveEnvironment,
  options: AdaptiveOptions = {},
): AdaptiveJourney {
  const width = positive(environment.width, policy.widths.base);
  const height = positive(environment.height, policy.shortHeight);
  const fresh = resolveAdaptive(environment, options).layout;
  const explicit =
    (options.surface ?? 'web') !== 'web' ||
    (options.lockedProfile !== undefined && options.lockedProfile !== 'living-room');
  const rotated =
    previous !== null &&
    isLandscape(width, height) !== isLandscape(previous.width, previous.height);
  const heightOnly = previous?.retained === true && !rotated && width === previous.width;
  const retained =
    !explicit &&
    options.continuity !== 'reset' &&
    fresh !== 'phone' &&
    previous?.layout === 'phone' &&
    Math.min(width, height) < policy.widths.smallTablet &&
    (rotated || heightOnly);
  const layout: LayoutProfile = retained ? 'phone' : fresh;
  if (
    previous?.width === width &&
    previous.height === height &&
    previous.layout === layout &&
    previous.retained === retained
  )
    return previous;
  return Object.freeze({ width, height, layout, retained });
}

/** Options that show a retained journey through resolveAdaptive; anything else passes through. */
export function journeyOptions(
  journey: AdaptiveJourney | null,
  options: AdaptiveOptions = {},
): AdaptiveOptions {
  return journey?.retained ? { ...options, lockedProfile: journey.layout } : options;
}

type ScreenName = `screen${Uppercase<AntdBreakpoint>}`;
export type AntdScreenToken =
  | ScreenName
  | `${ScreenName}Min`
  | Exclude<`${ScreenName}Max`, 'screenXXXLMax'>;
export type AntdBreakpointTokens = Readonly<Record<AntdScreenToken, number>>;

const antdOrder = (Object.keys(policy.antd) as AntdBreakpoint[]).sort(
  (a, b) => policy.antd[a] - policy.antd[b],
);

/** AntD screen tokens from the same JSON: Min = floor, Max = next floor - 1, no gaps or overlap. */
export const adaptiveBreakpointTokens: AntdBreakpointTokens = (() => {
  const tokens: Record<string, number> = {};
  antdOrder.forEach((key, index) => {
    const name = `screen${key.toUpperCase()}`;
    tokens[name] = tokens[`${name}Min`] = policy.antd[key];
    const next = antdOrder[index + 1];
    if (next) tokens[`${name}Max`] = policy.antd[next] - 1;
  });
  return Object.freeze(tokens) as AntdBreakpointTokens;
})();
