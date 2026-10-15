import { useId, type CSSProperties, type ReactNode } from 'react';
import Segmented from './AtlasSegmented';
import atlas from '../data/atlas.json';
import { useAtlasSize } from './AtlasSizeProfile';
import { useAtlasAppearance, atlasLength } from './AtlasAppearance';

export type AtlasButtonGroupOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};
export type AtlasButtonGroupProps = {
  options:
    | readonly [AtlasButtonGroupOption, AtlasButtonGroupOption]
    | readonly [AtlasButtonGroupOption, AtlasButtonGroupOption, AtlasButtonGroupOption];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  radius?: string;
  name?: string;
  'aria-label': string;
};

/** Two or three exclusive choices, with native radio semantics and one shared wrapper. */
export default function AtlasButtonGroup({
  options,
  value,
  defaultValue,
  onChange,
  disabled,
  size,
  radius = '5',
  name,
  'aria-label': label,
}: AtlasButtonGroupProps) {
  const inheritedSize = useAtlasSize();
  const appearance = useAtlasAppearance();
  const id = useId();
  const dimensions =
    atlas.decisions.buttons.size_variants.find(item => item.value === (size ?? inheritedSize)) ??
    atlas.decisions.buttons.size_variants[0]!;
  const rounding =
    atlas.decisions.buttons.radius_variants.find(item => item.value === radius) ??
    atlas.decisions.buttons.radius_variants.find(item => item.value === '5')!;
  const initial = options.some(option => option.value === defaultValue)
    ? defaultValue
    : options[0].value;
  const selected =
    value === undefined
      ? undefined
      : options.some(option => option.value === value)
        ? value
        : options[0].value;
  const style = {
    '--button-group-height': atlasLength(dimensions.height_px, appearance),
    '--button-group-radius': rounding.css,
  } as CSSProperties;
  return (
    <Segmented<string>
      className="atlas-segmented atlas-button-group"
      style={style}
      block
      tabIndex={-1}
      name={name ?? id}
      aria-label={label}
      options={[...options]}
      value={selected}
      defaultValue={initial}
      onChange={onChange}
      disabled={disabled}
      data-button-group-count={options.length}
      data-size={dimensions.value}
      data-radius={rounding.value}
    />
  );
}
