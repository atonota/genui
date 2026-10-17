import { Select } from 'antd';
import { useId } from 'react';
import type { JsonValue } from '../../../genux/contracts';
import type { NativeAdapterProps } from '../../../genux/native-contract';
import { definition, type SelectOption } from '../../../genux/native/select';
import { selectedLabel } from '../../selectedLabel';

const classNames = { popup: { root: 'genux-select-popup' } };

function toValue(next: unknown, multiple: boolean): JsonValue {
  if (multiple)
    return Array.isArray(next) ? next.filter((id): id is string => typeof id === 'string') : [];
  return typeof next === 'string' ? next : null;
}

export default function GenUXSelectNative({ data, disabled, onChange }: NativeAdapterProps) {
  const id = useId();
  const payload = definition.parse(data);
  const multiple = payload.multiple === true;
  const options = (payload.options as unknown as SelectOption[]).map(option => ({
    value: option.id,
    label: option.label,
    disabled: option.disabled === true,
  }));
  const locked = disabled || payload.disabled === true || definition.readOnly;
  const value = multiple
    ? (payload.value as string[])
    : typeof payload.value === 'string'
      ? payload.value
      : null;
  return (
    <div>
      <label htmlFor={id}>{String(payload.label)}</label>
      <Select
        variant="filled"
        id={id}
        mode={multiple ? 'multiple' : undefined}
        options={options}
        labelRender={selectedLabel(options)}
        value={value}
        disabled={locked}
        allowClear
        showSearch={{ optionFilterProp: 'label' }}
        classNames={classNames}
        onChange={next => onChange(toValue(next, multiple))}
      />
    </div>
  );
}
