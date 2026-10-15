import { useId } from 'react';
import { Switch } from 'antd';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { definition } from '../../../genui/native/switch';

export default function AtlasSwitchNative({ data, disabled, onChange }: NativeAdapterProps) {
  const id = useId();
  const model = definition.parse(data);
  const labelId = `${id}-label`;
  return (
    <label className="control-row" htmlFor={id}>
      <Switch
        id={id}
        aria-labelledby={labelId}
        checked={model.value === true}
        disabled={disabled || model.disabled === true}
        onChange={next => onChange(next)}
      />
      <span id={labelId}>{String(model.label)}</span>
    </label>
  );
}
