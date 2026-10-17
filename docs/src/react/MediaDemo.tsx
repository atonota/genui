import { useId, useState } from 'react';
import { Select } from 'antd';
import GenUXProvider from './GenUXProvider';
import GenUXMediaFrame, { type GenUXMediaFrameProps } from './GenUXMediaFrame';
import { TweakerSettings } from './GenUXTweaker';
import GenUXScreenshot from './GenUXScreenshot';
import ExamplePreview from './ExamplePreview';
import { useI18n } from './useI18n';

// Local assets only; the missing path demonstrates the unavailable fallback and a retry that fails again.
const missingPhoto = '/selection/missing-photo.svg';
const availablePhoto = '/selection/forest.svg';
// A recorded 1440 by 1000 CSS pixel capture of the Avatar documentation page.
const avatarScreenshot = '/examples/genux-avatar-desktop.png';

type PhotoSource = 'missing' | 'available';
type MediaFit = NonNullable<GenUXMediaFrameProps['fit']>;

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
    <div className="genux-media-demo">
      <ExamplePreview id="media-photograph-with-caption" title={t('Photograph with caption')}>
        <section className="genux-media-section" aria-labelledby={captionTitle}>
          <h3 id={captionTitle}>{t('Photograph with caption')}</h3>
          <div className="genux-media-gallery">
            <GenUXMediaFrame
              src="/selection/coast.svg"
              alt={t('Coast illustration')}
              caption={t('Cover fills the frame and may crop the edges.')}
              overlay={t('Coast')}
            />
            <GenUXMediaFrame
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
        <section className="genux-media-section" aria-labelledby={screenshotTitle}>
          <h3 id={screenshotTitle}>{t('Recorded screenshot')}</h3>
          <GenUXScreenshot
            src={avatarScreenshot}
            width={1440}
            height={1000}
            alt={t(
              'Recorded static image of the GenUX Avatar documentation page at 1440 by 1000 CSS pixels. It is not interactive.',
            )}
            caption={t('Recorded GenUX Avatar example')}
          />
        </section>
      </ExamplePreview>
      <ExamplePreview id="media-unavailable-photograph" title={t('Unavailable photograph')}>
        <section className="genux-media-section" aria-labelledby={unavailableTitle}>
          <h3 id={unavailableTitle}>{t('Unavailable photograph')}</h3>
          <div className="genux-media-gallery">
            <GenUXMediaFrame
              src={src}
              fit={fit}
              alt={t('Forest illustration')}
              caption={t('The frame keeps its space when the image cannot load.')}
            />
          </div>
          {!restored && (
            <p className="genux-media-note">
              {t(
                'Retry image requests the same address again. This example path is missing, so the retry fails again.',
              )}
            </p>
          )}
          <TweakerSettings title="Media">
            <div className="genux-tweaker-token">
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
            <div className="genux-tweaker-token">
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
          <p className="genux-media-status" role="status">
            {restored ? t('Available photograph requested') : t('Missing photograph requested')}
          </p>
        </section>
      </ExamplePreview>
    </div>
  );
}

export default function MediaDemo({ documentation = false }: { documentation?: boolean }) {
  return (
    <GenUXProvider appearance={documentation ? 'docs' : undefined}>
      <MediaExamples />
    </GenUXProvider>
  );
}
