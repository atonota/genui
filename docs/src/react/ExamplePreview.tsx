/// <reference types="vite/client" />
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
import AtlasButton from './AtlasButton';
import AtlasSegmented from './AtlasSegmented';
import AtlasIcon from './AtlasIcon';
import { useAtlasAppearance } from './AtlasAppearance';
import { useI18n } from './useI18n';
import {
  getServerThemeSnapshot,
  getThemeSnapshot,
  setTheme,
  subscribeTheme,
  type ThemeMode,
} from '../theme';
import {
  DEFAULT_PREVIEW_DEVICE,
  previewDeviceDefinition,
  previewDevices,
  previewDeviceVariables,
  type PreviewDevice,
} from '../data/preview-devices';

export type ExamplePreviewProps = {
  /** Literal, globally unique kebab-case id prefixed with the component route. */
  id: string;
  /** Canonical English title; translated here. */
  title: string;
  children: ReactNode;
};

type ExampleView = 'preview' | 'code';
type PreviewCode = { id: string; code: string; sourcePath: string; sourceUrl: string };
type SourceState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; payload: PreviewCode };
type CopyState = 'idle' | 'copied' | 'failed';

// Decorative 24×24 outline pictograms for the icon-only device options.
const deviceGlyphs: Record<PreviewDevice, string> = {
  iphone:
    'M9.5 2.75h5A2.5 2.5 0 0 1 17 5.25v13.5a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 7 18.75V5.25a2.5 2.5 0 0 1 2.5-2.5ZM10.75 5.5h2.5',
  ipad: 'M6.5 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM12 5.75h.01',
  macbook:
    'M4 15.5V6a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 6v9.5M2 15.5h20V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2ZM12 6.75h.01',
};
// Every option keeps the shared target height through the wrapper's own height role.
const controlStyle = { '--atlas-segmented-height': 'var(--preview-control-size)' } as CSSProperties;

function DeviceGlyph({ device }: { device: PreviewDevice }) {
  return (
    <svg
      className="example-preview-glyph"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={deviceGlyphs[device]} />
    </svg>
  );
}

/** Icon-only option: the translated name stays the radio's single, visually hidden label. */
function IconOption({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="example-preview-option">
      {icon}
      <span className="example-preview-sr-only">{label}</span>
    </span>
  );
}

const SOURCE_ROOT = 'docs/src/react/';
// Layout effects apply inert before paint in the browser; the server has no DOM to update.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Build-time payload under the deployed base, so the Pages subpath prefix is kept. */
function previewCodeUrl(id: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}preview-code/${encodeURIComponent(id)}.json`;
}

/** Only TSX files under the fixed docs/src/react allowlist may be shown as source. */
function isAllowedSourcePath(path: string): boolean {
  return (
    path.startsWith(SOURCE_ROOT) &&
    path.endsWith('.tsx') &&
    path
      .split('/')
      .every(segment => segment !== '.' && segment !== '..' && /^[A-Za-z0-9_.-]+$/.test(segment))
  );
}

function isSafeSourceUrl(url: string): boolean {
  return (
    url.trim() === url &&
    !url.includes(' ') &&
    (url.startsWith('https://') || (url.startsWith('/') && !url.startsWith('//')))
  );
}

/** Rejects payloads for another wrapper, outside the source allowlist or without code. */
function parsePreviewCode(value: unknown, id: string): PreviewCode {
  if (value === null || typeof value !== 'object')
    throw new TypeError('Preview code payload must be an object.');
  const payload = value as Record<string, unknown>;
  if (payload.id !== id) throw new TypeError(`Preview code payload is not for ${id}.`);
  if (typeof payload.code !== 'string' || payload.code.trim() === '')
    throw new TypeError('Preview code payload has no source code.');
  if (typeof payload.sourcePath !== 'string' || !isAllowedSourcePath(payload.sourcePath))
    throw new TypeError('Preview code source path is outside the allowlist.');
  if (typeof payload.sourceUrl !== 'string' || !isSafeSourceUrl(payload.sourceUrl))
    throw new TypeError('Preview code source URL is not allowed.');
  return { id, code: payload.code, sourcePath: payload.sourcePath, sourceUrl: payload.sourceUrl };
}

/** Shared documentation workbench: per-group device and view, shell-wide theme, lazy source. */
export default function ExamplePreview({ id, title, children }: ExamplePreviewProps) {
  const appearance = useAtlasAppearance();
  // Storybook and approved consumers render the demo unchanged.
  if (appearance !== 'docs') return <>{children}</>;
  return (
    <PreviewWorkbench id={id} title={title}>
      {children}
    </PreviewWorkbench>
  );
}

function PreviewWorkbench({ id, title, children }: ExamplePreviewProps) {
  const { t } = useI18n();
  const titleId = `${useId()}-title`;
  // Device and view stay per group; the theme is the one shell theme for every group.
  const [device, setDevice] = useState<PreviewDevice>(DEFAULT_PREVIEW_DEVICE);
  const [view, setView] = useState<ExampleView>('preview');
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);
  const [source, setSource] = useState<SourceState>({ status: 'idle' });
  const [copy, setCopy] = useState<CopyState>('idle');
  // Only the latest request may settle the source state.
  const request = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const codePanelRef = useRef<HTMLDivElement>(null);
  // The inactive view leaves pointer and focus order in the same commit as the view change.
  useIsomorphicLayoutEffect(() => {
    stageRef.current?.toggleAttribute('inert', view === 'code');
    codePanelRef.current?.toggleAttribute('inert', view !== 'code');
  }, [view]);

  const loadSource = useCallback(() => {
    const current = ++request.current;
    setSource({ status: 'loading' });
    setCopy('idle');
    fetch(previewCodeUrl(id), { headers: { Accept: 'application/json' } })
      .then(response => {
        if (!response.ok) throw new Error(`Preview code request failed with ${response.status}.`);
        return response.json() as Promise<unknown>;
      })
      .then(payload => {
        const parsed = parsePreviewCode(payload, id);
        if (current === request.current) setSource({ status: 'ready', payload: parsed });
      })
      .catch(() => {
        if (current === request.current) setSource({ status: 'error' });
      });
  }, [id]);

  // The source is requested only when Code is chosen, never on the initial render.
  const changeView = (next: ExampleView) => {
    setView(next);
    if (next === 'code' && (source.status === 'idle' || source.status === 'error')) loadSource();
  };

  // Success is reported only after the clipboard promise resolves.
  const copyCode = (code: string) => {
    setCopy('idle');
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(code))
      .then(
        () => setCopy('copied'),
        () => setCopy('failed'),
      );
  };

  const payload = source.status === 'ready' ? source.payload : undefined;
  return (
    <div
      className="example-preview"
      role="group"
      aria-labelledby={titleId}
      data-example-preview={id}
      data-preview-view={view}
    >
      <div className="example-preview-toolbar">
        <p className="example-preview-title" id={titleId}>
          {t(title)}
        </p>
        <div className="example-preview-controls">
          {/* One Tab stop per radiogroup: the checked native radio; the root leaves the order. */}
          <AtlasSegmented<PreviewDevice>
            aria-label={t('Device preview')}
            tabIndex={-1}
            size="sm"
            style={controlStyle}
            value={device}
            onChange={setDevice}
            options={previewDevices.map(item => ({
              value: item.value,
              label: (
                <IconOption icon={<DeviceGlyph device={item.value} />} label={t(item.label)} />
              ),
            }))}
          />
          <AtlasSegmented<ThemeMode>
            aria-label={t('Preview theme')}
            tabIndex={-1}
            size="sm"
            style={controlStyle}
            value={theme}
            onChange={setTheme}
            options={[
              {
                value: 'light',
                label: <IconOption icon={<AtlasIcon name="sun" />} label={t('Light')} />,
              },
              {
                value: 'dark',
                label: <IconOption icon={<AtlasIcon name="moon" />} label={t('Dark')} />,
              },
            ]}
          />
          <AtlasSegmented<ExampleView>
            aria-label={t('Example view')}
            tabIndex={-1}
            size="sm"
            style={controlStyle}
            value={view}
            onChange={changeView}
            options={[
              { value: 'preview', label: t('Preview') },
              { value: 'code', label: t('Code') },
            ]}
          />
        </div>
      </div>
      {/* Both views stay mounted in one cell. The inactive one is aria-hidden and inert at once
          and fades out with the central motion; device changes restyle the same frame. */}
      <div className="example-preview-views">
        <div
          ref={stageRef}
          className="example-preview-stage"
          data-preview-active={view === 'preview'}
          aria-hidden={view === 'code' || undefined}
        >
          {/* Quiet caption naming the selected device and shell theme, above the frame so the
              choice shows without scrolling; the frame stays a bounded illustration and never
              promises a viewport width. */}
          <p className="example-preview-caption">
            <span>{t(previewDeviceDefinition(device).label)}</span>{' '}
            <span aria-hidden="true">·</span> <span>{t(theme === 'light' ? 'Light' : 'Dark')}</span>
          </p>
          <div
            className="example-preview-device"
            data-preview-device={device}
            style={previewDeviceVariables(device) as CSSProperties}
          >
            <div className="example-preview-bezel">
              <div className="example-preview-screen" data-preview-device={device}>
                {children}
              </div>
            </div>
            <span className="example-preview-base" aria-hidden="true" />
          </div>
        </div>
        {/* Empty until Code is first chosen; the source stays lazily fetched. */}
        <div
          ref={codePanelRef}
          className="example-preview-code-panel"
          data-preview-active={view === 'code'}
          aria-hidden={view === 'preview' || undefined}
        >
          {payload ? (
            <div className="example-preview-editor">
              <div className="example-preview-source">
                <p className="example-preview-source-label">
                  <span>{t('Source excerpt')}</span>{' '}
                  <a href={payload.sourceUrl}>{payload.sourcePath}</a>
                </p>
                <AtlasButton
                  fill="outline"
                  text={t('Copy code')}
                  onClick={() => copyCode(payload.code)}
                />
              </div>
              <pre
                className="example-preview-code"
                role="region"
                tabIndex={0}
                aria-label={t('Source code')}
              >
                <code>{payload.code}</code>
              </pre>
            </div>
          ) : source.status === 'error' ? (
            <div className="example-preview-message" role="alert">
              <p>{t('Source could not be loaded.')}</p>
              <AtlasButton fill="outline" text={t('Retry')} onClick={loadSource} />
            </div>
          ) : source.status === 'loading' ? (
            <p className="example-preview-message" role="status">
              {t('Loading source…')}
            </p>
          ) : null}
          <p className="example-preview-status" role="status">
            {copy === 'copied'
              ? t('Code copied.')
              : copy === 'failed'
                ? t('Code could not be copied.')
                : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
