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

export type DeviceFrameZoom = 'fit' | 'actual';

export type DeviceFrameProps = {
  device: PreviewDevice;
  /** Phones and tablets swap their logical size; the MacBook stays landscape. */
  orientation?: PreviewOrientation;
  /** Fit scales the whole device into the stage, never above 1:1; Actual keeps 1:1. */
  zoom?: DeviceFrameZoom;
  /** Kept as the same element across resizes and rotations; never cloned or keyed here. */
  children: ReactNode;
  /** Applied scale as a whole percentage, for the parent's caption. */
  onScale?: (percent: number) => void;
  /** Canonical English name of the stage region; translated here. */
  label?: string;
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
    computed semantic cap. Flooring keeps the scaled footprint inside the stage. */
export function deviceFrameScale(
  size: { readonly widthPx: number; readonly heightPx: number },
  zoom: DeviceFrameZoom,
  availableWidthPx?: number,
  availableHeightPx?: number,
): number {
  if (zoom === 'actual') return 1;
  const byWidth = availableWidthPx && availableWidthPx > 0 ? availableWidthPx / size.widthPx : 1;
  const byHeight = stageCap(availableHeightPx) / size.heightPx;
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
  children,
  onScale,
  label = 'Device preview',
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
  const scale = deviceFrameScale(size, zoom, availableWidth, availableHeight);
  const percent = Math.round(scale * 100);
  useIsomorphicLayoutEffect(() => {
    onScaleRef.current?.(percent);
  }, [percent]);
  // Actual 1:1 joins the Tab order only when its region has something to scroll.
  const scrollable =
    zoom === 'actual' &&
    (availableWidth === undefined ||
      size.widthPx > availableWidth ||
      size.heightPx > stageCap(availableHeight));
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
    >
      <div className="example-preview-scaler" style={scalerStyle}>
        <div
          className="example-preview-device"
          data-preview-device={device}
          data-preview-orientation={size.orientation}
          style={previewDeviceVariables(device, orientation) as CSSProperties}
        >
          <div className="example-preview-bezel">
            <div className="example-preview-screen" data-preview-device={device}>
              {children}
            </div>
          </div>
          <span className="example-preview-base" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
