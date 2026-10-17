/// <reference types="vite/client" />
import {
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type CSSProperties,
  type LazyExoticComponent,
} from 'react';
import { isPreviewOrientation, type PreviewOrientation } from '../data/preview-devices';
import { isPreviewProfile, parsePreviewProfile, type PreviewProfile } from '../preview/profiles';
import {
  previewRegistry,
  previewSlugForId,
  resolvePreviewDemo,
  type PreviewDemoProps,
} from '../preview/registry';
import { restoreLocale } from '../i18n';
import {
  getServerThemeBuilderSnapshot,
  getThemeBuilderSnapshot,
  initializeThemeBuilder,
  subscribeThemeBuilder,
} from '../theme-builder/store';
import {
  createDefaultRecipe,
  defaultGeometryVariables,
  resolveThemeBuilder,
  validateRecipe,
  type ThemeRecipe,
} from '../theme-builder/model';
import { docsThemeColors, themeColorVariables, type ThemeMode } from '../theme';
import { documentationVariables } from '../data/docs-brand';
import { GenUXSsrTheme } from './GenUXProvider';
import AdaptiveProvider from './AdaptiveProvider';
import { layoutLoaders } from '../adaptive/delivery';
import type { AdaptiveOptions, LayoutProfile } from '../adaptive/policy';
import {
  PreviewProvider,
  type PreviewContextValue,
  type PreviewRecipeResult,
} from './PreviewContext';

// The server resolves every allowlisted demo before rendering. In browser bundles this branch is
// dead code, so they never include the server registry or any unselected demo.
const serverDemos = import.meta.env.SSR
  ? (await import('../preview/registry.server')).serverDemos
  : null;
// Local mode event for the applied recipe; the global genux-theme-change event stays untouched.
const PREVIEW_THEME_EVENT = 'genux-preview-theme-change';
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

type PreviewDemo =
  | ComponentType<PreviewDemoProps>
  | LazyExoticComponent<ComponentType<PreviewDemoProps>>;
// One lazy component per slug, so every render and embed of a slug keeps one element type and
// its state; only that slug's literal registry loader ever runs.
const lazyDemos = new Map<string, LazyExoticComponent<ComponentType<PreviewDemoProps>>>();

/** Fails closed: only an allowlisted slug from the props renders, on any route. The server and
    the preloaded standalone route render it at once, outside any Suspense boundary; any other
    client route, an embed, loads it lazily behind the embed's Suspense boundary. */
function selectedDemo(slug: string): PreviewDemo {
  const entry = Object.hasOwn(previewRegistry, slug) ? previewRegistry[slug] : undefined;
  const ready = !entry
    ? undefined
    : serverDemos
      ? serverDemos[slug]
      : clientDemo?.slug === slug
        ? clientDemo.component
        : lazyDemos.get(slug);
  if (ready) return ready;
  if (!entry || serverDemos) throw new TypeError(`Unknown preview component '${slug}'.`);
  const demo = lazy(() =>
    resolvePreviewDemo(entry).then(
      component => ({ default: component }),
      (error: unknown) => {
        // A failed load is not cached, so a later mount retries the same allowlisted loader.
        lazyDemos.delete(slug);
        throw error;
      },
    ),
  );
  lazyDemos.set(slug, demo);
  return demo;
}

export type PreviewDeliveryProps = {
  id: string;
  slug: string;
  /** Initial local choices; the validated URL query may change them once after hydration. */
  theme?: ThemeMode;
  orientation?: PreviewOrientation;
  grid?: boolean;
  /** Internal: only the standalone preview route sets this. It alone reads the URL query and
      owns the document root theme and the global Theme Builder; the default embeds inline. */
  standalone?: boolean;
};
/** Fixed preset each profile entry exports; the standalone document keeps its route profile. */
export type PreviewLayout = {
  readonly profile: PreviewProfile;
  readonly gutterPx: number;
  readonly className: string;
  readonly dataLayout: string;
};
type PreviewStyle = CSSProperties & Record<`--${string}`, string>;

/** Each preview profile is a known, trusted reference journey and locks its layout profile, so a
    rotated small preview stays phone instead of reading its landscape width as tablet. */
const adaptiveProfiles: Readonly<Record<PreviewProfile, LayoutProfile>> = {
  small: 'phone',
  medium: 'tablet',
  large: 'desktop',
  // The living-room reference journey is its own explicit adaptive profile.
  tv: 'living-room',
};

/** One example on the fixed logical screen of its profile. By default it embeds inline on any
    route: mode, orientation and grid follow the props and only its own root carries the theme.
    The internal standalone route alone owns the document root theme, the global Theme Builder
    and the validated URL query, which applies local choices once after hydration. The profile
    and its preset never change at runtime. */
export default function PreviewDocument({
  id,
  slug,
  theme,
  orientation: initialOrientation,
  grid: initialGrid = false,
  standalone = false,
  layout,
}: PreviewDeliveryProps & { layout: PreviewLayout }) {
  // Style extraction renders under each scheme, so its dark pass emits dark roles; the real SSR
  // and the first client render have no provider and stay light, matching the light markup. An
  // explicit theme prop wins over both, and only the standalone query wins over that.
  const ssrMode = useContext(GenUXSsrTheme);
  const [queryMode, setMode] = useState<ThemeMode>();
  const [queryOrientation, setOrientation] = useState<PreviewOrientation>();
  const [queryGrid, setGrid] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const mode = queryMode ?? theme ?? ssrMode;
  const orientation = queryOrientation ?? initialOrientation;
  const grid = queryGrid || initialGrid;
  const profile = layout.profile;
  const screen = parsePreviewProfile(profile, orientation);
  const Demo = selectedDemo(slug);
  // An embed only reads the applied recipe; it never initializes, stores or applies it globally.
  const recipe = useSyncExternalStore(
    subscribeThemeBuilder,
    getThemeBuilderSnapshot,
    getServerThemeBuilderSnapshot,
  );
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
    if (!standalone) return;
    // Only the standalone document's root changes; shared-origin theme storage stays untouched.
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
    window.dispatchEvent(new Event(PREVIEW_THEME_EVENT));
  }, [mode, standalone]);
  // The standalone recipe follows its document's mode, never the outer global theme.
  useEffect(() => {
    if (!standalone) return;
    return initializeThemeBuilder({
      getMode: () => modeRef.current,
      eventName: PREVIEW_THEME_EVENT,
    });
  }, [standalone]);
  useEffect(() => {
    // Only standalone URLs apply validated local choices, once, after the light SSR hydrates.
    if (!standalone) return;
    const params = new URLSearchParams(window.location.search);
    const requestedMode = params.get('theme');
    if (requestedMode === 'light' || requestedMode === 'dark') setMode(requestedMode);
    const requested = params.get('orientation');
    if (isPreviewOrientation(requested)) setOrientation(requested);
    if (params.get('grid') === '1') setGrid(true);
  }, [standalone]);
  // Field keys read translated labels, so the standalone marker waits for the shared language;
  // an embed leaves the language to its host page.
  useEffect(() => {
    if (!standalone) {
      setHydrated(true);
      return;
    }
    let current = true;
    void restoreLocale()
      .catch(() => undefined)
      .then(() => {
        if (current) setHydrated(true);
      });
    return () => {
      current = false;
    };
  }, [standalone]);
  // An embed owns an in-memory recipe, as an inline example does; until its first apply it
  // follows the global recipe, and nothing here writes global storage. Only the embed exposes
  // these actions, so the standalone document keeps the global Theme Builder.
  const [localRecipe, setLocalRecipe] = useState<ThemeRecipe | null>(null);
  const apply = useCallback((input: ThemeRecipe): PreviewRecipeResult => {
    const checked = validateRecipe(input);
    if (!checked.ok) return { ok: false, error: checked.error };
    setLocalRecipe(checked.recipe);
    return { ok: true };
  }, []);
  const reset = useCallback(() => setLocalRecipe(createDefaultRecipe()), []);
  const context = useMemo<PreviewContextValue>(
    () =>
      standalone
        ? { exampleId: id, profile, mode, orientation: screen.orientation }
        : {
            exampleId: id,
            profile,
            mode,
            orientation: screen.orientation,
            recipe: localRecipe,
            apply,
            reset,
          },
    [id, profile, mode, screen.orientation, standalone, localRecipe, apply, reset],
  );
  // The AdaptiveProvider locks the reference profile and seeds only this logical screen's CSS
  // size, never an emulated device capability.
  const adaptiveOptions = useMemo<AdaptiveOptions>(
    () => ({
      // Only the tv reference journey runs on the living-room surface; every other stays web.
      surface: profile === 'tv' ? 'living-room' : 'web',
      lockedProfile: adaptiveProfiles[profile],
    }),
    [profile],
  );
  // Only the tv profile imports the canonical living-room controller, as the inline preview does;
  // other profiles never load it. Leaving the surface or unmounting detaches it at once, and a
  // late import from an earlier run never attaches.
  const rootRef = useRef<HTMLDivElement>(null);
  const [layoutClassName, setLayoutClassName] = useState<string>();
  useEffect(() => {
    const root = rootRef.current;
    if (adaptiveOptions.surface !== 'living-room' || !root) return;
    let current = true;
    let detach: (() => void) | undefined;
    layoutLoaders['living-room']().then(
      entry => {
        if (!current) return;
        detach = entry.attach?.(root);
        setLayoutClassName(entry.className);
      },
      // A failed import keeps the baseline document; nothing retries on its own.
      () => {},
    );
    return () => {
      current = false;
      detach?.();
      setLayoutClassName(undefined);
    };
  }, [adaptiveOptions.surface]);
  // A controlled logical viewport replaces only the host's size signals, after hydration too;
  // real capabilities, preferences and input stay the host's.
  const viewport = useMemo(
    () => ({ width: screen.widthPx, height: screen.heightPx }),
    [screen.widthPx, screen.heightPx],
  );
  // An embed carries this mode's canonical docs roles and its effective recipe, its own before
  // the global one, on its own root only, so the page and every other example keep theirs.
  const effectiveRecipe = localRecipe ?? recipe;
  const themeVariables = useMemo(
    () =>
      standalone
        ? undefined
        : {
            ...defaultGeometryVariables(mode),
            ...themeColorVariables(docsThemeColors[mode]),
            ...documentationVariables(mode),
            ...(effectiveRecipe ? resolveThemeBuilder(effectiveRecipe, mode).variables : {}),
            colorScheme: mode,
          },
    [standalone, mode, effectiveRecipe],
  );
  const style: PreviewStyle = {
    ...themeVariables,
    '--preview-document-width': `${screen.widthPx}px`,
    '--preview-document-height': `${screen.heightPx}px`,
    '--preview-document-container-width': `${screen.containerWidthPx}px`,
    '--preview-document-container-margin': `${screen.containerMarginPx}px`,
    '--preview-document-gutter': `${layout.gutterPx}px`,
  };
  // A standalone document is the whole page, so its content root is the page's one main
  // landmark; an embedded entry sits inside its host page's main and must not nest another.
  const ContentRoot = standalone ? 'main' : 'div';
  return (
    <AdaptiveProvider options={adaptiveOptions} viewport={viewport}>
      <PreviewProvider value={context}>
        <div
          ref={rootRef}
          className={layoutClassName}
          data-preview-document=""
          data-profile={profile}
          data-theme={mode}
          data-orientation={screen.orientation}
          data-preview-grid={grid ? '' : undefined}
          data-preview-hydrated={hydrated ? 'true' : undefined}
          data-adaptive-shell=""
          data-adaptive-surface={adaptiveOptions.surface}
          style={style}
        >
          <div data-preview-viewport="">
            <div data-preview-container="">
              {/* The profile's preset content root, also the named adaptive container every
                  demo's container rules read. Only the standalone document is a main landmark. */}
              <ContentRoot
                className={layout.className}
                data-preview-layout={layout.dataLayout}
                data-adaptive-container=""
              >
                {/* The standalone demo is always preloaded on the server and client, so it renders
                    directly: a Suspense boundary would make React emit a pending boundary and a
                    hidden payload outside this root even for a ready demo. `standalone` never
                    changes, so each document keeps one element type. */}
                {standalone ? (
                  <Demo documentation />
                ) : (
                  <Suspense fallback={null}>
                    <Demo documentation />
                  </Suspense>
                )}
              </ContentRoot>
            </div>
          </div>
        </div>
      </PreviewProvider>
    </AdaptiveProvider>
  );
}
