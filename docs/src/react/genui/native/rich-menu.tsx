import '../../../styles/atlas-dropdown.css';
import '../../../styles/atlas-rich-menu.css';
import { Flex, Typography } from 'antd';
import AtlasRichMenu, { type AtlasRichMenuGroup } from '../../AtlasRichMenu';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { definition, type RichMenuData } from '../../../genui/native/rich-menu';

/** Controlled local selection; remote actions stay with the trusted outer node action. */
export default function RichMenuNative({ data, disabled, onChange }: NativeAdapterProps) {
  const menu = definition.parse(data) as unknown as RichMenuData;
  const locked = disabled || menu.disabled === true;
  const items = menu.groups.flatMap(group => group.items);
  const groups: AtlasRichMenuGroup[] = menu.groups.map(group => ({
    id: group.id,
    label: group.label,
    items: group.items.map(item => ({
      id: item.id,
      label: item.label,
      description: item.description,
      disabled: locked || item.disabled === true,
    })),
  }));
  const selected = items.find(item => item.id === menu.value);
  const choose = (id: string) => {
    if (locked) return;
    if (items.some(item => item.id === id && item.disabled !== true)) onChange(id);
  };
  return (
    <Flex vertical gap="small" data-native-component={definition.name}>
      <AtlasRichMenu label={menu.label} groups={groups} onAction={choose} />
      {selected && <Typography.Text role="status">{selected.label}</Typography.Text>}
    </Flex>
  );
}
