import GenUXScreenshot from '../../GenUXScreenshot';
import type { NativeAdapterProps } from '../../../genux/native-contract';
import { definition } from '../../../genux/native/screenshot';

/** Read-only: there is no control for disabled, onChange or onAction to drive. */
export default function NativeScreenshot({ data }: NativeAdapterProps) {
  const { src, alt, caption, width, height } = definition.parse(data);
  return <GenUXScreenshot src={src} alt={alt} caption={caption} width={width} height={height} />;
}
