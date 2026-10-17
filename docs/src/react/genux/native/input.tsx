import { useId } from 'react';
import { Form } from 'antd';
import GenUXInput from '../../GenUXInput';
import { definition, type GenUXInputData } from '../../../genux/native/input';
import type { NativeAdapterProps } from '../../../genux/native-contract';

export default function GenUXInputNative({ data, disabled, onChange }: NativeAdapterProps) {
  const field = definition.parse(data) as unknown as GenUXInputData;
  const id = useId();
  return (
    <Form.Item
      label={field.label}
      htmlFor={id}
      required={field.required === true}
      colon={false}
      layout="vertical"
    >
      <GenUXInput
        id={id}
        value={field.value}
        placeholder={field.placeholder}
        maxLength={field.maxLength}
        required={field.required === true}
        aria-required={field.required === true}
        readOnly={field.readOnly === true}
        disabled={disabled || field.disabled === true}
        onChange={event => onChange(event.target.value)}
      />
    </Form.Item>
  );
}
