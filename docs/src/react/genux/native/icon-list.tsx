import GenUXIconList, { type GenUXIconListItem } from '../../GenUXIconList';
import type { GenUXIconName } from '../../GenUXIcon';
import type { NativeAdapterProps } from '../../../genux/native-contract';
import { definition, type IconListEntry } from '../../../genux/native/icon-list';

/** Read-only: the list has no controls, so disabled/onChange/onAction are unused. */
export default function Component({ data }: NativeAdapterProps) {
  const entries = definition.parse(data).items as unknown as IconListEntry[];
  const items: GenUXIconListItem[] = entries.map(entry => ({
    id: entry.id,
    title: entry.title,
    description: entry.description,
    // parse admits only names GenUXIcon resolves.
    icon: entry.icon as GenUXIconName | undefined,
  }));
  return <GenUXIconList items={items} />;
}
