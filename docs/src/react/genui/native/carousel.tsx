import '../../../styles/atlas-media.css';
import '../../../styles/atlas-carousel.css';
import AtlasCarousel from '../../AtlasCarousel';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { definition, readCarousel } from '../../../genui/native/carousel';

/** Read-only adapter: AtlasCarousel owns the ephemeral slide position; nothing is written back. */
export default function Carousel({ data }: NativeAdapterProps) {
  const { label, slides } = readCarousel(definition.parse(data));
  return <AtlasCarousel label={label} slides={slides} />;
}
