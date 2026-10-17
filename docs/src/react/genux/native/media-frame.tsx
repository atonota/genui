import GenUXMediaFrame, { type GenUXMediaFrameProps } from '../../GenUXMediaFrame';
import type { NativeAdapterProps } from '../../../genux/native-contract';
import { definition } from '../../../genux/native/media-frame';

/** Read-only native image; parse re-validates data, so the casts only narrow checked values. */
export default function MediaFrame({ data }: NativeAdapterProps) {
  const media = definition.parse(data);
  return (
    <GenUXMediaFrame
      src={media.src as string}
      alt={media.alt as string}
      caption={typeof media.caption === 'string' ? media.caption : undefined}
      ratio={media.ratio as GenUXMediaFrameProps['ratio']}
      fit={media.fit as GenUXMediaFrameProps['fit']}
    />
  );
}
