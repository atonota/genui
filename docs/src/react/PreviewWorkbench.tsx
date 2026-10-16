import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import AtlasButton from './AtlasButton';
import AtlasSegmented from './AtlasSegmented';
import AtlasIcon from './AtlasIcon';
import DeviceFrame, { type DeviceFrameZoom } from './DeviceFrame';
import PreviewSource from './PreviewSource';
import { usePreviewFrame } from './usePreviewFrame';
import { useI18n } from './useI18n';
import type { ThemeMode } from '../theme';
import { previewProfileForDevice, type PreviewProfile } from '../preview/profiles';
import {
  previewDeviceDefinition,
  previewDevices,
  previewScreen,
  type PreviewDevice,
} from '../data/preview-devices';

export type PreviewWorkbenchProps = { id: string; title: string };
type ExampleView = 'preview' | 'code';

// Decorative 24×24 outline pictograms for the icon-only device options.
const deviceGlyphs: Record<PreviewDevice, string> = {
  iphone:
    'M9.5 2.75h5A2.5 2.5 0 0 1 17 5.25v13.5a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 7 18.75V5.25a2.5 2.5 0 0 1 2.5-2.5ZM10.75 5.5h2.5',
  ipad: 'M6.5 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM12 5.75h.01',
  macbook:
    'M4 15.5V6a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 6v9.5M2 15.5h20V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2ZM12 6.75h.01',
};
// Illustrative class names only; no hardware or viewport claim.
const deviceLabels: Record<PreviewDevice, string> = {
  iphone: 'iPhone 18',
  ipad: 'iPad mini',
  macbook: 'MacBook 13',
};
const profileLabels: Record<PreviewProfile, string> = {
  large: 'Large profile',
  medium: 'Medium profile',
  small: 'Small profile',
};
// Every option keeps the shared target height through the wrapper's own height role.
const controlStyle = { '--atlas-segmented-height': 'var(--preview-control-size)' } as CSSProperties;
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

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

/** One example in one isolated preview document. Expand reuses the same dialog, DeviceFrame
    and iframe browsing context; nothing is remounted or reparented. */
export default function PreviewWorkbench({ id, title }: PreviewWorkbenchProps) {
  const { t } = useI18n();
  const titleId = `${useId()}-title`;
  const frame = usePreviewFrame({ id, title });
  const [view, setView] = useState<ExampleView>('preview');
  const [zoom, setZoom] = useState<DeviceFrameZoom>('fit');
  const [scale, setScale] = useState(100);
  const [expanded, setExpanded] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const codePanelRef = useRef<HTMLDivElement>(null);
  // Close events queued by our own mode switches are not user closes.
  const ownCloses = useRef(0);
  const profile = previewProfileForDevice(frame.device);
  const screen = previewScreen(frame.device, frame.orientation);
  const rotatable = previewDeviceDefinition(frame.device).rotatable;

  useIsomorphicLayoutEffect(() => {
    stageRef.current?.toggleAttribute('inert', view === 'code');
    codePanelRef.current?.toggleAttribute('inert', view !== 'code');
  }, [view]);

  // The Inspector's settings action asks this example to show its Preview.
  useEffect(() => {
    const show = (event: Event) => {
      if ((event as CustomEvent<{ id?: unknown } | null>).detail?.id === id) setView('preview');
    };
    document.addEventListener('genui-preview-show', show);
    return () => document.removeEventListener('genui-preview-show', show);
  }, [id]);

  // showModal requires a closed dialog, so each switch closes first and suppresses that close.
  const present = (modal: boolean) => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (dialog.open) {
      ownCloses.current += 1;
      dialog.close();
    }
    if (modal) dialog.showModal();
    else dialog.show();
    setExpanded(modal);
    if (!modal)
      dialog.querySelector<HTMLElement>('[data-preview-expand]')?.focus({ preventScroll: true });
  };

  const caption = (
    <p className="example-preview-caption">
      {t('Logical screen')} {`${screen.widthPx}×${screen.heightPx}`} ·{' '}
      {t(deviceLabels[frame.device])} · {t(profileLabels[profile])} ·{' '}
      {t(frame.theme === 'light' ? 'Light' : 'Dark')} · {`${scale}%`}
    </p>
  );

  return (
    <dialog
      ref={dialogRef}
      open
      className="example-preview"
      role={expanded ? undefined : 'group'}
      aria-modal={expanded || undefined}
      aria-labelledby={titleId}
      data-example-preview={id}
      data-preview-mode={view}
      data-preview-view={view}
      data-preview-profile={profile}
      data-preview-device={frame.device}
      data-preview-orientation={screen.orientation}
      data-preview-expanded={String(expanded)}
      onPointerDown={() => frame.focus()}
      onFocusCapture={() => frame.focus()}
      onCancel={event => {
        event.preventDefault();
        if (expanded) present(false);
      }}
      onClose={() => {
        if (ownCloses.current > 0) ownCloses.current -= 1;
        else present(false);
      }}
    >
      <div className="example-preview-toolbar">
        <p className="example-preview-title" id={titleId}>
          {t(title)}
        </p>
        {/* One Tab stop per radiogroup: the checked native radio; the root leaves the order. */}
        <AtlasSegmented<ExampleView>
          className="example-preview-view-tabs"
          aria-label={t('Example view')}
          tabIndex={-1}
          size="sm"
          style={controlStyle}
          value={view}
          onChange={setView}
          options={[
            { value: 'preview', label: t('Preview') },
            { value: 'code', label: t('Code') },
          ]}
        />
        {view === 'preview' && (
          <div className="example-preview-settings">
            <AtlasSegmented<PreviewDevice>
              aria-label={t('Device preview')}
              tabIndex={-1}
              size="sm"
              style={controlStyle}
              value={frame.device}
              onChange={frame.setDevice}
              options={previewDevices.map(item => ({
                value: item.value,
                label: (
                  <IconOption
                    icon={<DeviceGlyph device={item.value} />}
                    label={t(deviceLabels[item.value])}
                  />
                ),
              }))}
            />
            <AtlasSegmented<ThemeMode>
              aria-label={t('Preview theme')}
              tabIndex={-1}
              size="sm"
              style={controlStyle}
              value={frame.theme}
              onChange={frame.setTheme}
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
            <AtlasButton
              fill="outline"
              size="sm"
              text={t('Actual size 1:1')}
              aria-pressed={zoom === 'actual'}
              onClick={() => setZoom(zoom === 'fit' ? 'actual' : 'fit')}
            />
            <AtlasButton
              fill="outline"
              size="sm"
              text={t('Grid')}
              aria-pressed={frame.grid}
              onClick={() => frame.setGrid(!frame.grid)}
            />
            <AtlasButton
              fill="outline"
              size="sm"
              text={t('Rotate')}
              disabled={!rotatable}
              onClick={() => frame.rotate()}
            />
            <AtlasButton
              fill="outline"
              size="sm"
              data-preview-expand=""
              text={expanded ? t('Close expanded preview') : t('Expand')}
              onClick={() => present(!expanded)}
            />
            <a href={frame.standaloneSrc} target="_blank" rel="noopener">
              {t('Open alone')}
            </a>
          </div>
        )}
      </div>
      {/* Both views stay mounted in one cell; the inactive one is aria-hidden and inert. */}
      <div className="example-preview-views">
        <div
          ref={stageRef}
          className="example-preview-stage"
          data-preview-active={view === 'preview'}
          aria-hidden={view === 'code' || undefined}
        >
          {caption}
          {/* Honest state while the frame stays mounted but hidden until it reports ready. */}
          {!frame.ready && (
            <div className="example-preview-message" role={frame.error ? 'alert' : 'status'}>
              <p className="example-preview-caption">
                {t(frame.error ? 'The preview could not load.' : 'Loading preview')}
              </p>
              {frame.error && (
                <>
                  <AtlasButton
                    fill="outline"
                    size="sm"
                    text={t('Retry')}
                    onClick={() => frame.retry()}
                  />
                  <a href={frame.standaloneSrc} target="_blank" rel="noopener">
                    {t('Open alone')}
                  </a>
                </>
              )}
            </div>
          )}
          <DeviceFrame
            device={frame.device}
            orientation={frame.orientation}
            zoom={zoom}
            onScale={setScale}
          >
            <iframe
              data-preview-iframe=""
              data-preview-grid={String(frame.grid)}
              title={t(title)}
              src={frame.src}
              ref={frame.frameRef}
              onLoad={frame.onLoad}
              onError={frame.onError}
              style={{ visibility: frame.ready ? undefined : 'hidden' }}
              sandbox="allow-scripts allow-same-origin allow-forms"
              loading="lazy"
            />
          </DeviceFrame>
        </div>
        <div
          ref={codePanelRef}
          className="example-preview-code-panel"
          data-preview-active={view === 'code'}
          aria-hidden={view === 'preview' || undefined}
        >
          <div className="example-preview-message">
            {caption}
            <AtlasButton
              fill="outline"
              size="sm"
              text={t('Back to Preview')}
              onClick={() => setView('preview')}
            />
          </div>
          <PreviewSource
            id={id}
            profile={profile}
            settings={{ theme: frame.theme, orientation: screen.orientation, grid: frame.grid }}
            active={view === 'code'}
          />
        </div>
      </div>
    </dialog>
  );
}
