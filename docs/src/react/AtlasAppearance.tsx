import { createContext, useContext } from 'react';

export type AtlasAppearance = 'approved' | 'docs';
/** Consumers opt in explicitly. Shared components and Storybook retain approved defaults. */
export const AtlasAppearanceContext = createContext<AtlasAppearance>('approved');
export function useAtlasAppearance(): AtlasAppearance {
  return useContext(AtlasAppearanceContext);
}

/** Docs use native AntD CSS pixels; approved consumers keep their existing units. */
export function atlasLength(pixels: number, appearance: AtlasAppearance): string {
  return appearance === 'docs' ? `${pixels}px` : `${pixels / 16}rem`;
}
