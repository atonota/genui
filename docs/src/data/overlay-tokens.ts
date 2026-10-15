import definitions from '../theme-builder/definitions.json';

/**
 * Central overlay roles (scrim, backdrop blur, stacking layers, motion aliases) for
 * user-opened layers such as pickers, dropdown panels and drawers.
 *
 * Single value source: docs/src/theme-builder/definitions.json. This module reads the
 * raw JSON only and never imports theme.ts, the theme-builder model or color-system,
 * so theme.ts can spread overlayThemeRoles() without an import cycle.
 */

export type OverlayMode = 'light' | 'dark';

export const OVERLAY_TOKEN_IDS = [
  'overlay-scrim-color',
  'overlay-scrim-opacity',
  'overlay-backdrop-blur',
  'overlay-scrim-z',
  'overlay-trigger-z',
  'overlay-popup-z',
] as const;

export type OverlayTokenId = (typeof OVERLAY_TOKEN_IDS)[number];

export type OverlayTokenValues = {
  'overlay-scrim-color': string;
  'overlay-scrim-opacity': number;
  'overlay-backdrop-blur': number;
  'overlay-scrim-z': number;
  'overlay-trigger-z': number;
  'overlay-popup-z': number;
};

export type OverlayCssVariables = Record<`--${string}`, string>;

/** camelCase roles for the themeColors spread; createThemeStyleText emits them as --kebab-case. */
export type OverlayThemeRoles = {
  overlayScrimColor: string;
  overlayScrimOpacity: string;
  overlayScrim: string;
  overlayBackdropBlur: string;
  overlayScrimZ: string;
  overlayTriggerZ: string;
  overlayPopupZ: string;
  overlayOpenDuration: string;
  overlayCloseDuration: string;
  overlayEasing: string;
  /** Legacy dropdown names stay as aliases of the overlay roles, never a second value source. */
  dropdownScrim: string;
  dropdownBackdropBlur: string;
  dropdownBackdropZ: string;
  dropdownTriggerZ: string;
};

type OverlayValueSource = Readonly<Record<string, string | number | undefined>>;

type RawDefinition = {
  id: string;
  defaults: Record<OverlayMode, string | number>;
};

// Only the id and per-mode defaults are read here; the full definition shape belongs to the model.
const rawDefinitions = definitions as unknown as readonly RawDefinition[];

/** #rgb or #rrggbb where every channel is equal, so the scrim is always a neutral grey. */
const NEUTRAL_HEX = /^#(?:([0-9a-f])\1\1|([0-9a-f]{2})\2\2)$/;

function toNeutralHex(value: unknown, id: OverlayTokenId): string {
  if (typeof value !== 'string') {
    throw new TypeError(`${id} must be a neutral hex color string`);
  }
  const hex = value.trim().toLowerCase();
  if (!NEUTRAL_HEX.test(hex)) {
    throw new TypeError(`${id} must be a neutral grey hex color (#rgb or #rrggbb with r = g = b)`);
  }
  if (hex.length === 4) {
    return `#${hex.charAt(1).repeat(6)}`;
  }
  return hex;
}

function toFiniteNumber(value: unknown, id: OverlayTokenId): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`${id} must be a finite number`);
  }
  return parsed;
}

function toOpacity(value: unknown, id: OverlayTokenId): number {
  const opacity = toFiniteNumber(value, id);
  if (opacity <= 0 || opacity > 1) {
    throw new RangeError(`${id} must be greater than 0 and at most 1`);
  }
  return Math.round(opacity * 1000) / 1000;
}

function toBlur(value: unknown, id: OverlayTokenId): number {
  const blur = toFiniteNumber(value, id);
  if (blur <= 0) {
    throw new RangeError(`${id} must be a positive blur radius in px`);
  }
  return blur;
}

function toLayer(value: unknown, id: OverlayTokenId): number {
  const layer = toFiniteNumber(value, id);
  if (!Number.isInteger(layer)) {
    throw new RangeError(`${id} must be an integer stacking layer`);
  }
  return layer;
}

function normalizeOverlayValues(values: OverlayValueSource): OverlayTokenValues {
  return {
    'overlay-scrim-color': toNeutralHex(values['overlay-scrim-color'], 'overlay-scrim-color'),
    'overlay-scrim-opacity': toOpacity(values['overlay-scrim-opacity'], 'overlay-scrim-opacity'),
    'overlay-backdrop-blur': toBlur(values['overlay-backdrop-blur'], 'overlay-backdrop-blur'),
    'overlay-scrim-z': toLayer(values['overlay-scrim-z'], 'overlay-scrim-z'),
    'overlay-trigger-z': toLayer(values['overlay-trigger-z'], 'overlay-trigger-z'),
    'overlay-popup-z': toLayer(values['overlay-popup-z'], 'overlay-popup-z'),
  };
}

function channel(hex: string, offset: number): number {
  return Number.parseInt(hex.slice(offset, offset + 2), 16);
}

function buildOverlayVariables(values: OverlayValueSource) {
  const overlay = normalizeOverlayValues(values);
  const hex = overlay['overlay-scrim-color'];
  const opacity = overlay['overlay-scrim-opacity'];
  return {
    '--overlay-scrim-color': hex,
    '--overlay-scrim-opacity': String(opacity),
    '--overlay-scrim': `rgba(${channel(hex, 1)}, ${channel(hex, 3)}, ${channel(hex, 5)}, ${opacity})`,
    '--overlay-backdrop-blur': `${overlay['overlay-backdrop-blur']}px`,
    '--overlay-scrim-z': String(overlay['overlay-scrim-z']),
    '--overlay-trigger-z': String(overlay['overlay-trigger-z']),
    '--overlay-popup-z': String(overlay['overlay-popup-z']),
    // Motion references the existing Cubic press/release tokens instead of duplicating numbers.
    '--overlay-open-duration': 'var(--press-duration)',
    '--overlay-close-duration': 'var(--release-duration)',
    '--overlay-easing': 'var(--motion-easing)',
    // Legacy dropdown names are aliases only.
    '--dropdown-scrim': 'var(--overlay-scrim)',
    '--dropdown-backdrop-blur': 'var(--overlay-backdrop-blur)',
    '--dropdown-backdrop-z': 'var(--overlay-scrim-z)',
    '--dropdown-trigger-z': 'var(--overlay-trigger-z)',
  };
}

/** The six overlay defaults for one scheme, read from definitions.json and validated. */
export function overlayDefaultValues(mode: OverlayMode): OverlayTokenValues {
  const raw: Record<string, string | number | undefined> = {};
  for (const id of OVERLAY_TOKEN_IDS) {
    const definition = rawDefinitions.find(entry => entry.id === id);
    if (!definition) {
      throw new Error(`definitions.json is missing the overlay definition "${id}"`);
    }
    raw[id] = definition.defaults[mode];
  }
  return normalizeOverlayValues(raw);
}

/** CSS custom properties for a set of overlay values: raw roles, derived scrim, motion and legacy aliases. */
export function overlayVariablesFromValues(values: OverlayValueSource): OverlayCssVariables {
  return buildOverlayVariables(values);
}

/** Overlay roles shaped for the themeColors spread in theme.ts. */
export function overlayThemeRoles(mode: OverlayMode): OverlayThemeRoles {
  const variables = buildOverlayVariables(overlayDefaultValues(mode));
  return {
    overlayScrimColor: variables['--overlay-scrim-color'],
    overlayScrimOpacity: variables['--overlay-scrim-opacity'],
    overlayScrim: variables['--overlay-scrim'],
    overlayBackdropBlur: variables['--overlay-backdrop-blur'],
    overlayScrimZ: variables['--overlay-scrim-z'],
    overlayTriggerZ: variables['--overlay-trigger-z'],
    overlayPopupZ: variables['--overlay-popup-z'],
    overlayOpenDuration: variables['--overlay-open-duration'],
    overlayCloseDuration: variables['--overlay-close-duration'],
    overlayEasing: variables['--overlay-easing'],
    dropdownScrim: variables['--dropdown-scrim'],
    dropdownBackdropBlur: variables['--dropdown-backdrop-blur'],
    dropdownBackdropZ: variables['--dropdown-backdrop-z'],
    dropdownTriggerZ: variables['--dropdown-trigger-z'],
  };
}
