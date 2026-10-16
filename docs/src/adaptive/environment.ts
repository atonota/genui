import { serverEnvironment, type ActiveInput, type AdaptiveEnvironment } from './policy';

/** Independent capability queries; any-pointer keeps hybrid devices additive. */
export const environmentQueries = {
  coarse: '(any-pointer: coarse)',
  fine: '(any-pointer: fine)',
  hover: '(hover: hover)',
  anyHover: '(any-hover: hover)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
  forcedColors: '(forced-colors: active)',
} as const;

export type ConnectionLike = EventTarget & { readonly saveData?: boolean };

export const connectionOf = (view: Window): ConnectionLike | undefined =>
  (view.navigator as (Navigator & { readonly connection?: ConnectionLike }) | undefined)
    ?.connection;

export const sameEnvironment = (a: AdaptiveEnvironment, b: AdaptiveEnvironment): boolean =>
  (Object.keys(a) as (keyof AdaptiveEnvironment)[]).every(key => Object.is(a[key], b[key]));

/** Live signals for one window; listeners attach for the first subscriber, detach after the last. */
export class EnvironmentStore {
  private readonly view: Window | undefined;
  private readonly initial: AdaptiveEnvironment;
  private readonly listeners = new Set<() => void>();
  private snapshot: AdaptiveEnvironment;
  private activeInput: ActiveInput;
  private detach: (() => void) | null = null;

  constructor(view?: Window, initial: AdaptiveEnvironment = serverEnvironment) {
    this.view = view;
    this.initial = Object.isFrozen(initial) ? initial : Object.freeze({ ...initial });
    this.snapshot = this.initial;
    this.activeInput = this.initial.activeInput;
  }

  /** Same object while signals are unchanged; reads live values only while unsubscribed. */
  readonly getSnapshot = (): AdaptiveEnvironment => {
    if (!this.detach) this.refresh();
    return this.snapshot;
  };

  /** The static or request-time snapshot; it never changes, so hydration stays truthful. */
  readonly getServerSnapshot = (): AdaptiveEnvironment => this.initial;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (!this.detach && this.view) {
      this.detach = this.attach(this.view);
      this.refresh();
    }
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      this.listeners.delete(listener);
      if (this.listeners.size > 0 || !this.detach) return;
      this.detach();
      this.detach = null;
    };
  };

  private readonly update = (): void => {
    if (this.refresh()) for (const notify of [...this.listeners]) notify();
  };

  private setInput(input: ActiveInput): void {
    if (this.activeInput === input) return;
    this.activeInput = input;
    this.update();
  }

  private refresh(): boolean {
    if (!this.view) return false;
    const next = this.read(this.view);
    if (sameEnvironment(next, this.snapshot)) return false;
    this.snapshot = Object.freeze(next);
    return true;
  }

  private read(view: Window): AdaptiveEnvironment {
    const media = (query: string): boolean =>
      typeof view.matchMedia === 'function' && view.matchMedia(query).matches;
    const viewport = view.visualViewport;
    const saveData = connectionOf(view)?.saveData;
    return {
      width: view.innerWidth,
      height: view.innerHeight,
      visualWidth: viewport?.width ?? view.innerWidth,
      visualHeight: viewport?.height ?? view.innerHeight,
      coarse: media(environmentQueries.coarse),
      fine: media(environmentQueries.fine),
      hover: media(environmentQueries.hover),
      anyHover: media(environmentQueries.anyHover),
      reducedMotion: media(environmentQueries.reducedMotion),
      forcedColors: media(environmentQueries.forcedColors),
      saveData: typeof saveData === 'boolean' ? saveData : null,
      activeInput: this.activeInput,
    };
  }

  private attach(view: Window): () => void {
    const cleanups: (() => void)[] = [];
    const listen = (
      target: EventTarget | null | undefined,
      type: string,
      handler: (event: Event) => void,
      options?: AddEventListenerOptions,
    ) => {
      if (!target || typeof target.addEventListener !== 'function') return;
      const node: EventTarget = target;
      node.addEventListener(type, handler, options);
      cleanups.push(() => node.removeEventListener(type, handler, options));
    };
    const update = this.update;
    if (typeof view.matchMedia === 'function')
      for (const query of Object.values(environmentQueries))
        listen(view.matchMedia(query), 'change', update);
    listen(view, 'resize', update);
    listen(view.visualViewport, 'resize', update);
    listen(view.visualViewport, 'scroll', update);
    listen(connectionOf(view), 'change', update);
    // Active input is the last real event, never a claim that a keyboard or pointer exists.
    // Visual focus mode stays owned by input-modality.ts; this store never writes it.
    const observe: AddEventListenerOptions = { capture: true, passive: true };
    listen(
      view,
      'pointerdown',
      event => {
        const type = (event as PointerEvent).pointerType;
        if (type === 'mouse' || type === 'pen' || type === 'touch') this.setInput(type);
      },
      observe,
    );
    listen(view, 'keydown', () => this.setInput('keyboard'), observe);
    return () => {
      for (const cleanup of cleanups.splice(0)) cleanup();
    };
  }
}

const stores = new WeakMap<Window, EnvironmentStore>();
let serverStore: EnvironmentStore | undefined;

/** One store per window (injectable); a view-less shared store serves SSR. */
export function getEnvironmentStore(view?: Window): EnvironmentStore {
  const target = view ?? (typeof window === 'undefined' ? undefined : window);
  if (!target) return (serverStore ??= new EnvironmentStore());
  let store = stores.get(target);
  if (!store) stores.set(target, (store = new EnvironmentStore(target)));
  return store;
}
