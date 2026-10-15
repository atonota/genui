import '../../../styles/atlas-media.css';
import '../../../styles/atlas-screenshot.css';
import AtlasScreenshot from '../../AtlasScreenshot';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { definition } from '../../../genui/native/screenshot';

/** Read-only: there is no control for disabled, onChange or onAction to drive. */
export default function NativeScreenshot({ data }: NativeAdapterProps) {
  const { src, alt, caption, width, height } = definition.parse(data);
  return <AtlasScreenshot src={src} alt={alt} caption={caption} width={width} height={height} />;
}
