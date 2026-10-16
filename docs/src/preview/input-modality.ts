/** Joins the parent document and one same-origin preview document into one visible focus
    group. Each realm keeps its own modality owner; only trusted Tab and pointer input is
    relayed, as the central bridge event, into the other document. */
import { inputModalityBridgeEvent, isModalityTabKey, type InputModality } from '../input-modality';

function relay(target: Document, modality: InputModality): void {
  const view = target.defaultView;
  if (!view) return;
  target.dispatchEvent(new view.CustomEvent(inputModalityBridgeEvent, { detail: modality }));
}

/** Returns an idempotent unlink. Bridge events are never relayed back, so nothing echoes. */
export function linkInputModality(parent: Document, child: Document): () => void {
  if (parent === child) return () => {};
  const passive: AddEventListenerOptions = { capture: true, passive: true };
  const pairs: [Document, Document][] = [
    [parent, child],
    [child, parent],
  ];
  const removers = pairs.map(([source, target]) => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isTrusted && isModalityTabKey(event)) relay(target, 'keyboard');
    };
    const onPointer = (event: Event) => {
      if (event.isTrusted) relay(target, 'pointer');
    };
    source.addEventListener('keydown', onKeyDown, true);
    source.addEventListener('pointerdown', onPointer, passive);
    source.addEventListener('touchstart', onPointer, passive);
    return () => {
      source.removeEventListener('keydown', onKeyDown, true);
      source.removeEventListener('pointerdown', onPointer, passive);
      source.removeEventListener('touchstart', onPointer, passive);
    };
  });
  // A preview loaded while the parent shows keyboard focus starts in the same visual mode.
  if (parent.documentElement.dataset.inputModality === 'keyboard') relay(child, 'keyboard');
  let linked = true;
  return () => {
    if (!linked) return;
    linked = false;
    for (const remove of removers) remove();
  };
}
