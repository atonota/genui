import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Switch } from 'antd';
import GenUXButton from './GenUXButton';
import GenUXIconButton from './GenUXIconButton';
import GenUXSegmented from './GenUXSegmented';
import GenUXIcon from './GenUXIcon';
import { TweakerDockButton } from './GenUXTweaker';
import DeviceFrame, { type DeviceFrameZoom } from './DeviceFrame';
import InlinePreview from './InlinePreview';
import {
  PreviewProvider,
  registerLocalPreview,
  type PreviewContextValue,
  type PreviewRecipeResult,
} from './PreviewContext';
import PreviewSource from './PreviewSource';
import { usePreviewFrame } from './usePreviewFrame';
import { useI18n } from './useI18n';
import { docsThemeColors, themeColorVariables, type ThemeMode } from '../theme';
import {
  createDefaultRecipe,
  resolveThemeBuilder,
  validateRecipe,
  type ThemeRecipe,
} from '../theme-builder/model';
import {
  getServerThemeBuilderSnapshot,
  getThemeBuilderSnapshot,
  subscribeThemeBuilder,
} from '../theme-builder/store';
import { documentationVariables } from '../data/docs-brand';
import { previewProfileForDevice, type PreviewProfile } from '../preview/profiles';
import { previewWorkbenchLayout, useMacbookWideViewport } from '../preview/workbench-layout';
import {
  previewDeviceDefinition,
  previewDevices,
  previewScreen,
  type PreviewDevice,
} from '../data/preview-devices';

export type PreviewWorkbenchProps = { id: string; title: string; children: ReactNode };
type ExampleView = 'preview' | 'code';

// Decorative 24×24 outline pictograms for the icon-only device options.
const deviceGlyphs: Record<PreviewDevice, string> = {
  iphone:
    'M9.5 2.75h5A2.5 2.5 0 0 1 17 5.25v13.5a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 7 18.75V5.25a2.5 2.5 0 0 1 2.5-2.5ZM10.75 5.5h2.5',
  ipad: 'M6.5 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM12 5.75h.01',
  macbook:
    'M4 15.5V6a1.5 1.5 0 0 1 1.5-1.5h13A1.5 1.5 0 0 1 20 6v9.5M2 15.5h20V17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2ZM12 6.75h.01',
  tv: 'M4.5 4.5h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2ZM8.5 20.5h7M12 17.5v3',
};
// Illustrative class names only; no hardware or viewport claim.
const deviceLabels: Record<PreviewDevice, string> = {
  iphone: 'iPhone 18',
  ipad: 'iPad mini',
  macbook: 'MacBook 13',
  tv: 'TV',
};
const profileLabels: Record<PreviewProfile, string> = {
  large: 'Large profile',
  medium: 'Medium profile',
  small: 'Small profile',
  tv: 'TV profile',
};
// Every option keeps the shared target height through the wrapper's own height role.
const controlStyle = { '--genux-segmented-height': 'var(--preview-control-size)' } as CSSProperties;
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
// One default recipe, so an unedited example keeps a stable effective recipe.
const defaultRecipe = createDefaultRecipe();

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

/** Returning focus from the expanded same-document preview, Firefox can ignore an element's
    focus() until the target's window is activated again, so each attempt first focuses the
    target's own window. */
function focusInOwnWindow(target: HTMLElement | null | undefined) {
  if (!target) return;
  target.ownerDocument.defaultView?.focus();
  target.focus({ preventScroll: true });
}

/** Expand while it is offered, else the checked view radio; focus() keeps the input modality.
    Firefox can still ignore focus() on the visually hidden radio, so an ignored attempt falls
    back to the always-operable Grid switch. */
function focusReturnTarget(dialog: HTMLDialogElement | null) {
  const target =
    dialog?.querySelector<HTMLElement>('[data-preview-expand]') ??
    dialog?.querySelector<HTMLElement>('.example-preview-view-tabs input[type="radio"]:checked');
  focusInOwnWindow(target);
  if (target && target.ownerDocument.activeElement === target) return;
  focusInOwnWindow(dialog?.querySelector<HTMLElement>('[data-preview-grid-control]'));
}

/** One example rendered on the page inside its device mockup. Device, theme, rotation, Code
    and Expand restyle the same dialog, DeviceFrame and demo tree; nothing is remounted or
    reparented. */
export default function PreviewWorkbench({ id, title, children }: PreviewWorkbenchProps) {
  const { t } = useI18n();
  const titleId = `${useId()}-title`;
  // The visible Grid label names its switch through htmlFor.
  const gridSwitchId = `${titleId}-grid`;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frame = usePreviewFrame({ id, title, anchorRef: dialogRef });
  const [view, setView] = useState<ExampleView>('preview');
  const [zoom, setZoom] = useState<DeviceFrameZoom>('fit');
  const [scale, setScale] = useState(100);
  const [expanded, setExpanded] = useState(false);
  const [alone, setAlone] = useState<'fullscreen' | 'window' | null>(null);
  const returnAlone = useRef(false);
  const aloneOpen = alone !== null;
  const stageRef = useRef<HTMLDivElement>(null);
  const codePanelRef = useRef<HTMLDivElement>(null);
  // Close events queued by our own mode switches are not user closes.
  const ownCloses = useRef(0);
  // Set when leaving Expand; the return focus waits for that render.
  const returnFocus = useRef(false);
  // Set when Open tweaker leaves Expand; that render opens the outer Tweaker instead.
  const openAfterExpand = useRef(false);
  // Set by Back to Preview; the checked Preview radio takes focus after that render.
  const focusPreviewTab = useRef(false);
  // Latest mode switch and mode for the document event listener below.
  const presentRef = useRef<(modal: boolean) => void>(() => {});
  const expandedRef = useRef(false);
  const wide = useMacbookWideViewport();
  const layout = previewWorkbenchLayout(frame.device, wide, zoom);
  const profile = previewProfileForDevice(frame.device);
  const screen = previewScreen(frame.device, frame.orientation);
  const rotatable = previewDeviceDefinition(frame.device).rotatable;
  const openFrameSettings = frame.openSettings;
  // This example's in-memory recipe; until its first apply it follows the global Theme Builder
  // recipe, and nothing here writes global storage.
  const [localRecipe, setLocalRecipe] = useState<ThemeRecipe | null>(null);
  const globalRecipe = useSyncExternalStore(
    subscribeThemeBuilder,
    getThemeBuilderSnapshot,
    getServerThemeBuilderSnapshot,
  );
  const effectiveRecipe = useMemo(
    () => localRecipe ?? globalRecipe ?? defaultRecipe,
    [localRecipe, globalRecipe],
  );
  const apply = useCallback((input: ThemeRecipe): PreviewRecipeResult => {
    const checked = validateRecipe(input);
    if (!checked.ok) return { ok: false, error: checked.error };
    setLocalRecipe(checked.recipe);
    return { ok: true };
  }, []);
  const reset = useCallback(() => setLocalRecipe(createDefaultRecipe()), []);
  const previewValue = useMemo<PreviewContextValue>(
    () => ({
      exampleId: id,
      profile,
      mode: frame.theme,
      orientation: screen.orientation,
      recipe: localRecipe,
      apply,
      reset,
    }),
    [id, profile, frame.theme, screen.orientation, localRecipe, apply, reset],
  );
  // The page Tweaker finds this example while it holds focus; each new value replaces the
  // registration and unmount removes it.
  useEffect(() => registerLocalPreview(previewValue), [previewValue]);
  // Theme roles and recipe variables for the screen alone; the page and the bezel keep theirs.
  // The default recipe resolves every variable, so a reset restores the screen exactly.
  const screenStyle = useMemo(
    () =>
      ({
        ...themeColorVariables(docsThemeColors[frame.theme]),
        ...documentationVariables(frame.theme),
        ...resolveThemeBuilder(effectiveRecipe, frame.theme).variables,
        colorScheme: frame.theme,
        backgroundColor: 'var(--preview-screen-surface)',
        color: 'var(--ink)',
      }) as CSSProperties,
    [effectiveRecipe, frame.theme],
  );

  useIsomorphicLayoutEffect(() => {
    stageRef.current?.toggleAttribute('inert', view === 'code');
    codePanelRef.current?.toggleAttribute('inert', view !== 'code');
  }, [view]);

  // Back to Preview inerts its own button, so focus moves to the checked Preview radio once the
  // view has rendered; focus() keeps the current input modality.
  useIsomorphicLayoutEffect(() => {
    if (view !== 'preview' || !focusPreviewTab.current) return;
    focusPreviewTab.current = false;
    focusInOwnWindow(
      dialogRef.current?.querySelector<HTMLElement>(
        '.example-preview-view-tabs input[type="radio"]:checked',
      ),
    );
  }, [view]);

  // The Inspector's settings action asks this example to show its Preview.
  useEffect(() => {
    const show = (event: Event) => {
      if ((event as CustomEvent<{ id?: unknown } | null>).detail?.id !== id) return;
      setView('preview');
      // The settings opener runs right after this event, so an expanded example leaves the
      // top layer now and skips its focus return; the outer Tweaker stays reachable.
      if (!expandedRef.current) return;
      expandedRef.current = false;
      presentRef.current(false);
      returnFocus.current = false;
    };
    document.addEventListener('genux-preview-show', show);
    return () => document.removeEventListener('genux-preview-show', show);
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
    // Leaving Expand may remove its button (wide MacBook), so that return follows the render.
    returnFocus.current = !modal && expanded;
    if (!modal && alone) {
      returnAlone.current = true;
      setAlone(null);
    }
    setExpanded(modal);
    if (!modal && !expanded) focusReturnTarget(dialog);
  };
  useIsomorphicLayoutEffect(() => {
    presentRef.current = present;
    expandedRef.current = expanded;
  });

  // The outer Tweaker lies outside an expanded example's top layer, so Expand closes first and
  // the Tweaker opens after that render; the demo subtree stays where it is.
  const openTweaker = () => {
    frame.focus();
    if (!expanded) {
      openFrameSettings();
      return;
    }
    openAfterExpand.current = true;
    present(false);
  };

  // Firefox can restore focus while it settles the queued native close, so the return waits
  // a frame until our own closes have landed; a mode switch or unmount cancels it.
  useIsomorphicLayoutEffect(() => {
    if (expanded || !returnFocus.current) return;
    returnFocus.current = false;
    // A pending Open tweaker replaces the return focus once the closes have landed.
    const settings = openAfterExpand.current;
    openAfterExpand.current = false;
    let frame = 0;
    const settle = (frames: number) => {
      frame = requestAnimationFrame(() => {
        if (ownCloses.current > 0 && frames > 0) settle(frames - 1);
        else if (settings) openFrameSettings();
        else if (returnAlone.current) {
          returnAlone.current = false;
          focusInOwnWindow(dialogRef.current?.querySelector('[data-preview-alone-open]'));
        } else focusReturnTarget(dialogRef.current);
      });
    };
    settle(3);
    return () => cancelAnimationFrame(frame);
  }, [expanded, openFrameSettings]);

  useIsomorphicLayoutEffect(() => {
    if (alone) focusInOwnWindow(dialogRef.current?.querySelector('[data-preview-alone-close]'));
  }, [aloneOpen]);

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
      className={alone ? 'example-preview example-preview-screen' : 'example-preview'}
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
      data-preview-alone={alone ?? undefined}
      data-theme={alone ? frame.theme : undefined}
      style={alone ? screenStyle : undefined}
      data-preview-macbook-wide={String(wide)}
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
      {expanded && (
        <div className="genux-tweaker-trigger">
          <TweakerDockButton onClick={openTweaker} />
        </div>
      )}
      {alone && (
        <div className="example-alone-header">
          <GenUXIconButton
            icon={alone === 'fullscreen' ? 'minus' : 'arrows-out-simple'}
            size="sm"
            aria-label={t(alone === 'fullscreen' ? 'Collapse fullscreen' : 'Fullscreen')}
            title={t(alone === 'fullscreen' ? 'Collapse fullscreen' : 'Fullscreen')}
            onClick={() => setAlone(alone === 'fullscreen' ? 'window' : 'fullscreen')}
          />
          <GenUXIconButton
            icon="x"
            size="sm"
            data-preview-alone-close=""
            aria-label={t('Close preview')}
            title={t('Close preview')}
            onClick={() => present(false)}
          />
        </div>
      )}
      <div className="example-preview-toolbar" hidden={alone !== null} inert={alone !== null}>
        <p className="example-preview-title" id={titleId}>
          {t(title)}
        </p>
        {/* One Tab stop per radiogroup: the checked native radio; the root leaves the order. */}
        <GenUXSegmented<ExampleView>
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
            <GenUXSegmented<PreviewDevice>
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
            <GenUXSegmented<ThemeMode>
              aria-label={t('Preview theme')}
              tabIndex={-1}
              size="sm"
              style={controlStyle}
              value={frame.theme}
              onChange={frame.setTheme}
              options={[
                {
                  value: 'light',
                  label: <IconOption icon={<GenUXIcon name="sun" />} label={t('Light')} />,
                },
                {
                  value: 'dark',
                  label: <IconOption icon={<GenUXIcon name="moon" />} label={t('Dark')} />,
                },
              ]}
            />
            {layout.manualActual && (
              <GenUXButton
                fill="outline"
                size="sm"
                text={t('Actual size 1:1')}
                aria-pressed={zoom === 'actual'}
                onClick={() => setZoom(zoom === 'fit' ? 'actual' : 'fit')}
              />
            )}
            {/* The compact GenUX switch is the focusable Grid control; its label toggles it too. */}
            <span className="example-preview-grid-switch">
              <label htmlFor={gridSwitchId}>{t('Grid')}</label>
              <Switch
                id={gridSwitchId}
                size="small"
                data-selection-size="sm"
                data-preview-grid-control=""
                checked={frame.grid}
                onChange={checked => frame.setGrid(checked)}
              />
            </span>
            <GenUXButton
              fill="outline"
              size="sm"
              text={t('Rotate')}
              disabled={!rotatable}
              onClick={() => frame.rotate()}
            />
            {/* Close always stays while expanded; the wide MacBook already shows 1:1 inline. */}
            {(expanded || layout.inlineExpand) && (
              <GenUXButton
                fill="outline"
                size="sm"
                data-preview-expand=""
                icon={expanded ? 'x' : 'arrows-out-simple'}
                text={expanded ? t('Close expanded preview') : t('Expand')}
                onClick={() => present(!expanded)}
              />
            )}
            <GenUXButton
              fill="link"
              size="sm"
              text={t('Alone')}
              data-preview-alone-open=""
              onClick={() => {
                setView('preview');
                setAlone('fullscreen');
                present(true);
              }}
            />
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
          {/* The demo renders on this page as one stable, unkeyed subtree that device, theme,
              rotation, Code and Expand restyle in place; the provider is always present. */}
          <PreviewProvider value={previewValue}>
            <DeviceFrame
              device={frame.device}
              orientation={frame.orientation}
              zoom={layout.zoom}
              fitAxis={layout.fitAxis}
              onScale={setScale}
              screenStyle={screenStyle}
              screenTheme={frame.theme}
            >
              <InlinePreview
                id={id}
                device={frame.device}
                theme={frame.theme}
                orientation={screen.orientation}
                grid={frame.grid}
                fluid={alone !== null}
              >
                {children}
              </InlinePreview>
            </DeviceFrame>
          </PreviewProvider>
        </div>
        <div
          ref={codePanelRef}
          className="example-preview-code-panel"
          data-preview-active={view === 'code'}
          aria-hidden={view === 'preview' || undefined}
        >
          <div className="example-preview-message">
            {caption}
            <GenUXButton
              fill="outline"
              size="sm"
              text={t('Back to Preview')}
              onClick={() => {
                focusPreviewTab.current = true;
                setView('preview');
              }}
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
