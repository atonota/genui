import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  baselineDelivery,
  DeliveryController,
  type InitialLayout,
  type LayoutNavigation,
} from '../adaptive/delivery';
import { resolveAdaptive, type AdaptiveOptions } from '../adaptive/policy';
import { AdaptiveContext, useAdaptive, type AdaptiveContextValue } from './AdaptiveProvider';
import AtlasButton from './AtlasButton';
import AtlasPortalScope from './AtlasPortalScope';
import { useI18n } from './useI18n';

export type AdaptivePurpose = 'reading' | 'form' | 'data';

/**
 * Shell override of the inherited surface and lock only. Journey continuity and its release
 * belong to AdaptiveProvider options and useAdaptive().releaseJourney, never to a Shell.
 */
export type AdaptiveShellOptions = Pick<AdaptiveOptions, 'surface' | 'lockedProfile'>;

export type AdaptiveShellProps = {
  children: ReactNode;
  navigation?: ReactNode;
  context?: ReactNode;
  purpose?: AdaptivePurpose;
  ariaLabel?: string;
  /** Remote or hardware Back; return true when it was handled. */
  onBack?: () => boolean;
  /** Surface and lock override; without it the Shell keeps the inherited resolution. */
  options?: AdaptiveShellOptions;
  /**
   * Trusted code-owned server data from loadServerAdaptive, never a generated UI payload. It
   * presents its profile only while that is the resolved layout and the real module is not active.
   */
  initialLayout?: InitialLayout;
};

const noSubscription = () => () => {};
const readBaseline = () => baselineDelivery;
const openByDefault: Record<LayoutNavigation, boolean> = {
  drawer: false,
  rail: true,
  persistent: true,
  spatial: true,
};
// Compiled CSS is trusted; a closing tag inside it still never ends the inline element early.
const inlineStyle = (cssText: string) => cssText.replace(/<\/(style)/gi, '<\\/$1');
// webOS remotes report Back as keyCode 461; other platforms use the standard key names.
const isBackKey = (event: KeyboardEvent) =>
  event.key === 'GoBack' || event.key === 'BrowserBack' || event.nativeEvent.keyCode === 461;

/**
 * Inherited provider context; explicit Shell options re-resolve that same environment. Options
 * without a surface keep the inherited surface, and without a lock keep the inherited lock or
 * retained journey on that surface. The result is the context of the whole Shell subtree.
 */
function useResolution(options?: AdaptiveShellOptions): AdaptiveContextValue {
  const inherited = useAdaptive();
  const explicit = options !== undefined;
  const surface = options?.surface ?? inherited.surface;
  const lockedProfile =
    options?.lockedProfile ??
    (surface === inherited.surface ? inherited.options.lockedProfile : undefined);
  return useMemo(() => {
    if (!explicit) return inherited;
    const effective: AdaptiveOptions = lockedProfile ? { surface, lockedProfile } : { surface };
    return {
      ...inherited,
      resolution: resolveAdaptive(inherited.environment, effective),
      surface,
      options: effective,
    };
  }, [explicit, inherited, surface, lockedProfile]);
}

/** One shell for every profile: slots and the business subtree never remount. */
export default function AdaptiveShell({
  children,
  navigation,
  context,
  purpose = 'reading',
  ariaLabel,
  onBack,
  options,
  initialLayout,
}: AdaptiveShellProps) {
  const { t } = useI18n();
  const adaptive = useResolution(options);
  const { resolution, surface } = adaptive;
  const [controller, setController] = useState<DeliveryController | null>(null);
  // Each effect run owns its controller, so a StrictMode replay never keeps a disposed one.
  useEffect(() => {
    const owned = new DeliveryController();
    setController(owned);
    return () => owned.dispose();
  }, []);
  const delivery = useSyncExternalStore(
    controller?.subscribe ?? noSubscription,
    controller?.getSnapshot ?? readBaseline,
    readBaseline,
  );
  const layout = resolution.layout;
  useEffect(() => {
    if (controller) void controller.select(layout);
  }, [controller, layout]);

  const loaded = controller?.module(delivery.active);
  // Server data for the resolved layout presents it until that real module is active; a
  // mismatched profile, such as a TV seed in a web Shell, is ignored and keeps the baseline.
  const seed = initialLayout?.profile === layout ? initialLayout : undefined;
  const active = seed && loaded?.profile !== layout ? undefined : loaded;
  const presented = active ?? seed;
  // The seeded style stays once rendered: its rules are scoped like loaded module CSS, and the
  // client CSS helper dedupes against it instead of installing that profile again.
  const [seedStyle, setSeedStyle] = useState(seed);
  if (seed && seed !== seedStyle) setSeedStyle(seed);
  const rootRef = useRef<HTMLDivElement>(null);
  // A profile or surface change detaches at once; only the module matching the requested
  // layout attaches, before paint, so an outgoing TV module never handles keys while the next
  // one loads. Seed metadata carries no functions and attaches nothing.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!active?.attach || !root || active.profile !== layout) return;
    return active.attach(root);
  }, [active, layout, surface]);

  const kind = presented?.navigation ?? 'drawer';
  const [navChoice, setNavChoice] = useState<boolean | null>(null);
  const navOpen = navigation !== undefined && (navChoice ?? openByDefault[kind]);
  const navId = useId();
  const toggleId = useId();
  const navRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  // Hiding the nav must not strand focus inside it; form values live in the untouched main.
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (navOpen || !nav?.contains(nav.ownerDocument.activeElement)) return;
    const toggle = nav.ownerDocument.getElementById(toggleId);
    (toggle && toggle.getClientRects().length > 0 ? toggle : mainRef.current)?.focus({
      preventScroll: true,
    });
  }, [navOpen, toggleId]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Keys bubble through nested Shells: one handled by an inner Shell is never handled again.
    if (event.defaultPrevented) return;
    if (
      event.key === 'Escape' &&
      kind === 'drawer' &&
      navOpen &&
      navRef.current?.contains(event.target as Node)
    ) {
      event.preventDefault();
      setNavChoice(false);
    } else if (isBackKey(event) && !event.repeat && onBack?.()) {
      event.preventDefault();
    }
  };

  // Always the same wrapper, so the business subtree never remounts when options change.
  const shell = (
    <div
      ref={rootRef}
      className={presented ? `adaptive-shell ${presented.className}` : 'adaptive-shell'}
      data-adaptive-shell=""
      data-adaptive-surface={surface}
      data-layout={presented?.profile ?? 'baseline'}
      data-layout-requested={controller ? delivery.requested : layout}
      data-delivery-status={delivery.status}
      data-loaded-layouts={delivery.loaded.join(' ')}
      data-navigation={kind}
      data-nav-open={navOpen ? 'true' : 'false'}
      data-purpose={purpose}
      data-input-layers={resolution.inputLayers.join(' ')}
      data-orientation={resolution.orientation}
      data-short-height={resolution.shortHeight ? 'true' : 'false'}
      onKeyDown={onKeyDown}
    >
      {navigation !== undefined && (
        <div className="adaptive-shell-bar">
          <AtlasButton
            id={toggleId}
            fill="text"
            text={t('Navigation')}
            aria-controls={navId}
            aria-expanded={navOpen}
            onClick={() => setNavChoice(!navOpen)}
          />
        </div>
      )}
      {navigation !== undefined && (
        <nav
          ref={navRef}
          id={navId}
          className="adaptive-shell-nav"
          aria-label={t('Navigation')}
          hidden={!navOpen}
          inert={!navOpen}
        >
          {navigation}
        </nav>
      )}
      <main ref={mainRef} className="adaptive-shell-main" tabIndex={-1} aria-label={ariaLabel}>
        {children}
      </main>
      {context !== undefined && (
        <aside className="adaptive-shell-context" aria-label={t('Context')}>
          {context}
        </aside>
      )}
      <div className="adaptive-shell-delivery">
        <span role="status">
          {delivery.status === 'loading'
            ? t('Loading layout')
            : delivery.status === 'error'
              ? t('Layout could not load')
              : ''}
        </span>
        {delivery.status === 'error' && (
          <AtlasButton text={t('Retry')} onClick={() => void controller?.retry()} />
        )}
      </div>
    </div>
  );
  // The plain host is a stable container-query parent outside the root, so main.parentElement
  // stays the root; the seeded style is its sibling and never shifts the root's slot. Inside an
  // AtlasProvider the portal scope adds no box: the effective surface owns its popups through
  // this Shell's own themed body portal, registered to this root.
  return (
    <AdaptiveContext.Provider value={adaptive}>
      <div className="adaptive-shell-host">
        {seedStyle && (
          <style
            data-adaptive-layout-style={seedStyle.profile}
            dangerouslySetInnerHTML={{ __html: inlineStyle(seedStyle.cssText) }}
          />
        )}
        <AtlasPortalScope ownerRef={rootRef} adaptive={adaptive}>
          {shell}
        </AtlasPortalScope>
      </div>
    </AdaptiveContext.Provider>
  );
}
