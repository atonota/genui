import AtlasIconList, { type AtlasIconListItem } from '../../AtlasIconList';
import type { AtlasIconName } from '../../AtlasIcon';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { definition, type IconListEntry } from '../../../genui/native/icon-list';

/** Read-only: the list has no controls, so disabled/onChange/onAction are unused. */
export default function Component({ data }: NativeAdapterProps) {
  const entries = definition.parse(data).items as unknown as IconListEntry[];
  const items: AtlasIconListItem[] = entries.map(entry => ({
    id: entry.id,
    title: entry.title,
    description: entry.description,
    // parse admits only names AtlasIcon resolves.
    icon: entry.icon as AtlasIconName | undefined,
  }));
  return <AtlasIconList items={items} />;
}
