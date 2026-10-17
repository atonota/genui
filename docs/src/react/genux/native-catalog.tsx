import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { GenUXNativeComponentName } from '../../genux/contracts';
import type { NativeAdapterProps } from '../../genux/native-contract';

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
export const NATIVE_ADAPTERS: Readonly<Record<GenUXNativeComponentName, NativeAdapter>> =
  Object.freeze({
    GenUXButton: adapter(() => import('./native/button')),
    GenUXInput: adapter(() => import('./native/input')),
    GenUXInputNumber: adapter(() => import('./native/input-number')),
    GenUXSelect: adapter(() => import('./native/select')),
    GenUXRadio: adapter(() => import('./native/radio')),
    GenUXCheckbox: adapter(() => import('./native/checkbox')),
    GenUXSwitch: adapter(() => import('./native/switch')),
    GenUXSlider: adapter(() => import('./native/slider')),
    GenUXCascader: adapter(() => import('./native/cascader')),
    GenUXDateTimePicker: adapter(() => import('./native/date-time')),
    GenUXPagination: adapter(() => import('./native/pagination')),
    GenUXSteps: adapter(() => import('./native/steps')),
    GenUXBreadcrumb: adapter(() => import('./native/breadcrumb')),
    GenUXAccordion: adapter(() => import('./native/accordion')),
    GenUXPill: adapter(() => import('./native/pill')),
    GenUXAvatar: adapter(() => import('./native/avatar')),
    GenUXAvatarGroup: adapter(() => import('./native/avatar-group')),
    GenUXMediaFrame: adapter(() => import('./native/media-frame')),
    GenUXScreenshot: adapter(() => import('./native/screenshot')),
    GenUXIconList: adapter(() => import('./native/icon-list')),
    GenUXQuote: adapter(() => import('./native/quote')),
    GenUXCarousel: adapter(() => import('./native/carousel')),
    GenUXRichMenu: adapter(() => import('./native/rich-menu')),
    GenUXUpload: adapter(() => import('./native/upload')),
    GenUXDrawer: adapter(() => import('./native/drawer')),
    GenUXToast: adapter(() => import('./native/toast')),
    GenUXAlert: adapter(() => import('./native/alert')),
    GenUXNotification: adapter(() => import('./native/notification')),
    GenUXModal: adapter(() => import('./native/modal')),
    GenUXPopconfirm: adapter(() => import('./native/popconfirm')),
    GenUXSplitter: adapter(() => import('./native/splitter')),
    GenUXAutoComplete: adapter(() => import('./native/auto-complete')),
    GenUXDropdown: adapter(() => import('./native/dropdown')),
    GenUXSegmented: adapter(() => import('./native/segmented')),
    GenUXRecordCollection: adapter(() => import('./native/record-collection')),
    GenUXRecordDisplay: adapter(() => import('./native/record-display')),
    GenUXRecordForm: adapter(() => import('./native/record-form')),
    GenUXEditableGrid: adapter(() => import('./native/editable-grid')),
    GenUXRepeatingRecords: adapter(() => import('./native/repeating-records')),
    GenUXConnectedWorkspace: adapter(() => import('./native/connected-workspace')),
    GenUXEmptyState: adapter(() => import('./native/empty-state')),
    GenUXSeriesChart: adapter(() => import('./native/series-chart')),
    GenUXPasswordInput: adapter(() => import('./native/password-input')),
    GenUXTextArea: adapter(() => import('./native/text-area')),
    GenUXSearchInput: adapter(() => import('./native/search-input')),
    GenUXDateTimeMultiple: adapter(() => import('./native/date-multiple')),
    GenUXRadioCards: adapter(() => import('./native/radio-cards')),
    GenUXCheckboxCards: adapter(() => import('./native/checkbox-cards')),
    GenUXSwitchCards: adapter(() => import('./native/switch-cards')),
  });
