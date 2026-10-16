/** Device illustrations for the shared example workbench. They are bounded illustrative
    container previews, not browser or device emulation: the preferred screen width is a
    reference maximum, a smaller central display cap bounds the drawn screen so it never
    dominates the page, and the frame still fits its column. Phones and tablets keep portrait
    proportions, the MacBook keeps landscape proportions, and every screen shares one minimum
    height and grows with its content. These chrome curves and hardware details are the only
    device-specific geometry. Lengths are CSS px. */
export type PreviewDevice = 'iphone' | 'ipad' | 'macbook';

export type PreviewDeviceDefinition = {
  readonly value: PreviewDevice;
  /** Canonical English option label, translated where rendered. */
  readonly label: string;
  /** Preferred screen width: a reference maximum, never a viewport promise. */
  readonly screenWidthPx: number;
  /** Illustrative display cap on the drawn screen width; no scaling, text keeps its size. */
  readonly displayMaxScreenWidthPx: number;
  /** One shared minimum block size, so device changes keep the same floor. */
  readonly screenMinHeightPx: number;
  /** Preferred proportions: portrait iPhone and iPad, landscape MacBook; content still grows. */
  readonly screenAspectWidth: number;
  readonly screenAspectHeight: number;
  readonly bezelTopPx: number;
  readonly bezelInlinePx: number;
  readonly bezelBottomPx: number;
  readonly frameRadiusPx: number;
  /** Lower lid corners; the MacBook lid meets its base almost square. */
  readonly frameEndRadiusPx: number;
  readonly screenRadiusPx: number;
  /** Dynamic island on iPhone, camera dot on iPad and MacBook. */
  readonly sensorWidthPx: number;
  readonly sensorHeightPx: number;
  /** Home indicator in the iPhone bottom bezel; zero elsewhere. */
  readonly indicatorWidthPx: number;
  readonly indicatorHeightPx: number;
  readonly baseHeightPx: number;
  /** How far the base extends past the lid on each side. */
  readonly baseOverhangPx: number;
  readonly baseRadiusPx: number;
  /** Hinge notch at the top of the MacBook base; zero elsewhere. */
  readonly notchWidthPx: number;
  readonly notchHeightPx: number;
};

const macbook: PreviewDeviceDefinition = {
  value: 'macbook',
  label: 'MacBook',
  screenWidthPx: 1280,
  displayMaxScreenWidthPx: 384,
  screenMinHeightPx: 200,
  screenAspectWidth: 1280,
  screenAspectHeight: 800,
  bezelTopPx: 16,
  bezelInlinePx: 10,
  bezelBottomPx: 10,
  frameRadiusPx: 12,
  frameEndRadiusPx: 3,
  screenRadiusPx: 4,
  sensorWidthPx: 6,
  sensorHeightPx: 6,
  indicatorWidthPx: 0,
  indicatorHeightPx: 0,
  baseHeightPx: 10,
  baseOverhangPx: 14,
  baseRadiusPx: 8,
  notchWidthPx: 88,
  notchHeightPx: 4,
};

export const DEFAULT_PREVIEW_DEVICE: PreviewDevice = 'macbook';

export const previewDevices: readonly PreviewDeviceDefinition[] = [
  {
    value: 'iphone',
    label: 'iPhone',
    screenWidthPx: 390,
    displayMaxScreenWidthPx: 260,
    screenMinHeightPx: 200,
    screenAspectWidth: 390,
    screenAspectHeight: 844,
    bezelTopPx: 20,
    bezelInlinePx: 8,
    bezelBottomPx: 20,
    frameRadiusPx: 40,
    frameEndRadiusPx: 40,
    screenRadiusPx: 32,
    sensorWidthPx: 72,
    sensorHeightPx: 12,
    indicatorWidthPx: 96,
    indicatorHeightPx: 4,
    baseHeightPx: 0,
    baseOverhangPx: 0,
    baseRadiusPx: 0,
    notchWidthPx: 0,
    notchHeightPx: 0,
  },
  {
    value: 'ipad',
    label: 'iPad',
    screenWidthPx: 820,
    displayMaxScreenWidthPx: 400,
    screenMinHeightPx: 200,
    screenAspectWidth: 820,
    screenAspectHeight: 1180,
    bezelTopPx: 14,
    bezelInlinePx: 14,
    bezelBottomPx: 14,
    frameRadiusPx: 24,
    frameEndRadiusPx: 24,
    screenRadiusPx: 10,
    sensorWidthPx: 6,
    sensorHeightPx: 6,
    indicatorWidthPx: 0,
    indicatorHeightPx: 0,
    baseHeightPx: 0,
    baseOverhangPx: 0,
    baseRadiusPx: 0,
    notchWidthPx: 0,
    notchHeightPx: 0,
  },
  macbook,
];

export function previewDeviceDefinition(device: PreviewDevice): PreviewDeviceDefinition {
  return previewDevices.find(item => item.value === device) ?? macbook;
}

/** Inline --preview-* roles read by preview-workbench.css. */
export function previewDeviceVariables(
  device: PreviewDevice,
): Record<`--preview-${string}`, string> {
  const definition = previewDeviceDefinition(device);
  const px = (value: number) => `${value}px`;
  // Frame width around a screen width: the lid bezel and the base overhang on both sides.
  const frame = (screenWidth: number) =>
    screenWidth + 2 * definition.bezelInlinePx + 2 * definition.baseOverhangPx;
  // Every screen keeps numeric preferred proportions, so device changes interpolate them.
  const aspect = `${definition.screenAspectWidth} / ${definition.screenAspectHeight}`;
  return {
    '--preview-device-width': px(frame(definition.screenWidthPx)),
    '--preview-device-display-width': px(frame(definition.displayMaxScreenWidthPx)),
    '--preview-screen-min-height': px(definition.screenMinHeightPx),
    '--preview-screen-aspect': aspect,
    '--preview-bezel-top': px(definition.bezelTopPx),
    '--preview-bezel-inline': px(definition.bezelInlinePx),
    '--preview-bezel-bottom': px(definition.bezelBottomPx),
    '--preview-frame-radius': px(definition.frameRadiusPx),
    '--preview-frame-end-radius': px(definition.frameEndRadiusPx),
    '--preview-screen-radius': px(definition.screenRadiusPx),
    '--preview-sensor-width': px(definition.sensorWidthPx),
    '--preview-sensor-height': px(definition.sensorHeightPx),
    '--preview-indicator-width': px(definition.indicatorWidthPx),
    '--preview-indicator-height': px(definition.indicatorHeightPx),
    '--preview-base-height': px(definition.baseHeightPx),
    '--preview-base-overhang': px(definition.baseOverhangPx),
    '--preview-base-radius': px(definition.baseRadiusPx),
    '--preview-notch-width': px(definition.notchWidthPx),
    '--preview-notch-height': px(definition.notchHeightPx),
  };
}
