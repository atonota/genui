import { Checkbox } from 'antd';
import { definition } from '../../../genui/native/checkbox';
import type { NativeAdapterProps } from '../../../genui/native-contract';

export default function AtlasCheckbox({ data, disabled, onChange }: NativeAdapterProps) {
  const payload = definition.parse(data);
  return (
    <Checkbox
      checked={payload.value === true}
      disabled={disabled || payload.disabled === true || payload.readOnly === true}
      onChange={event => onChange(event.target.checked)}
    >
      {payload.label as string}
    </Checkbox>
  );
}
