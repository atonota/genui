import GenUXCarousel from '../../GenUXCarousel';
import type { NativeAdapterProps } from '../../../genux/native-contract';
import { definition, readCarousel } from '../../../genux/native/carousel';

/** Read-only adapter: GenUXCarousel owns the ephemeral slide position; nothing is written back. */
export default function Carousel({ data }: NativeAdapterProps) {
  const { label, slides } = readCarousel(definition.parse(data));
  return <GenUXCarousel label={label} slides={slides} />;
}
