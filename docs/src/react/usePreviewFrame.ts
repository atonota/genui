/// <reference types="vite/client" />
/** Parent side of one isolated preview iframe. Theme, orientation, grid and, once the document
    has reported ready, the profile stay local to the preview document and travel through the
    bridge, so the same browsing context and demo tree keep all state; only the initial or a
    retried profile navigates. The frame is revealed once its root carries the local mode, so
    mode changes never flash. */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  previewDeviceDefinition,
  previewOrientation,
  type PreviewDevice,
  type PreviewOrientation,
} from '../data/preview-devices';
import { PREVIEW_CHANNEL, type PreviewCommand } from '../preview/bridge';
import {
  DEFAULT_PREVIEW_PROFILE,
  isPreviewProfile,
  previewProfileDevice,
  previewProfileForDevice,
  type PreviewProfile,
} from '../preview/profiles';
import {
  previewControlEvent,
  previewFocusEvent,
  type PreviewControlDetail,
  type PreviewFocusDetail,
} from '../components/docs-inspector';
import { getThemeSnapshot, type ThemeMode } from '../theme';
import { linkInputModality } from '../preview/input-modality';

/** Asks the parent UI to show the preview view before the native settings open. */
export const previewShowEvent = 'genui-preview-show';

// The first mounted preview owns Inspector focus until another one calls focus().
let focusedPreviewId: string | null = null;

const isDevice = (value: unknown): value is PreviewDevice =>
  value === 'iphone' || value === 'ipad' || value === 'macbook';
const isMode = (value: unknown): value is ThemeMode => value === 'light' || value === 'dark';
// GitHub Pages serves the docs under a base path; normalized to one trailing slash.
const base = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;
const MAX_REVISION = 1e9;

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
  ready: boolean;
  /** The frame failed to load or to switch profile; retry navigates the requested profile. */
  error: boolean;
  /** Iframe URL; changes only when an initial profile navigation or a retry commits. Runtime
      profile switches keep it, the browsing context and the demo tree. */
  src: string;
  /** Open alone URL for the current local choices and selected profile. */
  standaloneSrc: string;
  frameRef: RefObject<HTMLIFrameElement | null>;
  setDevice(device: PreviewDevice): void;
  setTheme(mode: ThemeMode): void;
  rotate(): void;
  setGrid(on: boolean): void;
  openSettings(): void;
  focus(): void;
  /** Navigates the requested profile again, for example after a failed load. */
  retry(): void;
  /** Wire to the iframe onLoad and onError. */
  onLoad(): void;
  onError(): void;
};

type Committed = {
  readonly profile: PreviewProfile;
  readonly query: string;
  /** Bounded per-navigation counter; replies from older documents never match it. */
  readonly revision: number;
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

export function usePreviewFrame({ id, title }: { id: string; title: string }): PreviewFrame {
  const initialDevice = previewProfileDevice(DEFAULT_PREVIEW_PROFILE);
  const [device, setDeviceState] = useState<PreviewDevice>(initialDevice);
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [requested, setRequested] = useState<PreviewOrientation>();
  const [grid, setGridState] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [committed, setCommitted] = useState<Committed>({
    profile: DEFAULT_PREVIEW_PROFILE,
    query: '',
    revision: 0,
  });
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  // Synchronous mirrors of the local choices for message and event handlers.
  const local = useRef<Local>({
    device: initialDevice,
    theme: 'light',
    requested: undefined,
    grid: false,
  });
  const committedRef = useRef(committed);
  const frameReady = useRef(false);
  // The committed document reported ready once; its profile then switches without navigation.
  const connected = useRef(false);
  // Profile the document last reported ready, its runtime layout; src never follows it.
  const active = useRef<PreviewProfile>(DEFAULT_PREVIEW_PROFILE);
  const pendingSettings = useRef(false);
  const observed = useRef<{ doc: Document; observer: MutationObserver } | null>(null);
  const frameListeners = useRef<(() => void) | null>(null);
  // Preview document whose focus claim and input modality bridge are installed.
  const bound = useRef<Document | null>(null);
  const initialized = useRef(false);

  const post = useCallback(
    (command: PreviewCommand) =>
      frameRef.current?.contentWindow?.postMessage(
        { channel: PREVIEW_CHANNEL, id, revision: committedRef.current.revision, ...command },
        window.location.origin,
      ),
    [id],
  );
  const check = useCallback(() => {
    const root = observed.current?.doc.documentElement;
    setReady(frameReady.current && root?.dataset.theme === local.current.theme);
  }, []);
  const detach = useCallback(() => {
    observed.current?.observer.disconnect();
    observed.current = null;
  }, []);

  /** Navigates to a profile; the query carries the local choices and a fresh revision. */
  const commit = useCallback(
    (profile: PreviewProfile, again = false) => {
      if (!again && profile === committedRef.current.profile) return;
      const revision = (committedRef.current.revision + 1) % MAX_REVISION;
      const params = choiceParams(local.current);
      params.set('revision', String(revision));
      frameReady.current = false;
      connected.current = false;
      active.current = profile;
      detach();
      committedRef.current = { profile, query: `?${params}`, revision };
      setCommitted(committedRef.current);
      setReady(false);
      setError(false);
    },
    [detach],
  );
  /** A document that can no longer answer waits for its replacement's own ready. */
  const lose = useCallback(() => {
    frameReady.current = false;
    connected.current = false;
    detach();
    setReady(false);
  }, [detach]);

  const setDevice = useCallback(
    (next: PreviewDevice) => {
      local.current.device = next;
      setDeviceState(next);
      const profile = previewProfileForDevice(next);
      // Nothing hydrated holds state yet, so the profile may navigate directly.
      if (!connected.current) return commit(profile);
      if (frameReady.current && profile === active.current) return;
      // The same browsing context and demo tree switch layout, even while another import runs;
      // the ready for the latest requested profile reveals the frame again.
      frameReady.current = false;
      setReady(false);
      post({ type: 'profile', profile });
    },
    [commit, post],
  );
  const setTheme = useCallback(
    (mode: ThemeMode) => {
      local.current.theme = mode;
      setThemeState(mode);
      if (frameReady.current) post({ type: 'theme', mode });
      check();
    },
    [check, post],
  );
  const rotate = useCallback(() => {
    const { device: current, requested: wanted } = local.current;
    if (!previewDeviceDefinition(current).rotatable) return;
    const next = previewOrientation(current, wanted) === 'portrait' ? 'landscape' : 'portrait';
    local.current.requested = next;
    setRequested(next);
    if (frameReady.current) post({ type: 'orientation', orientation: next });
  }, [post]);
  const setGrid = useCallback(
    (on: boolean) => {
      local.current.grid = on;
      setGridState(on);
      if (frameReady.current) post({ type: 'grid', on });
    },
    [post],
  );
  const openSettings = useCallback(() => {
    if (!frameReady.current) {
      pendingSettings.current = true;
      return;
    }
    post({ type: 'open-native-settings' });
    frameRef.current?.focus();
  }, [post]);

  const publish = useCallback(() => {
    if (focusedPreviewId !== id) return;
    const { device: current, theme: mode, grid: on } = local.current;
    const detail: PreviewFocusDetail = { id, title, device: current, theme: mode, grid: on };
    document.dispatchEvent(new CustomEvent(previewFocusEvent, { detail }));
  }, [id, title]);
  const focus = useCallback(() => {
    focusedPreviewId = id;
    publish();
  }, [id, publish]);

  const unbind = useCallback(() => {
    frameListeners.current?.();
    frameListeners.current = null;
    bound.current = null;
  }, []);
  /** Installs the focus claim and the input modality bridge once per preview document, from
      whichever of load or ready comes first; false for a page without the preview root. */
  const bindPreviewDocument = useCallback(
    (doc: Document) => {
      if (bound.current === doc) return true;
      if (doc.URL === 'about:blank' || !doc.querySelector('[data-preview-document]')) return false;
      unbind();
      const claim = () => focus();
      doc.addEventListener('focusin', claim);
      doc.addEventListener('pointerdown', claim);
      // Only the same-origin document on this example's preview route joins the focus visuals.
      const linked =
        doc.location.origin === window.location.origin &&
        doc.location.pathname.startsWith(`${base}preview/${encodeURIComponent(id)}/`);
      const unlink = linked ? linkInputModality(document, doc) : () => {};
      bound.current = doc;
      frameListeners.current = () => {
        doc.removeEventListener('focusin', claim);
        doc.removeEventListener('pointerdown', claim);
        unlink();
      };
      return true;
    },
    [focus, id, unbind],
  );

  const onLoad = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc || doc.URL === 'about:blank') return unbind();
    // A reload replaced the ready document; wait for its own ready.
    if (observed.current && observed.current.doc !== doc) lose();
    // A 404 or other page without the preview root would never report ready.
    if (!bindPreviewDocument(doc)) {
      unbind();
      setError(true);
      lose();
      return;
    }
    // A document that became ready before this load event answers once.
    post({ type: 'connect' });
  }, [bindPreviewDocument, lose, post, unbind]);
  const onError = useCallback(() => {
    setError(true);
    lose();
  }, [lose]);
  const retry = useCallback(
    () => commit(previewProfileForDevice(local.current.device), true),
    [commit],
  );

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    // One read of the outer theme; the preview never subscribes to or writes it.
    setTheme(getThemeSnapshot());
  }, [setTheme]);

  useEffect(() => {
    focusedPreviewId ??= id;
    return () => {
      if (focusedPreviewId === id) focusedPreviewId = null;
    };
  }, [id]);
  useEffect(() => publish(), [publish, device, theme, grid]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const frame = frameRef.current;
      if (event.origin !== window.location.origin || !frame || event.source !== frame.contentWindow)
        return;
      const data = event.data as Record<string, unknown> | null;
      if (!data || typeof data !== 'object' || data.channel !== PREVIEW_CHANNEL || data.id !== id)
        return;
      // Every reply must come from the committed navigation; runtime profile switches keep it.
      if ((data.revision ?? 0) !== committedRef.current.revision) return;
      if (data.type === 'ready') {
        // Only the latest requested profile counts; an older document or layout is stale.
        const expectedProfile = previewProfileForDevice(local.current.device);
        if (!isPreviewProfile(data.profile) || data.profile !== expectedProfile) return;
        const doc = frame.contentDocument;
        // The focus bridge joins this document before ready can reveal it; onLoad may come later.
        if (!doc || !bindPreviewDocument(doc)) return;
        frameReady.current = true;
        connected.current = true;
        active.current = data.profile;
        setError(false);
        if (observed.current?.doc !== doc) {
          detach();
          const observer = new MutationObserver(check);
          observer.observe(doc.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme'],
          });
          observed.current = { doc, observer };
        }
        const { theme: mode, grid: on, device: current, requested: wanted } = local.current;
        post({ type: 'theme', mode });
        post({ type: 'orientation', orientation: previewOrientation(current, wanted) });
        post({ type: 'grid', on });
        if (pendingSettings.current) {
          pendingSettings.current = false;
          post({ type: 'open-native-settings' });
          frame.focus();
        }
        check();
      } else if (data.type === 'profile-failed') {
        // The document keeps its last layout and state; retry navigates the requested profile.
        if (data.profile === previewProfileForDevice(local.current.device)) setError(true);
      }
    };
    window.addEventListener('message', onMessage);
    // A child that became ready before this listener answers once; an unready one posts later.
    post({ type: 'connect' });
    return () => window.removeEventListener('message', onMessage);
  }, [bindPreviewDocument, check, detach, id, post]);

  useEffect(() => {
    const onControl = (event: Event) => {
      const detail = controlDetail((event as CustomEvent<unknown>).detail);
      if (!detail || (detail.scope === 'focused' && focusedPreviewId !== id)) return;
      if (detail.device) setDevice(detail.device);
      if (detail.theme) setTheme(detail.theme);
      if (detail.grid !== undefined) setGrid(detail.grid);
      if (detail.action === 'settings' && focusedPreviewId === id) {
        document.dispatchEvent(new CustomEvent(previewShowEvent, { detail: { id } }));
        openSettings();
      }
    };
    document.addEventListener(previewControlEvent, onControl);
    return () => document.removeEventListener(previewControlEvent, onControl);
  }, [id, openSettings, setDevice, setGrid, setTheme]);

  useEffect(
    () => () => {
      detach();
      unbind();
    },
    [detach, unbind],
  );

  const standalone = choiceParams({ device, theme, requested, grid }).toString();
  return {
    device,
    theme,
    orientation: previewOrientation(device, requested),
    grid,
    ready,
    error,
    src: `${base}preview/${encodeURIComponent(id)}/${committed.profile}/${committed.query}`,
    standaloneSrc: `${base}preview/${encodeURIComponent(id)}/${previewProfileForDevice(device)}/${
      standalone ? `?${standalone}` : ''
    }`,
    frameRef,
    setDevice,
    setTheme,
    rotate,
    setGrid,
    openSettings,
    focus,
    retry,
    onLoad,
    onError,
  };
}
