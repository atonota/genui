export type InputModality = 'keyboard' | 'pointer';
type ModalityOwner = { listeners: Set<() => void>; holds: number; dispose: () => void };
const owners = new WeakMap<Document, ModalityOwner>();

/** Visible focus mode starts off (pointer); only plain Tab/Shift+Tab turns it on. */
export const getInputModalitySnapshot = (): InputModality =>
  typeof document !== 'undefined' && document.documentElement.dataset.inputModality === 'keyboard'
    ? 'keyboard'
    : 'pointer';

export const getServerInputModalitySnapshot = (): InputModality => 'pointer';

/** Internal visual signal between linked documents; its detail is the next modality. */
export const inputModalityBridgeEvent = 'atlas-input-modality-bridge';

/** Plain Tab and Shift+Tab are the only keys that turn visible focus on. */
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
  // Arrows, Escape, Enter, Space and typing never turn the mode on, and never turn it off.
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
