export type InputModality = 'keyboard' | 'pointer';
type ModalityOwner = { listeners: Set<() => void>; holds: number; dispose: () => void };
const owners = new WeakMap<Document, ModalityOwner>();

/** Visible focus mode starts off (pointer); only plain Tab/Shift+Tab turns it on. */
export const getInputModalitySnapshot = (): InputModality =>
  typeof document !== 'undefined' && document.documentElement.dataset.inputModality === 'keyboard'
    ? 'keyboard'
    : 'pointer';

export const getServerInputModalitySnapshot = (): InputModality => 'pointer';

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
    if (event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey)
      update('keyboard');
  };
  // Pointer input only turns the visual mode off: no preventDefault, blur or caret change.
  const onPointer = () => update('pointer');
  const passive: AddEventListenerOptions = { capture: true, passive: true };
  if (root.dataset.inputModality !== 'keyboard') root.dataset.inputModality = 'pointer';
  doc.addEventListener('keydown', onKeyDown, true);
  doc.addEventListener('pointerdown', onPointer, passive);
  doc.addEventListener('touchstart', onPointer, passive);
  const owner: ModalityOwner = {
    listeners,
    holds: 0,
    dispose: () => {
      doc.removeEventListener('keydown', onKeyDown, true);
      doc.removeEventListener('pointerdown', onPointer, passive);
      doc.removeEventListener('touchstart', onPointer, passive);
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
