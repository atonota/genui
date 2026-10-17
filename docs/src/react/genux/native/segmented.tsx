import GenUXSegmented from '../../GenUXSegmented';
import type { NativeAdapterProps } from '../../../genux/native-contract';
import { definition } from '../../../genux/native/segmented';

interface SegmentedOption {
  label: string;
  value: string;
  disabled?: boolean;
}

/** Controlled GenUXSegmented: the runtime payload owns the value; choices only report intent. */
export default function NativeSegmented({ data, disabled, onChange }: NativeAdapterProps) {
  const payload = definition.parse(data);
  const locked = disabled || payload.disabled === true;
  const options = (payload.options as unknown as SegmentedOption[]).map(option => ({
    label: option.label,
    value: option.value,
    disabled: locked || option.disabled === true,
  }));
  return (
    <GenUXSegmented<string>
      aria-label={payload.label as string}
      options={options}
      value={payload.value as string}
      disabled={locked}
      onChange={value => {
        if (!locked) onChange(value);
      }}
    />
  );
}
