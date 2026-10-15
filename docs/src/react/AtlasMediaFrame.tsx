import { useEffect, useId, useRef, useState } from 'react';
import AtlasButton from './AtlasButton';
import { useI18n } from './useI18n';

export type AtlasMediaFrameProps = {
  src?: string;
  /** Text alternative; an empty string marks a decorative image. */
  alt: string;
  caption?: string;
  fit?: 'cover' | 'contain';
  ratio?: 'landscape' | 'square' | 'portrait';
  /** Short text shown on an opaque panel over the image. */
  overlay?: string;
};

type ImageState = 'none' | 'loading' | 'loaded' | 'error';

/**
 * Settles a successful load. A retry button that still holds focus is about to unmount,
 * so focus moves to the figure first; focus anywhere else stays where the user put it.
 */
function completeLoad(
  fallback: HTMLElement | null,
  figure: HTMLElement | null,
  setState: (state: ImageState) => void,
) {
  const button = fallback?.querySelector('button');
  if (button && button === button.ownerDocument.activeElement) {
    figure?.focus({ preventScroll: true });
  }
  setState('loaded');
}

/** Native figure whose frame reserves its ratio before the image loads or fails. */
export default function AtlasMediaFrame({
  src,
  alt,
  caption,
  fit = 'cover',
  ratio = 'landscape',
  overlay,
}: AtlasMediaFrameProps) {
  const { t } = useI18n();
  const source = src?.trim() ? src : undefined;
  const image = useRef<HTMLImageElement>(null);
  const figure = useRef<HTMLElement>(null);
  const fallback = useRef<HTMLDivElement>(null);
  const captionId = useId();
  const [requested, setRequested] = useState(source);
  const [state, setState] = useState<ImageState>(source === undefined ? 'none' : 'loading');
  // Explicit retries of the current source; part of the img key so a retry remounts it.
  const [retries, setRetries] = useState(0);
  // A new source clears the previous result and its retries; the keyed img requests it.
  if (requested !== source) {
    setRequested(source);
    setState(source === undefined ? 'none' : 'loading');
    setRetries(0);
  }
  useEffect(() => {
    const node = image.current;
    // A server-rendered image can settle before hydration attaches its handlers.
    if (!node?.complete) return;
    let current = true;
    node.decode().then(
      () => {
        if (current) completeLoad(fallback.current, figure.current, setState);
      },
      () => {
        if (current) setState('error');
      },
    );
    return () => {
      current = false;
    };
  }, [source, retries]);
  const decorative = alt.trim() === '';
  // While a retry loads, the fallback and its button stay, so focus is not dropped.
  const retrying = retries > 0 && state === 'loading';
  const unavailable = state === 'none' || state === 'error' || retrying;
  const canRetry = source !== undefined && (state === 'error' || retrying);
  const retry = () => {
    // Only a failed request is retried, and the same src is requested again unchanged.
    if (state !== 'error') return;
    setRetries(count => count + 1);
    setState('loading');
  };
  const retryStatus =
    state === 'loaded'
      ? t('Image loaded')
      : retrying
        ? t('Retrying image')
        : t('Image still unavailable');
  return (
    <figure
      ref={figure}
      className="atlas-media"
      tabIndex={-1}
      aria-labelledby={caption ? captionId : undefined}
      aria-label={caption ? undefined : decorative ? t('Image') : alt}
      data-fit={fit}
      data-ratio={ratio}
      data-image-state={state}
    >
      <div className="atlas-media-frame">
        {source !== undefined && state !== 'error' && (
          <img
            key={`${source}#${retries}`}
            ref={image}
            className="atlas-media-image"
            src={source}
            alt={decorative ? '' : alt}
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={() => completeLoad(fallback.current, figure.current, setState)}
            onError={() => setState('error')}
          />
        )}
        {unavailable && (
          <div ref={fallback} className="atlas-media-fallback">
            <div className="atlas-media-fallback-text" aria-hidden={decorative || undefined}>
              <p>{t('Image unavailable')}</p>
              {!decorative && <p className="atlas-media-fallback-detail">{alt}</p>}
            </div>
            {/* Outside the hidden text, so the button stays named and reachable. */}
            {canRetry && <AtlasButton text={t('Retry image')} onClick={retry} />}
          </div>
        )}
        {overlay && <p className="atlas-media-overlay">{overlay}</p>}
      </div>
      {retries > 0 && (
        <p className="atlas-media-retry-status" role="status">
          {retryStatus}
        </p>
      )}
      {caption && (
        <figcaption id={captionId} className="atlas-media-caption">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
