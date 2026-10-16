import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import type { PreviewOrientation } from '../data/preview-devices';
import type { PreviewProfile } from '../preview/profiles';
import { getThemeSnapshot, subscribeTheme, type ThemeMode } from '../theme';
import type { ThemeRecipe } from '../theme-builder/model';

/** Outcome of a local recipe apply; a rejected recipe leaves the example unchanged. */
export type PreviewRecipeResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string };

/** Selection the preview renders for one example. An inline example also owns an in-memory
    token recipe; the global Theme Builder recipe is only its fallback. */
export type PreviewContextValue = {
  readonly exampleId: string;
  readonly profile: PreviewProfile;
  readonly mode: ThemeMode;
  readonly orientation?: PreviewOrientation;
  /** This example's recipe; absent or null follows the global recipe. */
  readonly recipe?: ThemeRecipe | null;
  /** Validates and applies a recipe to this example only; never writes global storage. */
  readonly apply?: (recipe: ThemeRecipe) => PreviewRecipeResult;
  /** Returns only this example to the default recipe. */
  readonly reset?: () => void;
};

/** Null outside a preview document (an inline mockup or the standalone route), so docs pages
    keep the workbench. */
export const PreviewContext = createContext<PreviewContextValue | null>(null);

/** Root element of a preview document; portals opened inside a preview stay within it. */
export const previewDocumentSelector = '[data-preview-document]';

export function PreviewProvider({
  value,
  children,
}: {
  value: PreviewContextValue;
  children: ReactNode;
}) {
  return <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>;
}

export function usePreviewContext(): PreviewContextValue | null {
  return useContext(PreviewContext);
}

const subscribeNothing = () => () => {};
const lightServerSnapshot = (): ThemeMode => 'light';

// Focused local preview registry: the page Tweaker edits the example that last took focus.
// Each mounted example registers its current value and unmount removes it, so no stale target.
const localPreviews = new Map<string, PreviewContextValue>();
const localPreviewListeners = new Set<() => void>();
let focusedLocalPreviewId: string | null = null;
const notifyLocalPreview = () => localPreviewListeners.forEach(listener => listener());

export function registerLocalPreview(value: PreviewContextValue): () => void {
  const id = value.exampleId;
  localPreviews.set(id, value);
  if (focusedLocalPreviewId === id) notifyLocalPreview();
  return () => {
    if (localPreviews.get(id) !== value) return;
    localPreviews.delete(id);
    if (focusedLocalPreviewId === id) notifyLocalPreview();
  };
}

/** Always records the focused id, so a later registration still notifies its readers; returns
    whether that example is registered now. Callers that only follow focus ignore the result. */
export function focusLocalPreview(id: string): boolean {
  if (focusedLocalPreviewId !== id) {
    focusedLocalPreviewId = id;
    notifyLocalPreview();
  }
  return localPreviews.has(id);
}

export function releaseLocalPreview(id: string): void {
  if (focusedLocalPreviewId !== id) return;
  focusedLocalPreviewId = null;
  notifyLocalPreview();
}

function subscribeLocalPreview(listener: () => void): () => void {
  localPreviewListeners.add(listener);
  return () => {
    localPreviewListeners.delete(listener);
  };
}
const getFocusedLocalPreview = (): PreviewContextValue | null =>
  focusedLocalPreviewId === null ? null : (localPreviews.get(focusedLocalPreviewId) ?? null);
const noLocalPreview = (): PreviewContextValue | null => null;

/** The actual enclosing preview, else the focused example on this page. Only Tweaker editors
    read the registry; AtlasProvider reads the actual context alone. */
export function useLocalPreviewTarget(): PreviewContextValue | null {
  const preview = useContext(PreviewContext);
  const focused = useSyncExternalStore(
    preview ? subscribeNothing : subscribeLocalPreview,
    preview ? noLocalPreview : getFocusedLocalPreview,
    noLocalPreview,
  );
  return preview ?? focused;
}

/** Theme mode for docs components. An isolated preview document owns its mode and never
    follows shared-origin theme storage; elsewhere the global theme store stays the source. */
export function usePreviewTheme(
  getServerSnapshot: () => ThemeMode = lightServerSnapshot,
): ThemeMode {
  const preview = useContext(PreviewContext);
  const globalMode = useSyncExternalStore(
    preview ? subscribeNothing : subscribeTheme,
    getThemeSnapshot,
    getServerSnapshot,
  );
  return preview?.mode ?? globalMode;
}
