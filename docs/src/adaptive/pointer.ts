/**
 * Opt-in pointer gesture adapter for a caller that owns a drag-like gesture.
 * Native click, focus and activation stay with the platform: nothing here
 * synthesizes a click or prevents default, and callers keep a non-drag path.
 * While a gesture is active its release is also observed on the owning document
 * and a window blur cancels it, so a release outside the element never strands it.
 */
export type PointerGesturePhase = 'start' | 'move' | 'end' | 'cancel';

export type PointerGestureEvent = Readonly<{
  phase: PointerGesturePhase;
  pointerId: number;
  pointerType: string;
  dx: number;
  dy: number;
  /** True once movement reached the caller threshold. */
  active: boolean;
  source: PointerEvent;
}>;

export type PointerGestureOptions = Readonly<{
  onGesture: (event: PointerGestureEvent) => void;
  /** CSS px of movement before move events are reported (default 0). */
  threshold?: number;
  /** Decides which pointerdown starts a gesture (default primary button). */
  accept?: (event: PointerEvent) => boolean;
  /** Capture keeps moves after leaving the element; always released on end. */
  capture?: boolean;
}>;

type Tracked = {
  id: number;
  type: string;
  x: number;
  y: number;
  active: boolean;
  /** Last matched event; the source of a blur cancel. */
  last: PointerEvent;
};

type Watched = Readonly<{ doc: Document; view: Window | null }>;

const primaryButton = (event: PointerEvent) => event.isPrimary && event.button === 0;

export class PointerGesture {
  private readonly element: Element;
  private readonly options: PointerGestureOptions;
  private readonly threshold: number;
  private tracked: Tracked | null = null;
  private watched: Watched | null = null;
  private disposed = false;

  constructor(element: Element, options: PointerGestureOptions) {
    this.element = element;
    this.options = options;
    this.threshold = Math.max(0, options.threshold ?? 0);
    element.addEventListener('pointerdown', this.onDown);
    element.addEventListener('pointermove', this.onMove);
    element.addEventListener('pointerup', this.onEnd);
    element.addEventListener('pointercancel', this.onCancel);
    element.addEventListener('lostpointercapture', this.onCancel);
  }

  get gesturing(): boolean {
    return this.tracked !== null;
  }

  /** Idempotent; releases a held capture without reporting a phase. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.release();
    this.element.removeEventListener('pointerdown', this.onDown);
    this.element.removeEventListener('pointermove', this.onMove);
    this.element.removeEventListener('pointerup', this.onEnd);
    this.element.removeEventListener('pointercancel', this.onCancel);
    this.element.removeEventListener('lostpointercapture', this.onCancel);
  }

  // Cleared before release so the resulting lostpointercapture is ignored.
  private release(): void {
    const tracked = this.tracked;
    this.tracked = null;
    this.unwatch();
    if (tracked && this.element.hasPointerCapture?.(tracked.id))
      this.element.releasePointerCapture(tracked.id);
  }

  // Without capture, or when capture failed, a release outside the element only
  // reaches the document; the capture phase sees it even if propagation stopped.
  // The element listeners then find nothing tracked, so nothing is reported twice.
  private watch(): void {
    const doc = this.element.ownerDocument;
    const view = doc.defaultView;
    doc.addEventListener('pointerup', this.onEnd, true);
    doc.addEventListener('pointercancel', this.onCancel, true);
    view?.addEventListener('blur', this.onBlur);
    this.watched = { doc, view };
  }

  private unwatch(): void {
    const watched = this.watched;
    if (!watched) return;
    this.watched = null;
    watched.doc.removeEventListener('pointerup', this.onEnd, true);
    watched.doc.removeEventListener('pointercancel', this.onCancel, true);
    watched.view?.removeEventListener('blur', this.onBlur);
  }

  private emit(phase: PointerGesturePhase, source: PointerEvent, tracked: Tracked): void {
    this.options.onGesture({
      phase,
      pointerId: tracked.id,
      pointerType: tracked.type,
      dx: source.clientX - tracked.x,
      dy: source.clientY - tracked.y,
      active: tracked.active,
      source,
    });
  }

  private finish(source: PointerEvent, phase: 'end' | 'cancel'): void {
    const tracked = this.tracked;
    if (!tracked || source.pointerId !== tracked.id) return;
    this.release();
    this.emit(phase, source, tracked);
  }

  private readonly onDown = (event: Event): void => {
    const pointer = event as PointerEvent;
    if (this.disposed || this.tracked || !(this.options.accept ?? primaryButton)(pointer)) return;
    const tracked: Tracked = {
      id: pointer.pointerId,
      type: pointer.pointerType,
      x: pointer.clientX,
      y: pointer.clientY,
      active: this.threshold === 0,
      last: pointer,
    };
    this.tracked = tracked;
    this.watch();
    if (this.options.capture) {
      try {
        this.element.setPointerCapture(pointer.pointerId);
      } catch {
        // The pointer is no longer active; the gesture still ends via up or cancel.
      }
    }
    this.emit('start', pointer, tracked);
  };

  private readonly onMove = (event: Event): void => {
    const pointer = event as PointerEvent;
    const tracked = this.tracked;
    if (!tracked || pointer.pointerId !== tracked.id) return;
    tracked.last = pointer;
    if (
      !tracked.active &&
      Math.hypot(pointer.clientX - tracked.x, pointer.clientY - tracked.y) >= this.threshold
    )
      tracked.active = true;
    if (tracked.active) this.emit('move', pointer, tracked);
  };

  private readonly onEnd = (event: Event): void => this.finish(event as PointerEvent, 'end');
  private readonly onCancel = (event: Event): void => this.finish(event as PointerEvent, 'cancel');

  // A blurred window may never deliver the release; cancel at the last known position.
  private readonly onBlur = (): void => {
    const tracked = this.tracked;
    if (!tracked) return;
    this.release();
    this.emit('cancel', tracked.last, tracked);
  };
}
