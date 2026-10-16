import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  advanceJourney,
  journeyOptions,
  resolveAdaptive,
  serverEnvironment,
  type AdaptiveEnvironment,
  type AdaptiveJourney,
  type AdaptiveOptions,
  type AdaptiveResolution,
  type ProductSurface,
} from '../adaptive/policy';
import { getEnvironmentStore } from '../adaptive/environment';

export interface AdaptiveContextValue {
  environment: AdaptiveEnvironment;
  resolution: AdaptiveResolution;
  surface: ProductSurface;
  /** Effective options, including the phone lock of a retained journey. */
  options: AdaptiveOptions;
  /** Drops a retained journey; the next render resolves by width again. */
  releaseJourney: () => void;
}

export const AdaptiveContext = createContext<AdaptiveContextValue | null>(null);

const subscribeNothing = () => () => {};
const readClient = () => true;
const readServer = () => false;
const webOptions: AdaptiveOptions = Object.freeze({ surface: 'web' });

/** Fixed logical size of a mockup screen in CSS px; replaces only the host's size signals. */
export type AdaptiveViewport = Readonly<{ width: number; height: number }>;

// The shared document store is read lazily during render, never at module init, so SSR
// and the hydration pass both see the stable initial snapshot. A controlled viewport replaces
// only width, height and the visual size; capabilities, preferences and input stay the host's.
function useEnvironment(
  enabled: boolean,
  initial: AdaptiveEnvironment,
  viewport?: AdaptiveViewport,
): { environment: AdaptiveEnvironment; measured: boolean } {
  const store = useMemo(
    () => (enabled && typeof window !== 'undefined' ? getEnvironmentStore(window) : null),
    [enabled],
  );
  const subscribe = useCallback(
    (onChange: () => void) => (store ? store.subscribe(onChange) : subscribeNothing()),
    [store],
  );
  const getSnapshot = useCallback(() => (store ? store.getSnapshot() : initial), [store, initial]);
  const getServerSnapshot = useCallback(() => initial, [initial]);
  const host = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const logicalWidth = viewport?.width;
  const logicalHeight = viewport?.height;
  const environment = useMemo<AdaptiveEnvironment>(
    () =>
      logicalWidth === undefined || logicalHeight === undefined
        ? host
        : Object.freeze({
            ...host,
            width: logicalWidth,
            height: logicalHeight,
            visualWidth: logicalWidth,
            visualHeight: logicalHeight,
          }),
    [host, logicalWidth, logicalHeight],
  );
  // Hydration renders the initial snapshot too; only later client renders are measured.
  const hydrated = useSyncExternalStore(subscribeNothing, readClient, readServer);
  return { environment, measured: store !== null && hydrated };
}

/**
 * Resolution with journey continuity. The journey is derived state updated during render (the
 * React pattern for information from previous renders), so a rotated phone never renders or
 * requests the tablet layout first. SSR and hydration snapshots are never recorded, so the
 * conservative 320 fallback cannot latch a phone.
 */
function useResolution(
  environment: AdaptiveEnvironment,
  measured: boolean,
  options: AdaptiveOptions,
): AdaptiveContextValue {
  const surface = options.surface ?? 'web';
  const { lockedProfile, continuity } = options;
  const own = useMemo<AdaptiveOptions>(
    () => ({
      surface,
      ...(lockedProfile ? { lockedProfile } : {}),
      ...(continuity ? { continuity } : {}),
    }),
    [surface, lockedProfile, continuity],
  );
  const [journey, setJourney] = useState<AdaptiveJourney | null>(null);
  const current = measured ? advanceJourney(journey, environment, own) : null;
  if (current !== null && current !== journey) setJourney(current);
  const releaseJourney = useCallback(() => setJourney(null), []);
  const effective = useMemo(() => journeyOptions(current, own), [current, own]);
  return useMemo(
    () => ({
      environment,
      resolution: resolveAdaptive(environment, effective),
      surface,
      options: effective,
      releaseJourney,
    }),
    [environment, effective, surface, releaseJourney],
  );
}

/** Explicit product surface, locked profile, SSR snapshot and optional fixed logical viewport
    for every nested consumer. */
export default function AdaptiveProvider({
  children,
  options,
  initialEnvironment,
  viewport,
}: {
  children: ReactNode;
  options?: AdaptiveOptions;
  initialEnvironment?: AdaptiveEnvironment;
  /** Controlled logical size, for example a fixed device mockup screen. */
  viewport?: AdaptiveViewport;
}) {
  const { environment, measured } = useEnvironment(
    true,
    initialEnvironment ?? serverEnvironment,
    viewport,
  );
  const value = useResolution(environment, measured, options ?? {});
  return <AdaptiveContext.Provider value={value}>{children}</AdaptiveContext.Provider>;
}

/** Provider context when present; otherwise the shared document environment on the web surface. */
export function useAdaptive(): AdaptiveContextValue {
  const provided = useContext(AdaptiveContext);
  const { environment, measured } = useEnvironment(provided === null, serverEnvironment);
  const own = useResolution(environment, measured, webOptions);
  return provided ?? own;
}
