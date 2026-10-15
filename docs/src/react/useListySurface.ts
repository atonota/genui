import { useSyncExternalStore } from 'react';
import { getServerThemeSnapshot, getThemeSnapshot, subscribeTheme } from '../theme';
import {
  getServerThemeBuilderSnapshot,
  getThemeBuilderSnapshot,
  subscribeThemeBuilder,
} from '../theme-builder/store';
import { listySurfaceOf, tokenDefinitions, type ListySurface } from '../theme-builder/model';
import { useAtlasAppearance } from './AtlasAppearance';
import { useAtlasSize } from './AtlasSizeProfile';

const subscribeNothing = () => () => {};

/** Only documentation surfaces follow the applied Theme Builder recipe; approved surfaces and the
    server render read the definition defaults, so hydration stays consistent. */
function useAppliedRecipe() {
  const builderActive = useAtlasAppearance() === 'docs';
  const recipe = useSyncExternalStore(
    builderActive ? subscribeThemeBuilder : subscribeNothing,
    builderActive ? getThemeBuilderSnapshot : getServerThemeBuilderSnapshot,
    getServerThemeBuilderSnapshot,
  );
  const mode = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);
  return { recipe, mode };
}

/** Central Listy surface role shared by AtlasListy and the native Cascader popup. */
export default function useListySurface(): ListySurface {
  const { recipe, mode } = useAppliedRecipe();
  return listySurfaceOf(recipe, mode);
}

/** Compact row height in px for the inherited size profile; bounded native scrollers derive their
    height from it instead of an arbitrary inline value. */
export function useListyRowHeight(): number {
  const size = useAtlasSize();
  const { recipe, mode } = useAppliedRecipe();
  const id = `size-compact-${size}`;
  const value =
    recipe?.[mode][id] ?? tokenDefinitions.find(definition => definition.id === id)?.defaults[mode];
  return Number(value);
}
