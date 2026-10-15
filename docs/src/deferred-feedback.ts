/** Load optional presentation on interaction intent, keeping reading/navigation light. */
export function installDeferredFeedback(doc: Document): () => void {
  let enabled = true;
  let loading = false;
  let firstEvents: Event[] = [];
  let dispose: (() => void) | undefined;
  const events = ['pointerdown', 'pointerup', 'pointercancel', 'keydown', 'click', 'scroll'];
  const stop = () => {
    for (const name of events) doc.removeEventListener(name, intent, true);
    doc.defaultView?.removeEventListener('resize', intent);
  };
  const intent = (event: Event) => {
    if (dispose || !enabled) return;
    if (/^(scroll|resize)$/.test(event.type)) {
      firstEvents = [];
      return;
    }
    firstEvents.push(event);
    // Preserve rapid completed actions while the optional chunk is loading.
    // Bound retained event references; replay never redispatches business input.
    firstEvents = firstEvents.slice(-32);
    if (loading) return;
    loading = true;
    void import('./interaction-feedback')
      .then(({ installInteractionFeedback }) => {
        if (enabled) {
          dispose = installInteractionFeedback(doc, firstEvents);
          firstEvents = [];
          stop();
        }
      })
      .catch(() => {
        loading = false;
        firstEvents = [];
      });
  };
  for (const name of events) doc.addEventListener(name, intent, true);
  doc.defaultView?.addEventListener('resize', intent);
  return () => {
    enabled = false;
    firstEvents = [];
    dispose?.();
    stop();
  };
}
