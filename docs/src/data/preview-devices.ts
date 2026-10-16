/** Device frames for the shared example workbench. Each device draws one fixed logical
    screen: the size is an illustrative reference, not browser or device emulation and no
    hardware claim. Phones and tablets rotate by swapping width and height, the MacBook and
    the TV are always landscape, and the screen never grows with its content. The whole device
    width includes the bezel and the base. The chrome curves stay neutral roles for the existing
    CSS. Lengths are CSS px; this module is the one central source of preview dimensions. */
export type PreviewDevice = 'iphone' | 'ipad' | 'macbook' | 'tv';
export type PreviewOrientation = 'portrait' | 'landscape';

export const previewOrientations: readonly PreviewOrientation[] = ['portrait', 'landscape'];

export function isPreviewOrientation(value: unknown): value is PreviewOrientation {
  return value === 'portrait' || value === 'landscape';
}

export type PreviewDeviceDefinition = {
  readonly value: PreviewDevice;
  /** Canonical English option label, translated where rendered. */
  readonly label: string;
  /** Fixed logical screen width in the device's natural orientation. */
  readonly screenWidthPx: number;
  /** Fixed logical screen height; content scrolls inside, the screen never grows. */
  readonly screenHeightPx: number;
  /** Centered content container width; equals the screen width when unbounded. */
  readonly containerWidthPx: number;
  /** Phones and tablets rotate; the MacBook and the TV stay landscape. */
  readonly rotatable: boolean;
  /** @deprecated Compat alias of screenWidthPx until the workbench reads the fixed roles. */
  readonly displayMaxScreenWidthPx: number;
  /** @deprecated Compat alias of screenHeightPx. */
  readonly screenMinHeightPx: number;
  /** @deprecated Compat alias of the fixed screen proportions. */
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

/** Fixed screen fields; the deprecated roles alias the actual fixed size. */
function fixedScreen(width: number, height: number, container = width) {
  return {
    screenWidthPx: width,
    screenHeightPx: height,
    containerWidthPx: container,
    displayMaxScreenWidthPx: width,
    screenMinHeightPx: height,
    screenAspectWidth: width,
    screenAspectHeight: height,
  };
}

// Illustrative MacBook 13 class: 1440×900 (16:10) logical screen, 1024 container, 208 margins;
// with the unchanged bezel and base the whole device is 1520×942.
const macbook: PreviewDeviceDefinition = {
  value: 'macbook',
  label: 'MacBook',
  ...fixedScreen(1440, 900, 1024),
  rotatable: false,
  bezelTopPx: 18,
  bezelInlinePx: 12,
  bezelBottomPx: 12,
  frameRadiusPx: 14,
  frameEndRadiusPx: 2,
  screenRadiusPx: 4,
  sensorWidthPx: 6,
  sensorHeightPx: 6,
  indicatorWidthPx: 0,
  indicatorHeightPx: 0,
  baseHeightPx: 12,
  baseOverhangPx: 28,
  baseRadiusPx: 10,
  notchWidthPx: 112,
  notchHeightPx: 5,
};

// Illustrative living-room TV class: a 1920x1080 (16:9) logical reference screen with a 1600
// container and 160 margins. A new illustrative assumption, not a physical hardware claim; the
// thin bezel and low stand reuse the neutral chrome roles of the other devices.
const tv: PreviewDeviceDefinition = {
  value: 'tv',
  label: 'TV',
  ...fixedScreen(1920, 1080, 1600),
  rotatable: false,
  bezelTopPx: 12,
  bezelInlinePx: 12,
  bezelBottomPx: 12,
  frameRadiusPx: 6,
  frameEndRadiusPx: 6,
  screenRadiusPx: 2,
  sensorWidthPx: 6,
  sensorHeightPx: 6,
  indicatorWidthPx: 0,
  indicatorHeightPx: 0,
  baseHeightPx: 10,
  baseOverhangPx: 0,
  baseRadiusPx: 4,
  notchWidthPx: 0,
  notchHeightPx: 0,
};

export const DEFAULT_PREVIEW_DEVICE: PreviewDevice = 'macbook';

export const previewDevices: readonly PreviewDeviceDefinition[] = [
  {
    value: 'iphone',
    label: 'iPhone',
    // Illustrative iPhone 18 class logical screen. Rotatable devices keep one uniform bezel, so
    // landscape moves the island and indicator to the side edges without resizing the frame.
    ...fixedScreen(402, 874),
    rotatable: true,
    bezelTopPx: 16,
    bezelInlinePx: 16,
    bezelBottomPx: 16,
    frameRadiusPx: 56,
    frameEndRadiusPx: 56,
    screenRadiusPx: 40,
    sensorWidthPx: 84,
    sensorHeightPx: 10,
    indicatorWidthPx: 104,
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
    // Illustrative iPad mini class logical screen.
    ...fixedScreen(744, 1133),
    rotatable: true,
    bezelTopPx: 20,
    bezelInlinePx: 20,
    bezelBottomPx: 20,
    frameRadiusPx: 32,
    frameEndRadiusPx: 32,
    screenRadiusPx: 12,
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
  tv,
];

/** A detached shallow copy: every field is primitive and callers never reach the registry. */
export function previewDeviceDefinition(device: PreviewDevice): PreviewDeviceDefinition {
  return { ...(previewDevices.find(item => item.value === device) ?? macbook) };
}

function naturalOrientation(definition: PreviewDeviceDefinition): PreviewOrientation {
  return definition.screenWidthPx >= definition.screenHeightPx ? 'landscape' : 'portrait';
}

/** Rotatable devices honour a valid requested orientation; fixed devices keep their natural
    orientation, landscape for the MacBook and the TV. */
export function previewOrientation(
  device: PreviewDevice,
  orientation?: PreviewOrientation,
): PreviewOrientation {
  const definition = previewDeviceDefinition(device);
  return definition.rotatable && isPreviewOrientation(orientation)
    ? orientation
    : naturalOrientation(definition);
}

export type PreviewScreen = {
  readonly device: PreviewDevice;
  readonly orientation: PreviewOrientation;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly containerWidthPx: number;
  /** Inline margin on each side of the centered container. */
  readonly containerMarginPx: number;
};

/** The fixed logical screen for a device and orientation; rotating swaps width and height. */
export function previewScreen(
  device: PreviewDevice,
  orientation?: PreviewOrientation,
): PreviewScreen {
  const definition = previewDeviceDefinition(device);
  const resolved = previewOrientation(device, orientation);
  const swap = resolved !== naturalOrientation(definition);
  const widthPx = swap ? definition.screenHeightPx : definition.screenWidthPx;
  const heightPx = swap ? definition.screenWidthPx : definition.screenHeightPx;
  // An unbounded container follows the screen; a bounded one never exceeds it.
  const containerWidthPx =
    definition.containerWidthPx >= definition.screenWidthPx
      ? widthPx
      : Math.min(definition.containerWidthPx, widthPx);
  return {
    device: definition.value,
    orientation: resolved,
    widthPx,
    heightPx,
    containerWidthPx,
    containerMarginPx: (widthPx - containerWidthPx) / 2,
  };
}

/** Inline --preview-* roles read by preview-workbench.css. */
export function previewDeviceVariables(
  device: PreviewDevice,
  orientation?: PreviewOrientation,
): Record<`--preview-${string}`, string> {
  const definition = previewDeviceDefinition(device);
  const screen = previewScreen(device, orientation);
  const px = (value: number) => `${value}px`;
  // The whole device: lid bezel and base overhang on both sides, the base below.
  const deviceWidth = screen.widthPx + 2 * definition.bezelInlinePx + 2 * definition.baseOverhangPx;
  const deviceHeight =
    definition.bezelTopPx + screen.heightPx + definition.bezelBottomPx + definition.baseHeightPx;
  return {
    '--preview-device-width': px(deviceWidth),
    '--preview-device-height': px(deviceHeight),
    '--preview-screen-width': px(screen.widthPx),
    '--preview-screen-height': px(screen.heightPx),
    '--preview-container-width': px(screen.containerWidthPx),
    '--preview-container-margin': px(screen.containerMarginPx),
    // Compat aliases for the current workbench CSS: the actual fixed size, no display cap.
    '--preview-device-display-width': px(deviceWidth),
    '--preview-screen-min-height': px(screen.heightPx),
    '--preview-screen-aspect': `${screen.widthPx} / ${screen.heightPx}`,
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
