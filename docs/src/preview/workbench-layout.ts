import { useSyncExternalStore } from 'react';
import type { PreviewDevice } from '../data/preview-devices';
import type { DeviceFrameFitAxis, DeviceFrameZoom } from '../react/DeviceFrame';

/** The one MacBook workbench threshold, in CSS viewport px: from here the fixed logical screen
    shows at Actual 1:1 inline; below it Fit follows the available width alone. */
export const MACBOOK_WIDE_MIN_VIEWPORT_PX = 1920;
const wideQuery = `(min-width: ${MACBOOK_WIDE_MIN_VIEWPORT_PX}px)`;

export function isMacbookWideViewport(viewportWidthPx: number): boolean {
  return viewportWidthPx >= MACBOOK_WIDE_MIN_VIEWPORT_PX;
}

export type PreviewWorkbenchLayout = {
  readonly zoom: DeviceFrameZoom;
  readonly fitAxis: DeviceFrameFitAxis;
  /** The manual Actual 1:1 toggle; the MacBook follows the viewport rule instead. */
  readonly manualActual: boolean;
  /** Inline Expand; the wide MacBook already shows 1:1. Close stays while expanded. */
  readonly inlineExpand: boolean;
};

/** Phones and tablets keep their manual zoom and Expand; the MacBook fits by width below the
    threshold and shows Actual 1:1 from it. */
export function previewWorkbenchLayout(
  device: PreviewDevice,
  wide: boolean,
  manualZoom: DeviceFrameZoom,
): PreviewWorkbenchLayout {
  if (device !== 'macbook')
    return { zoom: manualZoom, fitAxis: 'both', manualActual: true, inlineExpand: true };
  return {
    zoom: wide ? 'actual' : 'fit',
    fitAxis: 'width',
    manualActual: false,
    inlineExpand: !wide,
  };
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  if (typeof window.matchMedia === 'function') {
    const query = window.matchMedia(wideQuery);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

// The actual CSS viewport width; no user agent, physical screen or fullscreen heuristics.
function getSnapshot(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia(wideQuery).matches
    : isMacbookWideViewport(window.innerWidth);
}

// The server and the hydration render stay narrow: width Fit is the conservative fallback.
const getServerSnapshot = () => false;

export function useMacbookWideViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
