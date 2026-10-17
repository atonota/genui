import type { ComponentDoc } from './catalog';

/** Empty State and Avatar entries kept in their own module so each source file stays within the root size guard. */
export const contentComponents: ComponentDoc[] = [
  {
    slug: 'empty-state',
    title: 'Empty State',
    summary:
      'Explain why a collection shows nothing and offer the next useful step. First use, no matching results and unavailable records each have their own message and action.',
    antdComponent: 'Empty',
    category: 'Feedback',
    sourceUrl: 'https://ant.design/components/empty/',
    whenToUse: [
      'When a collection has no records yet. Treat the first view as an invitation to start, not as a blank area.',
      'When a search or filter returns nothing. Say so and offer a way to change or clear the search.',
      'When supplied records cannot be shown. Explain the problem and offer recovery. Loading and denied access are different states with their own messages.',
    ],
    examples: [
      {
        id: 'first-use',
        title: 'First-use collection',
        description:
          'An empty collection invites the first useful action. Creating a record changes local state only.',
        code: `import { useState } from 'react';
import GenUXProvider from '../src/react/GenUXProvider';
import GenUXEmptyState from '../src/react/GenUXEmptyState';

export default function FirstUseCollection() {
  const [created, setCreated] = useState(false);
  return <GenUXProvider appearance="docs">
    {!created && <GenUXEmptyState kind="empty" title="No records yet"
      description="Create your first record to start organizing this collection."
      actionLabel="Create first record" onAction={() => setCreated(true)} />}
    <p role="status">{created ? 'First local record created' : ''}</p>
  </GenUXProvider>;
}`,
      },
      {
        id: 'no-match',
        title: 'Filtered collection',
        description:
          'The search field keeps its value while nothing matches. Clear search restores the available record.',
        code: `import { useState } from 'react';
import GenUXProvider from '../src/react/GenUXProvider';
import GenUXInput from '../src/react/GenUXInput';
import GenUXEmptyState from '../src/react/GenUXEmptyState';

const records = ['GenUX research brief'];

export default function FilteredCollection() {
  const [query, setQuery] = useState('roadmap');
  const term = query.trim().toLowerCase();
  const matches = records.filter(title => title.toLowerCase().includes(term));
  return <GenUXProvider appearance="docs">
    <GenUXInput aria-label="Search example records" value={query}
      onChange={event => setQuery(event.target.value)} allowClear />
    {matches.length > 0
      ? <ul>{matches.map(title => <li key={title}>{title}</li>)}</ul>
      : <GenUXEmptyState kind="no-match" title="Nothing matches this search"
          description="Change your search or clear it to see the available records."
          actionLabel="Clear search" onAction={() => setQuery('')} />}
  </GenUXProvider>;
}`,
      },
      {
        id: 'error',
        title: 'Unavailable collection',
        description:
          'An error explains what happened and offers recovery. Try again restores the supplied local records without a request.',
        code: `import { useState } from 'react';
import GenUXProvider from '../src/react/GenUXProvider';
import GenUXEmptyState from '../src/react/GenUXEmptyState';

export default function UnavailableCollection() {
  const [restored, setRestored] = useState(false);
  return <GenUXProvider appearance="docs">
    {restored
      ? <ul><li>GenUX research brief</li></ul>
      : <GenUXEmptyState kind="error" title="Records could not be shown"
          description="This local example can restore its supplied records."
          actionLabel="Try again" onAction={() => setRestored(true)} />}
    <p role="status">{restored ? 'Local records restored' : ''}</p>
  </GenUXProvider>;
}`,
      },
    ],
    apiDescription:
      'GenUXEmptyState wraps native Ant Design Empty with a real heading, an explanation and one optional contextual action. The host owns the records, the action and its outcome.',
    api: [
      {
        property: 'kind',
        type: "'empty' | 'no-match' | 'error'",
        defaultValue: 'Required',
        description:
          'Why nothing is shown: a first-use collection, a search without results or records that could not be shown. Loading and denied access are separate states.',
      },
      {
        property: 'title / description',
        type: 'string / string',
        defaultValue: 'Required / undefined',
        description:
          'A short visible heading stating what happened, and an optional explanation of the cause and next step.',
      },
      {
        property: 'actionLabel / onAction',
        type: 'string / () => void',
        defaultValue: 'undefined',
        description:
          'One optional contextual action, such as creating a first record, clearing a search or trying again. The host performs the actual work.',
      },
      {
        property: 'headingLevel',
        type: '2 | 3 | 4 | 5 | 6',
        defaultValue: '4',
        description: 'Real heading level that fits the surrounding document outline.',
      },
    ],
    nativeApi: [
      {
        property: 'description',
        type: 'ReactNode',
        defaultValue: 'Localized No data',
        description: 'Native explanatory text below the image.',
      },
      {
        property: 'image',
        type: 'ReactNode | Empty.PRESENTED_IMAGE_SIMPLE | Empty.PRESENTED_IMAGE_DEFAULT',
        defaultValue: 'Empty.PRESENTED_IMAGE_DEFAULT',
        description: 'Decorative illustration. It never replaces the heading or explanation.',
      },
      {
        property: 'children',
        type: 'ReactNode',
        defaultValue: '—',
        description: 'Native footer content below the description, used for a contextual action.',
      },
      {
        property: 'classNames / styles',
        type: 'Empty semantic slots',
        defaultValue: '—',
        description: 'Scoped root, image, description and footer styling.',
      },
    ],
    accessibility: [
      'Use a real heading and readable text. Illustrations are decorative and never the only explanation.',
      'Name the action by its outcome, such as Create first record or Clear search. Keyboard focus uses one non-surrounding marker.',
      'Announce results such as a created record or restored list in nearby status text. Keep the search field and its value when nothing matches.',
      'Distinguish first use, no match and error in text, not by color alone. Error text explains how to recover.',
    ],
    notes: [
      'Guidance paraphrases Refactoring UI on empty states (pages 234-236): treat the first view as an invitation to act and lead with one clear action. No book text or images are reproduced.',
      'Loading uses a progress indicator and denied access uses a permission message. Neither is an empty state.',
      'Uses existing shared component styles and tokens. No decorative card or border is added, and readable text stays at least 14 CSS px in Outfit.',
      'Examples change local state only. They make no network request, save no data and register no GenUX capability.',
      'Browser behavior checks for these examples are in docs/browser/refactoring-ui.spec.ts.',
      'This web experiment leaves Storybook and approved component decisions unchanged.',
      'Native Ant Design 6.6.6 APIs are referenced here; browser, device and rendered accessibility acceptance remain separate from source and DOM checks.',
    ],
  },
  {
    slug: 'avatar',
    title: 'Avatar',
    summary:
      'Help people recognize who is involved with a profile image or readable initials. A missing image keeps the same size and shape, and the name stays available as text.',
    antdComponent: 'Avatar',
    category: 'Content',
    sourceUrl: 'https://ant.design/components/avatar/',
    whenToUse: [
      'Beside a name in lists, comments, assignments and record headers, to support quick recognition.',
      'Always pair the avatar with a meaningful name. Images and initials support recognition; they do not replace the name.',
      'Do not use avatar color alone to communicate status, role or availability.',
    ],
    examples: [
      {
        id: 'names',
        title: 'Image and initials',
        description:
          'Each avatar receives the person name. Beside the visible name it is decorative, so the name is announced once. Without an image, initials derived from the name fill the same space.',
        code: `import GenUXProvider from '../src/react/GenUXProvider';
import GenUXAvatar from '../src/react/GenUXAvatar';
import '../src/styles/genux-avatar.css';

const people = ['Ada Lovelace', 'Sam Lee', 'Unknown person'];

export default function PeopleList() {
  return <GenUXProvider appearance="docs">
    <ul aria-label="Avatar examples">
      {people.map(name => <li key={name}><GenUXAvatar name={name} decorative /> {name}</li>)}
    </ul>
  </GenUXProvider>;
}`,
      },
      {
        id: 'image-failure',
        title: 'Image unavailable',
        description:
          'This example points to a missing local image. The avatar keeps its fixed size and shape and shows initials instead. Standing alone, it keeps the person name as its accessible name.',
        code: `import GenUXProvider from '../src/react/GenUXProvider';
import GenUXAvatar from '../src/react/GenUXAvatar';
import '../src/styles/genux-avatar.css';

export default function MissingImage() {
  return <GenUXProvider appearance="docs">
    <GenUXAvatar name="Ada Lovelace" src="/genux-avatar-missing-example.png" />
    <p>A missing image uses initials in the same reserved space.</p>
  </GenUXProvider>;
}`,
      },
      {
        id: 'size-shape',
        title: 'Size and shape',
        description:
          'Size follows the shared sm, md and lg profile unless supplied. Shape stays fixed for images and initials.',
        code: `import GenUXProvider from '../src/react/GenUXProvider';
import GenUXAvatar from '../src/react/GenUXAvatar';
import '../src/styles/genux-avatar.css';

export default function AvatarShapes() {
  return <GenUXProvider appearance="docs">
    <GenUXAvatar name="Sam Lee" size="sm" />
    <GenUXAvatar name="Sam Lee" />
    <GenUXAvatar name="Sam Lee" size="lg" shape="square" />
  </GenUXProvider>;
}`,
      },
    ],
    apiDescription:
      'GenUXAvatar wraps native Ant Design Avatar. It derives initials from the supplied name and keeps a fixed size and shape when an image cannot load. Beside a visible name, mark it decorative so the name is announced once.',
    api: [
      {
        property: 'name',
        type: 'string',
        defaultValue: 'Required',
        description:
          'Person name used for the derived initials and, when the avatar stands alone, its accessible name.',
      },
      {
        property: 'src',
        type: 'string',
        defaultValue: 'undefined',
        description:
          'Optional profile image URL. When it cannot load, initials appear in the same reserved space.',
      },
      {
        property: 'size',
        type: "'sm' | 'md' | 'lg'",
        defaultValue: 'Inherited profile',
        description:
          'Shared GenUX size. Without a value the avatar follows the surrounding size profile.',
      },
      {
        property: 'shape',
        type: "'circle' | 'square'",
        defaultValue: "'circle'",
        description: 'Fixed shape that stays the same when an image fails.',
      },
      {
        property: 'decorative',
        type: 'boolean',
        defaultValue: 'false',
        description:
          'Hides the avatar from assistive technology when the same name is visible beside it. A standalone avatar keeps one image role named by the person.',
      },
    ],
    nativeApi: [
      {
        property: 'src / alt',
        type: 'string | ReactNode / string',
        defaultValue: '—',
        description: 'Native image source and alternative text.',
      },
      {
        property: 'onError',
        type: '() => boolean',
        defaultValue: '—',
        description:
          'Native image failure handler. Returning false prevents the native fallback to children.',
      },
      {
        property: 'children / gap',
        type: 'ReactNode / number',
        defaultValue: '— / 4',
        description: 'Native text content, such as initials, scaled to fit within the avatar.',
      },
      {
        property: 'shape / size',
        type: "'circle' | 'square' / number | AvatarSize",
        defaultValue: "'circle' / —",
        description: 'Native shape and size. GenUX sizes control the rendered dimensions.',
      },
    ],
    accessibility: [
      'Every avatar receives a meaningful person name. When it stands alone, that name is its accessible name. Beside a visible name, set decorative so the name is not announced twice.',
      'Initials and a failed image keep the same reserved size and shape, so the layout does not shift.',
      'Never use avatar color alone for status. State presence, role or availability in text.',
      'Initials and adjacent names stay at least 14 CSS px and readable in both themes.',
    ],
    notes: [
      'Guidance paraphrases Refactoring UI on user-supplied images (pages 214-216): give them a fixed size and shape and a calm fallback. No book text or images are reproduced.',
      'GenUXAvatar styles load only on this route from genux-avatar.css. Each usage example imports that stylesheet explicitly; the component never imports it globally. Upload, cropping and profile services are outside this component.',
      'Examples use fictional names and a deliberately missing local image path. They call no backend, save no data and register no GenUX capability.',
      'Browser behavior checks for these examples are in docs/browser/refactoring-ui.spec.ts.',
      'This web experiment leaves Storybook and approved component decisions unchanged.',
      'Native Ant Design 6.6.6 APIs are referenced here; browser, device and rendered accessibility acceptance remain separate from source and DOM checks.',
    ],
  },
];
