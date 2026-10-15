import { useId, useState } from 'react';
import { useI18n } from './useI18n';

export interface AtlasScreenshotProps {
  /** Screenshot address. Empty values and failed loads show the fallback. */
  src: string;
  /** Text alternative that says what the recording shows. */
  alt: string;
  /** Visible caption; it also names the scroll region. */
  caption: string;
  /** Original CSS width of the recording. */
  width: number;
  /** Original CSS height of the recording. */
  height: number;
}

const positiveExtent = (value: number) => Number.isFinite(value) && value > 0;

/**
 * A recorded screenshot shown at its original CSS size. The image is never
 * scaled to fit; a bounded region scrolls in both directions instead, so the
 * recorded text stays readable.
 */
export default function AtlasScreenshot({
  src,
  alt,
  caption,
  width,
  height,
}: AtlasScreenshotProps) {
  const { t } = useI18n();
  const captionId = useId();
  const helpId = useId();
  // A new src, including a return to one that failed earlier, clears the failure during
  // render, so it gets a fresh attempt without an effect; the image is keyed by src too.
  // A failure before hydration fires no onError, so the ref also checks the settled image.
  const [failedSrc, setFailedSrc] = useState<string>();
  const [requestedSrc, setRequestedSrc] = useState(src);
  if (requestedSrc !== src) {
    setRequestedSrc(src);
    setFailedSrc(undefined);
  }
  const available =
    Boolean(src) && positiveExtent(width) && positiveExtent(height) && failedSrc !== src;
  return (
    <figure
      className="atlas-screenshot"
      data-screenshot-state={available ? 'available' : 'unavailable'}
    >
      {available ? (
        <div
          className="atlas-screenshot-scroll"
          role="region"
          tabIndex={0}
          aria-labelledby={captionId}
          aria-describedby={helpId}
        >
          <img
            key={src}
            loading="lazy"
            src={src}
            alt={alt}
            width={width}
            height={height}
            style={{ width, height }}
            decoding="async"
            ref={image => {
              if (image?.complete && image.naturalWidth === 0) setFailedSrc(src);
            }}
            onError={() => setFailedSrc(src)}
          />
        </div>
      ) : (
        <div className="atlas-screenshot-fallback">
          <p>{t('Screenshot unavailable')}</p>
          {alt && <p>{alt}</p>}
        </div>
      )}
      <figcaption>
        <span id={captionId}>{caption}</span>
        {available && (
          <span id={helpId} className="atlas-screenshot-help">
            {t(
              'Shown at its original size so the text stays readable. Scroll inside the frame to see the rest.',
            )}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
