import splitterRefresh from './splitter-refresh.json';
import breadcrumbRefresh from './breadcrumb-refresh.json';
import paginationRefresh from './pagination-refresh.json';
import stepsRefresh from './steps-refresh.json';
import autoCompleteRefresh from './autocomplete-refresh.json';
import cascaderRefresh from './cascader-refresh.json';
import dropdownRefresh from './dropdown-refresh.json';
import gapSharedFixes from './gap-shared-fixes.json';
import gapDisplayFixes from './gap-display-fixes.json';
import gapFormFixes from './gap-form-fixes.json';
import gapCollectionsFixes from './gap-collections-fixes.json';
import componentRefresh from './component-refresh.json';
import sizeProfile from './size-profile.json';
import interactionRefresh from './interaction-refresh.json';
import colorRefresh from './color-refresh.json';
import buttonRefresh from './button-refresh.json';
import buttonCatalog from './button-catalog.json';
import dataEntryCatalog from './data-entry-catalog.json';
import pillRefresh from './pill-refresh.json';
import colorLivePreview from './color-live-preview.json';
import cardRefresh from './card-refresh.json';
import cardGenUI from './card-genui.json';
import docs from './docs.json';
import react from './react.json';
import legacy from '../../../../src/i18n/tr.json';
import workspace from './workspace.json';
import color from './color.json';
import kitCore from './kit-core.json';
import kitCollections from './kit-collections.json';
import kitRecords from './kit-records.json';
import kitDocs from './kit-docs.json';
import slider from './slider.json';
import tweaker from './tweaker.json';
import accessibilityShell from './accessibility-shell.json';
import documentationRefresh from './documentation-refresh.json';
import themeBuilder from './theme-builder.json';
import themeBuilderTokens from './theme-builder-tokens.json';
import tokenStandards from './token-standards.json';
import componentExtensions from './component-extensions.json';
import buttonExtensions from './button-extensions.json';
import colorGroups from './color-groups.json';
import selectionVariants from './selection-variants.json';
import drawerExtensions from './drawer-extensions.json';
import feedback from './feedback.json';
import dateTime from './date-time.json';
import uxSelection from './ux-selection.json';
import uxDateFilter from './ux-date-filter.json';
import uxDepartmentSelect from './ux-department-select.json';
import contentUx from './content-ux.json';
import uxCompletion from './ux-completion.json';
import overlayStandard from './overlay-standard.json';
import foundationsTokens from './foundations-tokens.json';
import foundationsStandards from './foundations-standards.json';
import foundationsGuides from './foundations-guides.json';
import foundationsTools from './foundations-tools.json';
import foundationsGenUI from './foundations-genui.json';
import foundationNavigation from './foundation-navigation.json';
import listy from './listy.json';
import listyPatterns from './listy-patterns.json';
import badge from './badge.json';
import inputTweaker from './input-tweaker.json';
import tweakerOptions from './tweaker-options.json';
import { translations as themeBuilderStates } from '../../theme-builder/states';
import previewWorkbench from './preview-workbench.json';
import docsReference from './docs-reference.json';

const messages: Readonly<Record<string, string>> = {
  // First so existing phrase translations keep precedence over the new dictionaries.
  ...docsReference,
  ...previewWorkbench,
  ...listy,
  ...listyPatterns,
  ...badge,
  ...overlayStandard,
  ...uxCompletion,
  ...contentUx,
  ...componentExtensions,
  ...buttonExtensions,
  ...colorGroups,
  ...selectionVariants,
  ...drawerExtensions,
  ...feedback,
  ...dateTime,
  ...themeBuilderStates,
  ...tokenStandards,
  ...documentationRefresh,
  ...accessibilityShell,
  ...tweaker,
  ...slider,
  ...color,
  ...kitCore,
  ...kitCollections,
  ...kitRecords,
  ...kitDocs,
  ...workspace,
  ...legacy,
  ...docs,
  ...react,
  ...buttonRefresh,
  ...buttonCatalog,
  ...dataEntryCatalog,
  ...pillRefresh,
  ...colorLivePreview,
  ...cardRefresh,
  ...cardGenUI,
  ...splitterRefresh,
  ...breadcrumbRefresh,
  ...paginationRefresh,
  ...stepsRefresh,
  ...autoCompleteRefresh,
  ...cascaderRefresh,
  ...dropdownRefresh,
  ...colorRefresh,
  ...interactionRefresh,
  ...sizeProfile,
  ...componentRefresh,
  ...gapSharedFixes,
  ...gapDisplayFixes,
  ...gapFormFixes,
  ...gapCollectionsFixes,
  ...themeBuilder,
  ...themeBuilderTokens,
  ...uxSelection,
  ...uxDateFilter,
  ...uxDepartmentSelect,
  ...inputTweaker,
  ...tweakerOptions,
  // Last so the current information architecture overrides legacy phrase translations.
  ...foundationsTokens,
  ...foundationsStandards,
  ...foundationsGuides,
  ...foundationsTools,
  ...foundationsGenUI,
  ...foundationNavigation,
};
export default messages;
