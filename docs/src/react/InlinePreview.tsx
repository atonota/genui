import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import AdaptiveProvider from './AdaptiveProvider';
import GenUXProvider from './GenUXProvider';
import { PreviewProvider, usePreviewContext, type PreviewContextValue } from './PreviewContext';
import { layoutLoaders } from '../adaptive/delivery';
import type { AdaptiveOptions } from '../adaptive/policy';
import {
  previewScreen,
  type PreviewDevice,
  type PreviewOrientation,
} from '../data/preview-devices';
import { previewProfileForDevice } from '../preview/profiles';
import type { ThemeMode } from '../theme';

export type InlinePreviewProps = {
  /** Example id; scopes the preview owner's variable class. */
  id: string;
  device: PreviewDevice;
  theme: ThemeMode;
  orientation?: PreviewOrientation;
  grid: boolean;
  /** Alone uses the available modal surface while keeping the same mounted demo. */
  fluid?: boolean;
  /** The actual demo; rendered on this page, never fetched, embedded or cloned. */
  children: ReactNode;
};

// Each device locks its layout profile; TV is the explicit living-room product, never a width.
const deviceOptions: Readonly<Record<PreviewDevice, AdaptiveOptions>> = {
  iphone: { surface: 'web', lockedProfile: 'phone' },
  ipad: { surface: 'web', lockedProfile: 'tablet' },
  macbook: { surface: 'web', lockedProfile: 'desktop' },
  tv: { surface: 'living-room', lockedProfile: 'living-room' },
};

/** One example's same-page preview document, the direct DOM child of its DeviceFrame screen.
    The root carries the canonical document roles from the central screen and, on TV, the
    living-room shell; the providers inside it own the local mode, the fixed logical viewport over
    the host's real capabilities and the docs roles. Device, theme, rotation and grid change props
    and attributes only: element types stay the same and nothing is keyed, so the demo keeps its
    state. */
export default function InlinePreview({
  id,
  device,
  theme,
  orientation,
  grid,
  fluid = false,
  children,
}: InlinePreviewProps) {
  const parent = usePreviewContext();
  const profile = previewProfileForDevice(device);
  const screen = previewScreen(device, orientation);
  const fallback = useMemo<PreviewContextValue>(
    () => ({ exampleId: id, profile, mode: theme, orientation: screen.orientation }),
    [id, profile, theme, screen.orientation],
  );
  // The Workbench's value wins; the fallback only serves a bare mount. One provider either way.
  const value = parent ?? fallback;
  const options = deviceOptions[device];
  const rootRef = useRef<HTMLDivElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const [layoutClassName, setLayoutClassName] = useState<string>();
  useEffect(() => {
    setHydrated(true);
  }, []);
  // Only the TV surface imports the living-room module; switching away or unmounting detaches it
  // at once, and a late import from an earlier run never attaches.
  useEffect(() => {
    const root = rootRef.current;
    if (options.surface !== 'living-room' || !root) return;
    let current = true;
    let detach: (() => void) | undefined;
    layoutLoaders['living-room']().then(
      entry => {
        if (!current) return;
        detach = entry.attach?.(root);
        setLayoutClassName(entry.className);
      },
      // A failed import keeps the baseline document; nothing retries on its own.
      () => {},
    );
    return () => {
      current = false;
      detach?.();
      setLayoutClassName(undefined);
    };
  }, [options.surface]);
  const documentStyle = {
    '--preview-document-width': fluid ? '100%' : `${screen.widthPx}px`,
    '--preview-document-height': fluid
      ? 'var(--preview-alone-content-height)'
      : `${screen.heightPx}px`,
    '--preview-document-container-width': fluid
      ? `min(100%, ${screen.containerWidthPx}px)`
      : `${screen.containerWidthPx}px`,
    '--preview-document-container-margin': fluid
      ? 'auto'
      : `${(screen.widthPx - screen.containerWidthPx) / 2}px`,
    // The per-profile gutter stays in preview-document.css.
    '--preview-document-gutter': 'var(--preview-grid-gutter)',
  } as CSSProperties;
  return (
    <PreviewProvider value={value}>
      <div
        ref={rootRef}
        className={layoutClassName}
        style={documentStyle}
        data-preview-document=""
        data-preview-example={id}
        data-preview-device={device}
        data-profile={profile}
        data-theme={value.mode}
        data-orientation={screen.orientation}
        data-preview-grid={grid ? '' : undefined}
        data-preview-hydrated={hydrated ? 'true' : 'false'}
        data-adaptive-shell=""
        data-adaptive-surface={options.surface}
      >
        <AdaptiveProvider
          options={options}
          viewport={fluid ? undefined : { width: screen.widthPx, height: screen.heightPx }}
        >
          <GenUXProvider appearance="docs">
            <div data-preview-viewport="">
              <div data-preview-container="">
                {/* A div, not main: the page already owns its one main landmark. */}
                <div
                  className={`preview-${profile}`}
                  data-preview-main=""
                  data-adaptive-container=""
                >
                  <div data-preview-content="">{children}</div>
                </div>
              </div>
            </div>
          </GenUXProvider>
        </AdaptiveProvider>
      </div>
    </PreviewProvider>
  );
}
