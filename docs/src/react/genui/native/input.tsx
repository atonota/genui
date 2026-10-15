import { useId } from 'react';
import { Form } from 'antd';
import AtlasInput from '../../AtlasInput';
import { definition, type AtlasInputData } from '../../../genui/native/input';
import type { NativeAdapterProps } from '../../../genui/native-contract';

export default function AtlasInputNative({ data, disabled, onChange }: NativeAdapterProps) {
  const field = definition.parse(data) as unknown as AtlasInputData;
  const id = useId();
  return (
    <Form.Item
      label={field.label}
      htmlFor={id}
      required={field.required === true}
      colon={false}
      layout="vertical"
    >
      <AtlasInput
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
