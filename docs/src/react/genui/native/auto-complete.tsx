import '../../../styles/atlas-autocomplete.css';
import AtlasAutoComplete, { type AtlasSuggestion } from '../../AtlasAutoComplete';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { definition, type AutoCompletePayload } from '../../../genui/native/auto-complete';

/** Controlled native AutoComplete; the runtime owns the value, never local state. */
export default function AutoCompleteNative({ data, disabled, onChange }: NativeAdapterProps) {
  const payload = definition.parse(data) as unknown as AutoCompletePayload;
  const blocked = disabled || payload.disabled === true || payload.readOnly === true;
  const items: AtlasSuggestion[] = payload.suggestions.map(suggestion => ({
    key: suggestion.id,
    value: suggestion.label,
    title: suggestion.label,
    disabled: suggestion.disabled,
  }));
  return (
    <AtlasAutoComplete
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
