import { createContext, useContext } from 'react';
import Segmented from './AtlasSegmented';
import atlas from '../data/atlas.json';
import { pillSizeProfiles } from '../data/pill-surfaces';
import { selectionSizeProfiles } from '../data/selection-sizes';
import { useI18n } from './useI18n';

export type AtlasSize = 'sm' | 'md' | 'lg';
export type AtlasSizeFamily = 'component' | 'selection' | 'pill';
export const AtlasSizeContext = createContext<AtlasSize | undefined>(undefined);
export const useAtlasSize = (): AtlasSize => useContext(AtlasSizeContext) ?? 'md';
export const atlasSizeProfiles = atlas.decisions.buttons.size_variants;

export function AtlasSizeControl({
  value,
  onChange,
  vertical = false,
  sizeFamily = 'component',
}: {
  value: AtlasSize;
  onChange: (value: AtlasSize) => void;
  vertical?: boolean;
  sizeFamily?: AtlasSizeFamily;
}) {
  const { t } = useI18n();
  const profiles =
    sizeFamily === 'selection'
      ? selectionSizeProfiles
      : sizeFamily === 'pill'
        ? pillSizeProfiles
        : atlasSizeProfiles;
  return (
    <section className="atlas-size-control" data-size-control>
      <p>{t('Component size')}</p>
      <Segmented
        className="atlas-size-options"
        aria-label={t('Component size')}
        tabIndex={-1}
        block
        vertical={vertical}
        value={value}
        onChange={value => onChange(value as AtlasSize)}
        options={profiles.map(profile => ({
          value: profile.value,
          label: t(profile.label),
        }))}
      />
    </section>
  );
}
