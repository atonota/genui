export type InputModality = 'keyboard' | 'pointer';
type ModalityOwner = { listeners: Set<() => void>; holds: number; dispose: () => void };
const owners = new WeakMap<Document, ModalityOwner>();

/**
 * Visible focus mode starts off (pointer). Plain Tab/Shift+Tab turns it on everywhere; inside
 * an explicit living-room surface a handled directional key may also turn it on (human TV
 * decision 2026-10-16). Width never implies TV.
 */
export const getInputModalitySnapshot = (): InputModality =>
  typeof document !== 'undefined' && document.documentElement.dataset.inputModality === 'keyboard'
    ? 'keyboard'
    : 'pointer';

export const getServerInputModalitySnapshot = (): InputModality => 'pointer';

/** Internal visual signal between linked documents; its detail is the next modality. */
export const inputModalityBridgeEvent = 'atlas-input-modality-bridge';

/** Plain Tab and Shift+Tab are the only keys the document listener reads to turn focus on. */
export const isModalityTabKey = (event: KeyboardEvent): boolean =>
  event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey;

function acquire(doc: Document): ModalityOwner {
  const existing = owners.get(doc);
  if (existing) return existing;
  const root = doc.documentElement;
  const listeners = new Set<() => void>();
  const update = (modality: InputModality) => {
    if (root.dataset.inputModality === modality) return;
    root.dataset.inputModality = modality;
    for (const notify of listeners) notify();
  };
  // Arrows, Escape, Enter, Space and typing never turn the mode on here, and never turn it off;
  // the TV exception arrives only through requestSpatialInputModality and the bridge event.
  const onKeyDown = (event: KeyboardEvent) => {
    if (isModalityTabKey(event)) update('keyboard');
  };
  // Pointer input only turns the visual mode off: no preventDefault, blur or caret change.
  const onPointer = () => update('pointer');
  // A linked document relays its real Tab or pointer input; this owner stays the only writer.
  const onBridge = (event: Event) => {
    const modality = (event as CustomEvent<unknown>).detail;
    if (modality === 'keyboard' || modality === 'pointer') update(modality);
  };
  const passive: AddEventListenerOptions = { capture: true, passive: true };
  if (root.dataset.inputModality !== 'keyboard') root.dataset.inputModality = 'pointer';
  doc.addEventListener('keydown', onKeyDown, true);
  doc.addEventListener('pointerdown', onPointer, passive);
  doc.addEventListener('touchstart', onPointer, passive);
  doc.addEventListener(inputModalityBridgeEvent, onBridge);
  const owner: ModalityOwner = {
    listeners,
    holds: 0,
    dispose: () => {
      doc.removeEventListener('keydown', onKeyDown, true);
      doc.removeEventListener('pointerdown', onPointer, passive);
      doc.removeEventListener('touchstart', onPointer, passive);
      doc.removeEventListener(inputModalityBridgeEvent, onBridge);
    },
  };
  owners.set(doc, owner);
  return owner;
}

function release(doc: Document, owner: ModalityOwner): void {
  if (owner.holds > 0 || owner.listeners.size > 0) return;
  owner.dispose();
  if (owners.get(doc) === owner) owners.delete(doc);
}

/** Host-declared TV boundary; layout width alone never produces it. */
export const spatialSurfaceSelector = '[data-adaptive-surface="living-room"]';

const declaredSurfaceSelector = '[data-adaptive-surface]';
const controllerSelector = '[data-adaptive-shell]';
/** Provider owner and its body-level portal root (AtlasProvider marks both). */
const providerOwnerSelector = '[data-atlas-provider-owner]';
/** Portal owners: a provider owner, or a Shell controller that owns its own body portal. */
const portalOwnerSelector = `${providerOwnerSelector}, ${controllerSelector}`;
const portalSelector = '[data-atlas-portal]';
/** Private portal -> actual owner map; only a live registration links them, never an id. */
const portalOwners = new WeakMap<Element, Element>();
/** Live registrations per document and their registry listeners; neither writes the modality. */
const registeredPortals = new WeakMap<Document, Set<HTMLElement>>();
const portalListeners = new WeakMap<Document, Set<() => void>>();

function notifyPortals(doc: Document): void {
  for (const notify of [...(portalListeners.get(doc) ?? [])]) notify();
}

/**
 * A provider owner or a Shell controller registers the body portal its native popups render
 * into, so a handled key on a focused popup target counts for that owner only. Same document,
 * connected, marked refs;
 * the returned release is idempotent and drops only this mapping.
 */
export function registerSpatialPortal(owner: HTMLElement, portal: HTMLElement): () => void {
  const doc = owner.ownerDocument;
  const view = doc?.defaultView;
  if (
    !view ||
    owner === portal ||
    portal.ownerDocument !== doc ||
    !(owner instanceof view.HTMLElement) ||
    !(portal instanceof view.HTMLElement) ||
    !owner.isConnected ||
    !portal.isConnected ||
    !owner.matches(portalOwnerSelector) ||
    !portal.matches(portalSelector)
  )
    return () => {};
  portalOwners.set(portal, owner);
  const portals = registeredPortals.get(doc) ?? new Set<HTMLElement>();
  registeredPortals.set(doc, portals);
  portals.add(portal);
  notifyPortals(doc);
  let registered = true;
  return () => {
    if (!registered) return;
    registered = false;
    if (portalOwners.get(portal) !== owner) return;
    portalOwners.delete(portal);
    portals.delete(portal);
    notifyPortals(doc);
  };
}

/** Outside focus counts only inside a TV portal registered by the boundary's nearest owner. */
function isOwnedPortalFocus(boundary: HTMLElement, focused: Element): boolean {
  const portal = focused.closest(portalSelector);
  const owner = boundary.closest(portalOwnerSelector);
  if (!portal?.isConnected || !owner?.isConnected) return false;
  if (portal.getAttribute('data-adaptive-surface') !== 'living-room') return false;
  // A Shell inside the portal owns its own keys, exactly as a nested inline Shell does.
  const controller = focused.closest(controllerSelector);
  if (controller && portal.contains(controller)) return false;
  return portalOwners.get(portal) === owner;
}

/** The nearest declared surface decides, so a nested web surface overrides a TV ancestor. */
function isNearestSurfaceSpatial(element: Element): boolean {
  const declared = element.closest(declaredSurfaceSelector);
  return declared?.getAttribute('data-adaptive-surface') === 'living-room';
}

/** The owner sits in the boundary's own controller: no nested Shell or non-TV surface between. */
function isOwnerInBoundary(owner: Element, boundary: Element): boolean {
  if (!boundary.contains(owner)) return false;
  for (let node: Element | null = owner; node && node !== boundary; node = node.parentElement) {
    if (node.matches(controllerSelector)) return false;
    const surface = node.getAttribute('data-adaptive-surface');
    if (surface !== null && surface !== 'living-room') return false;
  }
  return true;
}

/**
 * Connected TV portal roots a live registration links to the boundary's nearest owner (a Shell
 * boundary is its own) or to a provider owner inside its own controller, so a TV layout reaches
 * native popups outside it while a nested Shell's portal stays with that Shell.
 */
export function getSpatialPortalsFor(boundary: HTMLElement): HTMLElement[] {
  if (!boundary.isConnected || !isNearestSurfaceSpatial(boundary)) return [];
  const nearest = boundary.closest(portalOwnerSelector);
  return [...(registeredPortals.get(boundary.ownerDocument) ?? [])].filter(portal => {
    const owner = portalOwners.get(portal);
    return (
      owner !== undefined &&
      owner.isConnected &&
      portal.isConnected &&
      portal.getAttribute('data-adaptive-surface') === 'living-room' &&
      (owner === nearest || isOwnerInBoundary(owner, boundary))
    );
  });
}

/** Register and release notifications only: no modality writer, storage or key listener. */
export function subscribeSpatialPortals(doc: Document, listener: () => void): () => void {
  const listeners = portalListeners.get(doc) ?? new Set<() => void>();
  portalListeners.set(doc, listeners);
  listeners.add(listener);
  let subscribed = true;
  return () => {
    if (!subscribed) return;
    subscribed = false;
    listeners.delete(listener);
    if (listeners.size === 0) portalListeners.delete(doc);
  };
}

/**
 * Human TV decision 2026-10-16: a caller that actually handled a directional key inside an
 * explicit living-room surface opens the same ringless visual focus mode. It relays the
 * existing bridge event to the document owner, so there is no second writer, no storage and
 * no global arrow listener; disconnected boundaries, a nearer declared non-TV surface and
 * focus inside a nested web surface or another Shell controller are ignored.
 */
export function requestSpatialInputModality(boundary: HTMLElement): void {
  if (!boundary.isConnected) return;
  const doc = boundary.ownerDocument;
  const view = doc?.defaultView;
  if (!view || !isNearestSurfaceSpatial(boundary)) return;
  // The handled move left focus on its target. Inline it must belong to this boundary's own
  // controller; outside it only a body portal registered by this boundary's own owner counts.
  const focused = doc.activeElement;
  if (!focused || !isNearestSurfaceSpatial(focused)) return;
  if (boundary.contains(focused)) {
    if (focused.closest(controllerSelector) !== boundary.closest(controllerSelector)) return;
  } else if (!isOwnedPortalFocus(boundary, focused)) return;
  // The document's own realm builds the event, so an injected document accepts it.
  doc.dispatchEvent(new view.CustomEvent(inputModalityBridgeEvent, { detail: 'keyboard' }));
}

/** Layouts hold the one document owner for the page; returns an idempotent release. */
export function installInputModality(doc?: Document): () => void {
  const target = doc ?? (typeof document === 'undefined' ? undefined : document);
  if (!target) return () => {};
  const owner = acquire(target);
  owner.holds++;
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    owner.holds--;
    release(target, owner);
  };
}

/** Providers share the document owner; a layout hold keeps it alive while islands unsubscribe. */
export function subscribeInputModality(listener: () => void): () => void {
  if (typeof document === 'undefined') return () => {};
  const doc = document;
  const owner = acquire(doc);
  owner.listeners.add(listener);
  let subscribed = true;
  return () => {
    if (!subscribed) return;
    subscribed = false;
    owner.listeners.delete(listener);
    release(doc, owner);
  };
}
