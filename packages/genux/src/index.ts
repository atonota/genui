// Base entry: GenUX Ant Design controls re-exported from the canonical docs/src sources. GenUX and
// Ant Design X surfaces stay behind the ./genux entry; styles are imported via ./styles.
export * from '../../../docs/src/react/GenUXProvider';
export { default as GenUXProvider } from '../../../docs/src/react/GenUXProvider';
// GenUXAppearance, GenUXAppearanceContext and useGenUXAppearance already come from GenUXProvider.
export { genuxLength } from '../../../docs/src/react/GenUXAppearance';
export * from '../../../docs/src/react/GenUXSizeProfile';
export * from '../../../docs/src/react/GenUXPortalScope';
export { default as GenUXPortalScope } from '../../../docs/src/react/GenUXPortalScope';

export * from '../../../docs/src/react/GenUXIcon';
export { default as GenUXIcon } from '../../../docs/src/react/GenUXIcon';
export * from '../../../docs/src/react/GenUXIconList';
export { default as GenUXIconList } from '../../../docs/src/react/GenUXIconList';
export { default as GenUXClearIcon } from '../../../docs/src/react/GenUXClearIcon';

// IconLibrary already comes from GenUXIcon.
export type {
  Palette,
  Tone,
  ButtonDepth,
  GenUXButtonProps,
} from '../../../docs/src/react/GenUXButton';
export { buttonStates, default as GenUXButton } from '../../../docs/src/react/GenUXButton';
export * from '../../../docs/src/react/GenUXButtonGroup';
export { default as GenUXButtonGroup } from '../../../docs/src/react/GenUXButtonGroup';
export * from '../../../docs/src/react/GenUXIconButton';
export { default as GenUXIconButton } from '../../../docs/src/react/GenUXIconButton';
export * from '../../../docs/src/react/GenUXLayeredButton';
export { default as GenUXLayeredButton } from '../../../docs/src/react/GenUXLayeredButton';
export * from '../../../docs/src/react/GenUXSlotButton';
export { default as GenUXSlotButton } from '../../../docs/src/react/GenUXSlotButton';
export * from '../../../docs/src/react/GenUXSegmented';
export { default as GenUXSegmented } from '../../../docs/src/react/GenUXSegmented';

export * from '../../../docs/src/react/GenUXInputFrame';
export { default as GenUXInputFrame } from '../../../docs/src/react/GenUXInputFrame';
export * from '../../../docs/src/react/GenUXInput';
export { default as GenUXInput } from '../../../docs/src/react/GenUXInput';
export * from '../../../docs/src/react/GenUXInputNumber';
export { default as GenUXInputNumber } from '../../../docs/src/react/GenUXInputNumber';
export * from '../../../docs/src/react/GenUXAutoComplete';
export { default as GenUXAutoComplete } from '../../../docs/src/react/GenUXAutoComplete';
export * from '../../../docs/src/react/GenUXCascader';
export { default as GenUXCascader } from '../../../docs/src/react/GenUXCascader';
export * from '../../../docs/src/react/GenUXDateTime';
export { default as GenUXDateTime } from '../../../docs/src/react/GenUXDateTime';
// Selection controls are the Ant Design components; GenUXProvider tokens and the shared styles own
// their paint, focus and 32/40/48 sizing. The GenUXSelectionVariants catalog demo stays docs-only.
export { Checkbox as GenUXCheckbox, Radio as GenUXRadio, Switch as GenUXSwitch } from 'antd';
export type {
  CheckboxProps as GenUXCheckboxProps,
  RadioProps as GenUXRadioProps,
  SwitchProps as GenUXSwitchProps,
} from 'antd';
export * from '../../../docs/src/react/GenUXSlider';
export { default as GenUXSlider } from '../../../docs/src/react/GenUXSlider';
export * from '../../../docs/src/react/GenUXUpload';
export { default as GenUXUpload } from '../../../docs/src/react/GenUXUpload';

export * from '../../../docs/src/react/GenUXDropdown';
export { default as GenUXDropdown } from '../../../docs/src/react/GenUXDropdown';
export * from '../../../docs/src/react/GenUXRichMenu';
export { default as GenUXRichMenu } from '../../../docs/src/react/GenUXRichMenu';
export * from '../../../docs/src/react/GenUXBreadcrumb';
export { default as GenUXBreadcrumb } from '../../../docs/src/react/GenUXBreadcrumb';
export * from '../../../docs/src/react/GenUXPagination';
export { default as GenUXPagination } from '../../../docs/src/react/GenUXPagination';
export * from '../../../docs/src/react/GenUXSteps';
export { default as GenUXSteps } from '../../../docs/src/react/GenUXSteps';

export * from '../../../docs/src/react/GenUXBadge';
export { default as GenUXBadge } from '../../../docs/src/react/GenUXBadge';
// GenUXPillColorScope already comes from GenUXPill.
export * from '../../../docs/src/react/GenUXPill';
export { default as GenUXPill } from '../../../docs/src/react/GenUXPill';
export { usePillColor } from '../../../docs/src/react/GenUXPillColors';
export * from '../../../docs/src/react/GenUXAvatar';
export { default as GenUXAvatar } from '../../../docs/src/react/GenUXAvatar';
export * from '../../../docs/src/react/GenUXAvatarGroup';
export { default as GenUXAvatarGroup } from '../../../docs/src/react/GenUXAvatarGroup';
export * from '../../../docs/src/react/GenUXListy';
export { default as GenUXListy } from '../../../docs/src/react/GenUXListy';
export * from '../../../docs/src/react/GenUXListyItem';
export { default as GenUXListyItem } from '../../../docs/src/react/GenUXListyItem';
export * from '../../../docs/src/react/GenUXQuote';
export { default as GenUXQuote } from '../../../docs/src/react/GenUXQuote';
export * from '../../../docs/src/react/GenUXEmptyState';
export { default as GenUXEmptyState } from '../../../docs/src/react/GenUXEmptyState';

export * from '../../../docs/src/react/GenUXMediaFrame';
export { default as GenUXMediaFrame } from '../../../docs/src/react/GenUXMediaFrame';
export * from '../../../docs/src/react/GenUXCarousel';
export { default as GenUXCarousel } from '../../../docs/src/react/GenUXCarousel';
export * from '../../../docs/src/react/GenUXScreenshot';
export { default as GenUXScreenshot } from '../../../docs/src/react/GenUXScreenshot';
export * from '../../../docs/src/react/GenUXChart';
export { default as GenUXChart } from '../../../docs/src/react/GenUXChart';
export * from '../../../docs/src/react/GenUXSplitter';
export { default as GenUXSplitter } from '../../../docs/src/react/GenUXSplitter';

// FAB public model: explicit names avoid duplicate re-export ambiguity with the component module.
export { default as GenUXFab } from '../../../docs/src/react/GenUXFab';
export type {
  GenUXFabProps,
  FabAction,
  FabAppearance,
  FabConfig,
  FabDirection,
  FabEasing,
  FabEffect,
  FabGeometry,
  FabGeometryInput,
  FabGroup,
  FabLayout,
  FabMeasuredAction,
  FabMotion,
  FabOptions,
  FabPoint,
  FabRect,
  FabShape,
  FabSize,
  FabState,
  FabType,
} from '../../../docs/src/fab/types';
export {
  FAB_DEFAULTS,
  FAB_OPTIONS,
  actionUnavailableReason,
  normalizeFabOptions,
  resolveFabActions,
  validateFabActions,
} from '../../../docs/src/fab/options';
export { layoutFab, placeFabTrigger } from '../../../docs/src/fab/geometry';

export * from '../../../docs/src/react/GenUXFeedback';
export * from '../../../docs/src/react/GenUXOverlay';

// React adaptive bindings; the pure core types live in the ./adaptive entry.
export {
  AdaptiveProvider,
  AdaptiveContext,
  useAdaptive,
  AdaptiveShell,
  AdaptiveSider,
} from '../../../docs/src/react/adaptive';
export type {
  AdaptiveContextValue,
  AdaptivePurpose,
  AdaptiveShellOptions,
  AdaptiveShellProps,
  AdaptiveSiderProps,
} from '../../../docs/src/react/adaptive';
