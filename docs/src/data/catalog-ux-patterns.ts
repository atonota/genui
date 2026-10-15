import type { ComponentDoc } from './catalog';

/** API rows as [property, type, default, description] keep each entry short. */
const rows = (...items: [string, string, string, string][]): ComponentDoc['api'] =>
  items.map(([property, type, defaultValue, description]) => ({
    property,
    type,
    defaultValue,
    description,
  }));

/** Example code is copied as written, so it imports every stylesheet its components need. */
const example = (id: string, title: string, description: string, code: string) => ({
  id,
  title,
  description,
  code: code.trim(),
});

/** Media, content, carousel, local upload, rich menu and chart patterns from the UX crosswalk. */
export const uxPatternComponents: ComponentDoc[] = [
  {
    slug: 'media',
    title: 'Media frame',
    summary:
      'A native figure reserves its ratio before the image loads, keeps a readable fallback when it fails and places the caption below the image.',
    antdComponent: 'Composition: native figure and img',
    category: 'Data display',
    sourceUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element/figure',
    whenToUse: [
      'For photographs and illustrations that need a caption or a short label over the image.',
      'When surrounding content must not move while an image loads or after it fails.',
      'For recorded screenshots whose text must stay readable at the original size.',
    ],
    examples: [
      example(
        'caption',
        'Photograph with caption',
        'Cover fills a landscape frame and may crop the edges. The overlay sits on an opaque panel.',
        `
import '../src/styles/atlas-media.css';
import AtlasProvider from '../src/react/AtlasProvider';
import AtlasMediaFrame from '../src/react/AtlasMediaFrame';

export default function Example() {
  return (
    <AtlasProvider appearance="docs">
      <AtlasMediaFrame
        src="/selection/coast.svg"
        alt="Coast illustration"
        caption="Cover fills the frame and may crop the edges."
        overlay="Coast"
      />
    </AtlasProvider>
  );
}`,
      ),
      example(
        'fit-and-fallback',
        'Contain and unavailable image',
        'Contain shows the whole image in a square frame. Without a usable source the frame keeps its space and shows Image unavailable with the text alternative.',
        `
import '../src/styles/atlas-media.css';
import AtlasProvider from '../src/react/AtlasProvider';
import AtlasMediaFrame from '../src/react/AtlasMediaFrame';

export default function Example() {
  return (
    <AtlasProvider appearance="docs">
      <AtlasMediaFrame
        src="/selection/city.svg"
        fit="contain"
        ratio="square"
        alt="City illustration"
        caption="Contain shows the whole image inside the frame."
      />
      <AtlasMediaFrame
        alt="Forest illustration"
        caption="The frame keeps its space when no image is available."
      />
    </AtlasProvider>
  );
}`,
      ),
      example(
        'screenshot',
        'Recorded screenshot',
        'A recorded page image keeps its original 1440 by 1000 CSS pixel size inside a bounded region that scrolls in both directions, so its text stays readable instead of shrinking.',
        `
import '../src/styles/atlas-screenshot.css';
import AtlasProvider from '../src/react/AtlasProvider';
import AtlasScreenshot from '../src/react/AtlasScreenshot';

export default function Example() {
  return (
    <AtlasProvider appearance="docs">
      <AtlasScreenshot
        src="/examples/atlas-avatar-desktop.png"
        width={1440}
        height={1000}
        alt="Recorded static image of the Atlas Avatar documentation page at 1440 by 1000 CSS pixels. It is not interactive."
        caption="Recorded Atlas Avatar example"
      />
    </AtlasProvider>
  );
}`,
      ),
    ],
    apiDescription:
      'Rows without a prefix belong to AtlasMediaFrame. Rows that start with AtlasScreenshot belong to the recorded screenshot figure.',
    api: rows(
      ['src', 'string', '-', 'Image address. Empty or missing values show the fallback.'],
      ['alt', 'string', '-', 'Text alternative. An empty string marks the image decorative.'],
      ['caption', 'string', '-', 'Visible figcaption below the frame.'],
      ['fit', "'cover' | 'contain'", "'cover'", 'Cover fills and may crop; contain shows it all.'],
      ['ratio', "'landscape' | 'square' | 'portrait'", "'landscape'", 'Reserved frame ratio.'],
      ['overlay', 'string', '-', 'Short text on an opaque panel over the image.'],
      [
        'AtlasScreenshot src',
        'string',
        '-',
        'Screenshot address. Empty values and failed loads show Screenshot unavailable.',
      ],
      [
        'AtlasScreenshot alt',
        'string',
        '-',
        'Text alternative that says what the recording shows.',
      ],
      [
        'AtlasScreenshot caption',
        'string',
        '-',
        'Visible figcaption; it also names the scroll region.',
      ],
      [
        'AtlasScreenshot width',
        'number',
        '-',
        'Original CSS width; a positive number. Other values show the fallback.',
      ],
      [
        'AtlasScreenshot height',
        'number',
        '-',
        'Original CSS height; a positive number. Other values show the fallback.',
      ],
    ),
    accessibility: [
      'alt names the image. An empty alt makes the image and its fallback decorative and hidden from assistive technology.',
      'When the image is missing or fails, the frame shows Image unavailable and the alt text as visible text.',
      'After a failed load, Retry image is a native button outside any hidden fallback text, so it stays named and reachable even for decorative images.',
      'After a retry, a status reports Retrying image, then Image loaded or Image still unavailable.',
      'The caption is a native figcaption, and overlay text sits on an opaque panel so contrast does not depend on the photograph.',
      'The screenshot scroll region is focusable and named by its caption, so arrow and page keys scroll it; a bottom edge marks keyboard focus.',
      'When the screenshot cannot load, Screenshot unavailable and the text alternative are shown as visible text instead of an empty image.',
    ],
    notes: [
      'This is a native figure composition, not the Ant Design Image component, and it has no preview overlay.',
      'The frame reserves its ratio before loading, so a slow or failed image does not shift the page.',
      'Retry image requests the same src again by remounting the image; the address is not changed, no cache-busting query is added and nothing retries on a timer.',
      'data-image-state reports none, loading, loaded or error for styling and tests; it is not a visible status.',
      'Examples use local illustrations only; no image is fetched from a remote service.',
      'AtlasScreenshot never scales the image down: width and height reserve the original size, and the region scrolls instead of shrinking the text.',
      'The recorded screenshot is a static local file with no zoom, live controls or server capability.',
    ],
  },
  {
    slug: 'content-patterns',
    title: 'Content patterns',
    summary:
      'An icon list, a quotation with a visible source and an avatar group that always shows the names of the people it represents.',
    antdComponent: 'Composition: Avatar, Button and native lists',
    category: 'Data display',
    sourceUrl: 'https://ant.design/components/avatar/',
    whenToUse: [
      'Use the icon list for short checklists or feature lists where each title carries the meaning.',
      'Use the quotation when a statement needs a visible source and, for examples, a disclosed context.',
      'Use the avatar group to show who is involved without hiding names behind overlapping photographs.',
    ],
    examples: [
      example(
        'avatar-group',
        'Named avatar group',
        'Three people are shown with their names. Expand people reveals the whole list instead of a clipped menu.',
        `
import '../src/styles/atlas-avatar.css';
import '../src/styles/atlas-content-patterns.css';
import AtlasProvider from '../src/react/AtlasProvider';
import AtlasAvatarGroup from '../src/react/AtlasAvatarGroup';

const people = [
  { id: 'ada', name: 'Ada Lovelace' },
  { id: 'sam', name: 'Sam Lee' },
  { id: 'priya', name: 'Priya Nair' },
  { id: 'morgan', name: 'Morgan Chen' },
];

export default function Example() {
  return (
    <AtlasProvider appearance="docs">
      <AtlasAvatarGroup people={people} maxVisible={3} />
    </AtlasProvider>
  );
}`,
      ),
      example(
        'list-and-quote',
        'Icon list and quotation',
        'Decorative icons mark list items, and a fictional quotation names its source and context.',
        `
import '../src/styles/atlas-content-patterns.css';
import AtlasProvider from '../src/react/AtlasProvider';
import AtlasIconList from '../src/react/AtlasIconList';
import AtlasQuote from '../src/react/AtlasQuote';

export default function Example() {
  return (
    <AtlasProvider appearance="docs">
      <AtlasIconList
        items={[
          {
            id: 'define',
            title: 'Define the task',
            description: 'Name who it serves and what a good outcome looks like.',
            icon: 'arrowRight',
          },
          { id: 'review', title: 'Review the result', icon: 'arrowRight' },
        ]}
      />
      <AtlasQuote
        quote="We start with the task, then choose the simplest useful interface."
        attribution="Atlas demo team"
        context="Fictional example"
      />
    </AtlasProvider>
  );
}`,
      ),
    ],
    apiDescription:
      'Three components share this page. Each row names the component before its property.',
    api: rows(
      [
        'AtlasIconList items',
        '{ id: string; title: string; description?: string; icon?: AtlasIconName }[]',
        '-',
        'List entries; the icon is decorative.',
      ],
      ['AtlasQuote quote', 'string', '-', 'Quoted text.'],
      ['AtlasQuote attribution', 'string', '-', 'Visible source of the quotation.'],
      ['AtlasQuote context', 'string', '-', 'Optional disclosure, for example Fictional example.'],
      [
        'AtlasAvatarGroup people',
        '{ id: string; name: string; src?: string }[]',
        '-',
        'People in display order; every name stays visible.',
      ],
      ['AtlasAvatarGroup maxVisible', 'number', '3', 'People shown before Expand people.'],
    ),
    accessibility: [
      'Icons and overlapping faces are hidden from assistive technology; visible titles and names carry the meaning.',
      'The quotation uses blockquote inside a figure, and the attribution is plain caption text.',
      'Expand people is a native button with aria-expanded and aria-controls; it reveals the whole list, so no action is clipped or hidden.',
      'The collapsed list states how many more people there are as text, not only as +N beside the faces.',
    ],
    notes: [
      'AtlasAvatarGroup composes the existing Ant Design Avatar and Button through AtlasAvatar and AtlasButton.',
      'Quotations in examples are fictional and labelled as such; they do not imply endorsement.',
      'All content is supplied by the caller; nothing is stored or fetched.',
    ],
  },
  {
    slug: 'carousel',
    title: 'Carousel',
    summary:
      'A manual slide viewer with Previous slide and Next slide buttons, a visible position status and no autoplay.',
    antdComponent: 'Composition: Button and media frame',
    category: 'Data display',
    sourceUrl: 'https://www.w3.org/WAI/ARIA/apg/patterns/carousel/',
    whenToUse: [
      'For a small set of related images that people step through in order.',
      'Prefer a visible list or grid when people need to compare items side by side.',
    ],
    examples: [
      example(
        'basic',
        'Illustration gallery',
        'Buttons move one slide at a time and wrap at the ends. The status reports the current position.',
        `
import '../src/styles/atlas-media.css';
import '../src/styles/atlas-carousel.css';
import AtlasProvider from '../src/react/AtlasProvider';
import AtlasCarousel from '../src/react/AtlasCarousel';

const slides = [
  {
    id: 'coast',
    title: 'Coast',
    src: '/selection/coast.svg',
    alt: 'Coast illustration',
    caption: 'A quiet shoreline with waves reaching the sand.',
  },
  { id: 'forest', title: 'Forest', src: '/selection/forest.svg', alt: 'Forest illustration' },
  { id: 'city', title: 'City', src: '/selection/city.svg', alt: 'City illustration' },
];

export default function Example() {
  return (
    <AtlasProvider appearance="docs">
      <AtlasCarousel label="Illustration gallery" slides={slides} />
    </AtlasProvider>
  );
}`,
      ),
    ],
    api: rows(
      [
        'slides',
        '{ id: string; title: string; src: string; alt: string; caption?: string }[]',
        '-',
        'Slides in order; only the active slide is rendered.',
      ],
      ['label', 'string', '-', 'Accessible name of the carousel section.'],
    ),
    accessibility: [
      'The section is named by label and announced as a carousel; the active slide is a group named Slide {current} of {total}.',
      'A status message repeats the position after each move, and both buttons point to the slide with aria-controls.',
      'Navigation wraps at the ends, so a pressed button never disables itself and focus stays in place.',
      'Nothing moves on its own, so there is no pause control to find.',
    ],
    notes: [
      'This is not the Ant Design Carousel: there is no autoplay, timer, swipe gesture or slide transition.',
      'With one slide both buttons are disabled; with none the section shows No slides available.',
      'If the caller shortens the list, the shown slide stays within the new range.',
    ],
  },
  {
    slug: 'upload',
    title: 'Upload',
    summary:
      'Local file selection on Upload.Dragger: chosen files are checked, listed with name and size and can be removed. Nothing is sent to a server.',
    antdComponent: 'Upload.Dragger',
    category: 'Data entry',
    sourceUrl: 'https://ant.design/components/upload/',
    whenToUse: [
      'When people choose or drop files that the page reads or passes to its own later step.',
      'When type and size limits must be explained before and after a choice.',
    ],
    examples: [
      example(
        'local',
        'Local text files',
        'Accepts text files up to 1 KB. Refused files are explained by name, and the count updates as files are added or removed.',
        `
import { useState } from 'react';
import '../src/styles/atlas-upload.css';
import AtlasProvider from '../src/react/AtlasProvider';
import AtlasUpload from '../src/react/AtlasUpload';

export default function Example() {
  const [files, setFiles] = useState<File[]>([]);
  return (
    <AtlasProvider appearance="docs">
      <AtlasUpload
        label="Choose local files"
        accept="text/plain,.txt"
        maxBytes={1024}
        multiple
        onFilesChange={setFiles}
      />
      <p role="status">Files selected: {files.length}</p>
    </AtlasProvider>
  );
}`,
      ),
    ],
    api: rows(
      [
        'label',
        'string',
        '-',
        'Visible name of the choose control, for example Choose local files.',
      ],
      ['accept', 'string', '-', 'Comma-separated MIME types, wildcards and extensions.'],
      [
        'maxBytes',
        'number',
        '-',
        'Finite positive limit per file; other values disable the control.',
      ],
      ['multiple', 'boolean', 'false', 'Allows several files; otherwise one file is kept.'],
      [
        'disabled',
        'boolean',
        'inherited',
        'Disables choosing and removing; defaults to ConfigProvider.',
      ],
      [
        'onFilesChange',
        '(files: File[]) => void',
        '-',
        'Receives the current local File list after each change.',
      ],
    ),
    nativeApi: rows(
      [
        'fileList',
        'UploadFile[]',
        '-',
        'Controlled list with uid, name, size, type and the local file only.',
      ],
      [
        'beforeUpload',
        '(file, batch) => false | typeof Upload.LIST_IGNORE',
        '-',
        'False keeps a valid file local; LIST_IGNORE refuses it with a visible alert.',
      ],
      ['maxCount', 'number', '1 when single', 'Keeps one file unless multiple is set.'],
      ['showUploadList', 'object', 'remove only', 'Preview and download icons are off.'],
      ['itemRender', 'function', '-', 'Renders name, size and an accessible Remove button.'],
    ),
    accessibility: [
      'The drop area is a button named by label; Enter and Space open the native file chooser.',
      'Helper text states that files stay on this device and lists the accepted types and size limit.',
      'Refused files are reported by name with the reason, file type or size, in a role alert region.',
      'Each remove button is named Remove {name}, and focus returns to the choose control after removal.',
    ],
    notes: [
      'There is no action, customRequest or progress: files never leave the device and are never shown as uploaded.',
      'The accept value is only a hint for the native chooser; every chosen or dropped file is checked again.',
      'The list lives in memory only; reloading the page clears it and nothing is written to storage.',
      'parseAccept, isValidMaxBytes and uploadRejection are exported for callers that need the same rules.',
    ],
  },
  {
    slug: 'rich-menu',
    title: 'Rich menu',
    summary:
      'Grouped menu actions with a title and description each, built on AtlasDropdown so the native menu keeps its focus, keyboard and dismissal behavior.',
    antdComponent: 'Dropdown',
    category: 'Navigation',
    sourceUrl: 'https://ant.design/components/dropdown/',
    whenToUse: [
      'When a few related actions each need a sentence of explanation before people choose.',
      'Use a plain dropdown when the action titles alone are clear.',
    ],
    examples: [
      example(
        'grouped',
        'Workspace shortcuts',
        'Two labelled groups with descriptions and one unavailable action. Choosing an action updates local status text.',
        `
import { useState } from 'react';
import '../src/styles/atlas-dropdown.css';
import '../src/styles/atlas-rich-menu.css';
import AtlasProvider from '../src/react/AtlasProvider';
import AtlasRichMenu, { type AtlasRichMenuGroup } from '../src/react/AtlasRichMenu';

const groups: AtlasRichMenuGroup[] = [
  {
    id: 'report-tools',
    label: 'Report tools',
    items: [
      {
        id: 'draft-report',
        label: 'Draft report',
        description: 'Create a report from the current workspace.',
      },
      {
        id: 'publish-remotely',
        label: 'Publish remotely',
        description: 'Remote publishing is not available in this example.',
        disabled: true,
      },
    ],
  },
  {
    id: 'collection-tools',
    label: 'Collection tools',
    items: [
      { id: 'new-collection', label: 'New collection', description: 'Organize related records.' },
    ],
  },
];

export default function Example() {
  const [selected, setSelected] = useState('');
  const label = groups.flatMap(group => group.items).find(item => item.id === selected)?.label;
  return (
    <AtlasProvider appearance="docs">
      <AtlasRichMenu label="Workspace shortcuts" groups={groups} onAction={setSelected} />
      <p role="status">{label ? 'Selected: ' + label : ''}</p>
    </AtlasProvider>
  );
}`,
      ),
    ],
    api: rows(
      ['label', 'string', '-', 'Visible trigger text and accessible name.'],
      ['groups', 'AtlasRichMenuGroup[]', '-', 'Labelled groups of actions in keyboard order.'],
      ['onAction', '(id: string) => void', '-', 'Called with the chosen item id.'],
      [
        'AtlasRichMenuGroup',
        '{ id: string; label: string; items: AtlasRichMenuItem[] }',
        '-',
        'One labelled group of actions.',
      ],
      [
        'AtlasRichMenuItem',
        '{ id: string; label: string; description: string; icon?: AtlasIconName; disabled?: boolean }',
        '-',
        'One action; the description is required.',
      ],
    ),
    nativeApi: rows(
      [
        'menu.items',
        "{ type: 'group'; key; label; children }[]",
        '-',
        'Each group becomes a native menu group.',
      ],
      [
        'classNames.root',
        'string',
        "'atlas-rich-menu-popup'",
        'Scopes the rich layout to this popup.',
      ],
    ),
    accessibility: [
      'The trigger is a button named by label, and group labels are announced with their actions.',
      'Each item name includes its title and description; icons are hidden from assistive technology.',
      'Arrow keys follow the flat DOM order of items, also when wide popups lay groups out in two columns.',
      'Unavailable actions stay visible and disabled, and Escape closes the menu.',
    ],
    notes: [
      'There is no second menu engine: grouping, focus and dismissal come from AtlasDropdown and Ant Design Dropdown.',
      'Narrow screens use one column with a maximum height and scrolling inside the popup.',
      'onAction only reports an id; the example updates local status text such as Selected: Draft report.',
    ],
  },
  {
    slug: 'chart',
    title: 'Chart',
    summary:
      'A static grouped bar chart in SVG with value labels, patterned series, a visible legend and the complete numeric table.',
    antdComponent: 'Composition: native SVG and table',
    category: 'Data display',
    sourceUrl: 'https://developer.mozilla.org/en-US/docs/Web/SVG/Element/rect',
    whenToUse: [
      'To compare a few series across a short list of categories on one scale.',
      'When the exact values must stay available as a table next to the picture.',
    ],
    examples: [
      example(
        'grouped',
        'Weekly activity',
        'Planned and completed tasks share one scale from zero. Each bar shows its value, and the table lists every number.',
        `
import '../src/styles/atlas-chart.css';
import AtlasProvider from '../src/react/AtlasProvider';
import AtlasChart from '../src/react/AtlasChart';

export default function Example() {
  return (
    <AtlasProvider appearance="docs">
      <AtlasChart
        title="Weekly activity"
        description="Tasks planned and completed each day on one scale that starts at zero."
        categories={['Mon', 'Tue', 'Wed']}
        series={[
          { id: 'planned', label: 'Planned', values: [10, 15, 12] },
          { id: 'completed', label: 'Completed', values: [8, 12, 11] },
        ]}
      />
    </AtlasProvider>
  );
}`,
      ),
      example(
        'invalid',
        'Data that cannot be drawn',
        'A series with fewer values than categories is refused with an explicit reason instead of a broken chart.',
        `
import '../src/styles/atlas-chart.css';
import AtlasProvider from '../src/react/AtlasProvider';
import AtlasChart from '../src/react/AtlasChart';

export default function Example() {
  return (
    <AtlasProvider appearance="docs">
      <AtlasChart
        title="Weekly activity"
        categories={['Mon', 'Tue', 'Wed']}
        series={[{ id: 'planned', label: 'Planned', values: [10, 15] }]}
      />
    </AtlasProvider>
  );
}`,
      ),
    ],
    api: rows(
      ['title', 'string', '-', 'Chart name; it also captions the value table.'],
      ['categories', 'string[]', '-', 'Category names in order, one group of bars each.'],
      [
        'series',
        '{ id: string; label: string; values: number[] }[]',
        '-',
        'One value per category.',
      ],
      ['description', 'string', '-', 'Optional summary that describes the figure.'],
    ),
    accessibility: [
      'The figure is named by its title and described by description; drawn bars are hidden and the table carries the data.',
      'Series differ by pattern as well as color, each bar shows its value as text and the legend stays visible.',
      'The table has a caption, row and column headers and end-aligned tabular numbers.',
      'The plot and the table scroll inside their own focusable regions instead of widening the page.',
    ],
    notes: [
      'No chart library is used; bar geometry is plain arithmetic on one scale that starts at zero.',
      'Empty data, unnamed categories, duplicate series ids, unequal lengths and negative or non-finite values show Chart data unavailable with the reason in an alert.',
      'The chart is static: no animation, tooltips or interaction beyond scrolling.',
      'chartDataProblem is exported so callers can check data before rendering.',
    ],
  },
];
