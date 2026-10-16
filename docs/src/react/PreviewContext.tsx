import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import type { PreviewOrientation } from '../data/preview-devices';
import type { PreviewProfile } from '../preview/profiles';
import { getThemeSnapshot, subscribeTheme, type ThemeMode } from '../theme';

/** Selection the isolated preview document renders for one example. */
export type PreviewContextValue = {
  readonly exampleId: string;
  readonly profile: PreviewProfile;
  readonly mode: ThemeMode;
  readonly orientation?: PreviewOrientation;
};

/** Null outside the preview document, so docs pages keep the workbench. */
export const PreviewContext = createContext<PreviewContextValue | null>(null);

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
