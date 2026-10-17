import { Collapse } from 'antd';
import type { NativeAdapterProps } from '../../../genux/native-contract';
import { readAccordion } from '../../../genux/native/accordion';

export default function GenUXAccordion({ data, disabled, onChange }: NativeAdapterProps) {
  const view = readAccordion(data);
  const locked = disabled || view.disabled;
  const disabledIds = new Set(view.items.filter(item => item.disabled).map(item => item.id));
  return (
    <Collapse
      activeKey={view.value}
      collapsible={locked ? 'disabled' : undefined}
      items={view.items.map(item => ({
        key: item.id,
        label: item.title,
        children: item.body,
        collapsible: item.disabled ? 'disabled' : undefined,
      }))}
      onChange={keys => {
        const next = (Array.isArray(keys) ? keys : [keys]).map(String);
        if (locked || next.some(id => disabledIds.has(id))) return;
        onChange(next);
      }}
    />
  );
}
