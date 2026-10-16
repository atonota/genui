import type { LayoutProfile } from './policy';

export type LayoutNavigation = 'drawer' | 'rail' | 'persistent' | 'spatial';

/**
 * One layout entry; importing it brings its own compiled CSS string, and attach installs it in the
 * root's document. Callers own attach cleanup. Custom unit loaders may omit cssText.
 */
export type LayoutModule = {
  profile: LayoutProfile;
  className: string;
  navigation: LayoutNavigation;
  cssText?: string;
  attach?: (root: HTMLElement) => () => void;
};

/** Frozen server metadata for the profile chosen before hydration. */
export type InitialLayout = Readonly<{
  profile: LayoutProfile;
  className: string;
  navigation: LayoutNavigation;
  cssText: string;
}>;

export type DeliveryStatus = 'baseline' | 'loading' | 'ready' | 'error';

export type DeliverySnapshot = {
  status: DeliveryStatus;
  requested: LayoutProfile;
  active: LayoutProfile | null;
  loaded: readonly LayoutProfile[];
  error?: string;
};

export type LayoutLoaders = Record<LayoutProfile, () => Promise<LayoutModule>>;

/** Literal imports give each profile its own chunk; nothing loads before select(). */
export const layoutLoaders: LayoutLoaders = {
  phone: () => import('./layouts/phone').then(entry => entry.layoutModule),
  tablet: () => import('./layouts/tablet').then(entry => entry.layoutModule),
  laptop: () => import('./layouts/laptop').then(entry => entry.layoutModule),
  desktop: () => import('./layouts/desktop').then(entry => entry.layoutModule),
  wide: () => import('./layouts/wide').then(entry => entry.layoutModule),
  'living-room': () => import('./layouts/living-room').then(entry => entry.layoutModule),
};

/** The server and pre-hydration snapshot: shared baseline CSS only, no layout module. */
export const baselineDelivery: DeliverySnapshot = {
  status: 'baseline',
  requested: 'phone',
  active: null,
  loaded: [],
};

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class DeliveryController {
  private snapshot: DeliverySnapshot = baselineDelivery;
  private readonly listeners = new Set<() => void>();
  private readonly pending = new Map<LayoutProfile, Promise<LayoutModule>>();
  private readonly modules = new Map<LayoutProfile, LayoutModule>();
  private readonly loaders: LayoutLoaders;
  private epoch = 0;
  private disposed = false;

  constructor(loaders: LayoutLoaders = layoutLoaders) {
    this.loaders = loaders;
  }

  readonly getSnapshot = (): DeliverySnapshot => this.snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    if (this.disposed) return () => {};
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** The resolved module for a profile, if its import has finished. */
  module(profile: LayoutProfile | null): LayoutModule | undefined {
    return profile === null ? undefined : this.modules.get(profile);
  }

  /** Resolves true only when this request became active; a newer select() always wins. */
  select(profile: LayoutProfile): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);
    const epoch = ++this.epoch;
    if (this.modules.has(profile)) {
      this.publish('ready', profile, profile);
      return Promise.resolve(true);
    }
    // The current layout, or the baseline, stays in place while the next one loads.
    this.publish('loading', profile, this.snapshot.active);
    return this.load(profile).then(
      () => {
        if (this.disposed || epoch !== this.epoch) return false;
        this.publish('ready', profile, profile);
        return true;
      },
      (error: unknown) => {
        if (this.disposed || epoch !== this.epoch) return false;
        this.publish('error', profile, this.snapshot.active, describe(error));
        return false;
      },
    );
  }

  /** One manual attempt for the requested profile; nothing retries on its own. */
  retry(): Promise<boolean> {
    return this.select(this.snapshot.requested);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.epoch++;
    this.listeners.clear();
  }

  private load(profile: LayoutProfile): Promise<LayoutModule> {
    const existing = this.pending.get(profile);
    if (existing) return existing;
    const request = this.loaders[profile]()
      .then(entry => {
        if (entry.profile !== profile)
          throw new Error(`Layout module ${entry.profile} answered ${profile}`);
        if (!this.disposed) this.record(profile, entry);
        return entry;
      })
      .catch((error: unknown) => {
        // A failed import is evicted so retry() starts a fresh request.
        this.pending.delete(profile);
        throw error;
      });
    this.pending.set(profile, request);
    return request;
  }

  /** Loaded CSS stays in the document, so an older module is recorded even when it cannot become active. */
  private record(profile: LayoutProfile, entry: LayoutModule): void {
    this.modules.set(profile, entry);
    const { loaded } = this.snapshot;
    if (!loaded.includes(profile)) this.commit({ ...this.snapshot, loaded: [...loaded, profile] });
  }

  private publish(
    status: DeliveryStatus,
    requested: LayoutProfile,
    active: LayoutProfile | null,
    error?: string,
  ): void {
    const { loaded } = this.snapshot;
    this.commit(
      error === undefined
        ? { status, requested, active, loaded }
        : { status, requested, active, loaded, error },
    );
  }

  private commit(next: DeliverySnapshot): void {
    this.snapshot = next;
    for (const notify of [...this.listeners]) notify();
  }
}
