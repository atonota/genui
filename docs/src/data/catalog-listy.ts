import type { ComponentDoc } from './catalog';

/** Listy entry; its shared row primitive is also used by the Cascader popup. */
export const listyComponents: ComponentDoc[] = [
  {
    slug: 'listy',
    title: 'Listy',
    summary:
      'Show related records as readable lists on shared Atlas rows. Sixteen live patterns cover plain, selectable, reorderable, grouped and virtual lists on one central surface with the shared compact sizes.',
    antdComponent: 'Listy',
    category: 'Data display',
    sourceUrl: 'https://ant.design/components/listy/',
    whenToUse: [
      'For a list of related records that people scan, such as pages, people or recent work.',
      'Place single or multiple selection, switches and row actions as native controls inside the row; the list adds no keyboard model of its own.',
      'Use grouped sticky headers for long categorized data and a bounded virtual list for thousands of records.',
      'Use Table for aligned fields, Select for a choice and Cascader for a hierarchy. The Cascader popup reuses the same row.',
    ],
    examples: [
      {
        id: 'basic',
        title: 'Basic list',
        description:
          'AtlasListy renders native Listy with stable keys. Every row composes the shared AtlasListyItem.',
        code: `import AtlasProvider from '../src/react/AtlasProvider';
import AtlasListy from '../src/react/AtlasListy';
import '../src/styles/atlas-listy.css';

const items = [
  { key: 'button', label: 'Button', description: 'Choose an action and its emphasis.' },
  { key: 'cascader', label: 'Cascader', description: 'Choose a destination through a clear hierarchy.' },
];

export default function BasicListy() {
  return <AtlasProvider appearance="docs">
    <AtlasListy label="Documentation pages" items={items} />
  </AtlasProvider>;
}`,
      },
      {
        id: 'selection',
        title: 'Controlled selection',
        description:
          'A native radio in each row owns the name, keyboard and checked state. The row mirrors it with selected, and a polite status region announces the result.',
        code: `import { useState } from 'react';
import { Radio } from 'antd';
import AtlasProvider from '../src/react/AtlasProvider';
import AtlasListy from '../src/react/AtlasListy';
import '../src/styles/atlas-listy.css';

const teams = ['Product design', 'Engineering', 'Research'];

export default function SelectListy() {
  const [value, setValue] = useState(teams[0]);
  return <AtlasProvider appearance="docs">
    <Radio.Group value={value} onChange={event => setValue(event.target.value)}>
      <AtlasListy label="Team" items={teams.map(team => ({
        key: team,
        label: team,
        leading: <Radio value={team} aria-label={team} />,
        selected: team === value,
        interactive: true,
        rowProps: { onClick: () => setValue(team) },
      }))} />
    </Radio.Group>
    <p role="status">Selected: {value}</p>
  </AtlasProvider>;
}`,
      },
      {
        id: 'grouped',
        title: 'Grouped sticky headers',
        description:
          'AtlasListy forwards native group and sticky. The bounded height comes from a named number of compact rows, so the current group header stays visible while the list scrolls.',
        code: `import AtlasProvider from '../src/react/AtlasProvider';
import AtlasListy from '../src/react/AtlasListy';
import '../src/styles/atlas-listy.css';

// Bounded viewport: six compact md rows of 40 px.
const COMPACT_ROW = 40;
const VISIBLE_ROWS = 6;
const teamOf: Record<string, string> = {
  deniz: 'Engineering', mert: 'Engineering', elif: 'Engineering',
  can: 'Design', zeynep: 'Design', ali: 'Research', ece: 'Research',
};
const people = [
  { key: 'deniz', label: 'Deniz Kaya' },
  { key: 'mert', label: 'Mert Aydın' },
  { key: 'elif', label: 'Elif Şahin' },
  { key: 'can', label: 'Can Yılmaz' },
  { key: 'zeynep', label: 'Zeynep Arslan' },
  { key: 'ali', label: 'Ali Çelik' },
  { key: 'ece', label: 'Ece Koç' },
];

export default function GroupedListy() {
  return <AtlasProvider appearance="docs">
    <AtlasListy label="People by team" items={people} sticky
      height={COMPACT_ROW * VISIBLE_ROWS}
      group={{ key: item => teamOf[item.key] ?? 'Other', title: team => team }} />
  </AtlasProvider>;
}`,
      },
      {
        id: 'virtual',
        title: 'Virtual list with scrollTo',
        description:
          'Ten thousand local records render in a bounded virtual list. The native ref scrolls to a key from a visible button; no backend is involved.',
        code: `import { useRef } from 'react';
import type { ListyRef } from 'antd/lib/listy';
import AtlasProvider from '../src/react/AtlasProvider';
import AtlasListy from '../src/react/AtlasListy';
import AtlasButton from '../src/react/AtlasButton';
import '../src/styles/atlas-listy.css';

// Bounded viewport: ten compact md rows of 40 px.
const COMPACT_ROW = 40;
const VISIBLE_ROWS = 10;
const records = Array.from({ length: 10000 }, (_, index) => ({
  key: 'record-' + (index + 1),
  label: 'Record ' + (index + 1),
}));

export default function VirtualListy() {
  const listy = useRef<ListyRef>(null);
  return <AtlasProvider appearance="docs">
    <AtlasButton text="Jump to last item" onClick={() =>
      listy.current?.scrollTo({ key: 'record-10000', align: 'bottom' })} />
    <AtlasListy ref={listy} label="Records" items={records} virtual
      height={COMPACT_ROW * VISIBLE_ROWS} />
  </AtlasProvider>;
}`,
      },
    ],
    apiDescription:
      'AtlasListy wraps the installed native Ant Design 6.6.6 Listy and forwards its height, virtual, sticky, group, ref and onScroll contracts. Atlas supplies the shared row, the central Listy surface role and the accessible group name; the caller owns the items and state.',
    api: [
      {
        property: 'label',
        type: 'string',
        defaultValue: 'Required',
        description: 'Accessible name of the list group.',
      },
      {
        property: 'items',
        type: 'readonly AtlasListyEntry[]',
        defaultValue: 'Required',
        description:
          'Rows in display order with unique stable keys. Replace the array when data changes.',
      },
      {
        property: 'item.label / description',
        type: 'string / string',
        defaultValue: 'Required / undefined',
        description:
          'Readable row title and optional supporting text; long text wraps between words.',
      },
      {
        property: 'item.leading / trailing',
        type: 'ReactNode / ReactNode',
        defaultValue: 'undefined',
        description:
          'Leading content and short trailing context. Native controls placed there keep their own name and keyboard behavior; do not place meaning in an icon alone.',
      },
      {
        property: 'item.disabled',
        type: 'boolean',
        defaultValue: 'false',
        description: 'Marks an unavailable row; explain the reason in its description.',
      },
      {
        property: 'item.selected / interactive',
        type: 'boolean / boolean',
        defaultValue: 'false',
        description:
          'Controlled row state mirrored for styling. A native control in the row owns the checked state, name and keyboard behavior.',
      },
      {
        property: 'item.rowProps',
        type: "Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'role'>",
        defaultValue: 'undefined',
        description:
          'Attributes and handlers forwarded to the shared row, such as a pointer click that mirrors a native control. Roles stay with the host.',
      },
      {
        property: 'height / virtual',
        type: 'number / boolean',
        defaultValue: 'undefined / false',
        description:
          'Forwarded native bounded and virtual rendering. Derive the height from the compact row role; only visible rows render.',
      },
      {
        property: 'sticky / group',
        type: 'boolean / Group<AtlasListyEntry, string>',
        defaultValue: 'false / undefined',
        description:
          'Forwarded native grouped segments; sticky keeps the current group header visible while scrolling.',
      },
      {
        property: 'ref / onScroll',
        type: 'Ref<ListyRef> / UIEventHandler<HTMLElement>',
        defaultValue: 'undefined',
        description:
          'Forwarded native ref with scrollTo by index, key, group or position, and the native scroll event.',
      },
      {
        property: 'className / classNames / styles',
        type: 'string / ListyProps semantic slots',
        defaultValue: '—',
        description: 'Adds a consumer class and native root, item and group header slots.',
      },
    ],
    nativeApi: [
      {
        property: 'items / rowKey / itemRender',
        type: 'T[] / keyof T | function / function',
        defaultValue: 'Required',
        description:
          'Native data, stable identity and row rendering. AtlasListy sets rowKey to key and always renders AtlasListyItem.',
      },
      {
        property: 'height / virtual',
        type: 'number / boolean',
        defaultValue: 'undefined / native',
        description:
          'Native bounded and virtual rendering. AtlasListy forwards both; the virtual pattern keeps 10,000 local records in a bounded viewport.',
      },
      {
        property: 'group / sticky',
        type: 'Group<T> / boolean',
        defaultValue: 'undefined / false',
        description:
          'Native grouped segments with optional sticky headers. AtlasListy forwards both.',
      },
      {
        property: 'classNames / styles',
        type: 'root | item | groupHeader slots',
        defaultValue: '—',
        description: 'Native semantic object or function styling.',
      },
      {
        property: 'ref.scrollTo',
        type: '(config?: ListyScrollToConfig) => void',
        defaultValue: '—',
        description: 'Native programmatic scrolling by index, key, group or position.',
      },
    ],
    accessibility: [
      'The list group is named by label. Rows are readable content and add no extra keyboard model.',
      'Selection, switches, row actions and reorder buttons are native controls reached with Tab; outcomes are announced in a polite status region. Keyboard focus uses one non-surrounding marker.',
      'Reordering never depends on dragging: Move up and Move down buttons outside the list move the selected row and keep focus on the button.',
      'Icons are decorative; labels and descriptions carry the meaning. Unavailable rows are stated in text.',
      'At 320 CSS px rows wrap naturally and the page does not scroll horizontally. Row text defaults to 14 CSS px in Outfit; a custom typography token can lower it only to the project minimum of 12 CSS px.',
    ],
    notes: [
      'Uses the installed Ant Design 6.6.6 Listy; no package was added and vendor files are unchanged.',
      'AtlasListyItem is the shared row primitive. The Cascader popup composes the same row while keeping its native tree semantics.',
      'Compact rows follow the shared sm/md/lg profile at 32/40/48 px with the shared radius role; rows with descriptions or 48/56/64 px avatars grow instead of clipping.',
      'The Listy surface role in the Tweaker theme tokens switches every list between inset and outlined. The Cascader popup reads the same role.',
      'Sixteen live patterns: plain with key-value, unordered, ordered, icon, single select, multiple select, settings, row actions, reorder, steps, loading and empty status, rich content, nested, market, grouped and virtual.',
      'Examples use local data and local state only; there is no backend. Storybook, approved decisions and GenUI registries are unchanged.',
    ],
  },
];
