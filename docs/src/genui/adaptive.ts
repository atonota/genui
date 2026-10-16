import type { AdaptiveResolution, LayoutProfile } from '../adaptive/policy';
import {
  adaptiveContractFor,
  type ComponentAdaptiveContract,
  type ContainerBehavior,
  type ContractFamily,
  type EvidenceStatus,
  type InputContract,
} from '../adaptive/component-coverage';
import type { GenUIComponentName } from './contracts';

// Trusted-host presentation metadata for registered GenUI components. The host resolves the
// environment and product surface; generated payloads only name a registered component, so
// they never pick a surface, raw capabilities, sources, endpoints or new actions.

type InputLayer = AdaptiveResolution['inputLayers'][number];

const LAYOUT_PROFILES: Readonly<Record<LayoutProfile, true>> = Object.freeze({
  phone: true,
  tablet: true,
  laptop: true,
  desktop: true,
  wide: true,
  'living-room': true,
});

const INPUT_LAYERS: Readonly<Record<InputLayer, true>> = Object.freeze({
  coarse: true,
  precision: true,
  spatial: true,
});

export type LayerPlacement = 'none' | 'sheet' | 'side' | 'centered' | 'anchored';
type BaseLayerPlacement = Exclude<LayerPlacement, 'none' | 'sheet'>;

const LAYER_PLACEMENTS: Readonly<Partial<Record<GenUIComponentName, BaseLayerPlacement>>> =
  Object.freeze({
    AtlasModal: 'centered',
    AtlasDrawer: 'side',
    AtlasPopconfirm: 'anchored',
  });

export interface GenUIPresentationContext {
  readonly component: GenUIComponentName;
  readonly family: ContractFamily;
  readonly containerBehavior: ContainerBehavior;
  readonly inputContract: InputContract;
  readonly layout: LayoutProfile;
  readonly orientation: AdaptiveResolution['orientation'];
  readonly shortHeight: boolean;
  /** Interaction-area layer; visible sizes, type and radius stay on the central tokens. */
  readonly targetLayer: 'coarse' | 'precision';
  /** Initial stacking follows the layout profile; container queries still refine it. */
  readonly stacked: boolean;
  readonly layerPlacement: LayerPlacement;
  /**
   * Human TV decision 2026-10-16: true only for the explicit living-room layout with the
   * spatial input layer, where handled arrows may open the same ringless focus mode.
   */
  readonly arrowsMoveVisualFocus: boolean;
  readonly evidenceStatus: EvidenceStatus;
}

function assertResolution(resolution: AdaptiveResolution): void {
  if (!Object.hasOwn(LAYOUT_PROFILES, resolution.layout)) {
    throw new TypeError(`Unknown layout profile ${String(resolution.layout)}`);
  }
  if (resolution.orientation !== 'portrait' && resolution.orientation !== 'landscape') {
    throw new TypeError(`Unknown orientation ${String(resolution.orientation)}`);
  }
  if (typeof resolution.shortHeight !== 'boolean') {
    throw new TypeError('shortHeight must be boolean');
  }
  if (!Array.isArray(resolution.inputLayers)) {
    throw new TypeError('inputLayers must be an array');
  }
  const seen = new Set<string>();
  for (const layer of resolution.inputLayers) {
    if (!Object.hasOwn(INPUT_LAYERS, layer) || seen.has(layer)) {
      throw new TypeError(`Invalid input layer ${String(layer)}`);
    }
    seen.add(layer);
  }
}

/**
 * Compact surfaces turn centered and side layers into a sheet. Anchored layers stay
 * contextual: the popconfirm root bounds itself to the viewport and keeps AntD's
 * trigger-relative confirm semantics, so it never reports a sheet.
 */
function layerPlacement(
  component: GenUIComponentName,
  contract: ComponentAdaptiveContract,
  compact: boolean,
): LayerPlacement {
  if (contract.family !== 'layer') return 'none';
  const base = LAYER_PLACEMENTS[component];
  if (base === undefined) {
    throw new Error(`Layer ${component} has no registered placement`);
  }
  if (base === 'anchored') return base;
  return compact ? 'sheet' : base;
}

/**
 * Explicit TV exception: only a host-declared living-room surface with its spatial layer lets
 * handled arrows open visual focus. Width never implies TV, and payloads cannot set this.
 */
export function allowsSpatialVisualFocus(resolution: AdaptiveResolution): boolean {
  return resolution.layout === 'living-room' && resolution.inputLayers.includes('spatial');
}

/**
 * Resolves enum-only presentation metadata for a registered component. Unknown names and
 * malformed resolutions throw; the result is frozen and holds no paths or endpoints.
 */
export function resolveGenUIPresentation(
  component: string,
  resolution: AdaptiveResolution,
): GenUIPresentationContext {
  const contract = adaptiveContractFor(component);
  assertResolution(resolution);
  const name = component as GenUIComponentName;
  const layers = resolution.inputLayers;
  // Unknown input stays honest: precision is assumed only when every known layer is precise.
  const precise = layers.length > 0 && layers.every(layer => layer === 'precision');
  // A short visual viewport changes usable area, not the layout profile.
  const compact = resolution.layout === 'phone' || resolution.shortHeight;
  const context: GenUIPresentationContext = {
    component: name,
    family: contract.family,
    containerBehavior: contract.containerBehavior,
    inputContract: contract.inputContract,
    layout: resolution.layout,
    orientation: resolution.orientation,
    shortHeight: resolution.shortHeight,
    targetLayer: precise ? 'precision' : 'coarse',
    stacked: resolution.layout === 'phone',
    layerPlacement: layerPlacement(name, contract, compact),
    arrowsMoveVisualFocus: allowsSpatialVisualFocus(resolution),
    evidenceStatus: contract.evidenceStatus,
  };
  return Object.freeze(context);
}
