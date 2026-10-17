/// <reference types="vite/client" />
import { useEffect, useRef, useState } from 'react';
import GenUXButton from './GenUXButton';
import { useI18n } from './useI18n';
import type { ThemeMode } from '../theme';
import type { PreviewOrientation } from '../data/preview-devices';
import { previewProfiles, type PreviewProfile } from '../preview/profiles';
import { previewDeliveryUsage } from '../preview/delivery-contract';

// Read-only Code view for ExamplePreview. The build-time payload from
// pages/preview-code/[id].json.ts is fetched only while Code is active, cached per id and
// rendered as escaped text: nothing is evaluated, highlighted or injected as HTML. Usage is
// built from the id, slug and preview configuration only, never from the demo's own state.
type Source = { code: string; sourcePath: string; sourceUrl: string };
type Delivery = Source & { usage: string };
type Payload = Source & {
  id: string;
  slug: string;
  deliveries: Record<PreviewProfile, Delivery>;
};
/** The workbench's current preview configuration; demo values and state are never part of it. */
export type PreviewSettings = {
  theme: ThemeMode;
  orientation: PreviewOrientation;
  grid: boolean;
};
type View = { id: string; status: 'loading' | 'ready' | 'error'; payload?: Payload };

const base = import.meta.env.BASE_URL.replace(/[/]$/, '');
const segment = '[A-Za-z0-9_][A-Za-z0-9_.-]*';
const sourcePathPattern = new RegExp(`^docs/src/react/(?:${segment}/)*${segment}[.]tsx$`);

// Links must be this site's own published copy of the same path, as sourceHref builds it.
const isSourceUrl = (value: unknown, sourcePath: string) => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value, window.location.href);
    const path = sourcePath.slice('docs/'.length).split('/').map(encodeURIComponent).join('/');
    return (
      url.origin === window.location.origin &&
      !url.search &&
      !url.hash &&
      url.pathname === `${base}/source/${path}.txt`
    );
  } catch {
    return false;
  }
};

const isSource = (value: unknown): value is Source => {
  const source = value as Partial<Source> | null;
  return (
    typeof source === 'object' &&
    source !== null &&
    typeof source.code === 'string' &&
    source.code.trim() !== '' &&
    typeof source.sourcePath === 'string' &&
    sourcePathPattern.test(source.sourcePath) &&
    isSourceUrl(source.sourceUrl, source.sourcePath)
  );
};

const parsePayload = (data: unknown, id: string): Payload | undefined => {
  if (!isSource(data) || (data as Partial<Payload>).id !== id) return undefined;
  const { slug, deliveries } = data as Partial<Payload>;
  if (typeof slug !== 'string' || slug.trim() === '') return undefined;
  if (typeof deliveries !== 'object' || deliveries === null) return undefined;
  const valid = previewProfiles.every(profile => {
    const delivery: unknown = deliveries[profile];
    return isSource(delivery) && typeof (delivery as Partial<Delivery>).usage === 'string';
  });
  return valid ? (data as Payload) : undefined;
};

type BlockProps = {
  title: string;
  note?: string;
  source: Source;
  copyLabel: string;
  onCopy: () => void;
};

function SourceBlock({ title, note, source, copyLabel, onCopy }: BlockProps) {
  const { t } = useI18n();
  return (
    <div className="preview-source-block">
      <h3>{title}</h3>
      {note && <p>{note}</p>}
      <p>
        <code>{source.sourcePath}</code>
      </p>
      <pre>
        <code>{source.code}</code>
      </pre>
      <GenUXButton text={copyLabel} fill="outline" onClick={onCopy} />
      <a href={source.sourceUrl}>{t('Open source file')}</a>
    </div>
  );
}

type Props = { id: string; profile: PreviewProfile; settings: PreviewSettings; active: boolean };

export default function PreviewSource({ id, profile, settings, active }: Props) {
  const { t } = useI18n();
  const cache = useRef(new Map<string, Payload>());
  const [view, setView] = useState<View>();
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (!active) return;
    const cached = cache.current.get(id);
    if (cached) {
      setView({ id, status: 'ready', payload: cached });
      return;
    }
    const controller = new AbortController();
    setView({ id, status: 'loading' });
    fetch(`${base}/preview-code/${encodeURIComponent(id)}.json`, {
      signal: controller.signal,
      credentials: 'same-origin',
    })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then(data => {
        if (controller.signal.aborted) return;
        const payload = parsePayload(data, id);
        if (!payload) throw new Error(`Invalid preview code payload for ${id}`);
        cache.current.set(id, payload);
        setView({ id, status: 'ready', payload });
      })
      .catch(() => {
        if (!controller.signal.aborted) setView({ id, status: 'error' });
      });
    return () => controller.abort();
  }, [id, active]);

  const { theme, orientation, grid } = settings;
  useEffect(() => setCopied(''), [id, profile, theme, orientation, grid]);

  if (!active) return null;
  // A view left over from another id is stale and never shown.
  const current = view?.id === id ? view : undefined;
  if (!current?.payload)
    return (
      <p role="status">
        {current?.status === 'error'
          ? t('Source code could not be loaded.')
          : t('Loading source code')}
      </p>
    );
  const { payload } = current;
  const delivery = payload.deliveries[profile];
  const copy = (label: string, text: string) =>
    void navigator.clipboard?.writeText(text).then(
      () => setCopied(label),
      () => setCopied(t('Copy failed')),
    );
  // Usage resolves against this site's own base, so a local build references its local entry.
  const siteBase = new URL(`${base}/`, window.location.origin).href;
  const usage = previewDeliveryUsage(
    profile,
    { id: payload.id, slug: payload.slug, ...settings },
    siteBase,
  );
  return (
    <section role="region" aria-label={t('Source code')} className="preview-source">
      <div className="preview-source-block">
        <h3>{t('Preview usage')}</h3>
        <p>
          {t('Theme')}: <code>{theme}</code> · {t('Orientation')}: <code>{orientation}</code> ·{' '}
          {t('Grid')}: <code>{String(grid)}</code>
        </p>
        <p>
          {t(
            'Usage reflects only the preview configuration (theme, orientation, grid), not values or state inside the example.',
          )}
        </p>
        <p>
          {t(
            'This code renders the selected profile on the page through an internal repository entry and requires the canonical documentation styles, so it works only inside this repository. Use Open alone for a standalone view and the Integration tab for the public product API.',
          )}{' '}
          <a href="#code">{t('Go to Integration usage code')}</a>
        </p>
        <p>{t('Usage')} · React TSX</p>
        <pre>
          <code>{usage}</code>
        </pre>
        <GenUXButton
          text={t('Copy usage code')}
          fill="outline"
          onClick={() => copy(t('Usage code copied'), usage)}
        />
      </div>
      <SourceBlock
        title={`${t('Profile entry')}: ${profile}`}
        source={delivery}
        copyLabel={t('Copy profile entry')}
        onCopy={() => copy(t('Profile entry copied'), delivery.code)}
      />
      <SourceBlock
        title={t('Shared example source excerpt')}
        note={t('Excerpt of the shared example source; not a standalone complete example.')}
        source={payload}
        copyLabel={t('Copy shared excerpt')}
        onCopy={() => copy(t('Shared excerpt copied'), payload.code)}
      />
      <p role="status">{copied}</p>
    </section>
  );
}
