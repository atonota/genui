import AtlasPagination from '../../AtlasPagination';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { definition } from '../../../genui/native/pagination';

/** Runtime-controlled page; size changes and jump drafts stay off because only the page is stored. */
export default function NativePagination({ data, disabled, onChange }: NativeAdapterProps) {
  const payload = definition.parse(data);
  const locked = disabled || payload.disabled === true || payload.readOnly === true;
  return (
    <AtlasPagination
      current={payload.value as number}
      total={payload.total as number}
      pageSize={payload.pageSize as number}
      label={typeof payload.label === 'string' ? payload.label : undefined}
      disabled={locked || undefined}
      showSizeChanger={false}
      showQuickJumper={false}
      onChange={page => {
        if (!locked) onChange(page);
      }}
    />
  );
}
