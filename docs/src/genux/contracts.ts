import type { GenUXCardModel } from '../data/card-model';
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };
export const GENUX_CARD_CATALOG_ID = 'local://genux-cards/v1';
export const GENUX_PUBLIC_CATALOG_ID = 'local://genux-cards/public/v1';
export const GENUX_NATIVE_COMPONENT_NAMES = [
  'GenUXButton',
  'GenUXInput',
  'GenUXInputNumber',
  'GenUXSelect',
  'GenUXRadio',
  'GenUXCheckbox',
  'GenUXSwitch',
  'GenUXSlider',
  'GenUXCascader',
  'GenUXDateTimePicker',
  'GenUXPagination',
  'GenUXSteps',
  'GenUXBreadcrumb',
  'GenUXAccordion',
  'GenUXPill',
  'GenUXAvatar',
  'GenUXAvatarGroup',
  'GenUXMediaFrame',
  'GenUXScreenshot',
  'GenUXIconList',
  'GenUXQuote',
  'GenUXCarousel',
  'GenUXRichMenu',
  'GenUXUpload',
  'GenUXDrawer',
  'GenUXToast',
  'GenUXAlert',
  'GenUXNotification',
  'GenUXModal',
  'GenUXPopconfirm',
  'GenUXSplitter',
  'GenUXAutoComplete',
  'GenUXDropdown',
  'GenUXSegmented',
  'GenUXRecordCollection',
  'GenUXRecordDisplay',
  'GenUXRecordForm',
  'GenUXEditableGrid',
  'GenUXRepeatingRecords',
  'GenUXConnectedWorkspace',
  'GenUXEmptyState',
  'GenUXSeriesChart',
  'GenUXPasswordInput',
  'GenUXTextArea',
  'GenUXSearchInput',
  'GenUXDateTimeMultiple',
  'GenUXRadioCards',
  'GenUXCheckboxCards',
  'GenUXSwitchCards',
] as const;
export type GenUXNativeComponentName = (typeof GENUX_NATIVE_COMPONENT_NAMES)[number];
export const GENUX_COMPONENT_NAMES = [
  'GenUXEntityCard',
  'GenUXMetricCard',
  'GenUXPurposeCard',
  'GenUXTaskSurface',
  'GenUXCollection',
  'GenUXChart',
  'GenUXForm',
  'GenUXChoice',
  'GenUXAction',
  'GenUXEmpty',
  'GenUXStack',
  'GenUXText',
  ...GENUX_NATIVE_COMPONENT_NAMES,
] as const;
export type GenUXComponentName = (typeof GENUX_COMPONENT_NAMES)[number];
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
export interface GenUXComponent {
  id: string;
  component: GenUXComponentName;
  child?: string;
  children?: readonly string[];
  model?: GenUXCardModel | { path: string };
  text?: string | { path: string };
  direction?: 'stack' | 'grid';
  payload?: TaskBlockData | { path: string };
}
export interface GenUXSurfaceModel {
  id: string;
  generation: number;
  revision: number;
  components: readonly GenUXComponent[];
  data: JsonValue;
  models: Readonly<Record<string, GenUXCardModel>>;
  blocks: Readonly<Record<string, TaskBlockData>>;
  draftFields: Readonly<Record<string, Readonly<Record<string, string>>>>;
}
export type GenUXRunStatus = 'idle' | 'receiving' | 'success' | 'error' | 'aborted';
export interface GenUXEvent {
  id: number;
  kind: 'request' | 'accepted' | 'rejected' | 'action' | 'draft' | 'terminal' | 'restore';
  message: string;
  requestId: string | null;
  sequence: number | null;
  revision: number;
}
export interface GenUXSnapshot {
  scopeId: string;
  audience: 'panel' | 'frontpage';
  sourceMode: 'recorded' | 'host';
  revision: number;
  status: GenUXRunStatus;
  requestId: string | null;
  sequence: number;
  surfaces: readonly GenUXSurfaceModel[];
  events: readonly GenUXEvent[];
  error: string | null;
  actionResult: string | null;
  history: readonly number[];
}
export interface GenUXBatch {
  requestId: string;
  sequence: number;
  commands: readonly unknown[];
}
export interface GenUXResult {
  ok: boolean;
  error?: string;
}
export interface GenUXAction {
  surfaceId: string;
  componentId: string;
  actionId: string;
  baseRevision: number;
  idempotencyKey: string;
}
export interface GenUXRuntime {
  getSnapshot: () => GenUXSnapshot;
  subscribe: (listener: () => void) => () => void;
  beginRequest: (requestId: string) => void;
  applyBatch: (batch: GenUXBatch) => GenUXResult;
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
  ) => GenUXResult;
  setSelection: (surfaceId: string, componentId: string, selected: boolean) => GenUXResult;
  moveTask: (
    surfaceId: string,
    componentId: string,
    lane: 'planned' | 'active' | 'done',
  ) => GenUXResult;
  chooseValue: (
    surfaceId: string,
    componentId: string,
    value: string | readonly string[],
  ) => GenUXResult;
  changeNativeValue: (
    surfaceId: string,
    componentId: string,
    value: JsonValue,
    generation: number,
    baseRevision: number,
  ) => GenUXResult;
  dispatchAction: (action: GenUXAction) => GenUXResult;
  restoreRevision: (revision: number) => GenUXResult;
}
