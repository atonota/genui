import { useId, useMemo } from 'react';
import GenUXSplitter, { type GenUXSplitterPanel } from '../../GenUXSplitter';
import type { NativeAdapterProps } from '../../../genux/native-contract';
import { definition, splitterView } from '../../../genux/native/splitter';

/** Runtime-owned sizes on the real GenUXSplitter; panes render plain text only. */
export default function NativeSplitter({ data, disabled, onChange }: NativeAdapterProps) {
  // Model ids repeat across surfaces; the DOM prefix belongs to this mounted instance.
  const instance = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const view = useMemo(() => splitterView(definition.parse(data)), [data]);
  const locked = disabled || view.disabled;

  // Disabled panes pin both limits to the current sizes, GenUXSplitter's own
  // aria-disabled path, instead of hiding the separator.
  const panels = view.panels.map((panel, index) => ({
    id: panel.id,
    label: panel.label,
    min: locked ? view.value[index] : panel.min,
    max: locked ? view.value[index] : panel.max,
    children: <p>{panel.text}</p>,
  })) as unknown as readonly [GenUXSplitterPanel, GenUXSplitterPanel];

  // The runtime value is rendered as-is; interactions only propose candidates.
  return (
    <GenUXSplitter
      id={`genux-splitter-${instance}`}
      label={view.label}
      panels={panels}
      sizes={view.value}
      onSizesChange={sizes => {
        if (!locked) onChange([sizes[0], sizes[1]]);
      }}
    />
  );
}
