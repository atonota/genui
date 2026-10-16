import { useId, useState } from 'react';
import { Select, Switch } from 'antd';
import AtlasProvider from './AtlasProvider';
import AtlasCarousel from './AtlasCarousel';
import ExamplePreview from './ExamplePreview';
import { TweakerSettings } from './AtlasTweaker';
import { useI18n } from './useI18n';

function CarouselExample() {
  const { t } = useI18n();
  const countId = useId();
  const captionsId = useId();
  // AtlasCarousel keeps its own position and clamps it when fewer slides are supplied.
  const [count, setCount] = useState(3);
  const [captions, setCaptions] = useState(true);
  // Local illustrations only; captions are caller text translated here.
  const slides = [
    {
      id: 'coast',
      title: t('Coast'),
      src: '/selection/coast.svg',
      alt: t('Coast illustration'),
      caption: captions ? t('A quiet shoreline with waves reaching the sand.') : undefined,
    },
    {
      id: 'forest',
      title: t('Forest'),
      src: '/selection/forest.svg',
      alt: t('Forest illustration'),
      caption: captions ? t('Tall trees gathered along a hillside.') : undefined,
    },
    {
      id: 'city',
      title: t('City'),
      src: '/selection/city.svg',
      alt: t('City illustration'),
      caption: captions ? t('Buildings of different heights along a street.') : undefined,
    },
  ];
  return (
    <ExamplePreview id="carousel-illustration-gallery" title={t('Illustration gallery')}>
      <TweakerSettings title="Carousel settings">
        <div className="atlas-tweaker-option">
          <label htmlFor={countId}>{t('Slides shown')}</label>
          <Select
            id={countId}
            value={count}
            options={[2, 3].map(value => ({ value, label: String(value) }))}
            onChange={(next: number) => setCount(next)}
          />
        </div>
        <div className="atlas-tweaker-option">
          <label htmlFor={captionsId}>{t('Show captions')}</label>
          <Switch id={captionsId} checked={captions} onChange={setCaptions} />
        </div>
      </TweakerSettings>
      <AtlasCarousel label={t('Illustration gallery')} slides={slides.slice(0, count)} />
    </ExamplePreview>
  );
}

export default function CarouselDemo({ documentation = false }: { documentation?: boolean }) {
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined}>
      <CarouselExample />
    </AtlasProvider>
  );
}
