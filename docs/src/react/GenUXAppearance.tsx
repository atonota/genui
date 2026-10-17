import { createContext, useContext } from 'react';

export type GenUXAppearance = 'approved' | 'docs';
/** Consumers opt in explicitly. Shared components and Storybook retain approved defaults. */
export const GenUXAppearanceContext = createContext<GenUXAppearance>('approved');
export function useGenUXAppearance(): GenUXAppearance {
  return useContext(GenUXAppearanceContext);
}

/** Docs use native AntD CSS pixels; approved consumers keep their existing units. */
export function genuxLength(pixels: number, appearance: GenUXAppearance): string {
  return appearance === 'docs' ? `${pixels}px` : `${pixels / 16}rem`;
}
