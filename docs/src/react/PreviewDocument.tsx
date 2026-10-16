/// <reference types="vite/client" />
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
} from 'react';
import { isPreviewOrientation, type PreviewOrientation } from '../data/preview-devices';
import { isPreviewProfile, parsePreviewProfile, type PreviewProfile } from '../preview/profiles';
import {
  previewRegistry,
  previewSlugForId,
  resolvePreviewDemo,
  type PreviewDemoProps,
} from '../preview/registry';
import { installPreviewBridge, postToParent } from '../preview/bridge';
import { restoreLocale } from '../i18n';
import { initializeThemeBuilder } from '../theme-builder/store';
import type { ThemeMode } from '../theme';
import { AtlasSsrTheme } from './AtlasProvider';
import AdaptiveProvider from './AdaptiveProvider';
import {
  serverEnvironment,
  type AdaptiveEnvironment,
  type AdaptiveOptions,
  type LayoutProfile,
} from '../adaptive/policy';
import { PreviewProvider } from './PreviewContext';

// The server resolves every allowlisted demo before rendering. In browser bundles this branch is
// dead code, so they never include the server registry or any unselected demo.
const serverDemos = import.meta.env.SSR
  ? (await import('../preview/registry.server')).serverDemos
  : null;
// Local mode event for the applied recipe; the global atlas-theme-change event stays untouched.
const PREVIEW_THEME_EVENT = 'atlas-preview-theme-change';
const PREVIEW_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Allowlisted slug of this document's own route, <base>preview/<id>/<profile>/; anything else is
    null. The id only selects a registry key and never becomes an import path. */
function routeSlug(pathname: string, base: string): string | null {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  if (!pathname.startsWith(prefix)) return null;
  const segments = pathname.slice(prefix.length).split('/');
  const last = segments[segments.length - 1];
  if (last === '' || last === 'index.html') segments.pop();
  const [scope, id, profile] = segments;
  if (segments.length !== 3 || scope !== 'preview' || !isPreviewProfile(profile)) return null;
  if (!id || !PREVIEW_ID.test(id)) return null;
  try {
    return previewSlugForId(id);
  } catch {
    return null;
  }
}

// Browsers evaluate this module, and so hydrate, only after the one demo of this route resolves,
// so the first client render matches the SSR markup without a Suspense fallback.
const clientDemo = import.meta.env.SSR
  ? null
  : await (async () => {
      const slug = routeSlug(window.location.pathname, import.meta.env.BASE_URL);
      const entry = slug === null ? undefined : previewRegistry[slug];
      return slug && entry ? { slug, component: await resolvePreviewDemo(entry) } : null;
    })();

/** Fails closed: only an allowlisted slug that matches this document's resolved demo renders. */
function selectedDemo(slug: string): ComponentType<PreviewDemoProps> {
  let demo: ComponentType<PreviewDemoProps> | undefined;
  if (Object.hasOwn(previewRegistry, slug))
    demo = serverDemos
      ? serverDemos[slug]
      : clientDemo?.slug === slug
        ? clientDemo.component
        : undefined;
  if (!demo) throw new TypeError(`Unknown preview component '${slug}'.`);
  return demo;
}

/** Commits after the selected demo, its preceding sibling, renders or hydrates. */
function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => onReady(), [onReady]);
  return null;
}

export type PreviewDeliveryProps = {
  id: string;
  slug: string;
  /** Initial local choices; the URL query and bridge commands may change them after hydration. */
  theme?: ThemeMode;
  orientation?: PreviewOrientation;
  grid?: boolean;
};
/** Preset each profile entry exports; a runtime switch applies it to the same stable tree. */
export type PreviewLayout = {
  readonly profile: PreviewProfile;
  readonly gutterPx: number;
  readonly className: string;
  readonly dataLayout: string;
};
type PreviewStyle = CSSProperties & Record<`--preview-document-${string}`, string>;

/** Each preview profile is a known, trusted reference journey and locks its layout profile, so a
    rotated small preview stays phone instead of reading its landscape width as tablet. */
const adaptiveProfiles: Readonly<Record<PreviewProfile, LayoutProfile>> = {
  small: 'phone',
  medium: 'tablet',
  large: 'desktop',
};

// Literal allowlisted entries; a switch imports only the requested one, never on first render.
const profileEntries: Readonly<
  Record<PreviewProfile, () => Promise<{ readonly previewLayout: PreviewLayout }>>
> = {
  small: () => import('./preview/SmallDelivery'),
  medium: () => import('./preview/MediumDelivery'),
  large: () => import('./preview/LargeDelivery'),
};

/** This document's own route under another profile; the query keeps revision and choices. */
function profileUrl(id: string, profile: PreviewProfile): string {
  const prefix = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const { search, hash } = window.location;
  return `${prefix}preview/${encodeURIComponent(id)}/${profile}/${search}${hash}`;
}

/** One example alone on a fixed logical screen. Mode, orientation, grid and profile stay local to
    this document and change through the bridge without navigation; a profile switch applies the
    requested entry's preset to the same stable tree, so all demo state survives in memory. */
export default function PreviewDocument({
  id,
  slug,
  theme,
  orientation: initialOrientation,
  grid: initialGrid = false,
  layout: initialLayout,
}: PreviewDeliveryProps & { layout: PreviewLayout }) {
  // Style extraction renders under each scheme, so its dark pass emits dark roles; the real SSR
  // and the first client render have no provider and stay light, matching the light markup. An
  // explicit initial theme prop wins over both.
  const ssrMode = useContext(AtlasSsrTheme);
  const [mode, setMode] = useState<ThemeMode>(theme ?? ssrMode);
  const [orientation, setOrientation] = useState(initialOrientation);
  const [grid, setGrid] = useState(initialGrid);
  const [layout, setLayout] = useState(initialLayout);
  const [hydrated, setHydrated] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const profile = layout.profile;
  const screen = parsePreviewProfile(profile, orientation);
  const Demo = selectedDemo(slug);
  const modeRef = useRef(mode);
  useEffect(() => {
    // Only this iframe's root changes; shared-origin theme storage stays untouched.
    modeRef.current = mode;
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
    window.dispatchEvent(new Event(PREVIEW_THEME_EVENT));
  }, [mode]);
  // The applied recipe follows this document's mode, never the outer global theme.
  useEffect(
    () =>
      initializeThemeBuilder({ getMode: () => modeRef.current, eventName: PREVIEW_THEME_EVENT }),
    [],
  );
  useEffect(() => {
    // Open alone URLs apply validated local choices once, after the light SSR markup hydrates.
    const params = new URLSearchParams(window.location.search);
    const theme = params.get('theme');
    if (theme === 'light' || theme === 'dark') setMode(theme);
    const requested = params.get('orientation');
    if (isPreviewOrientation(requested)) setOrientation(requested);
    if (params.get('grid') === '1') setGrid(true);
  }, []);
  // Field keys read translated labels, so ready waits for the shared language choice.
  // True once the selected demo and the language are ready; connect answers only then.
  const ready = useRef(false);
  const onReady = useCallback(() => {
    let current = true;
    void restoreLocale()
      .catch(() => undefined)
      .then(() => {
        if (!current) return;
        ready.current = true;
        setHydrated(true);
        postToParent(id, { type: 'ready', profile });
      });
    return () => {
      current = false;
      ready.current = false;
    };
  }, [id, profile]);
  // Latest committed preset for bridge commands; a newer switch request cancels older imports.
  const layoutRef = useRef(layout);
  const switchEpoch = useRef(0);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);
  /** Imports only the requested entry for its preset and applies it to this same tree; Ready then
      reports the new profile after the commit. The document URL follows without navigation. */
  const switchProfile = useCallback(
    (next: PreviewProfile) => {
      const epoch = ++switchEpoch.current;
      window.history.replaceState(window.history.state, '', profileUrl(id, next));
      if (next === layoutRef.current.profile) {
        if (ready.current) postToParent(id, { type: 'ready', profile: next });
        return;
      }
      void profileEntries[next]()
        .then(({ previewLayout }) => {
          if (previewLayout.profile !== next) throw new TypeError('Unknown preview profile.');
          if (epoch === switchEpoch.current) setLayout(previewLayout);
        })
        .catch(() => {
          if (epoch !== switchEpoch.current) return;
          window.history.replaceState(
            window.history.state,
            '',
            profileUrl(id, layoutRef.current.profile),
          );
          postToParent(id, { type: 'profile-failed', profile: next });
        });
    },
    [id],
  );
  useEffect(
    () =>
      installPreviewBridge(id, command => {
        // A parent that attached after ready asks once; an unready document posts ready later.
        if (command.type === 'connect') {
          if (ready.current) postToParent(id, { type: 'ready', profile });
        } else if (command.type === 'theme') setMode(command.mode);
        else if (command.type === 'orientation') setOrientation(command.orientation);
        else if (command.type === 'grid') setGrid(command.on);
        else if (command.type === 'profile') switchProfile(command.profile);
        // The real Tweaker inside this document opens; nothing is mirrored into the parent.
        else if (command.type === 'open-native-settings')
          root.current?.querySelector<HTMLButtonElement>('[data-tweaker-trigger]')?.click();
        // Legacy snapshot and restore commands are ignored; the same tree keeps its state.
      }),
    [id, profile, switchProfile],
  );
  const context = useMemo(
    () => ({ exampleId: id, profile, mode, orientation: screen.orientation }),
    [id, profile, mode, screen.orientation],
  );
  // A constant, unkeyed AdaptiveProvider wraps every profile so the business subtree never
  // remounts; it locks the reference profile and seeds only this logical screen's CSS size,
  // never an emulated device capability.
  const adaptiveOptions = useMemo<AdaptiveOptions>(
    () => ({ lockedProfile: adaptiveProfiles[profile] }),
    [profile],
  );
  const adaptiveEnvironment = useMemo<AdaptiveEnvironment>(
    () => ({
      ...serverEnvironment,
      width: screen.widthPx,
      height: screen.heightPx,
      visualWidth: screen.widthPx,
      visualHeight: screen.heightPx,
    }),
    [screen.widthPx, screen.heightPx],
  );
  const style: PreviewStyle = {
    '--preview-document-width': `${screen.widthPx}px`,
    '--preview-document-height': `${screen.heightPx}px`,
    '--preview-document-container-width': `${screen.containerWidthPx}px`,
    '--preview-document-container-margin': `${screen.containerMarginPx}px`,
    '--preview-document-gutter': `${layout.gutterPx}px`,
  };
  return (
    <AdaptiveProvider options={adaptiveOptions} initialEnvironment={adaptiveEnvironment}>
      <PreviewProvider value={context}>
        <div
          ref={root}
          data-preview-document=""
          data-profile={profile}
          data-theme={mode}
          data-orientation={screen.orientation}
          data-preview-grid={grid ? '' : undefined}
          data-preview-hydrated={hydrated ? 'true' : undefined}
          style={style}
        >
          <div data-preview-viewport="">
            <div data-preview-container="">
              {/* One stable main for every profile; only its preset class and layout change. It is
                  also the named adaptive container every demo's container rules read. */}
              <main
                className={layout.className}
                data-preview-layout={layout.dataLayout}
                data-adaptive-container=""
              >
                <Demo documentation />
                <Ready onReady={onReady} />
              </main>
            </div>
          </div>
        </div>
      </PreviewProvider>
    </AdaptiveProvider>
  );
}
