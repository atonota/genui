import GenUXAutoComplete, { type GenUXSuggestion } from '../../GenUXAutoComplete';
import type { NativeAdapterProps } from '../../../genux/native-contract';
import { definition, type AutoCompletePayload } from '../../../genux/native/auto-complete';

/** Controlled native AutoComplete; the runtime owns the value, never local state. */
export default function AutoCompleteNative({ data, disabled, onChange }: NativeAdapterProps) {
  const payload = definition.parse(data) as unknown as AutoCompletePayload;
  const blocked = disabled || payload.disabled === true || payload.readOnly === true;
  const items: GenUXSuggestion[] = payload.suggestions.map(suggestion => ({
    key: suggestion.id,
    value: suggestion.label,
    title: suggestion.label,
    disabled: suggestion.disabled,
  }));
  return (
    <GenUXAutoComplete
      label={payload.label}
      value={payload.value}
      items={items}
      placeholder={payload.placeholder}
      help={payload.help}
      disabled={blocked}
      // Native onChange also reports selections, so one callback covers both paths.
      onChange={next => {
        if (!blocked) onChange(next);
      }}
    />
  );
}
