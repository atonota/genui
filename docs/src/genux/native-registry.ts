import type { GenUXNativeComponentName } from './contracts';
import type { NativeDefinition } from './native-contract';
import { definition as accordion } from './native/accordion';
import { definition as alert } from './native/alert';
import { definition as autoComplete } from './native/auto-complete';
import { definition as avatar } from './native/avatar';
import { definition as avatarGroup } from './native/avatar-group';
import { definition as breadcrumb } from './native/breadcrumb';
import { definition as button } from './native/button';
import { definition as carousel } from './native/carousel';
import { definition as cascader } from './native/cascader';
import { definition as checkbox } from './native/checkbox';
import { definition as checkboxCards } from './native/checkbox-cards';
import { definition as connectedWorkspace } from './native/connected-workspace';
import { definition as dateMultiple } from './native/date-multiple';
import { definition as dateTime } from './native/date-time';
import { definition as drawer } from './native/drawer';
import { definition as dropdown } from './native/dropdown';
import { definition as editableGrid } from './native/editable-grid';
import { definition as emptyState } from './native/empty-state';
import { definition as iconList } from './native/icon-list';
import { definition as input } from './native/input';
import { definition as inputNumber } from './native/input-number';
import { definition as mediaFrame } from './native/media-frame';
import { definition as modal } from './native/modal';
import { definition as notification } from './native/notification';
import { definition as pagination } from './native/pagination';
import { definition as passwordInput } from './native/password-input';
import { definition as pill } from './native/pill';
import { definition as popconfirm } from './native/popconfirm';
import { definition as quote } from './native/quote';
import { definition as radio } from './native/radio';
import { definition as radioCards } from './native/radio-cards';
import { definition as recordCollection } from './native/record-collection';
import { definition as recordDisplay } from './native/record-display';
import { definition as recordForm } from './native/record-form';
import { definition as repeatingRecords } from './native/repeating-records';
import { definition as richMenu } from './native/rich-menu';
import { definition as screenshot } from './native/screenshot';
import { definition as searchInput } from './native/search-input';
import { definition as segmented } from './native/segmented';
import { definition as select } from './native/select';
import { definition as seriesChart } from './native/series-chart';
import { definition as slider } from './native/slider';
import { definition as splitter } from './native/splitter';
import { definition as steps } from './native/steps';
import { definition as switchDefinition } from './native/switch';
import { definition as switchCards } from './native/switch-cards';
import { definition as textArea } from './native/text-area';
import { definition as toast } from './native/toast';
import { definition as upload } from './native/upload';

// Static, code-owned mapping. Models select a registered name only; they can never
// register a definition, renderer, endpoint or style.
export const NATIVE_DEFINITIONS: Readonly<Record<GenUXNativeComponentName, NativeDefinition>> =
  Object.freeze({
    GenUXButton: button,
    GenUXInput: input,
    GenUXInputNumber: inputNumber,
    GenUXSelect: select,
    GenUXRadio: radio,
    GenUXCheckbox: checkbox,
    GenUXSwitch: switchDefinition,
    GenUXSlider: slider,
    GenUXCascader: cascader,
    GenUXDateTimePicker: dateTime,
    GenUXPagination: pagination,
    GenUXSteps: steps,
    GenUXBreadcrumb: breadcrumb,
    GenUXAccordion: accordion,
    GenUXPill: pill,
    GenUXAvatar: avatar,
    GenUXAvatarGroup: avatarGroup,
    GenUXMediaFrame: mediaFrame,
    GenUXScreenshot: screenshot,
    GenUXIconList: iconList,
    GenUXQuote: quote,
    GenUXCarousel: carousel,
    GenUXRichMenu: richMenu,
    GenUXUpload: upload,
    GenUXDrawer: drawer,
    GenUXToast: toast,
    GenUXAlert: alert,
    GenUXNotification: notification,
    GenUXModal: modal,
    GenUXPopconfirm: popconfirm,
    GenUXSplitter: splitter,
    GenUXAutoComplete: autoComplete,
    GenUXDropdown: dropdown,
    GenUXSegmented: segmented,
    GenUXRecordCollection: recordCollection,
    GenUXRecordDisplay: recordDisplay,
    GenUXRecordForm: recordForm,
    GenUXEditableGrid: editableGrid,
    GenUXRepeatingRecords: repeatingRecords,
    GenUXConnectedWorkspace: connectedWorkspace,
    GenUXEmptyState: emptyState,
    GenUXSeriesChart: seriesChart,
    GenUXPasswordInput: passwordInput,
    GenUXTextArea: textArea,
    GenUXSearchInput: searchInput,
    GenUXDateTimeMultiple: dateMultiple,
    GenUXRadioCards: radioCards,
    GenUXCheckboxCards: checkboxCards,
    GenUXSwitchCards: switchCards,
  });

export function nativeDefinition(name: string): NativeDefinition | undefined {
  return Object.hasOwn(NATIVE_DEFINITIONS, name)
    ? NATIVE_DEFINITIONS[name as GenUXNativeComponentName]
    : undefined;
}
