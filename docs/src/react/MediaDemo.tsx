import { useId, useState } from 'react';
import AtlasProvider from './AtlasProvider';
import AtlasButton from './AtlasButton';
import AtlasMediaFrame from './AtlasMediaFrame';
import AtlasScreenshot from './AtlasScreenshot';
import { useI18n } from './useI18n';

// Local assets only; the missing path demonstrates the unavailable fallback and a retry that fails again.
const missingPhoto = '/selection/missing-photo.svg';
const availablePhoto = '/selection/forest.svg';
// A recorded 1440 by 1000 CSS pixel capture of the Avatar documentation page.
const avatarScreenshot = '/examples/atlas-avatar-desktop.png';

function MediaExamples() {
  const { t } = useI18n();
  const captionTitle = useId();
  const screenshotTitle = useId();
  const unavailableTitle = useId();
  const [src, setSrc] = useState(missingPhoto);
  const restored = src === availablePhoto;
  return (
    <div className="atlas-media-demo">
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
      <section className="atlas-media-section" aria-labelledby={unavailableTitle}>
        <h3 id={unavailableTitle}>{t('Unavailable photograph')}</h3>
        <div className="atlas-media-gallery">
          <AtlasMediaFrame
            src={src}
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
        <AtlasButton
          text={restored ? t('Use missing photograph') : t('Use available photograph')}
          onClick={() => setSrc(restored ? missingPhoto : availablePhoto)}
        />
        <p className="atlas-media-status" role="status">
          {restored ? t('Available photograph requested') : t('Missing photograph requested')}
        </p>
      </section>
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
