/**
 * Optional LG webOS input adapter for an explicit living-room product context.
 * It never detects webOS: callers opt in. State reports only what real events
 * showed. Wheel stays native, nothing auto-clicks, and no camera, dwell or
 * privileged platform call happens here; platformBack is caller-injected.
 * On a living-room surface arrows and Back are reported as remote-navigation
 * telemetry, not hardware proof; a hardware keyboard is indistinguishable and
 * is not inferred. While the window is blurred every event is ignored and the
 * snapshot is kept until focus returns.
 */
export type WebOSActiveInput = 'unknown' | 'pointer' | 'remote';

export type WebOSInputState = Readonly<{
  /** null until a real cursorStateChange event arrives. */
  cursorVisible: boolean | null;
  activeInput: WebOSActiveInput;
}>;

/** Each handler returns true only when it actually handled Back. */
export type WebOSBackHandlers = Readonly<{
  closeTopLayer?: () => boolean;
  navigateBack?: () => boolean;
  platformBack?: () => boolean;
}>;

export type WebOSInputOptions = Readonly<{
  surface: 'web' | 'living-room';
  /** Where key, pointer and cursorStateChange events are observed; defaults to the document. */
  target?: EventTarget;
  back?: WebOSBackHandlers;
  isBackKey?: (event: KeyboardEvent) => boolean;
}>;

const webOSBackKeyCode = 461;

export const isWebOSBackKey = (event: KeyboardEvent): boolean =>
  event.key === 'GoBack' || event.key === 'BrowserBack' || event.keyCode === webOSBackKeyCode;

const unknownState: WebOSInputState = Object.freeze({
  cursorVisible: null,
  activeInput: 'unknown',
});

export class WebOSInputAdapter {
  private readonly target: EventTarget;
  private readonly options: WebOSInputOptions;
  private readonly listeners = new Set<() => void>();
  private readonly view: Window | null;
  private state: WebOSInputState = unknownState;
  private suspended = false;
  private disposed = false;

  constructor(doc: Document, options: WebOSInputOptions) {
    this.target = options.target ?? doc;
    this.options = options;
    this.view = doc.defaultView;
    if (options.surface !== 'living-room') return;
    this.view?.addEventListener('blur', this.suspend);
    this.view?.addEventListener('focus', this.resume);
    this.target.addEventListener('keydown', this.onKeyDown);
    this.target.addEventListener('pointerdown', this.onPointer, { passive: true });
    this.target.addEventListener('pointermove', this.onPointer, { passive: true });
    this.target.addEventListener('cursorStateChange', this.onCursor);
  }

  readonly getSnapshot = (): WebOSInputState => this.state;
  readonly getServerSnapshot = (): WebOSInputState => unknownState;

  /** Window blur pauses observation; the snapshot and focus stay as they were. */
  readonly suspend = (): void => {
    this.suspended = true;
  };

  readonly resume = (): void => {
    this.suspended = false;
  };

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Idempotent; removes every listener. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('pointerdown', this.onPointer);
    this.target.removeEventListener('pointermove', this.onPointer);
    this.target.removeEventListener('cursorStateChange', this.onCursor);
    this.view?.removeEventListener('blur', this.suspend);
    this.view?.removeEventListener('focus', this.resume);
    this.listeners.clear();
  }

  private update(change: Partial<WebOSInputState>): void {
    const next = { ...this.state, ...change };
    if (
      next.cursorVisible === this.state.cursorVisible &&
      next.activeInput === this.state.activeInput
    )
      return;
    this.state = Object.freeze(next);
    for (const notify of this.listeners) notify();
  }

  private readonly onKeyDown = (event: Event): void => {
    const key = event as KeyboardEvent;
    if (this.disposed || this.suspended || key.defaultPrevented || key.isComposing) return;
    // Modified keys are shortcuts or selections, neither remote navigation nor Back.
    if (key.altKey || key.ctrlKey || key.metaKey || key.shiftKey) return;
    if (key.key?.startsWith('Arrow')) {
      this.update({ activeInput: 'remote' });
      return;
    }
    if (!(this.options.isBackKey ?? isWebOSBackKey)(key)) return;
    this.update({ activeInput: 'remote' });
    const back = this.options.back;
    if (key.repeat || !back) return;
    // Only a handler that reports success consumes Back; otherwise the platform keeps it.
    if ([back.closeTopLayer, back.navigateBack, back.platformBack].some(run => run?.() === true))
      key.preventDefault();
  };

  private readonly onPointer = (event: Event): void => {
    if (this.suspended) return;
    if ((event as PointerEvent).pointerType === 'mouse') this.update({ activeInput: 'pointer' });
  };

  private readonly onCursor = (event: Event): void => {
    if (this.suspended) return;
    const detail = (event as CustomEvent<{ visibility?: unknown } | null>).detail;
    if (typeof detail?.visibility !== 'boolean') return;
    this.update(
      detail.visibility
        ? { cursorVisible: true, activeInput: 'pointer' }
        : { cursorVisible: false },
    );
  };
}
