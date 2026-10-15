import '../../../styles/atlas-dropdown.css';
import { ConfigProvider } from 'antd';
import AtlasDropdown from '../../AtlasDropdown';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { definition, type DropdownData } from '../../../genui/native/dropdown';

/** Branded action menu; a chosen item only reports its listed ID through onChange. */
export default function NativeDropdown({ data, disabled, onChange }: NativeAdapterProps) {
  const parsed = definition.parse(data) as unknown as DropdownData;
  const locked = disabled || parsed.disabled === true;
  const selected = parsed.items.find(item => item.id === parsed.value);
  return (
    <ConfigProvider componentDisabled={locked}>
      <AtlasDropdown
        label={selected ? `${parsed.label}: ${selected.label}` : parsed.label}
        items={parsed.items.map(item => ({
          key: item.id,
          label: item.label,
          disabled: locked || item.disabled === true,
        }))}
        onAction={key => {
          const item = parsed.items.find(entry => entry.id === key);
          if (!locked && item && !item.disabled) onChange(item.id);
        }}
      />
    </ConfigProvider>
  );
}
