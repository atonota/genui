import type { MouseEvent } from 'react';
import AtlasBreadcrumb, { type AtlasBreadcrumbItem } from '../../AtlasBreadcrumb';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { definition } from '../../../genui/native/breadcrumb';

type Entry = { key: string; label: string; disabled?: boolean };

// Adapter-derived fragments from validated IDs; clicks are intercepted, never followed.
const fragment = (key: string) => `#${key}`;

/** Renders the trail up to the current value; ancestors and siblings select locally. */
export default function Component({ data, disabled, onChange }: NativeAdapterProps) {
  const parsed = definition.parse(data);
  const entries = parsed.items as unknown as Entry[];
  const value = parsed.value as string;
  const locked = disabled || parsed.disabled === true;
  const currentIndex = entries.findIndex(entry => entry.key === value);
  const choices = locked ? [] : entries.filter(entry => !entry.disabled && entry.key !== value);
  const allowed = new Set(choices.map(entry => entry.key));
  const items = entries.slice(0, currentIndex + 1).map((entry, index) => {
    const item: AtlasBreadcrumbItem = { key: entry.key, label: entry.label };
    if (index < currentIndex && allowed.has(entry.key)) item.href = fragment(entry.key);
    if (index === currentIndex && choices.length) {
      item.menuLabel = parsed.label as string;
      item.menu = choices.map(choice => ({
        key: choice.key,
        label: choice.label,
        href: fragment(choice.key),
      }));
    }
    return item;
  });
  const select = (event: MouseEvent<HTMLDivElement>) => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link) return;
    event.preventDefault();
    const key = link.getAttribute('href')?.slice(1);
    if (!locked && key && allowed.has(key)) onChange(key);
  };
  return (
    <div onClickCapture={select}>
      <AtlasBreadcrumb label={parsed.label as string} items={items} />
    </div>
  );
}
