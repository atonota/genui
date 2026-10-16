import { useMemo } from 'react';
import AtlasCascader from '../../AtlasCascader';
import type { AtlasCascadeOption } from '../../AtlasCascader';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { definition } from '../../../genui/native/cascader';

/**
 * Controlled adapter: the runtime owns the value. Single clearing reports null;
 * multiple reports leaf paths only (never a collapsed parent) and clears to [].
 */
export default function NativeCascader({ data, disabled, onChange }: NativeAdapterProps) {
  const payload = useMemo(() => definition.parse(data), [data]);
  const common = {
    label: payload.label as string,
    options: payload.options as unknown as readonly AtlasCascadeOption[],
    placeholder: payload.placeholder as string | undefined,
    help: payload.help as string | undefined,
    selectionLabel: payload.selectionLabel as 'path' | 'leaf' | undefined,
    disabled: disabled || payload.disabled === true || payload.readOnly === true,
  };
  if (payload.multiple === true)
    return (
      <AtlasCascader
        {...common}
        multiple
        checkedStrategy="child"
        value={payload.value as string[][]}
        onChange={next => onChange(next)}
      />
    );
  const value = payload.value as string[] | null;
  return (
    <AtlasCascader
      {...common}
      value={value ?? []}
      onChange={next => onChange(next.length ? next : null)}
    />
  );
}
