import { useId } from 'react';
import { Flex } from 'antd';
import AtlasInputNumber from '../../AtlasInputNumber';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { definition, inputNumberFields } from '../../../genui/native/input-number';

export default function InputNumberNative({ data, disabled, onChange }: NativeAdapterProps) {
  const id = useId();
  const field = inputNumberFields(definition.parse(data));
  const locked = disabled || field.disabled || field.readOnly;
  return (
    <Flex vertical gap="small">
      <label htmlFor={id}>{field.label}</label>
      <AtlasInputNumber<number>
        id={id}
        value={field.value}
        min={field.min}
        max={field.max}
        step={field.step}
        disabled={locked}
        readOnly={field.readOnly}
        onChange={next => onChange(next ?? null)}
      />
    </Flex>
  );
}
