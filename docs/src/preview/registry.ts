/** Allowlist of the 40 documentation demos the isolated preview document renders. Module paths
    and export names copy the component route's island sources; stylesheet lists copy its route
    stylesheet rules in cascade order (Data workspace routes assume the splitter category rule).
    Loaders stay dynamic, so a browser loads only the selected demo. Unknown ids fail the build. */
import type { ComponentType } from 'react';

export type PreviewDemoProps = { documentation?: boolean };
type DemoModule = Record<string, unknown>;
export type PreviewEntry = {
  readonly source: string;
  readonly exportName: string;
  readonly styles: readonly string[];
  readonly load: () => Promise<DemoModule>;
};

const entry = (
  module: string,
  load: () => Promise<DemoModule>,
  exportName = 'default',
  styles = '',
): PreviewEntry => ({
  source: `docs/src/react/${module}.tsx`,
  exportName,
  styles: styles ? styles.split(' ').map(name => `${name}.css`) : [],
  load,
});

const dataEntry = 'data-entry-catalog';
const selection = `${dataEntry} atlas-selection-variants`;
const feedback = 'atlas-card atlas-feedback';
const workspace = 'atlas-card atlas-splitter';
const kit = 'workspace-kit kit-forms-fixes';
const collections = `${workspace} atlas-avatar workspace workspace-collections ${kit} kit-identity`;

export const previewRegistry: Readonly<Record<string, PreviewEntry>> = {
  button: entry(
    'ButtonDemo',
    () => import('../react/ButtonDemo'),
    'WebButtonDemo',
    'button-catalog',
  ),
  input: entry('InputDemo', () => import('../react/InputDemo'), 'WebInputDemo', dataEntry),
  select: entry('SelectDemo', () => import('../react/SelectDemo'), 'WebSelectDemo', dataEntry),
  pill: entry('PillDemo', () => import('../react/PillDemo'), 'default', 'pill-catalog'),
  card: entry('CardDemo', () => import('../react/CardDemo'), 'default', 'atlas-card card-catalog'),
  splitter: entry(
    'SplitterDemo',
    () => import('../react/SplitterDemo'),
    'default',
    'atlas-splitter splitter-catalog',
  ),
  breadcrumb: entry(
    'BreadcrumbDemo',
    () => import('../react/BreadcrumbDemo'),
    'default',
    'atlas-breadcrumb breadcrumb-catalog',
  ),
  pagination: entry(
    'PaginationDemo',
    () => import('../react/PaginationDemo'),
    'default',
    'atlas-pagination pagination-catalog',
  ),
  steps: entry(
    'StepsDemo',
    () => import('../react/StepsDemo'),
    'default',
    'atlas-steps steps-catalog',
  ),
  autocomplete: entry(
    'AutoCompleteDemo',
    () => import('../react/AutoCompleteDemo'),
    'default',
    'atlas-autocomplete autocomplete-catalog',
  ),
  cascader: entry(
    'CascaderDemo',
    () => import('../react/CascaderDemo'),
    'default',
    'atlas-cascader atlas-listy cascader-catalog',
  ),
  dropdown: entry(
    'DropdownDemo',
    () => import('../react/DropdownDemo'),
    'default',
    'atlas-dropdown dropdown-catalog',
  ),
  checkbox: entry(
    'CheckboxDemo',
    () => import('../react/CheckboxDemo'),
    'WebCheckboxDemo',
    selection,
  ),
  radio: entry('RadioDemo', () => import('../react/RadioDemo'), 'WebRadioDemo', selection),
  switch: entry('SwitchDemo', () => import('../react/SwitchDemo'), 'WebSwitchDemo', selection),
  slider: entry(
    'SliderDemo',
    () => import('../react/SliderDemo'),
    'default',
    `slider ${dataEntry}`,
  ),
  accordion: entry('AccordionDemo', () => import('../react/AccordionDemo')),
  form: entry('FormDemo', () => import('../react/FormDemo'), 'default', dataEntry),
  drawer: entry(
    'DrawerDemo',
    () => import('../react/DrawerDemo'),
    'default',
    'atlas-drawer-extensions',
  ),
  'empty-state': entry(
    'EmptyStateDemo',
    () => import('../react/EmptyStateDemo'),
    'default',
    'atlas-pagination kit-collections',
  ),
  avatar: entry('AvatarDemo', () => import('../react/AvatarDemo'), 'default', 'atlas-avatar'),
  toast: entry('FeedbackDemo', () => import('../react/FeedbackDemo'), 'ToastDemo', feedback),
  alert: entry('FeedbackDemo', () => import('../react/FeedbackDemo'), 'AlertDemo', feedback),
  notification: entry(
    'FeedbackDemo',
    () => import('../react/FeedbackDemo'),
    'NotificationDemo',
    feedback,
  ),
  modal: entry('FeedbackDemo', () => import('../react/FeedbackDemo'), 'ModalDemo', feedback),
  popconfirm: entry(
    'FeedbackDemo',
    () => import('../react/FeedbackDemo'),
    'PopconfirmDemo',
    feedback,
  ),
  'date-time': entry(
    'DateTimeDemo',
    () => import('../react/DateTimeDemo'),
    'default',
    `${dataEntry} atlas-date-time`,
  ),
  'data-table': entry(
    'workspace/CollectionDemo',
    () => import('../react/workspace/CollectionDemo'),
    'DataTableDemo',
    collections,
  ),
  'collection-views': entry(
    'workspace/CollectionDemo',
    () => import('../react/workspace/CollectionDemo'),
    'default',
    collections,
  ),
  'record-details': entry(
    'workspace/RecordDetailsDemo',
    () => import('../react/workspace/RecordDetailsDemo'),
    'default',
    `${workspace} workspace workspace-details ${kit}`,
  ),
  'record-forms': entry(
    'workspace/RecordFormsDemo',
    () => import('../react/workspace/RecordFormsDemo'),
    'default',
    `${workspace} workspace workspace-forms ${kit}`,
  ),
  'record-workspace': entry(
    'workspace/kit/ConnectedWorkspace',
    () => import('../react/workspace/kit/ConnectedWorkspace'),
    'default',
    `slider ${workspace} atlas-pagination atlas-avatar ${kit} workspace workspace-connected kit-collections kit-records kit-identity`,
  ),
  media: entry(
    'MediaDemo',
    () => import('../react/MediaDemo'),
    'default',
    'atlas-media atlas-screenshot',
  ),
  'content-patterns': entry(
    'ContentPatternsDemo',
    () => import('../react/ContentPatternsDemo'),
    'default',
    'atlas-avatar atlas-content-patterns',
  ),
  carousel: entry(
    'CarouselDemo',
    () => import('../react/CarouselDemo'),
    'default',
    'atlas-media atlas-carousel',
  ),
  upload: entry('UploadDemo', () => import('../react/UploadDemo'), 'default', 'atlas-upload'),
  'rich-menu': entry(
    'RichMenuDemo',
    () => import('../react/RichMenuDemo'),
    'default',
    'atlas-dropdown atlas-rich-menu',
  ),
  chart: entry('ChartDemo', () => import('../react/ChartDemo'), 'default', 'atlas-chart'),
  listy: entry(
    'ListyDemo',
    () => import('../react/ListyDemo'),
    'default',
    'atlas-listy atlas-selection-variants atlas-avatar',
  ),
  badge: entry(
    'BadgeDemo',
    () => import('../react/BadgeDemo'),
    'default',
    'atlas-avatar atlas-badge',
  ),
};

// Delivery metadata and its usage helper live in the pure delivery-contract module, so the Code
// view can use them without loading this allowlist; re-exported here for existing importers.
export {
  previewEntrySources,
  previewDeliveryPropNames,
  previewDeliveryContracts,
  previewDeliveryUsage,
} from './delivery-contract';
export type { PreviewDeliveryValues, PreviewDeliveryContract } from './delivery-contract';

/** Longest registered component slug that prefixes a literal example id. */
export function previewSlugForId(id: string): string {
  const slug = Object.keys(previewRegistry)
    .filter(candidate => id === candidate || id.startsWith(`${candidate}-`))
    .sort((a, b) => b.length - a.length)[0];
  if (!slug) throw new Error(`Preview id '${id}' matches no registered component route.`);
  return slug;
}

export async function resolvePreviewDemo(
  entry: PreviewEntry,
): Promise<ComponentType<PreviewDemoProps>> {
  const demo = (await entry.load())[entry.exportName];
  if (typeof demo !== 'function' && (typeof demo !== 'object' || demo === null))
    throw new TypeError(`${entry.source} has no ${entry.exportName} export.`);
  return demo as ComponentType<PreviewDemoProps>;
}
