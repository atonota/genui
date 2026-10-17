import { createContext, useContext } from 'react';
import Segmented from './GenUXSegmented';
import genux from '../data/genux.json';
import { pillSizeProfiles } from '../data/pill-surfaces';
import { selectionSizeProfiles } from '../data/selection-sizes';
import { useI18n } from './useI18n';

export type GenUXSize = 'sm' | 'md' | 'lg';
export type GenUXSizeFamily = 'component' | 'selection' | 'pill';
export const GenUXSizeContext = createContext<GenUXSize | undefined>(undefined);
export const useGenUXSize = (): GenUXSize => useContext(GenUXSizeContext) ?? 'md';
export const genuxSizeProfiles = genux.decisions.buttons.size_variants;

export function GenUXSizeControl({
  value,
  onChange,
  vertical = false,
  sizeFamily = 'component',
}: {
  value: GenUXSize;
  onChange: (value: GenUXSize) => void;
  vertical?: boolean;
  sizeFamily?: GenUXSizeFamily;
}) {
  const { t } = useI18n();
  const profiles =
    sizeFamily === 'selection'
      ? selectionSizeProfiles
      : sizeFamily === 'pill'
        ? pillSizeProfiles
        : genuxSizeProfiles;
  return (
    <section className="genux-size-control" data-size-control>
      <p>{t('Component size')}</p>
      <Segmented
        className="genux-size-options"
        aria-label={t('Component size')}
        tabIndex={-1}
        block
        vertical={vertical}
        value={value}
        onChange={value => onChange(value as GenUXSize)}
        options={profiles.map(profile => ({
          value: profile.value,
          label: t(profile.label),
        }))}
      />
    </section>
  );
}
