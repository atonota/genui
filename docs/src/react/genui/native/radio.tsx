import { Radio } from 'antd';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { definition, type AtlasRadioPayload } from '../../../genui/native/radio';

export default function AtlasRadio({ data, disabled, onChange }: NativeAdapterProps) {
  const payload = definition.parse(data) as unknown as AtlasRadioPayload;
  const locked = disabled || payload.disabled === true || payload.readOnly === true;
  return (
    <Radio.Group
      value={payload.value}
      disabled={locked}
      aria-label={payload.label}
      options={payload.options.map(option => ({
        value: option.id,
        label: option.label,
        disabled: option.disabled === true,
      }))}
      onChange={event => {
        if (!locked) onChange(event.target.value as string);
      }}
    />
  );
}
