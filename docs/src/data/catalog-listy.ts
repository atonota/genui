import type { ComponentDoc } from './catalog';

/** Listy entry; its shared row primitive is also used by the Cascader popup. */
export const listyComponents: ComponentDoc[] = [
  {
    slug: 'listy',
    title: 'Listy',
    summary:
      'Show a readable list of related records with shared Atlas rows. Labels, descriptions and leading or trailing content keep the shared sm, md and lg heights.',
    antdComponent: 'Listy',
    category: 'Data display',
    sourceUrl: 'https://ant.design/components/listy/',
    whenToUse: [
      'For a list of related records that people scan, such as pages, people or recent work.',
      'Use the inset presentation inside a panel and the outlined presentation when the list needs a functional boundary.',
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
        id: 'presentation',
        title: 'Leading, trailing and presentation',
        description:
          'Leading icons are decorative and trailing text adds short context. The page owns the presentation value; unavailable rows stay readable.',
        code: `import { useState } from 'react';
import AtlasProvider from '../src/react/AtlasProvider';
import AtlasListy, { type AtlasListyPresentation } from '../src/react/AtlasListy';
import AtlasIcon from '../src/react/AtlasIcon';
import '../src/styles/atlas-listy.css';

export default function PresentedListy() {
  const [presentation] = useState<AtlasListyPresentation>('outlined');
  return <AtlasProvider appearance="docs">
    <AtlasListy label="Recent pages" presentation={presentation} items={[
      { key: 'home', label: 'Overview', leading: <AtlasIcon name="house" />, trailing: 'Guide' },
      { key: 'search', label: 'Search', leading: <AtlasIcon name="search" />, trailing: 'Pattern' },
      { key: 'archive', label: 'Archived pages', disabled: true },
    ]} />
  </AtlasProvider>;
}`,
      },
    ],
    apiDescription:
      'AtlasListy wraps the installed native Ant Design 6.6.6 Listy. Atlas supplies the shared row, presentation and accessible group name; the caller owns the items.',
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
          'Decorative leading content and short trailing context. Do not place meaning in an icon alone.',
      },
      {
        property: 'item.disabled',
        type: 'boolean',
        defaultValue: 'false',
        description: 'Marks an unavailable row; explain the reason in its description.',
      },
      {
        property: 'presentation',
        type: "'inset' | 'outlined'",
        defaultValue: "'inset'",
        description:
          'Inset rows sit inside the list surface; outlined adds one functional boundary.',
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
          'Native data, stable identity and row rendering. Atlas renders AtlasListyItem.',
      },
      {
        property: 'height / virtual',
        type: 'number / boolean',
        defaultValue: 'undefined / native',
        description:
          'Native bounded and virtual rendering. AtlasListy renders every row without virtualization.',
      },
      {
        property: 'group / sticky',
        type: 'Group<T> / boolean',
        defaultValue: 'undefined / false',
        description: 'Native grouped segments with optional sticky headers.',
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
      'Interactive content inside a row uses native controls reached with Tab. Keyboard focus uses one non-surrounding marker.',
      'Icons are decorative; labels and descriptions carry the meaning. Unavailable rows are stated in text.',
      'At 320 CSS px rows wrap naturally, text stays at least 14 CSS px in Outfit and the page does not scroll horizontally.',
    ],
    notes: [
      'Uses the installed Ant Design 6.6.6 Listy; no package was added and vendor files are unchanged.',
      'AtlasListyItem is the shared row primitive. The Cascader popup composes the same row while keeping its native tree semantics.',
      'Rows follow the shared sm/md/lg profile at 32/40/48 px with the shared 5 px radius. Presentation settings live in the Tweaker.',
      'Examples use local data only. Storybook, approved decisions and GenUI registries are unchanged.',
    ],
  },
];
