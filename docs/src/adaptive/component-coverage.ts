import type { GenUIComponentName } from '../genui/contracts';

// Code-owned adaptive coverage for every GenUI component and documented catalog slug.
// Pure metadata: no React, DOM, network or browser globals, so SSR imports stay safe.
// The shared contract source is implemented, so entries start implemented-unverified.
// Per-component browser verification is pending; metadata alone never marks one verified.

export const CONTRACT_FAMILIES = [
  'action',
  'field',
  'choice',
  'navigation',
  'feedback',
  'layer',
  'content',
  'data',
  'ai',
] as const;
export type ContractFamily = (typeof CONTRACT_FAMILIES)[number];

/** How a component answers its own container, independent of the viewport. */
export const CONTAINER_BEHAVIORS = [
  // Keeps its intrinsic size inside the surrounding flow.
  'inline-intrinsic',
  // Fills the container inline size.
  'fluid-fill',
  // Wraps between whole items, never inside a word.
  'wrap-flow',
  // Stacks in narrow containers and forms rows when space allows.
  'stack-to-row',
  // Scrolls inside its own container; the page never scrolls horizontally.
  'scroll-region',
  // Layer placement comes from the host presentation context.
  'overlay-adaptive',
  // Sections collapse behind native disclosure controls.
  'disclosure',
  // Panes stack when narrow and split with a keyboard-operable separator when wide.
  'split-panes',
] as const;
export type ContainerBehavior = (typeof CONTAINER_BEHAVIORS)[number];

export const ACTIVATIONS = ['semantic-click', 'native-control', 'delegated', 'none'] as const;
export type Activation = (typeof ACTIVATIONS)[number];

export const CARET_OWNERSHIPS = ['owns-caret', 'delegated', 'none'] as const;
export type CaretOwnership = (typeof CARET_OWNERSHIPS)[number];

export const COMPOSITE_PATTERNS = [
  'none',
  // Native radio group or checkbox group, chosen by the multiple flag.
  'selection-group',
  'radio-group',
  'checkbox-group',
  'combobox',
  'menu',
  'grid',
  'slider',
  'disclosure',
  'carousel',
  'dialog',
  'separator',
] as const;
export type CompositePattern = (typeof COMPOSITE_PATTERNS)[number];

export const EVIDENCE_STATUSES = [
  'implementation-pending',
  'implemented-unverified',
  'verified',
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export interface InputContract {
  readonly activation: Activation;
  /** A caret owner keeps arrows for editing; arrows never open visual focus. */
  readonly caret: CaretOwnership;
  /** APG pattern that moves focus inside the widget once keyboard mode is on. */
  readonly composite: CompositePattern;
  /** Pointer drag resizes; the same control keeps a keyboard equivalent. */
  readonly pointerResize: boolean;
  /**
   * Tab or Shift+Tab opens visual focus mode on every surface, without a surrounding ring.
   * Directional keys may open it only on an explicitly declared living-room surface.
   */
  readonly visualFocus: 'tab-and-explicit-tv';
  /** Directional focus is opt-in for the explicit living-room surface; web stays Tab-only. */
  readonly spatialNavigation: 'explicit-tv-opt-in';
}

export interface ComponentAdaptiveContract {
  readonly family: ContractFamily;
  readonly containerBehavior: ContainerBehavior;
  readonly inputContract: InputContract;
  /** Repository .ts or .tsx file that owns the shared implementation or contract. */
  readonly sharedOwner: string;
  readonly evidenceStatus: EvidenceStatus;
}

type InputOverrides = Partial<
  Pick<InputContract, 'activation' | 'caret' | 'composite' | 'pointerResize'>
>;

function contract(
  family: ContractFamily,
  containerBehavior: ContainerBehavior,
  sharedOwner: string,
  input: InputOverrides = {},
): ComponentAdaptiveContract {
  const inputContract: InputContract = {
    activation: input.activation ?? 'none',
    caret: input.caret ?? 'none',
    composite: input.composite ?? 'none',
    pointerResize: input.pointerResize ?? false,
    visualFocus: 'tab-and-explicit-tv',
    spatialNavigation: 'explicit-tv-opt-in',
  };
  const result: ComponentAdaptiveContract = {
    family,
    containerBehavior,
    inputContract: Object.freeze(inputContract),
    sharedOwner,
    evidenceStatus: 'implemented-unverified',
  };
  return Object.freeze(result);
}

// Generic components render through the shared surface; native adapters load one file each.
const SURFACE = 'docs/src/react/genui/AtlasGenUISurface.tsx';
const native = (module: string): string => `docs/src/react/genui/native/${module}.tsx`;
// Doc-only slugs have no runtime renderer; this module owns their explicit contract.
const DOC_ONLY = 'docs/src/adaptive/component-coverage.ts';

const componentCoverage = {
  AtlasEntityCard: contract('content', 'stack-to-row', SURFACE, { activation: 'delegated' }),
  AtlasMetricCard: contract('data', 'fluid-fill', SURFACE),
  AtlasPurposeCard: contract('content', 'stack-to-row', SURFACE, { activation: 'delegated' }),
  AtlasTaskSurface: contract('ai', 'stack-to-row', SURFACE, {
    activation: 'delegated',
    caret: 'delegated',
  }),
  AtlasCollection: contract('data', 'scroll-region', SURFACE, { activation: 'delegated' }),
  AtlasChart: contract('data', 'fluid-fill', SURFACE),
  AtlasForm: contract('field', 'stack-to-row', SURFACE, {
    activation: 'delegated',
    caret: 'delegated',
  }),
  AtlasChoice: contract('choice', 'fluid-fill', SURFACE, {
    activation: 'native-control',
    composite: 'combobox',
  }),
  AtlasAction: contract('action', 'inline-intrinsic', SURFACE, { activation: 'semantic-click' }),
  AtlasEmpty: contract('feedback', 'fluid-fill', SURFACE, { activation: 'delegated' }),
  AtlasStack: contract('content', 'stack-to-row', SURFACE),
  AtlasText: contract('content', 'fluid-fill', SURFACE),
  AtlasButton: contract('action', 'inline-intrinsic', native('button'), {
    activation: 'semantic-click',
  }),
  AtlasInput: contract('field', 'fluid-fill', native('input'), {
    activation: 'native-control',
    caret: 'owns-caret',
  }),
  AtlasInputNumber: contract('field', 'fluid-fill', native('input-number'), {
    activation: 'native-control',
    caret: 'owns-caret',
  }),
  AtlasSelect: contract('choice', 'fluid-fill', native('select'), {
    activation: 'native-control',
    composite: 'combobox',
  }),
  AtlasRadio: contract('choice', 'wrap-flow', native('radio'), {
    activation: 'native-control',
    composite: 'radio-group',
  }),
  AtlasCheckbox: contract('choice', 'inline-intrinsic', native('checkbox'), {
    activation: 'native-control',
  }),
  AtlasSwitch: contract('choice', 'inline-intrinsic', native('switch'), {
    activation: 'native-control',
  }),
  AtlasSlider: contract('field', 'fluid-fill', native('slider'), {
    activation: 'native-control',
    composite: 'slider',
  }),
  AtlasCascader: contract('choice', 'fluid-fill', native('cascader'), {
    activation: 'native-control',
    composite: 'combobox',
  }),
  AtlasDateTimePicker: contract('field', 'fluid-fill', native('date-time'), {
    activation: 'native-control',
    caret: 'owns-caret',
    composite: 'combobox',
  }),
  AtlasPagination: contract('navigation', 'wrap-flow', native('pagination'), {
    activation: 'semantic-click',
  }),
  AtlasSteps: contract('navigation', 'stack-to-row', native('steps'), {
    activation: 'semantic-click',
  }),
  AtlasBreadcrumb: contract('navigation', 'wrap-flow', native('breadcrumb'), {
    activation: 'semantic-click',
  }),
  AtlasAccordion: contract('content', 'disclosure', native('accordion'), {
    activation: 'semantic-click',
    composite: 'disclosure',
  }),
  AtlasPill: contract('choice', 'wrap-flow', native('pill'), { activation: 'semantic-click' }),
  AtlasAvatar: contract('content', 'inline-intrinsic', native('avatar')),
  AtlasAvatarGroup: contract('content', 'wrap-flow', native('avatar-group')),
  AtlasMediaFrame: contract('content', 'fluid-fill', native('media-frame')),
  AtlasScreenshot: contract('content', 'fluid-fill', native('screenshot')),
  AtlasIconList: contract('content', 'wrap-flow', native('icon-list')),
  AtlasQuote: contract('content', 'fluid-fill', native('quote')),
  AtlasCarousel: contract('content', 'scroll-region', native('carousel'), {
    activation: 'semantic-click',
    composite: 'carousel',
  }),
  AtlasRichMenu: contract('navigation', 'stack-to-row', native('rich-menu'), {
    activation: 'semantic-click',
    composite: 'menu',
  }),
  AtlasUpload: contract('field', 'fluid-fill', native('upload'), { activation: 'native-control' }),
  AtlasDrawer: contract('layer', 'overlay-adaptive', native('drawer'), {
    activation: 'semantic-click',
    composite: 'dialog',
  }),
  AtlasToast: contract('feedback', 'overlay-adaptive', native('toast')),
  AtlasAlert: contract('feedback', 'fluid-fill', native('alert'), { activation: 'semantic-click' }),
  AtlasNotification: contract('feedback', 'overlay-adaptive', native('notification'), {
    activation: 'semantic-click',
  }),
  AtlasModal: contract('layer', 'overlay-adaptive', native('modal'), {
    activation: 'semantic-click',
    composite: 'dialog',
  }),
  AtlasPopconfirm: contract('layer', 'overlay-adaptive', native('popconfirm'), {
    activation: 'semantic-click',
    composite: 'dialog',
  }),
  AtlasSplitter: contract('content', 'split-panes', native('splitter'), {
    composite: 'separator',
    pointerResize: true,
  }),
  AtlasAutoComplete: contract('field', 'fluid-fill', native('auto-complete'), {
    activation: 'native-control',
    caret: 'owns-caret',
    composite: 'combobox',
  }),
  AtlasDropdown: contract('navigation', 'inline-intrinsic', native('dropdown'), {
    activation: 'semantic-click',
    composite: 'menu',
  }),
  AtlasSegmented: contract('choice', 'scroll-region', native('segmented'), {
    activation: 'native-control',
    composite: 'radio-group',
  }),
  AtlasRecordCollection: contract('data', 'scroll-region', native('record-collection'), {
    activation: 'delegated',
  }),
  AtlasRecordDisplay: contract('data', 'stack-to-row', native('record-display')),
  AtlasRecordForm: contract('field', 'stack-to-row', native('record-form'), {
    activation: 'delegated',
    caret: 'delegated',
  }),
  AtlasEditableGrid: contract('data', 'scroll-region', native('editable-grid'), {
    activation: 'delegated',
    caret: 'delegated',
    composite: 'grid',
  }),
  AtlasRepeatingRecords: contract('data', 'stack-to-row', native('repeating-records'), {
    activation: 'delegated',
    caret: 'delegated',
  }),
  AtlasConnectedWorkspace: contract('data', 'split-panes', native('connected-workspace'), {
    activation: 'delegated',
    caret: 'delegated',
  }),
  AtlasEmptyState: contract('feedback', 'fluid-fill', native('empty-state'), {
    activation: 'delegated',
  }),
  AtlasSeriesChart: contract('data', 'fluid-fill', native('series-chart')),
  AtlasPasswordInput: contract('field', 'fluid-fill', native('password-input'), {
    activation: 'native-control',
    caret: 'owns-caret',
  }),
  AtlasTextArea: contract('field', 'fluid-fill', native('text-area'), {
    activation: 'native-control',
    caret: 'owns-caret',
  }),
  AtlasSearchInput: contract('field', 'fluid-fill', native('search-input'), {
    activation: 'native-control',
    caret: 'owns-caret',
  }),
  AtlasDateTimeMultiple: contract('field', 'fluid-fill', native('date-multiple'), {
    activation: 'native-control',
    caret: 'owns-caret',
    composite: 'combobox',
  }),
  AtlasRadioCards: contract('choice', 'stack-to-row', native('radio-cards'), {
    activation: 'native-control',
    composite: 'radio-group',
  }),
  AtlasCheckboxCards: contract('choice', 'stack-to-row', native('checkbox-cards'), {
    activation: 'native-control',
    composite: 'checkbox-group',
  }),
  AtlasSwitchCards: contract('choice', 'stack-to-row', native('switch-cards'), {
    activation: 'native-control',
  }),
} satisfies Record<GenUIComponentName, ComponentAdaptiveContract>;

export const ADAPTIVE_COMPONENT_COVERAGE: Readonly<
  Record<GenUIComponentName, ComponentAdaptiveContract>
> = Object.freeze(componentCoverage);

export type DocSlugCoverage =
  | { readonly kind: 'genui'; readonly component: GenUIComponentName }
  | { readonly kind: 'doc-only'; readonly contract: ComponentAdaptiveContract };

const genui = (component: GenUIComponentName): DocSlugCoverage =>
  Object.freeze({ kind: 'genui', component });
const docOnly = (value: ComponentAdaptiveContract): DocSlugCoverage =>
  Object.freeze({ kind: 'doc-only', contract: value });

// Documented catalog slugs. A slug maps to its runtime component when its page documents one
// component; doc-only entries document composites without a single runtime component and
// still carry an explicit contract. Every public catalog slug must appear here; the
// assertion below fails closed on missing, extra or duplicated slugs.
const docSlugCoverage = {
  button: genui('AtlasButton'),
  input: genui('AtlasInput'),
  autocomplete: genui('AtlasAutoComplete'),
  cascader: genui('AtlasCascader'),
  select: genui('AtlasSelect'),
  checkbox: genui('AtlasCheckbox'),
  radio: genui('AtlasRadio'),
  switch: genui('AtlasSwitch'),
  slider: genui('AtlasSlider'),
  accordion: genui('AtlasAccordion'),
  form: genui('AtlasForm'),
  drawer: genui('AtlasDrawer'),
  pill: genui('AtlasPill'),
  dropdown: genui('AtlasDropdown'),
  pagination: genui('AtlasPagination'),
  steps: genui('AtlasSteps'),
  breadcrumb: genui('AtlasBreadcrumb'),
  splitter: genui('AtlasSplitter'),
  card: docOnly(contract('content', 'stack-to-row', DOC_ONLY, { activation: 'delegated' })),
  'data-table': genui('AtlasEditableGrid'),
  'collection-views': genui('AtlasRecordCollection'),
  'record-details': genui('AtlasRecordDisplay'),
  'record-forms': genui('AtlasRecordForm'),
  'record-workspace': genui('AtlasConnectedWorkspace'),
  toast: genui('AtlasToast'),
  alert: genui('AtlasAlert'),
  notification: genui('AtlasNotification'),
  modal: genui('AtlasModal'),
  popconfirm: genui('AtlasPopconfirm'),
  'date-time': genui('AtlasDateTimePicker'),
  'empty-state': genui('AtlasEmptyState'),
  avatar: genui('AtlasAvatar'),
  media: genui('AtlasMediaFrame'),
  'content-patterns': docOnly(contract('content', 'stack-to-row', DOC_ONLY)),
  carousel: genui('AtlasCarousel'),
  upload: genui('AtlasUpload'),
  'rich-menu': genui('AtlasRichMenu'),
  chart: genui('AtlasSeriesChart'),
  listy: docOnly(contract('data', 'scroll-region', DOC_ONLY, { activation: 'delegated' })),
  badge: docOnly(
    contract('content', 'inline-intrinsic', DOC_ONLY, { activation: 'semantic-click' }),
  ),
} satisfies Record<string, DocSlugCoverage>;

export const DOC_SLUG_COVERAGE: Readonly<Record<string, DocSlugCoverage>> =
  Object.freeze(docSlugCoverage);

export function isAdaptiveComponentName(name: string): name is GenUIComponentName {
  return Object.hasOwn(ADAPTIVE_COMPONENT_COVERAGE, name);
}

/** Returns the registered contract; unknown names throw instead of falling back. */
export function adaptiveContractFor(name: string): ComponentAdaptiveContract {
  if (!isAdaptiveComponentName(name)) {
    throw new Error(`No adaptive contract is registered for ${JSON.stringify(name)}`);
  }
  return ADAPTIVE_COMPONENT_COVERAGE[name];
}

function includes(list: readonly string[], value: unknown): boolean {
  return typeof value === 'string' && list.includes(value);
}

function compareKeys(
  label: string,
  expected: readonly string[],
  mapped: readonly string[],
  problems: string[],
): void {
  const seen = new Set<string>();
  for (const key of expected) {
    if (seen.has(key)) problems.push(`duplicate ${label}: ${key}`);
    seen.add(key);
  }
  const mappedKeys = new Set(mapped);
  for (const key of seen) {
    if (!mappedKeys.has(key)) problems.push(`missing ${label}: ${key}`);
  }
  for (const key of mapped) {
    if (!seen.has(key)) problems.push(`extra ${label}: ${key}`);
  }
}

function checkContract(label: string, value: ComponentAdaptiveContract, problems: string[]): void {
  const input = value.inputContract;
  if (!includes(CONTRACT_FAMILIES, value.family)) problems.push(`${label}: unknown family`);
  if (!includes(CONTAINER_BEHAVIORS, value.containerBehavior)) {
    problems.push(`${label}: unknown container behavior`);
  }
  if (!includes(EVIDENCE_STATUSES, value.evidenceStatus)) {
    problems.push(`${label}: unknown evidence status`);
  }
  if (
    typeof value.sharedOwner !== 'string' ||
    !value.sharedOwner.startsWith('docs/src/') ||
    !/\.tsx?$/.test(value.sharedOwner) ||
    value.sharedOwner.includes('..') ||
    value.sharedOwner.includes(':')
  ) {
    problems.push(`${label}: shared owner must be a .ts or .tsx repository file under docs/src`);
  }
  if (!includes(ACTIVATIONS, input.activation)) problems.push(`${label}: unknown activation`);
  if (!includes(CARET_OWNERSHIPS, input.caret)) problems.push(`${label}: unknown caret ownership`);
  if (!includes(COMPOSITE_PATTERNS, input.composite)) problems.push(`${label}: unknown composite`);
  if (typeof input.pointerResize !== 'boolean')
    problems.push(`${label}: pointerResize must be boolean`);
  if (input.visualFocus !== 'tab-and-explicit-tv') {
    problems.push(`${label}: visual focus opens only with Tab or an explicit TV surface`);
  }
  if (input.spatialNavigation !== 'explicit-tv-opt-in') {
    problems.push(`${label}: spatial navigation must stay an explicit TV opt-in`);
  }
}

/**
 * Fails closed when the supplied GenUI names or catalog slugs differ from the mapping:
 * missing, extra and duplicated records all throw, and every contract is validated.
 */
export function assertAdaptiveCoverage(names: readonly string[], slugs: readonly string[]): void {
  const problems: string[] = [];
  compareKeys('GenUI component', names, Object.keys(ADAPTIVE_COMPONENT_COVERAGE), problems);
  compareKeys('catalog slug', slugs, Object.keys(DOC_SLUG_COVERAGE), problems);
  for (const [name, value] of Object.entries(ADAPTIVE_COMPONENT_COVERAGE)) {
    checkContract(name, value, problems);
  }
  for (const [slug, entry] of Object.entries(DOC_SLUG_COVERAGE)) {
    if (entry.kind === 'genui') {
      if (!isAdaptiveComponentName(entry.component)) {
        problems.push(`catalog slug ${slug}: unknown GenUI component ${entry.component}`);
      }
    } else if (entry.kind === 'doc-only') {
      checkContract(`catalog slug ${slug}`, entry.contract, problems);
    } else {
      problems.push(`catalog slug ${slug}: unknown coverage kind`);
    }
  }
  if (problems.length > 0) {
    throw new Error(`Adaptive coverage is incomplete: ${problems.join('; ')}`);
  }
}
