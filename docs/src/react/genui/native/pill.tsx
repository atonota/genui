import AtlasPill from '../../AtlasPill';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { definition } from '../../../genui/native/pill';

/** Read-only status: only the validated label and palette index reach AtlasPill. */
export default function NativePill({ data }: NativeAdapterProps) {
  const payload = definition.parse(data);
  const colorIndex = typeof payload.colorIndex === 'number' ? payload.colorIndex : undefined;
  return <AtlasPill colorIndex={colorIndex}>{String(payload.label)}</AtlasPill>;
}
