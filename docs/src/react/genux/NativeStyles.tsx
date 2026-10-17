// Native GenUX control CSS, compiled by Vite and shipped inside the optional GenUX chunk so
// pages without a rendered surface never load it. Code-owned strings only: generated payloads
// cannot contribute CSS. React 19 hoists and dedupes the resource per document by href.
import genuxFeedback from '../../styles/genux-feedback.css?inline';
import genuxAutocomplete from '../../styles/genux-autocomplete.css?inline';
import genuxAvatar from '../../styles/genux-avatar.css?inline';
import genuxContentPatterns from '../../styles/genux-content-patterns.css?inline';
import genuxBreadcrumb from '../../styles/genux-breadcrumb.css?inline';
import genuxMedia from '../../styles/genux-media.css?inline';
import genuxCarousel from '../../styles/genux-carousel.css?inline';
import genuxSelectionVariants from '../../styles/genux-selection-variants.css?inline';
import workspaceKit from '../../styles/workspace-kit.css?inline';
import kitRecords from '../../styles/kit-records.css?inline';
import genuxDrawerExtensions from '../../styles/genux-drawer-extensions.css?inline';
import genuxDropdown from '../../styles/genux-dropdown.css?inline';
import genuxPagination from '../../styles/genux-pagination.css?inline';
import genuxRichMenu from '../../styles/genux-rich-menu.css?inline';
import genuxScreenshot from '../../styles/genux-screenshot.css?inline';
import genuxChart from '../../styles/genux-chart.css?inline';
import slider from '../../styles/slider.css?inline';
import genuxSplitter from '../../styles/genux-splitter.css?inline';
import genuxSteps from '../../styles/genux-steps.css?inline';
import genuxUpload from '../../styles/genux-upload.css?inline';

// Order mirrors the native adapter catalog so cascade ties resolve as before.
const NATIVE_CSS = [
  genuxFeedback,
  genuxAutocomplete,
  genuxAvatar,
  genuxContentPatterns,
  genuxBreadcrumb,
  genuxMedia,
  genuxCarousel,
  genuxSelectionVariants,
  workspaceKit,
  kitRecords,
  genuxDrawerExtensions,
  genuxDropdown,
  genuxPagination,
  genuxRichMenu,
  genuxScreenshot,
  genuxChart,
  slider,
  genuxSplitter,
  genuxSteps,
  genuxUpload,
].join('\n');

// Unscoped on purpose: body-portalled overlays rely on the existing global selectors.
export default function NativeStyles() {
  return (
    <style href="genux-native-styles" precedence="genux-native">
      {NATIVE_CSS}
    </style>
  );
}
