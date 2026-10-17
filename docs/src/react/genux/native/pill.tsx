import GenUXPill from '../../GenUXPill';
import type { NativeAdapterProps } from '../../../genux/native-contract';
import { definition } from '../../../genux/native/pill';

/** Read-only status: only the validated label and palette index reach GenUXPill. */
export default function NativePill({ data }: NativeAdapterProps) {
  const payload = definition.parse(data);
  const colorIndex = typeof payload.colorIndex === 'number' ? payload.colorIndex : undefined;
  return <GenUXPill colorIndex={colorIndex}>{String(payload.label)}</GenUXPill>;
}
