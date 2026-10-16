/** Device illustrations for the shared example workbench. They are container previews, not
    browser emulation: the screen width is a preferred width that still fits its column, and
    these chrome curves are the only device-specific geometry. Lengths are CSS px. */
export type PreviewDevice = 'iphone' | 'ipad' | 'macbook';

export type PreviewDeviceDefinition = {
  readonly value: PreviewDevice;
  /** Canonical English option label, translated where rendered. */
  readonly label: string;
  readonly screenWidthPx: number;
  /** Retained role; the workbench screen follows the aspect ratio below instead. */
  readonly screenMinHeightPx: number;
  /** Actual screen proportions: portrait iPhone and iPad, landscape MacBook. */
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
  readonly baseHeightPx: number;
  /** How far the base extends past the lid on each side. */
  readonly baseOverhangPx: number;
  readonly baseRadiusPx: number;
};

const macbook: PreviewDeviceDefinition = {
  value: 'macbook',
  label: 'MacBook',
  screenWidthPx: 1280,
  screenMinHeightPx: 240,
  screenAspectWidth: 1280,
  screenAspectHeight: 800,
  bezelTopPx: 22,
  bezelInlinePx: 14,
  bezelBottomPx: 14,
  frameRadiusPx: 16,
  frameEndRadiusPx: 4,
  screenRadiusPx: 6,
  sensorWidthPx: 8,
  sensorHeightPx: 8,
  baseHeightPx: 14,
  baseOverhangPx: 16,
  baseRadiusPx: 10,
};

export const DEFAULT_PREVIEW_DEVICE: PreviewDevice = 'macbook';

export const previewDevices: readonly PreviewDeviceDefinition[] = [
  {
    value: 'iphone',
    label: 'iPhone',
    screenWidthPx: 390,
    screenMinHeightPx: 320,
    screenAspectWidth: 390,
    screenAspectHeight: 844,
    bezelTopPx: 30,
    bezelInlinePx: 12,
    bezelBottomPx: 18,
    frameRadiusPx: 44,
    frameEndRadiusPx: 44,
    screenRadiusPx: 30,
    sensorWidthPx: 84,
    sensorHeightPx: 22,
    baseHeightPx: 0,
    baseOverhangPx: 0,
    baseRadiusPx: 0,
  },
  {
    value: 'ipad',
    label: 'iPad',
    screenWidthPx: 820,
    screenMinHeightPx: 280,
    screenAspectWidth: 820,
    screenAspectHeight: 1180,
    bezelTopPx: 22,
    bezelInlinePx: 22,
    bezelBottomPx: 22,
    frameRadiusPx: 28,
    frameEndRadiusPx: 28,
    screenRadiusPx: 12,
    sensorWidthPx: 8,
    sensorHeightPx: 8,
    baseHeightPx: 0,
    baseOverhangPx: 0,
    baseRadiusPx: 0,
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
  const aspect = `${definition.screenAspectWidth} / ${definition.screenAspectHeight}`;
  return {
    '--preview-device-width': px(
      definition.screenWidthPx + 2 * definition.bezelInlinePx + 2 * definition.baseOverhangPx,
    ),
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
    '--preview-base-height': px(definition.baseHeightPx),
    '--preview-base-overhang': px(definition.baseOverhangPx),
    '--preview-base-radius': px(definition.baseRadiusPx),
  };
}
