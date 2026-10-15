import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { GenUINativeComponentName } from '../../genui/contracts';
import type { NativeAdapterProps } from '../../genui/native-contract';

/**
 * UI-side adapter props. Confirmation adapters (Modal, Popconfirm) read
 * actionAvailable and request close only when onAction does not report false;
 * every other adapter keeps the shared NativeAdapterProps contract.
 */
export type NativeUIAdapterProps = Omit<NativeAdapterProps, 'onAction'> & {
  /** Whether the trusted outer action can run; standalone use defaults to true. */
  actionAvailable?: boolean;
  /** false, or a throw, means the action did not commit. */
  onAction: () => boolean | void;
};
type NativeAdapter = LazyExoticComponent<ComponentType<NativeUIAdapterProps>>;

// Each loader keeps a literal import path so the bundler emits one chunk (and its CSS) per adapter.
const adapter = (
  load: () => Promise<{ default: ComponentType<NativeUIAdapterProps> }>,
): NativeAdapter => lazy(load);

// Static, code-owned adapter mapping; keyed by the same names as NATIVE_DEFINITIONS.
export const NATIVE_ADAPTERS: Readonly<Record<GenUINativeComponentName, NativeAdapter>> =
  Object.freeze({
    AtlasButton: adapter(() => import('./native/button')),
    AtlasInput: adapter(() => import('./native/input')),
    AtlasInputNumber: adapter(() => import('./native/input-number')),
    AtlasSelect: adapter(() => import('./native/select')),
    AtlasRadio: adapter(() => import('./native/radio')),
    AtlasCheckbox: adapter(() => import('./native/checkbox')),
    AtlasSwitch: adapter(() => import('./native/switch')),
    AtlasSlider: adapter(() => import('./native/slider')),
    AtlasCascader: adapter(() => import('./native/cascader')),
    AtlasDateTimePicker: adapter(() => import('./native/date-time')),
    AtlasPagination: adapter(() => import('./native/pagination')),
    AtlasSteps: adapter(() => import('./native/steps')),
    AtlasBreadcrumb: adapter(() => import('./native/breadcrumb')),
    AtlasAccordion: adapter(() => import('./native/accordion')),
    AtlasPill: adapter(() => import('./native/pill')),
    AtlasAvatar: adapter(() => import('./native/avatar')),
    AtlasAvatarGroup: adapter(() => import('./native/avatar-group')),
    AtlasMediaFrame: adapter(() => import('./native/media-frame')),
    AtlasScreenshot: adapter(() => import('./native/screenshot')),
    AtlasIconList: adapter(() => import('./native/icon-list')),
    AtlasQuote: adapter(() => import('./native/quote')),
    AtlasCarousel: adapter(() => import('./native/carousel')),
    AtlasRichMenu: adapter(() => import('./native/rich-menu')),
    AtlasUpload: adapter(() => import('./native/upload')),
    AtlasDrawer: adapter(() => import('./native/drawer')),
    AtlasToast: adapter(() => import('./native/toast')),
    AtlasAlert: adapter(() => import('./native/alert')),
    AtlasNotification: adapter(() => import('./native/notification')),
    AtlasModal: adapter(() => import('./native/modal')),
    AtlasPopconfirm: adapter(() => import('./native/popconfirm')),
    AtlasSplitter: adapter(() => import('./native/splitter')),
    AtlasAutoComplete: adapter(() => import('./native/auto-complete')),
    AtlasDropdown: adapter(() => import('./native/dropdown')),
    AtlasSegmented: adapter(() => import('./native/segmented')),
    AtlasRecordCollection: adapter(() => import('./native/record-collection')),
    AtlasRecordDisplay: adapter(() => import('./native/record-display')),
    AtlasRecordForm: adapter(() => import('./native/record-form')),
    AtlasEditableGrid: adapter(() => import('./native/editable-grid')),
    AtlasRepeatingRecords: adapter(() => import('./native/repeating-records')),
    AtlasConnectedWorkspace: adapter(() => import('./native/connected-workspace')),
    AtlasEmptyState: adapter(() => import('./native/empty-state')),
    AtlasSeriesChart: adapter(() => import('./native/series-chart')),
    AtlasPasswordInput: adapter(() => import('./native/password-input')),
    AtlasTextArea: adapter(() => import('./native/text-area')),
    AtlasSearchInput: adapter(() => import('./native/search-input')),
    AtlasDateTimeMultiple: adapter(() => import('./native/date-multiple')),
    AtlasRadioCards: adapter(() => import('./native/radio-cards')),
    AtlasCheckboxCards: adapter(() => import('./native/checkbox-cards')),
    AtlasSwitchCards: adapter(() => import('./native/switch-cards')),
  });
