import { inputSurfaces } from './data/input-surfaces';
import { overlayThemeRoles } from './data/overlay-tokens';
import definitionsSource from './theme-builder/definitions.json';
import { defaultGeometryVariables } from './theme-builder/model';

export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'atlas-theme';
const THEME_EVENT = 'atlas-theme-change';

/** Panel, ink, muted and field roles derive from the central input surface model;
    paper and the warm surface are the approved page values and stay independent.
    The decorative well edge and inner shadows are exported too (--field-inset-border,
    --field-inner-shadow, --field-inner-hover) together with the disabled well roles
    (--field-disabled-bg, --field-disabled-text, --field-disabled-shadow), so every owner,
    AtlasProvider and the sidebar search included, reads the same model per :root[data-theme]
    instead of inlining a resolved palette.
    Overlay scrim, backdrop blur, stacking and motion roles spread in from overlayThemeRoles(),
    whose single value source is theme-builder/definitions.json; the old dropdown names are
    emitted only as aliases of those roles. */
export const themeColors = {
  light: {
    paper: '#f5f3ee',
    panel: inputSurfaces.light.surface,
    surface: '#eeeee8',
    ink: inputSurfaces.light.text,
    muted: inputSurfaces.light.hint,
    line: '#ddded5',
    fieldBorder: inputSurfaces.light.border,
    fieldBg: inputSurfaces.light.fieldBg,
    fieldFilledBg: inputSurfaces.light.fieldBg,
    fieldHoverBg: inputSurfaces.light.fieldBg,
    fieldInsetBorder: inputSurfaces.light.insetBorder,
    fieldInnerShadow: inputSurfaces.light.innerShadow,
    fieldInnerHover: inputSurfaces.light.innerHover,
    fieldDisabledBg: inputSurfaces.light.disabledBg,
    fieldDisabledText: inputSurfaces.light.disabledText,
    fieldDisabledShadow: inputSurfaces.light.disabledShadow,
    ...overlayThemeRoles('light'),
    primary: '#cf1322',
    primaryEdge: '#940615',
    accent: '#a8071a',
    actionInk: '#cf1322',
    soft: '#fff1f0',
    error: '#a8071a',
    warning: '#874d00',
    success: '#237804',
  },
  dark: {
    paper: '#242424',
    panel: inputSurfaces.dark.surface,
    surface: '#343434',
    ink: inputSurfaces.dark.text,
    muted: inputSurfaces.dark.hint,
    line: '#151515',
    fieldBorder: inputSurfaces.dark.border,
    fieldBg: inputSurfaces.dark.fieldBg,
    fieldFilledBg: inputSurfaces.dark.fieldBg,
    fieldHoverBg: inputSurfaces.dark.fieldBg,
    fieldInsetBorder: inputSurfaces.dark.insetBorder,
    fieldInnerShadow: inputSurfaces.dark.innerShadow,
    fieldInnerHover: inputSurfaces.dark.innerHover,
    fieldDisabledBg: inputSurfaces.dark.disabledBg,
    fieldDisabledText: inputSurfaces.dark.disabledText,
    fieldDisabledShadow: inputSurfaces.dark.disabledShadow,
    ...overlayThemeRoles('dark'),
    primary: '#cf1322',
    primaryEdge: '#940615',
    accent: '#ff7875',
    actionInk: '#ff7875',
    soft: '#343434',
    error: '#ff7875',
    warning: '#ffd666',
    success: '#95de64',
  },
} as const;

/** Canvas default from the central definitions; the documentation shell has no other value source. */
function canvasColor(mode: ThemeMode): string {
  const definitions: readonly unknown[] = definitionsSource;
  const entry = definitions.find(
    (candidate): candidate is { kind?: unknown; defaults?: Record<string, unknown> } =>
      candidate !== null &&
      typeof candidate === 'object' &&
      (candidate as { id?: unknown }).id === 'canvas',
  );
  const value = entry?.defaults?.[mode];
  if (entry?.kind !== 'color' || typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value))
    throw new TypeError(`Theme token definition canvas must provide a #RRGGBB ${mode} default.`);
  return value.toLowerCase();
}

/** Documentation shell roles, each declared once on :root. --paper stays the definition-backed
    canvas value that Theme Builder writes; --shell-bg and --panel-bg alias --paper and --panel,
    so overriding one role never moves the other. Both inks alias --ink. --surface keeps its
    component tint and is not a shell role. Documentation paper is independent of the approved
    and Storybook profile. */
function docsShellRoles(mode: ThemeMode) {
  return {
    paper: canvasColor(mode),
    shellBg: 'var(--paper)',
    shellInk: 'var(--ink)',
    panelBg: 'var(--panel)',
    panelInk: 'var(--ink)',
  } as const;
}

export const docsThemeColors = {
  light: { ...themeColors.light, ...docsShellRoles('light') },
  dark: { ...themeColors.dark, ...docsShellRoles('dark') },
} as const;

/** One mode's color roles as CSS custom properties, each camelCase role under its kebab-case
    name. The static root style text and inline preview owners share this single mapping. */
export function themeColorVariables(
  colors: Readonly<Record<string, string>>,
): Record<`--${string}`, string> {
  return Object.fromEntries(
    Object.entries(colors).map(([name, value]) => [
      `--${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`,
      value,
    ]),
  ) as Record<`--${string}`, string>;
}

function createThemeStyleText(colorsByMode: Record<ThemeMode, Record<string, string>>) {
  return Object.entries(colorsByMode)
    .map(([mode, colors]) => {
      // Emit factory geometry on each static root before a provider hydrates.
      // Keep color source mappings intact; custom provider recipes still override these defaults.
      const variables = {
        ...defaultGeometryVariables(mode as ThemeMode),
        ...themeColorVariables(colors),
      };
      const tokens = Object.entries(variables)
        .map(([name, value]) => `${name}:${value}`)
        .join(';');
      const owner =
        mode === 'light'
          ? `:root:not([data-theme]),:root[data-theme='light']`
          : `:root[data-theme='dark']`;
      return `${owner}{${tokens};color-scheme:${mode}}`;
    })
    .join('\n');
}

export const themeStyleText = createThemeStyleText(themeColors);
export const docsThemeStyleText = createThemeStyleText(docsThemeColors);

let paintGeneration = 0;

export function beginThemePaint(): void {
  const generation = ++paintGeneration;
  const root = document.documentElement;
  // A theme is one semantic palette. Interpolating readable foregrounds against
  // already-switched surfaces creates white-on-white/black-on-black frames.
  root.dataset.themePaint = 'atomic';
  const release = () => {
    if (generation === paintGeneration) delete root.dataset.themePaint;
  };
  window.requestAnimationFrame(() => window.requestAnimationFrame(release));
}

function applyTheme(mode: ThemeMode): void {
  beginThemePaint();
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.style.colorScheme = mode;
}

export function getThemeSnapshot(): ThemeMode {
  return typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark'
    ? 'dark'
    : 'light';
}

export function getServerThemeSnapshot(): ThemeMode {
  return 'light';
}

export function subscribeTheme(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const syncStorage = (event: StorageEvent) => {
    if (
      event.key === THEME_STORAGE_KEY &&
      (event.newValue === 'light' || event.newValue === 'dark')
    ) {
      applyTheme(event.newValue);
      listener();
    }
  };
  window.addEventListener(THEME_EVENT, listener);
  window.addEventListener('storage', syncStorage);
  return () => {
    window.removeEventListener(THEME_EVENT, listener);
    window.removeEventListener('storage', syncStorage);
  };
}

export function setTheme(mode: ThemeMode): void {
  if (typeof window === 'undefined') return;
  applyTheme(mode);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // The selected theme still works when browser storage is unavailable.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}
