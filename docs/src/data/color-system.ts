import { generate } from '@ant-design/colors';

export type ColorSelectionMethod = 'detailed' | 'presets';
export type ColorPreviewTheme = 'light' | 'dark';
export type Rgb = readonly [number, number, number];

export type ColorSelection = Readonly<{
  anchor: number;
  offset: number;
  w: number;
  b: number;
  mode: ColorPreviewTheme;
  selectionMode: ColorSelectionMethod;
  presetId: string | null;
}>;

export type ColorPreset = Readonly<{
  id: string;
  name: string;
  h: number;
  w: number;
  b: number;
  hex: string;
}>;

export const COLOR_SETTINGS_FORMAT = 'hwb-ant-design-controller';
export const COLOR_SCHEMA_VERSION = 4;
export const COLOR_SPECTRUM_SEGMENTS = 41;
export const MAX_COLOR_SETTINGS_BYTES = 1024 * 1024;
export const COLOR_TOKEN_NAMES = Object.freeze([
  'colorPrimary',
  'colorPrimaryHover',
  'colorPrimaryActive',
  'colorPrimaryBg',
  'colorPrimaryBorder',
  'colorPrimaryText',
] as const);
export type ColorTokenName = (typeof COLOR_TOKEN_NAMES)[number];

const finite = (value: unknown, name: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new TypeError(`${name} must be a finite number.`);
  return value;
};
const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
const round = (value: number, places = 1): number => Number(value.toFixed(places));
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function normalizeHue(value: number): number {
  const h = finite(value, 'Hue');
  return ((h % 360) + 360) % 360;
}

/** HWB prepares one sRGB seed. Palette derivation belongs to Ant Design. */
export function hwbToRgb(hue: number, whiteness: number, blackness: number): Rgb {
  const h = normalizeHue(hue);
  const w = clamp(finite(whiteness, 'Whiteness'), 0, 100) / 100;
  const b = clamp(finite(blackness, 'Blackness'), 0, 100) / 100;
  if (w + b >= 1) {
    const grey = (w / (w + b)) * 255;
    return [grey, grey, grey];
  }
  const x = 1 - Math.abs(((h / 60) % 2) - 1);
  const pure: Rgb =
    h < 60
      ? [1, x, 0]
      : h < 120
        ? [x, 1, 0]
        : h < 180
          ? [0, 1, x]
          : h < 240
            ? [0, x, 1]
            : h < 300
              ? [x, 0, 1]
              : [1, 0, x];
  const channel = (value: number): number => (value * (1 - w - b) + w) * 255;
  return [channel(pure[0]), channel(pure[1]), channel(pure[2])];
}

export function rgbToHex(rgb: readonly number[]): string {
  if (!Array.isArray(rgb) || rgb.length !== 3)
    throw new TypeError('RGB must contain exactly three channels.');
  return (
    '#' +
    rgb
      .map(value =>
        Math.round(clamp(finite(value, 'RGB channel'), 0, 255))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
      .toUpperCase()
  );
}

export function hexToRgb(hex: string): Rgb {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex))
    throw new TypeError('HEX must use the #RRGGBB format.');
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export function hwbToHex(h: number, w: number, b: number): string {
  return rgbToHex(hwbToRgb(h, w, b));
}

export function hexToHwb(
  hex: string,
  fallbackHue = 0,
): Readonly<{ h: number; w: number; b: number }> {
  const [r, g, b] = hexToRgb(hex).map(channel => channel / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = finite(fallbackHue, 'Fallback Hue');
  if (delta)
    h =
      max === r
        ? 60 * (((g - b) / delta) % 6)
        : max === g
          ? 60 * ((b - r) / delta + 2)
          : 60 * ((r - g) / delta + 4);
  return { h: round(normalizeHue(h), 4), w: round(min * 100, 4), b: round((1 - max) * 100, 4) };
}

export function relativeLuminance(hex: string): number {
  const linear = hexToRgb(hex).map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrastRatio(a: string, b: string): number {
  const x = relativeLuminance(a);
  const y = relativeLuminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export function contrastInk(hex: string): '#FFFFFF' | '#000000' {
  return contrastRatio(hex, '#FFFFFF') >= contrastRatio(hex, '#000000') ? '#FFFFFF' : '#000000';
}

const preset = (id: string, name: string, h: number, w = 12, b = 12): ColorPreset =>
  Object.freeze({ id, name, h, w, b, hex: hwbToHex(h, w, b) });

/** Source catalog order and duplicate red identity are intentional, not nearest-color mapping. */
export const COLOR_PRESETS: readonly ColorPreset[] = Object.freeze([
  preset('red', 'red', 0),
  preset('red-orange', 'red-orange', 15),
  preset('orange', 'orange', 30),
  preset('orange-yellow', 'orange-yellow', 45),
  preset('yellow', 'yellow', 60),
  preset('lime', 'lime', 75),
  preset('yellow-green', 'yellow-green', 90),
  preset('green', 'green', 120),
  preset('green-cyan', 'green-cyan', 150),
  preset('cyan', 'cyan', 180),
  preset('cyan-blue', 'cyan-blue', 210),
  preset('blue', 'blue', 240),
  preset('blue-violet', 'blue-violet', 255),
  preset('violet', 'violet', 270),
  preset('purple', 'purple', 292.5, 12, 28),
  preset('magenta', 'magenta', 300),
  preset('magenta-red', 'magenta-red', 330),
  preset('red-repeat', 'red', 0),
  preset('grey1', 'light gray', 0, 84, 16),
  preset('grey2', 'medium gray', 0, 56, 44),
  preset('grey3', 'dark gray', 0, 32, 68),
  preset('black1', 'warm-black', 30, 6, 90),
  preset('black2', 'cool-black', 220, 6, 90),
  preset('black3', 'black', 0, 0, 100),
]);

// Legacy settings remain readable without adding brown to the current visible catalog.
const legacyBrown = preset('brown', 'brown', 30, 16, 50);
const presetsById = new Map([...COLOR_PRESETS, legacyBrown].map(value => [value.id, value]));

export const DEFAULT_COLOR_SELECTION: ColorSelection = Object.freeze({
  anchor: 214,
  offset: 0,
  w: 15,
  b: 15,
  mode: 'light',
  selectionMode: 'presets',
  presetId: null,
});

export function validateColorSelection(value: unknown): ColorSelection {
  if (!isRecord(value)) throw new TypeError('Color settings must be an object.');
  const bounded = (name: string, min: number, max: number): number => {
    const n = finite(value[name], name);
    if (n < min || n > max) throw new RangeError(`${name} is outside its permitted range.`);
    return round(n, 1);
  };
  const anchor = bounded('anchor', 0, 360);
  const offset = bounded('offset', -36, 36);
  const w = bounded('w', 0, 100);
  const b = bounded('b', 0, 100);
  if (value.mode !== 'light' && value.mode !== 'dark')
    throw new TypeError('Preview theme must be light or dark.');
  const selectionMode = value.selectionMode === undefined ? 'detailed' : value.selectionMode;
  if (selectionMode !== 'detailed' && selectionMode !== 'presets')
    throw new TypeError('Selection method must be detailed or presets.');
  // Retired catalog entries restore as an exact custom HWB color, never as a
  // different preset. This path also covers saved lists and schema 1–4 imports.
  const presetId =
    value.presetId === undefined || value.presetId === 'violet-magenta' ? null : value.presetId;
  if (presetId !== null && (typeof presetId !== 'string' || !presetsById.has(presetId)))
    throw new TypeError('The source preset is not recognized.');
  return { anchor, offset, w, b, mode: value.mode, selectionMode, presetId };
}

export function convertColorSelection(value: ColorSelection) {
  const state = validateColorSelection(value);
  const h = round(normalizeHue(state.anchor + state.offset), 1) % 360;
  const rawHex = hwbToHex(h, state.w, state.b);
  const sum = state.w + state.b;
  const normalized = sum > 100;
  return {
    h,
    rawHex,
    seedHex: rawHex,
    rawRgb: hexToRgb(rawHex),
    seedRgb: hexToRgb(rawHex),
    normalized,
    achromatic: sum >= 100,
    effectiveW: normalized ? (state.w / sum) * 100 : state.w,
    effectiveB: normalized ? (state.b / sum) * 100 : state.b,
    pureShare: Math.max(0, 100 - sum),
    hwb: `hwb(${h} ${state.w}% ${state.b}%)`,
  };
}

function updateSelection(state: ColorSelection, patch: Partial<ColorSelection>): ColorSelection {
  return validateColorSelection({ ...state, ...patch });
}

export function setMainHue(state: ColorSelection, value: number): ColorSelection {
  return updateSelection(state, { anchor: value, offset: 0, presetId: null });
}

export function setFineOffset(state: ColorSelection, value: number): ColorSelection {
  return updateSelection(state, { offset: value, presetId: null });
}

export function setFineHue(
  value: ColorSelection,
  hue: number,
): Readonly<{ state: ColorSelection; recentered: boolean }> {
  const state = validateColorSelection(value);
  const h = finite(hue, 'Fine Hue');
  if (h < 0 || h > 360) throw new RangeError('Fine Hue must be between 0 and 360.');
  const delta = ((normalizeHue(h) - normalizeHue(state.anchor) + 540) % 360) - 180;
  if (Math.abs(delta) <= 36)
    return { state: setFineOffset(state, round(delta, 1)), recentered: false };
  return { state: setMainHue(state, round(h, 1)), recentered: true };
}

export function setColorChannel(
  state: ColorSelection,
  channel: 'w' | 'b',
  value: number,
): ColorSelection {
  if (channel !== 'w' && channel !== 'b') throw new TypeError('Channel must be w or b.');
  return updateSelection(state, { [channel]: value });
}

export function setSelectionMethod(
  state: ColorSelection,
  selectionMode: ColorSelectionMethod,
): ColorSelection {
  return updateSelection(state, { selectionMode });
}

export function setPreviewTheme(state: ColorSelection, mode: ColorPreviewTheme): ColorSelection {
  return updateSelection(state, { mode });
}

export function applyColorPreset(state: ColorSelection, id: string): ColorSelection {
  const selected = presetsById.get(id);
  if (!selected) throw new RangeError('The source preset is not recognized.');
  return updateSelection(state, {
    anchor: selected.h,
    offset: 0,
    w: selected.w,
    b: selected.b,
    presetId: selected.id,
  });
}

export function resetColorSelection(state: ColorSelection): ColorSelection {
  return { ...DEFAULT_COLOR_SELECTION, selectionMode: validateColorSelection(state).selectionMode };
}

export function presetStatus(state: ColorSelection) {
  const selected = validateColorSelection(state);
  const hex = convertColorSelection(selected).seedHex;
  const origin = selected.presetId ? (presetsById.get(selected.presetId) ?? null) : null;
  const exact =
    origin?.hex === hex ? origin : (COLOR_PRESETS.find(value => value.hex === hex) ?? null);
  return { origin, exact, modified: origin !== null && origin.hex !== hex };
}

export function hueWindowSegments(
  anchor: number,
): readonly Readonly<{ left: number; width: number }>[] {
  const start = normalizeHue(anchor - 36);
  const end = start + 72;
  return end <= 360
    ? [{ left: start / 3.6, width: 20 }]
    : [
        { left: start / 3.6, width: (360 - start) / 3.6 },
        { left: 0, width: (end - 360) / 3.6 },
      ];
}

export function generateColorPalette(
  seedHex: string,
  mode: ColorPreviewTheme,
  backgroundColor = '#141414',
): string[] {
  hexToRgb(seedHex);
  if (mode !== 'light' && mode !== 'dark')
    throw new TypeError('Palette theme must be light or dark.');
  if (mode === 'light') return generate(seedHex);
  hexToRgb(backgroundColor);
  return generate(seedHex, { theme: 'dark', backgroundColor });
}

export function exportColorSelection(
  value: ColorSelection,
  resolvedTokens: Readonly<Partial<Record<ColorTokenName, string>>> = {},
  backgroundColor = '#141414',
  antDesignVersion = '6.6.6',
) {
  const state = validateColorSelection(value);
  const converted = convertColorSelection(state);
  const status = presetStatus(state);
  const verifiedTokens: Partial<Record<ColorTokenName, string>> = {};
  for (const name of COLOR_TOKEN_NAMES) {
    const token = resolvedTokens[name];
    if (token !== undefined) {
      if (typeof token !== 'string') throw new TypeError('Resolved theme tokens must be strings.');
      verifiedTokens[name] = token;
    }
  }
  return {
    format: COLOR_SETTINGS_FORMAT,
    schemaVersion: COLOR_SCHEMA_VERSION,
    settings: state,
    selection: {
      mode: state.selectionMode,
      presetCatalogVersion: 3,
      presetId: state.presetId,
      exactPresetId: status.exact?.id ?? null,
      presetModified: status.modified,
    },
    pipeline: {
      inputColorModel: 'HWB',
      paletteEngine: '@ant-design/colors.generate',
      themeEngine:
        state.mode === 'dark' ? 'antd.theme.darkAlgorithm' : 'antd.theme.defaultAlgorithm',
      transferPolicy: 'direct-srgb-hex',
      webSafeQuantization: false,
      channelEncoding: '8 bit sRGB; each channel 0–255, without color reduction',
      subHueSpanDegrees: 72,
      subHueHalfSpanDegrees: 36,
      hue: converted.h,
      hwb: converted.hwb,
      rawHex: converted.rawHex,
      rawRgb: converted.rawRgb,
      seedHex: converted.seedHex,
      seedRgb: converted.seedRgb,
      normalized: converted.normalized,
      effectiveWhiteness: converted.effectiveW,
      effectiveBlackness: converted.effectiveB,
    },
    antDesign: {
      version: antDesignVersion,
      theme: {
        algorithm: state.mode === 'dark' ? 'darkAlgorithm' : 'defaultAlgorithm',
        token: { colorPrimary: converted.seedHex },
      },
      palette: generateColorPalette(converted.seedHex, state.mode, backgroundColor),
      resolvedTokens: verifiedTokens,
    },
  };
}

/** Only validated settings are imported. File-supplied palette and theme outputs are ignored. */
export function importColorSelection(source: unknown): ColorSelection {
  let document: unknown = source;
  if (typeof source === 'string') {
    if (new TextEncoder().encode(source).byteLength > MAX_COLOR_SETTINGS_BYTES)
      throw new RangeError('Color settings files must not exceed 1 MiB.');
    document = JSON.parse(source);
  }
  if (
    !isRecord(document) ||
    document.format !== COLOR_SETTINGS_FORMAT ||
    typeof document.schemaVersion !== 'number' ||
    ![1, 2, 3, 4].includes(document.schemaVersion)
  )
    throw new TypeError('Import a supported version 1, 2, 3 or 4 color settings file.');
  return validateColorSelection(document.settings);
}
