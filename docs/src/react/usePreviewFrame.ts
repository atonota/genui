/// <reference types="vite/client" />
/** Local controller of one inline example preview. Device, theme, orientation and grid stay
    local to the example and only restyle its same-page mockup, so the demo tree keeps all
    state; nothing navigates or remounts. The Inspector focus and control events keep their
    focused/all scope, and Open alone links the real standalone route. */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  previewDeviceDefinition,
  previewOrientation,
  type PreviewDevice,
  type PreviewOrientation,
} from '../data/preview-devices';
import {
  DEFAULT_PREVIEW_PROFILE,
  previewProfileDevice,
  previewProfileForDevice,
} from '../preview/profiles';
import {
  previewControlEvent,
  previewFocusEvent,
  type PreviewControlDetail,
  type PreviewFocusDetail,
} from '../components/docs-inspector';
import { getThemeSnapshot, type ThemeMode } from '../theme';
import { focusLocalPreview, releaseLocalPreview } from './PreviewContext';

/** Asks the parent UI to show the preview view before the native settings open. */
export const previewShowEvent = 'genux-preview-show';

// The first mounted preview owns Inspector focus until another one calls focus().
let focusedPreviewId: string | null = null;

// Inspector devices, validated exactly as the Inspector contract declares them, TV included.
const isDevice = (value: unknown): value is NonNullable<PreviewControlDetail['device']> =>
  value === 'iphone' || value === 'ipad' || value === 'macbook' || value === 'tv';
const isMode = (value: unknown): value is ThemeMode => value === 'light' || value === 'dark';
// GitHub Pages serves the docs under a base path; normalized to one trailing slash.
const base = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

function controlDetail(value: unknown): PreviewControlDetail | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { scope, device, theme, grid, action } = value as Record<string, unknown>;
  if (scope !== 'focused' && scope !== 'all') return undefined;
  const detail: PreviewControlDetail = { scope };
  if (isDevice(device)) detail.device = device;
  else if (device !== undefined) return undefined;
  if (isMode(theme)) detail.theme = theme;
  else if (theme !== undefined) return undefined;
  if (typeof grid === 'boolean') detail.grid = grid;
  else if (grid !== undefined) return undefined;
  if (action === 'settings') detail.action = action;
  else if (action !== undefined) return undefined;
  return detail;
}

export type PreviewFrame = {
  device: PreviewDevice;
  theme: ThemeMode;
  orientation: PreviewOrientation;
  grid: boolean;
  /** Open alone URL of the standalone route for the current local choices and profile. */
  standaloneSrc: string;
  setDevice(device: PreviewDevice): void;
  setTheme(mode: ThemeMode): void;
  rotate(): void;
  setGrid(on: boolean): void;
  /** Opens the page Demo Tweaker through its existing trigger. */
  openSettings(): void;
  focus(): void;
};

type Local = {
  device: PreviewDevice;
  theme: ThemeMode;
  requested: PreviewOrientation | undefined;
  grid: boolean;
};

/** Local choices as query parameters; the preview document validates them once. */
function choiceParams({ device, theme, requested, grid }: Local): URLSearchParams {
  const params = new URLSearchParams();
  if (theme !== 'light') params.set('theme', theme);
  if (previewDeviceDefinition(device).rotatable)
    params.set('orientation', previewOrientation(device, requested));
  if (grid) params.set('grid', '1');
  return params;
}

export function usePreviewFrame({
  id,
  title,
  anchorRef,
}: {
  id: string;
  title: string;
  /** An element inside the page Demo owner; openSettings uses that owner's Tweaker trigger. */
  anchorRef?: RefObject<HTMLElement | null>;
}): PreviewFrame {
  const initialDevice = previewProfileDevice(DEFAULT_PREVIEW_PROFILE);
  const [device, setDeviceState] = useState<PreviewDevice>(initialDevice);
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [requested, setRequested] = useState<PreviewOrientation>();
  const [grid, setGridState] = useState(false);
  // Synchronous mirrors of the local choices for event handlers.
  const local = useRef<Local>({
    device: initialDevice,
    theme: 'light',
    requested: undefined,
    grid: false,
  });
  const initialized = useRef(false);

  const setDevice = useCallback((next: PreviewDevice) => {
    local.current.device = next;
    setDeviceState(next);
  }, []);
  const setTheme = useCallback((mode: ThemeMode) => {
    local.current.theme = mode;
    setThemeState(mode);
  }, []);
  const rotate = useCallback(() => {
    const { device: current, requested: wanted } = local.current;
    if (!previewDeviceDefinition(current).rotatable) return;
    const next = previewOrientation(current, wanted) === 'portrait' ? 'landscape' : 'portrait';
    local.current.requested = next;
    setRequested(next);
  }, []);
  const setGrid = useCallback((on: boolean) => {
    local.current.grid = on;
    setGridState(on);
  }, []);
  const publish = useCallback(() => {
    if (focusedPreviewId !== id) return;
    const { device: current, theme: mode, grid: on } = local.current;
    const detail: PreviewFocusDetail = { id, title, device: current, theme: mode, grid: on };
    document.dispatchEvent(new CustomEvent(previewFocusEvent, { detail }));
  }, [id, title]);
  const focus = useCallback(() => {
    focusedPreviewId = id;
    // The page Tweaker's token editors follow the same focused example.
    focusLocalPreview(id);
    publish();
  }, [id, publish]);
  /** The example's settings live in the page Demo Tweaker: the nearest .genux-demo owner that
      holds its existing trigger opens it, so focus return stays with that Tweaker. This example
      becomes the local target first; without its registration the Tweaker would fall back to
      the global token editors, so it stays closed. */
  const openSettings = useCallback(() => {
    const selected = focusedPreviewId === id;
    focusedPreviewId = id;
    const available = focusLocalPreview(id);
    if (!selected) publish();
    if (!available) return;
    let owner = anchorRef?.current?.closest('.genux-demo') ?? null;
    while (owner) {
      const trigger = owner.querySelector<HTMLElement>('.genux-tweaker-trigger button');
      if (trigger) {
        trigger.click();
        return;
      }
      owner = owner.parentElement?.closest('.genux-demo') ?? null;
    }
  }, [anchorRef, id, publish]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    // One read of the outer theme after hydration; the preview never subscribes to or writes it.
    setTheme(getThemeSnapshot());
  }, [setTheme]);

  useEffect(() => {
    // The first mounted owner is also the Tweaker's local target; its registration notifies later.
    if (focusedPreviewId === null) {
      focusedPreviewId = id;
      focusLocalPreview(id);
    }
    return () => {
      if (focusedPreviewId === id) focusedPreviewId = null;
      releaseLocalPreview(id);
    };
  }, [id]);
  useEffect(() => publish(), [publish, device, theme, grid]);

  useEffect(() => {
    const onControl = (event: Event) => {
      const detail = controlDetail((event as CustomEvent<unknown>).detail);
      if (!detail || (detail.scope === 'focused' && focusedPreviewId !== id)) return;
      if (detail.device) setDevice(detail.device);
      if (detail.theme) setTheme(detail.theme);
      if (detail.grid !== undefined) setGrid(detail.grid);
      // Settings need this example's local registration, never the global fallback.
      if (detail.action === 'settings' && focusedPreviewId === id && focusLocalPreview(id)) {
        document.dispatchEvent(new CustomEvent(previewShowEvent, { detail: { id } }));
        openSettings();
      }
    };
    document.addEventListener(previewControlEvent, onControl);
    return () => document.removeEventListener(previewControlEvent, onControl);
  }, [id, openSettings, setDevice, setGrid, setTheme]);

  const standalone = choiceParams({ device, theme, requested, grid }).toString();
  return {
    device,
    theme,
    orientation: previewOrientation(device, requested),
    grid,
    standaloneSrc: `${base}preview/${encodeURIComponent(id)}/${previewProfileForDevice(device)}/${
      standalone ? `?${standalone}` : ''
    }`,
    setDevice,
    setTheme,
    rotate,
    setGrid,
    openSettings,
    focus,
  };
}
