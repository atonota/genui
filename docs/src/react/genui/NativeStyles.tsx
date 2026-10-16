// Native GenUI control CSS, compiled by Vite and shipped inside the optional GenUI chunk so
// pages without a rendered surface never load it. Code-owned strings only: generated payloads
// cannot contribute CSS. React 19 hoists and dedupes the resource per document by href.
import atlasFeedback from '../../styles/atlas-feedback.css?inline';
import atlasAutocomplete from '../../styles/atlas-autocomplete.css?inline';
import atlasAvatar from '../../styles/atlas-avatar.css?inline';
import atlasContentPatterns from '../../styles/atlas-content-patterns.css?inline';
import atlasBreadcrumb from '../../styles/atlas-breadcrumb.css?inline';
import atlasMedia from '../../styles/atlas-media.css?inline';
import atlasCarousel from '../../styles/atlas-carousel.css?inline';
import atlasSelectionVariants from '../../styles/atlas-selection-variants.css?inline';
import workspaceKit from '../../styles/workspace-kit.css?inline';
import kitRecords from '../../styles/kit-records.css?inline';
import atlasDrawerExtensions from '../../styles/atlas-drawer-extensions.css?inline';
import atlasDropdown from '../../styles/atlas-dropdown.css?inline';
import atlasPagination from '../../styles/atlas-pagination.css?inline';
import atlasRichMenu from '../../styles/atlas-rich-menu.css?inline';
import atlasScreenshot from '../../styles/atlas-screenshot.css?inline';
import atlasChart from '../../styles/atlas-chart.css?inline';
import slider from '../../styles/slider.css?inline';
import atlasSplitter from '../../styles/atlas-splitter.css?inline';
import atlasSteps from '../../styles/atlas-steps.css?inline';
import atlasUpload from '../../styles/atlas-upload.css?inline';

// Order mirrors the native adapter catalog so cascade ties resolve as before.
const NATIVE_CSS = [
  atlasFeedback,
  atlasAutocomplete,
  atlasAvatar,
  atlasContentPatterns,
  atlasBreadcrumb,
  atlasMedia,
  atlasCarousel,
  atlasSelectionVariants,
  workspaceKit,
  kitRecords,
  atlasDrawerExtensions,
  atlasDropdown,
  atlasPagination,
  atlasRichMenu,
  atlasScreenshot,
  atlasChart,
  slider,
  atlasSplitter,
  atlasSteps,
  atlasUpload,
].join('\n');

// Unscoped on purpose: body-portalled overlays rely on the existing global selectors.
export default function NativeStyles() {
  return (
    <style href="genui-native-styles" precedence="genui-native">
      {NATIVE_CSS}
    </style>
  );
}
