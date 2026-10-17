import { useId } from 'react';
import { Flex } from 'antd';
import type { NativeAdapterProps } from '../../../genux/native-contract';
import GenUXInput from '../../GenUXInput';

export default function NativeTextArea({ data, disabled, onChange }: NativeAdapterProps) {
  const id = useId();
  const label = typeof data.label === 'string' ? data.label : '';
  const value = typeof data.value === 'string' ? data.value : '';
  const placeholder = typeof data.placeholder === 'string' ? data.placeholder : undefined;
  const maxLength = typeof data.maxLength === 'number' ? data.maxLength : undefined;
  const rows = typeof data.rows === 'number' ? data.rows : 3;
  return (
    <Flex vertical gap="small">
      <label htmlFor={id}>{label}</label>
      <GenUXInput.TextArea
        id={id}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        required={data.required === true}
        readOnly={data.readOnly === true}
        disabled={disabled || data.disabled === true}
        // Controlled: the parent may accept, delay or reject the draft value.
        onChange={event => onChange(event.target.value)}
      />
    </Flex>
  );
}
