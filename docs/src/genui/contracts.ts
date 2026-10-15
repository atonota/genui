import type { AtlasCardModel } from '../data/card-model';
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };
export const ATLAS_CARD_CATALOG_ID = 'local://atlas-cards/v1';
export const ATLAS_PUBLIC_CATALOG_ID = 'local://atlas-cards/public/v1';
export const GENUI_NATIVE_COMPONENT_NAMES = [
  'AtlasButton',
  'AtlasInput',
  'AtlasInputNumber',
  'AtlasSelect',
  'AtlasRadio',
  'AtlasCheckbox',
  'AtlasSwitch',
  'AtlasSlider',
  'AtlasCascader',
  'AtlasDateTimePicker',
  'AtlasPagination',
  'AtlasSteps',
  'AtlasBreadcrumb',
  'AtlasAccordion',
  'AtlasPill',
  'AtlasAvatar',
  'AtlasAvatarGroup',
  'AtlasMediaFrame',
  'AtlasScreenshot',
  'AtlasIconList',
  'AtlasQuote',
  'AtlasCarousel',
  'AtlasRichMenu',
  'AtlasUpload',
  'AtlasDrawer',
  'AtlasToast',
  'AtlasAlert',
  'AtlasNotification',
  'AtlasModal',
  'AtlasPopconfirm',
  'AtlasSplitter',
  'AtlasAutoComplete',
  'AtlasDropdown',
  'AtlasSegmented',
  'AtlasRecordCollection',
  'AtlasRecordDisplay',
  'AtlasRecordForm',
  'AtlasEditableGrid',
  'AtlasRepeatingRecords',
  'AtlasConnectedWorkspace',
  'AtlasEmptyState',
  'AtlasSeriesChart',
  'AtlasPasswordInput',
  'AtlasTextArea',
  'AtlasSearchInput',
  'AtlasDateTimeMultiple',
  'AtlasRadioCards',
  'AtlasCheckboxCards',
  'AtlasSwitchCards',
] as const;
export type GenUINativeComponentName = (typeof GENUI_NATIVE_COMPONENT_NAMES)[number];
export const GENUI_COMPONENT_NAMES = [
  'AtlasEntityCard',
  'AtlasMetricCard',
  'AtlasPurposeCard',
  'AtlasTaskSurface',
  'AtlasCollection',
  'AtlasChart',
  'AtlasForm',
  'AtlasChoice',
  'AtlasAction',
  'AtlasEmpty',
  'AtlasStack',
  'AtlasText',
  ...GENUI_NATIVE_COMPONENT_NAMES,
] as const;
export type GenUIComponentName = (typeof GENUI_COMPONENT_NAMES)[number];
export interface TaskBlockData {
  title?: string;
  description?: string;
  intent?: 'query' | 'compare' | 'analyze' | 'draft' | 'review' | 'track' | 'configure';
  scopeLabel?: string;
  columns?: readonly {
    key: string;
    label: string;
    format?: 'text' | 'number' | 'currency';
    currency?: string;
  }[];
  rows?: readonly { id: string; [key: string]: string | number | boolean | null }[];
  selection?: readonly string[];
  groupBy?: string;
  points?: readonly { label: string; value: number }[];
  unit?: string;
  fields?: readonly import('../data/card-model').CardField[];
  action?: import('../data/card-model').CardAction;
  options?: readonly { id: string; label: string }[];
  value?: string | readonly string[];
  multiple?: boolean;
  native?: Record<string, JsonValue>;
}
export interface GenUIComponent {
  id: string;
  component: GenUIComponentName;
  child?: string;
  children?: readonly string[];
  model?: AtlasCardModel | { path: string };
  text?: string | { path: string };
  direction?: 'stack' | 'grid';
  payload?: TaskBlockData | { path: string };
}
export interface GenUISurface {
  id: string;
  generation: number;
  revision: number;
  components: readonly GenUIComponent[];
  data: JsonValue;
  models: Readonly<Record<string, AtlasCardModel>>;
  blocks: Readonly<Record<string, TaskBlockData>>;
  draftFields: Readonly<Record<string, Readonly<Record<string, string>>>>;
}
export type GenUIRunStatus = 'idle' | 'receiving' | 'success' | 'error' | 'aborted';
export interface GenUIEvent {
  id: number;
  kind: 'request' | 'accepted' | 'rejected' | 'action' | 'draft' | 'terminal' | 'restore';
  message: string;
  requestId: string | null;
  sequence: number | null;
  revision: number;
}
export interface GenUISnapshot {
  scopeId: string;
  audience: 'panel' | 'frontpage';
  sourceMode: 'recorded' | 'host';
  revision: number;
  status: GenUIRunStatus;
  requestId: string | null;
  sequence: number;
  surfaces: readonly GenUISurface[];
  events: readonly GenUIEvent[];
  error: string | null;
  actionResult: string | null;
  history: readonly number[];
}
export interface GenUIBatch {
  requestId: string;
  sequence: number;
  commands: readonly unknown[];
}
export interface GenUIResult {
  ok: boolean;
  error?: string;
}
export interface GenUIAction {
  surfaceId: string;
  componentId: string;
  actionId: string;
  baseRevision: number;
  idempotencyKey: string;
}
export interface GenUIRuntime {
  getSnapshot: () => GenUISnapshot;
  subscribe: (listener: () => void) => () => void;
  beginRequest: (requestId: string) => void;
  applyBatch: (batch: GenUIBatch) => GenUIResult;
  finishRequest: (
    requestId: string,
    status: 'success' | 'error' | 'aborted',
    message?: string,
  ) => void;
  patchField: (
    surfaceId: string,
    componentId: string,
    fieldKey: string,
    value: string,
  ) => GenUIResult;
  setSelection: (surfaceId: string, componentId: string, selected: boolean) => GenUIResult;
  moveTask: (
    surfaceId: string,
    componentId: string,
    lane: 'planned' | 'active' | 'done',
  ) => GenUIResult;
  chooseValue: (
    surfaceId: string,
    componentId: string,
    value: string | readonly string[],
  ) => GenUIResult;
  changeNativeValue: (
    surfaceId: string,
    componentId: string,
    value: JsonValue,
    generation: number,
    baseRevision: number,
  ) => GenUIResult;
  dispatchAction: (action: GenUIAction) => GenUIResult;
  restoreRevision: (revision: number) => GenUIResult;
}
