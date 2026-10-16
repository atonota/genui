import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useI18n } from './useI18n';
import {
  previewDeviceDefinition,
  previewDeviceVariables,
  previewScreen,
  type PreviewDevice,
  type PreviewOrientation,
} from '../data/preview-devices';
import type { ThemeMode } from '../theme';

export type DeviceFrameZoom = 'fit' | 'actual';
/** Fit by both stage axes, or by the stage width alone with the full fixed height in flow. */
export type DeviceFrameFitAxis = 'both' | 'width';

export type DeviceFrameProps = {
  device: PreviewDevice;
  /** Phones and tablets swap their logical size; the MacBook stays landscape. */
  orientation?: PreviewOrientation;
  /** Fit scales the whole device into the stage, never above 1:1; Actual keeps 1:1. */
  zoom?: DeviceFrameZoom;
  /** Width ignores the stage height cap; defaults to both for the existing consumers. */
  fitAxis?: DeviceFrameFitAxis;
  /** Kept as the same element across resizes and rotations; never cloned or keyed here. */
  children: ReactNode;
  /** Applied scale as a percentage floored to two decimals, for the parent's caption; a fit
      below 1:1 never reads 100. */
  onScale?: (percent: number) => void;
  /** Canonical English name of the stage region; translated here. */
  label?: string;
  /** Theme roles and local recipe for the screen alone, so the frame keeps the page palette. */
  screenStyle?: CSSProperties;
  /** Local mode of the screen's preview document. */
  screenTheme?: ThemeMode;
};

/** Semantic stage cap; --preview-stage-max-height in preview-workbench.css mirrors it. */
export const DEVICE_STAGE_MAX_HEIGHT_PX = 720;

// Layout effects measure before paint in the browser; the server has no DOM to measure.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** The whole fixed device: lid bezel and base overhang on both sides, the base below. */
export function deviceFrameSize(device: PreviewDevice, orientation?: PreviewOrientation) {
  const definition = previewDeviceDefinition(device);
  const screen = previewScreen(device, orientation);
  return {
    orientation: screen.orientation,
    widthPx: screen.widthPx + 2 * definition.bezelInlinePx + 2 * definition.baseOverhangPx,
    heightPx:
      definition.bezelTopPx + screen.heightPx + definition.bezelBottomPx + definition.baseHeightPx,
  };
}

const stageCap = (heightPx?: number) =>
  heightPx && heightPx > 0 ? heightPx : DEVICE_STAGE_MAX_HEIGHT_PX;

/** Fit never enlarges; an unmeasured stage keeps the central height cap, a measured one its
    computed semantic cap; the width axis ignores that cap. Flooring keeps the scaled footprint
    inside the stage. */
export function deviceFrameScale(
  size: { readonly widthPx: number; readonly heightPx: number },
  zoom: DeviceFrameZoom,
  availableWidthPx?: number,
  availableHeightPx?: number,
  fitAxis: DeviceFrameFitAxis = 'both',
): number {
  if (zoom === 'actual') return 1;
  const byWidth = availableWidthPx && availableWidthPx > 0 ? availableWidthPx / size.widthPx : 1;
  const byHeight = fitAxis === 'width' ? 1 : stageCap(availableHeightPx) / size.heightPx;
  return Math.floor(Math.min(1, byWidth, byHeight) * 1e4) / 1e4;
}

/** The stage's computed max-block-size, never its content height, so scaling cannot feed back. */
function stageHeightCap(stage: HTMLElement): number {
  return stageCap(Number.parseFloat(getComputedStyle(stage).maxBlockSize));
}

/** Fixed device mockup on a responsive stage: only the transform scale follows the stage. */
export default function DeviceFrame({
  device,
  orientation,
  zoom = 'fit',
  fitAxis = 'both',
  children,
  onScale,
  label = 'Device preview',
  screenStyle,
  screenTheme,
}: DeviceFrameProps) {
  const { t } = useI18n();
  const stageRef = useRef<HTMLDivElement>(null);
  const onScaleRef = useRef(onScale);
  const [availableWidth, setAvailableWidth] = useState<number>();
  const [availableHeight, setAvailableHeight] = useState<number>();
  useIsomorphicLayoutEffect(() => {
    onScaleRef.current = onScale;
  });
  // One observer set for the stage's lifetime; a hidden stage (zero width) keeps its last fit.
  // Width follows the stage, height its computed semantic cap, which Expand raises.
  useIsomorphicLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = (width: number) => {
      if (width <= 0) return;
      setAvailableWidth(width);
      setAvailableHeight(stageHeightCap(stage));
    };
    const remeasure = () => measure(stage.clientWidth);
    remeasure();
    window.addEventListener('resize', remeasure);
    const root = stage.closest('.example-preview');
    const mutations =
      typeof MutationObserver === 'undefined' ? null : new MutationObserver(remeasure);
    if (root) mutations?.observe(root, { attributeFilter: ['data-preview-expanded', 'open'] });
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(entries => {
            for (const entry of entries) measure(entry.contentRect.width);
          });
    observer?.observe(stage);
    return () => {
      window.removeEventListener('resize', remeasure);
      mutations?.disconnect();
      observer?.disconnect();
    };
  }, []);

  const size = deviceFrameSize(device, orientation);
  const scale = deviceFrameScale(size, zoom, availableWidth, availableHeight, fitAxis);
  // The scale is already floored to 1e-4, so this is its exact two-decimal percentage.
  const percent = Math.round(scale * 1e4) / 100;
  useIsomorphicLayoutEffect(() => {
    onScaleRef.current?.(percent);
  }, [percent]);
  // Actual 1:1 joins the Tab order only when its region has something to scroll.
  const scrollable =
    zoom === 'actual' &&
    (availableWidth === undefined ||
      size.widthPx > availableWidth ||
      (fitAxis === 'both' && size.heightPx > stageCap(availableHeight)));
  const scalerStyle = {
    '--preview-scale': String(scale),
    '--preview-fit-width': `${size.widthPx * scale}px`,
    '--preview-fit-height': `${size.heightPx * scale}px`,
  } as CSSProperties;

  // Orientation and zoom restyle the same tree, so the children are never remounted.
  return (
    <div
      ref={stageRef}
      className="example-preview-fit"
      role="region"
      aria-label={t(label)}
      tabIndex={scrollable ? 0 : undefined}
      data-preview-zoom={zoom}
      data-preview-fit-axis={fitAxis}
    >
      <div className="example-preview-scaler" style={scalerStyle}>
        <div
          className="example-preview-device"
          data-preview-device={device}
          data-preview-orientation={size.orientation}
          style={previewDeviceVariables(device, orientation) as CSSProperties}
        >
          <div className="example-preview-bezel">
            <div
              className="example-preview-screen"
              data-preview-device={device}
              data-theme={screenTheme}
              style={screenStyle}
            >
              {children}
            </div>
          </div>
          <span className="example-preview-base" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
