import AtlasProvider from './AtlasProvider';
import AtlasCarousel from './AtlasCarousel';
import { useI18n } from './useI18n';

function CarouselExample() {
  const { t } = useI18n();
  // Local illustrations only; captions are caller text translated here.
  const slides = [
    {
      id: 'coast',
      title: t('Coast'),
      src: '/selection/coast.svg',
      alt: t('Coast illustration'),
      caption: t('A quiet shoreline with waves reaching the sand.'),
    },
    {
      id: 'forest',
      title: t('Forest'),
      src: '/selection/forest.svg',
      alt: t('Forest illustration'),
      caption: t('Tall trees gathered along a hillside.'),
    },
    {
      id: 'city',
      title: t('City'),
      src: '/selection/city.svg',
      alt: t('City illustration'),
      caption: t('Buildings of different heights along a street.'),
    },
  ];
  return <AtlasCarousel label={t('Illustration gallery')} slides={slides} />;
}

export default function CarouselDemo({ documentation = false }: { documentation?: boolean }) {
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined}>
      <CarouselExample />
    </AtlasProvider>
  );
}
