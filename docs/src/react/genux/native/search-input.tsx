import { useId, type ChangeEvent } from 'react';
import type { NativeAdapterProps } from '../../../genux/native-contract';
import GenUXInput from '../../GenUXInput';

export type SearchInputAdapterProps = NativeAdapterProps & { actionAvailable?: boolean };

const text = (value: unknown) => (typeof value === 'string' ? value : undefined);

export default function NativeSearchInput({
  data,
  disabled,
  onChange,
  onAction,
  actionAvailable = false,
}: SearchInputAdapterProps) {
  const id = useId();
  const off = disabled || data.disabled === true;
  const readOnly = data.readOnly === true;
  const maxLength = typeof data.maxLength === 'number' ? data.maxLength : undefined;
  // Typing only reports the draft; the parent decides whether to accept it.
  const change = (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value);
  const field = {
    id,
    value: text(data.value) ?? '',
    placeholder: text(data.placeholder),
    maxLength,
    disabled: off,
    readOnly,
    onChange: change,
  };
  return (
    <div>
      <label htmlFor={id}>{text(data.label)}</label>
      {actionAvailable ? (
        <GenUXInput.Search
          {...field}
          onSearch={(_value, _event, info) => {
            // Clearing is editing, not an explicit search.
            if (info?.source === 'clear' || off) return;
            onAction();
          }}
        />
      ) : (
        // Without a trusted action there is no search affordance to imply success.
        <GenUXInput {...field} />
      )}
    </div>
  );
}
