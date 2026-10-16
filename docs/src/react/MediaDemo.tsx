import { useId, useState } from 'react';
import { Select } from 'antd';
import AtlasProvider from './AtlasProvider';
import AtlasMediaFrame, { type AtlasMediaFrameProps } from './AtlasMediaFrame';
import { TweakerSettings } from './AtlasTweaker';
import AtlasScreenshot from './AtlasScreenshot';
import ExamplePreview from './ExamplePreview';
import { useI18n } from './useI18n';

// Local assets only; the missing path demonstrates the unavailable fallback and a retry that fails again.
const missingPhoto = '/selection/missing-photo.svg';
const availablePhoto = '/selection/forest.svg';
// A recorded 1440 by 1000 CSS pixel capture of the Avatar documentation page.
const avatarScreenshot = '/examples/atlas-avatar-desktop.png';

type PhotoSource = 'missing' | 'available';
type MediaFit = NonNullable<AtlasMediaFrameProps['fit']>;

function MediaExamples() {
  const { t } = useI18n();
  const captionTitle = useId();
  const screenshotTitle = useId();
  const unavailableTitle = useId();
  const sourceId = useId();
  const fitId = useId();
  // Presentation only; the example owns both choices, so they survive closing the Tweaker.
  const [src, setSrc] = useState(missingPhoto);
  const [fit, setFit] = useState<MediaFit>('cover');
  const restored = src === availablePhoto;
  return (
    <div className="atlas-media-demo">
      <ExamplePreview id="media-photograph-with-caption" title={t('Photograph with caption')}>
        <section className="atlas-media-section" aria-labelledby={captionTitle}>
          <h3 id={captionTitle}>{t('Photograph with caption')}</h3>
          <div className="atlas-media-gallery">
            <AtlasMediaFrame
              src="/selection/coast.svg"
              alt={t('Coast illustration')}
              caption={t('Cover fills the frame and may crop the edges.')}
              overlay={t('Coast')}
            />
            <AtlasMediaFrame
              src="/selection/city.svg"
              fit="contain"
              ratio="square"
              alt={t('City illustration')}
              caption={t('Contain shows the whole image inside the frame.')}
            />
          </div>
        </section>
      </ExamplePreview>
      <ExamplePreview id="media-recorded-screenshot" title={t('Recorded screenshot')}>
        <section className="atlas-media-section" aria-labelledby={screenshotTitle}>
          <h3 id={screenshotTitle}>{t('Recorded screenshot')}</h3>
          <AtlasScreenshot
            src={avatarScreenshot}
            width={1440}
            height={1000}
            alt={t(
              'Recorded static image of the Atlas Avatar documentation page at 1440 by 1000 CSS pixels. It is not interactive.',
            )}
            caption={t('Recorded Atlas Avatar example')}
          />
        </section>
      </ExamplePreview>
      <ExamplePreview id="media-unavailable-photograph" title={t('Unavailable photograph')}>
        <section className="atlas-media-section" aria-labelledby={unavailableTitle}>
          <h3 id={unavailableTitle}>{t('Unavailable photograph')}</h3>
          <div className="atlas-media-gallery">
            <AtlasMediaFrame
              src={src}
              fit={fit}
              alt={t('Forest illustration')}
              caption={t('The frame keeps its space when the image cannot load.')}
            />
          </div>
          {!restored && (
            <p className="atlas-media-note">
              {t(
                'Retry image requests the same address again. This example path is missing, so the retry fails again.',
              )}
            </p>
          )}
          <TweakerSettings title="Media">
            <div className="atlas-tweaker-token">
              <label htmlFor={sourceId}>{t('Photograph source')}</label>
              <Select<PhotoSource>
                id={sourceId}
                value={restored ? 'available' : 'missing'}
                options={[
                  { value: 'missing', label: t('Missing photograph') },
                  { value: 'available', label: t('Available photograph') },
                ]}
                onChange={next => setSrc(next === 'available' ? availablePhoto : missingPhoto)}
              />
            </div>
            <div className="atlas-tweaker-token">
              <label htmlFor={fitId}>{t('Photograph fit')}</label>
              <Select<MediaFit>
                id={fitId}
                value={fit}
                options={[
                  { value: 'cover', label: t('Cover') },
                  { value: 'contain', label: t('Contain') },
                ]}
                onChange={next => setFit(next)}
              />
            </div>
          </TweakerSettings>
          <p className="atlas-media-status" role="status">
            {restored ? t('Available photograph requested') : t('Missing photograph requested')}
          </p>
        </section>
      </ExamplePreview>
    </div>
  );
}

export default function MediaDemo({ documentation = false }: { documentation?: boolean }) {
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined}>
      <MediaExamples />
    </AtlasProvider>
  );
}
