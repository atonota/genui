import '../../../styles/atlas-media.css';
import AtlasMediaFrame, { type AtlasMediaFrameProps } from '../../AtlasMediaFrame';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { definition } from '../../../genui/native/media-frame';

/** Read-only native image; parse re-validates data, so the casts only narrow checked values. */
export default function MediaFrame({ data }: NativeAdapterProps) {
  const media = definition.parse(data);
  return (
    <AtlasMediaFrame
      src={media.src as string}
      alt={media.alt as string}
      caption={typeof media.caption === 'string' ? media.caption : undefined}
      ratio={media.ratio as AtlasMediaFrameProps['ratio']}
      fit={media.fit as AtlasMediaFrameProps['fit']}
    />
  );
}
