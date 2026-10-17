import { useId, type CSSProperties, type ReactNode } from 'react';
import Segmented from './GenUXSegmented';
import genux from '../data/genux.json';
import { useGenUXSize } from './GenUXSizeProfile';
import { useGenUXAppearance, genuxLength } from './GenUXAppearance';

export type GenUXButtonGroupOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};
export type GenUXButtonGroupProps = {
  options:
    | readonly [GenUXButtonGroupOption, GenUXButtonGroupOption]
    | readonly [GenUXButtonGroupOption, GenUXButtonGroupOption, GenUXButtonGroupOption];
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
export default function GenUXButtonGroup({
  options,
  value,
  defaultValue,
  onChange,
  disabled,
  size,
  radius = '5',
  name,
  'aria-label': label,
}: GenUXButtonGroupProps) {
  const inheritedSize = useGenUXSize();
  const appearance = useGenUXAppearance();
  const id = useId();
  const dimensions =
    genux.decisions.buttons.size_variants.find(item => item.value === (size ?? inheritedSize)) ??
    genux.decisions.buttons.size_variants[0]!;
  const rounding =
    genux.decisions.buttons.radius_variants.find(item => item.value === radius) ??
    genux.decisions.buttons.radius_variants.find(item => item.value === '5')!;
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
    '--button-group-height': genuxLength(dimensions.height_px, appearance),
    '--button-group-radius': rounding.css,
  } as CSSProperties;
  return (
    <Segmented<string>
      className="genux-segmented genux-button-group"
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
