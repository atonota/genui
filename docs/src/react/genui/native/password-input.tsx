import { useId } from 'react';
import AtlasInput from '../../AtlasInput';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { definition } from '../../../genui/native/password-input';

// Controlled by the payload: a parent may reject or delay a draft value, so the
// input never keeps a local copy and never reports the value anywhere else.
export default function NativePasswordInput({ data, disabled, onChange }: NativeAdapterProps) {
  const id = useId();
  const payload = definition.parse(data);
  const readOnly = payload.readOnly === true;
  const locked = disabled || payload.disabled === true;
  return (
    <div>
      <label htmlFor={id}>{payload.label as string}</label>
      <AtlasInput.Password
        id={id}
        value={payload.value as string}
        placeholder={typeof payload.placeholder === 'string' ? payload.placeholder : undefined}
        maxLength={typeof payload.maxLength === 'number' ? payload.maxLength : undefined}
        required={payload.required === true}
        readOnly={readOnly}
        disabled={locked}
        onChange={event => {
          if (!readOnly && !locked) onChange(event.target.value);
        }}
      />
    </div>
  );
}
