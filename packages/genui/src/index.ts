// Base entry: Atlas Ant Design controls re-exported from the canonical docs/src sources. GenUI and
// Ant Design X surfaces stay behind the ./genui entry; styles are imported via ./styles.
export * from '../../../docs/src/react/AtlasProvider';
export { default as AtlasProvider } from '../../../docs/src/react/AtlasProvider';
// AtlasAppearance, AtlasAppearanceContext and useAtlasAppearance already come from AtlasProvider.
export { atlasLength } from '../../../docs/src/react/AtlasAppearance';
export * from '../../../docs/src/react/AtlasSizeProfile';
export * from '../../../docs/src/react/AtlasPortalScope';
export { default as AtlasPortalScope } from '../../../docs/src/react/AtlasPortalScope';

export * from '../../../docs/src/react/AtlasIcon';
export { default as AtlasIcon } from '../../../docs/src/react/AtlasIcon';
export * from '../../../docs/src/react/AtlasIconList';
export { default as AtlasIconList } from '../../../docs/src/react/AtlasIconList';
export { default as AtlasClearIcon } from '../../../docs/src/react/AtlasClearIcon';

// IconLibrary already comes from AtlasIcon.
export type {
  Palette,
  Tone,
  ButtonDepth,
  AtlasButtonProps,
} from '../../../docs/src/react/AtlasButton';
export { buttonStates, default as AtlasButton } from '../../../docs/src/react/AtlasButton';
export * from '../../../docs/src/react/AtlasButtonGroup';
export { default as AtlasButtonGroup } from '../../../docs/src/react/AtlasButtonGroup';
export * from '../../../docs/src/react/AtlasIconButton';
export { default as AtlasIconButton } from '../../../docs/src/react/AtlasIconButton';
export * from '../../../docs/src/react/AtlasLayeredButton';
export { default as AtlasLayeredButton } from '../../../docs/src/react/AtlasLayeredButton';
export * from '../../../docs/src/react/AtlasSlotButton';
export { default as AtlasSlotButton } from '../../../docs/src/react/AtlasSlotButton';
export * from '../../../docs/src/react/AtlasSegmented';
export { default as AtlasSegmented } from '../../../docs/src/react/AtlasSegmented';

export * from '../../../docs/src/react/AtlasInputFrame';
export { default as AtlasInputFrame } from '../../../docs/src/react/AtlasInputFrame';
export * from '../../../docs/src/react/AtlasInput';
export { default as AtlasInput } from '../../../docs/src/react/AtlasInput';
export * from '../../../docs/src/react/AtlasInputNumber';
export { default as AtlasInputNumber } from '../../../docs/src/react/AtlasInputNumber';
export * from '../../../docs/src/react/AtlasAutoComplete';
export { default as AtlasAutoComplete } from '../../../docs/src/react/AtlasAutoComplete';
export * from '../../../docs/src/react/AtlasCascader';
export { default as AtlasCascader } from '../../../docs/src/react/AtlasCascader';
export * from '../../../docs/src/react/AtlasDateTime';
export { default as AtlasDateTime } from '../../../docs/src/react/AtlasDateTime';
// Selection controls are the Ant Design components; AtlasProvider tokens and the shared styles own
// their paint, focus and 32/40/48 sizing. The AtlasSelectionVariants catalog demo stays docs-only.
export { Checkbox as AtlasCheckbox, Radio as AtlasRadio, Switch as AtlasSwitch } from 'antd';
export type {
  CheckboxProps as AtlasCheckboxProps,
  RadioProps as AtlasRadioProps,
  SwitchProps as AtlasSwitchProps,
} from 'antd';
export * from '../../../docs/src/react/AtlasSlider';
export { default as AtlasSlider } from '../../../docs/src/react/AtlasSlider';
export * from '../../../docs/src/react/AtlasUpload';
export { default as AtlasUpload } from '../../../docs/src/react/AtlasUpload';

export * from '../../../docs/src/react/AtlasDropdown';
export { default as AtlasDropdown } from '../../../docs/src/react/AtlasDropdown';
export * from '../../../docs/src/react/AtlasRichMenu';
export { default as AtlasRichMenu } from '../../../docs/src/react/AtlasRichMenu';
export * from '../../../docs/src/react/AtlasBreadcrumb';
export { default as AtlasBreadcrumb } from '../../../docs/src/react/AtlasBreadcrumb';
export * from '../../../docs/src/react/AtlasPagination';
export { default as AtlasPagination } from '../../../docs/src/react/AtlasPagination';
export * from '../../../docs/src/react/AtlasSteps';
export { default as AtlasSteps } from '../../../docs/src/react/AtlasSteps';

export * from '../../../docs/src/react/AtlasBadge';
export { default as AtlasBadge } from '../../../docs/src/react/AtlasBadge';
// AtlasPillColorScope already comes from AtlasPill.
export * from '../../../docs/src/react/AtlasPill';
export { default as AtlasPill } from '../../../docs/src/react/AtlasPill';
export { usePillColor } from '../../../docs/src/react/AtlasPillColors';
export * from '../../../docs/src/react/AtlasAvatar';
export { default as AtlasAvatar } from '../../../docs/src/react/AtlasAvatar';
export * from '../../../docs/src/react/AtlasAvatarGroup';
export { default as AtlasAvatarGroup } from '../../../docs/src/react/AtlasAvatarGroup';
export * from '../../../docs/src/react/AtlasListy';
export { default as AtlasListy } from '../../../docs/src/react/AtlasListy';
export * from '../../../docs/src/react/AtlasListyItem';
export { default as AtlasListyItem } from '../../../docs/src/react/AtlasListyItem';
export * from '../../../docs/src/react/AtlasQuote';
export { default as AtlasQuote } from '../../../docs/src/react/AtlasQuote';
export * from '../../../docs/src/react/AtlasEmptyState';
export { default as AtlasEmptyState } from '../../../docs/src/react/AtlasEmptyState';

export * from '../../../docs/src/react/AtlasMediaFrame';
export { default as AtlasMediaFrame } from '../../../docs/src/react/AtlasMediaFrame';
export * from '../../../docs/src/react/AtlasCarousel';
export { default as AtlasCarousel } from '../../../docs/src/react/AtlasCarousel';
export * from '../../../docs/src/react/AtlasScreenshot';
export { default as AtlasScreenshot } from '../../../docs/src/react/AtlasScreenshot';
export * from '../../../docs/src/react/AtlasChart';
export { default as AtlasChart } from '../../../docs/src/react/AtlasChart';
export * from '../../../docs/src/react/AtlasSplitter';
export { default as AtlasSplitter } from '../../../docs/src/react/AtlasSplitter';

export * from '../../../docs/src/react/AtlasFeedback';
export * from '../../../docs/src/react/AtlasOverlay';

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
