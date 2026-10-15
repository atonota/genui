type FeedbackScope = Document | HTMLElement;
type FeedbackController = {
  add: (scope: FeedbackScope) => () => void;
  replay: (event: Event) => void;
};
const controllers = new WeakMap<Document, FeedbackController>();
const clickable = [
  'button',
  'a[href]',
  'summary',
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="range"]',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
  '[role="button"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="radio"]',
  '[role="checkbox"]',
  '[role="option"]',
  '[role="slider"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="treeitem"]',
  '.ant-select',
  '.ant-select-item-option',
  '.ant-picker',
  '.ant-picker-cell',
  '.ant-picker-time-panel-cell',
  '[data-atlas-click-feedback="true"]',
].join(',');
const sliderSelector = '[role="slider"],input[type="range"]';
const blockedSelector = [
  '[disabled]',
  '[aria-disabled="true"]',
  '[aria-busy="true"]',
  '[aria-readonly="true"]',
  '[data-state-kind="busy"]',
  '[data-atlas-click-feedback="false"]',
  'fieldset[disabled]',
  '.ant-btn-loading',
  '.ant-radio-wrapper-disabled',
  '.ant-radio-button-wrapper-disabled',
  '.ant-checkbox-wrapper-disabled',
  '.ant-switch-disabled',
  '.ant-slider-disabled',
  '.ant-select-disabled',
  '.ant-picker-disabled',
  '.ant-picker-cell-disabled',
  '.ant-picker-time-panel-cell-disabled',
].join(',');
const readonlyFieldSelector = 'input[readonly]:not([role="combobox"]),textarea[readonly]';
// Native AntD pickers render their still-operable trigger display as a
// readonly input; only that display is exempt, not readonly inputs anywhere.
const pickerDisplaySelector = '.ant-picker .ant-picker-input > input';
const readonlyField = (field: Element) =>
  field.matches(readonlyFieldSelector) && !field.matches(pickerDisplaySelector);

/** One disposable delegated presentation controller; it never changes control state. */
export function installInteractionFeedback(
  scope?: FeedbackScope,
  initialEvent?: Event | Event[],
): () => void {
  const owner = scope ?? (typeof document === 'undefined' ? null : document);
  if (!owner) return () => {};
  const doc = owner.nodeType === 9 ? (owner as Document) : owner.ownerDocument;
  if (!doc?.defaultView) return () => {};
  let controller = controllers.get(doc);
  if (!controller) {
    controller = createController(doc);
    controllers.set(doc, controller);
  }
  const dispose = controller.add(owner);
  for (const event of Array.isArray(initialEvent)
    ? initialEvent
    : initialEvent
      ? [initialEvent]
      : [])
    controller.replay(event);
  return dispose;
}

function createController(doc: Document): FeedbackController {
  const view = doc.defaultView!;
  const scopes = new Map<FeedbackScope, number>();
  const active = new Map<HTMLElement, { target: HTMLElement; dispose: () => void }>();
  const pending = new Map<HTMLElement, number>();
  const sliderPointers = new Map<number, { owner: HTMLElement | null; target: HTMLElement }>();
  const sliderReleases = new WeakMap<HTMLElement, number>();
  const reduced = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  const element = (target: EventTarget | null): Element | null =>
    target instanceof view.Element ? target : null;
  const allowed = (target: HTMLElement) => [...scopes.keys()].some(scope => scope.contains(target));
  const blocked = (target: HTMLElement) =>
    Boolean(
      target.closest(blockedSelector) ||
        target.closest('[data-atlas-choice-card]')?.querySelector(':disabled') ||
        readonlyField(target) ||
        [...target.querySelectorAll(readonlyFieldSelector)].some(readonlyField),
    );
  const resolveTarget = (event: Event) => {
    let source = element(event.target);
    if (!source) return null;
    const label = source.closest('label');
    // A choice card's native label activation dispatches one click to its own
    // control; skip the card's outer click so the whole-card wave starts once.
    if (label?.matches('[data-atlas-choice-card]') && !label.contains(source.closest(clickable)))
      return null;
    if (label) {
      const id = label.getAttribute('for');
      const input = id ? doc.getElementById(id) : label.querySelector('input');
      if (input?.matches('input[type="checkbox"],input[type="radio"]')) source = input;
    }
    let target = source.closest<HTMLElement>(clickable);
    const slider = source.closest<HTMLElement>('.ant-slider');
    if (slider && !source.closest(sliderSelector)) {
      const handles = [...slider.querySelectorAll<HTMLElement>(sliderSelector)].filter(
        handle => !blocked(handle),
      );
      const mark = source.closest<HTMLElement>('.ant-slider-mark-text');
      const rect = (mark ?? source).getBoundingClientRect();
      const vertical = handles[0]?.getAttribute('aria-orientation') === 'vertical';
      const pointer = event as MouseEvent;
      const coordinate = mark
        ? vertical
          ? rect.top + rect.height / 2
          : rect.left + rect.width / 2
        : vertical
          ? pointer.clientY
          : pointer.clientX;
      target =
        handles.sort((left, right) => {
          const distance = (handle: HTMLElement) => {
            const bounds = handle.getBoundingClientRect();
            return Math.abs(
              coordinate -
                (vertical ? bounds.top + bounds.height / 2 : bounds.left + bounds.width / 2),
            );
          };
          return distance(left) - distance(right);
        })[0] ?? null;
    }
    return target && allowed(target) && !blocked(target) ? target : null;
  };
  const clear = () => {
    for (const frame of pending.values()) view.cancelAnimationFrame(frame);
    pending.clear();
    for (const entry of active.values()) entry.dispose();
    sliderPointers.clear();
  };
  const mutation = new view.MutationObserver(() => {
    for (const entry of active.values()) if (!entry.target.isConnected) entry.dispose();
  });

  function show(target: HTMLElement) {
    if (reduced?.matches || !target.isConnected || !allowed(target) || blocked(target)) return;
    // Whole choice cards and Radio.Button wrappers paint the control; their
    // native input is transparent and would give the wave the wrong geometry.
    const card = target.closest<HTMLElement>('[data-atlas-choice-card]');
    const visual =
      card ??
      target.closest<HTMLElement>('.ant-segmented-item') ??
      target.closest<HTMLElement>('.ant-radio-button-wrapper') ??
      target.closest<HTMLElement>('.ant-checkbox,.ant-radio') ??
      target.querySelector<HTMLElement>('.ant-picker-cell-inner') ??
      target;
    const rect = visual.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const style = view.getComputedStyle(visual);
    const durationToken = view
      .getComputedStyle(doc.documentElement)
      .getPropertyValue('--motion-duration-click-feedback')
      .trim();
    // Production CSS can minify 400ms to .4s; both are the same positive time.
    const durationMatch = /^(\d+(?:\.\d+)?|\.\d+)(ms|s)$/i.exec(durationToken);
    if (!durationMatch) return;
    const duration =
      Number(durationMatch[1]) * (durationMatch[2]!.toLowerCase() === 's' ? 1000 : 1);
    if (!Number.isFinite(duration) || duration <= 0) return;
    // Range crossings can move native focus between handle DOM indices. Their
    // Slider owns one transient; the actual target still owns geometry/cleanup.
    const feedbackOwner =
      card ??
      (target.matches(sliderSelector)
        ? (target.closest<HTMLElement>('.ant-slider') ?? target)
        : target);
    active.get(feedbackOwner)?.dispose();
    const wave = doc.createElement('span');
    wave.className = 'atlas-click-feedback atlas-motion-layer';
    wave.setAttribute('aria-hidden', 'true');
    wave.dataset.atlasFeedback = 'click';
    const position = (bounds: DOMRect) => {
      wave.style.left = `${bounds.left}px`;
      wave.style.top = `${bounds.top}px`;
      wave.style.width = `${bounds.width}px`;
      wave.style.height = `${bounds.height}px`;
    };
    position(rect);
    wave.style.borderRadius = style.borderRadius;
    const token = (name: string) => style.getPropertyValue(name).trim();
    const seed = token('--ant-color-primary') || token('--primary');
    const button = target.matches('.atlas-button,.ant-btn-primary');
    // Both Atlas and native primary Buttons paint their face on ::before; the
    // root background is only the lower edge. Read the current hover/press paint,
    // not the unchanged --button-face seed. Transparent actions use their ink.
    const face = button ? view.getComputedStyle(visual, '::before') : null;
    const paintedFace = face && face.content !== 'none' && face.content !== 'normal';
    // Choice cards and Radio.Button wrappers may be transparent or gray at rest;
    // their wave uses the brand seed first, then the painted checked edge.
    const choice = card !== null || visual.matches('.ant-radio-button-wrapper');
    const colors = choice
      ? [seed, style.borderTopColor, style.color]
      : button
        ? [
            paintedFace ? face.backgroundColor : style.backgroundColor,
            style.color,
            token('--button-face'),
            seed,
          ]
        : target.matches(
              'input[type="radio"],input[type="checkbox"],input[type="range"],[role="radio"],[role="checkbox"],[role="switch"],[role="slider"],.ant-switch',
            )
          ? [style.backgroundColor, seed, style.color]
          : [style.backgroundColor, style.color];
    const visibleColor = colors.find(
      color =>
        color &&
        !/^(?:transparent|canvastext|buttontext|white|var\(|#(?:fff|ffffff)$|rgba?\(255,\s*255,\s*255(?:,\s*1)?\)$|rgba\([^)]*,\s*0\)$)/i.test(
          color,
        ),
    );
    if (visibleColor) wave.style.setProperty('--click-feedback-color', visibleColor);
    let disposed = false;
    let deadline: number;
    let followFrame: number | undefined;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      view.clearTimeout(deadline);
      if (followFrame !== undefined) view.cancelAnimationFrame(followFrame);
      wave.removeEventListener('animationend', finish);
      wave.removeEventListener('animationcancel', finish);
      wave.remove();
      if (active.get(feedbackOwner)?.dispose === dispose) active.delete(feedbackOwner);
      if (active.size === 0) mutation.disconnect();
    };
    const finish = (event: Event) => {
      if (event.target === wave) dispose();
    };
    wave.addEventListener('animationend', finish);
    wave.addEventListener('animationcancel', finish);
    active.set(feedbackOwner, { target, dispose });
    doc.body.append(wave);
    mutation.observe(doc.body, { childList: true, subtree: true });
    // Cleanup only: missing animation events must never retain a decorative node.
    deadline = view.setTimeout(dispose, duration * 2);
    if (target.matches(sliderSelector)) {
      // Native value/focus commit before the handle's positive position transition
      // finishes. Keep its transient attached to the actual painted geometry.
      const follow = () => {
        followFrame = undefined;
        if (disposed) return;
        if (!target.isConnected || !allowed(target) || blocked(target)) return dispose();
        const bounds = visual.getBoundingClientRect();
        if (bounds.width <= 0 || bounds.height <= 0) return dispose();
        position(bounds);
        followFrame = view.requestAnimationFrame(follow);
      };
      followFrame = view.requestAnimationFrame(follow);
    }
  }

  const afterCommit = (owner: HTMLElement, resolve: () => HTMLElement | null) => {
    const previous = pending.get(owner);
    if (previous !== undefined) view.cancelAnimationFrame(previous);
    pending.set(
      owner,
      view.requestAnimationFrame(() => {
        pending.delete(owner);
        const target = resolve();
        if (target) show(target);
      }),
    );
  };
  const committedSliderTarget = (owner: HTMLElement | null, fallback: HTMLElement) => {
    const focused = doc.activeElement;
    // The native range owns tie-breaking, crossing and focus after sorted values
    // commit. The moved value can now belong to a different handle DOM index.
    return owner &&
      focused instanceof view.HTMLElement &&
      focused.matches(sliderSelector) &&
      owner.contains(focused)
      ? focused
      : fallback;
  };

  const events = ['click', 'pointerdown', 'pointerup', 'pointercancel', 'keydown', 'scroll'];
  const onEvent = (event: Event) => {
    if (event.type === 'scroll') {
      clear();
      return;
    }
    const pointer = event as PointerEvent;
    if (event.type === 'pointercancel') {
      sliderPointers.delete(pointer.pointerId);
      return;
    }
    if (event.type === 'pointerup') {
      const interaction = sliderPointers.get(pointer.pointerId);
      sliderPointers.delete(pointer.pointerId);
      if (interaction) {
        const target = committedSliderTarget(interaction.owner, interaction.target);
        sliderReleases.set(interaction.owner ?? target, event.timeStamp);
        show(target);
      }
      return;
    }
    const target = resolveTarget(event);
    if (!target) return;
    const slider = target.matches(sliderSelector);
    if (event.type === 'click') {
      const mark = element(event.target)?.closest<HTMLElement>('.ant-slider-mark-text');
      const owner = mark?.closest<HTMLElement>('.ant-slider');
      if (owner) {
        // Native marks commit their value on click. Measure the moved handle
        // after that commit; only decoration waits for the next paint.
        afterCommit(owner, () => resolveTarget(event));
        return;
      }
      const release = sliderReleases.get(target.closest<HTMLElement>('.ant-slider') ?? target);
      if (!slider || release === undefined || event.timeStamp - release >= 100) show(target);
    } else if (
      event.type === 'pointerdown' &&
      slider &&
      !element(event.target)?.closest('.ant-slider-mark-text')
    ) {
      const owner = target.closest<HTMLElement>('.ant-slider');
      sliderReleases.delete(owner ?? target);
      sliderPointers.set(pointer.pointerId, { owner, target });
    } else if (event.type === 'keydown' && slider) {
      const key = event as KeyboardEvent;
      if (
        !key.repeat &&
        /^(?:Arrow(?:Left|Right|Up|Down)|Home|End|PageUp|PageDown)$/.test(key.key)
      ) {
        // This delegated capture handler precedes native key handling. Values
        // and focus commit immediately; only the final-position decoration waits.
        const owner = target.closest<HTMLElement>('.ant-slider');
        afterCommit(owner ?? target, () => committedSliderTarget(owner, target));
      }
    }
  };
  const onPreferenceChange = () => {
    if (reduced?.matches) clear();
  };
  for (const event of events) doc.addEventListener(event, onEvent, true);
  view.addEventListener('resize', clear);
  reduced?.addEventListener('change', onPreferenceChange);
  return {
    replay: onEvent,
    add(scope) {
      scopes.set(scope, (scopes.get(scope) ?? 0) + 1);
      let removed = false;
      return () => {
        if (removed) return;
        removed = true;
        const remaining = (scopes.get(scope) ?? 1) - 1;
        if (remaining > 0) scopes.set(scope, remaining);
        else scopes.delete(scope);
        for (const entry of active.values()) if (!allowed(entry.target)) entry.dispose();
        if (scopes.size) return;
        clear();
        sliderPointers.clear();
        mutation.disconnect();
        for (const event of events) doc.removeEventListener(event, onEvent, true);
        view.removeEventListener('resize', clear);
        reduced?.removeEventListener('change', onPreferenceChange);
        controllers.delete(doc);
      };
    },
  };
}
