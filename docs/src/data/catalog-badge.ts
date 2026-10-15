import type { ComponentDoc } from './catalog';

/** Badge entry; AtlasBadge composes native Badge, Badge.Ribbon and Tag. */
export const badgeComponents: ComponentDoc[] = [
  {
    slug: 'badge',
    title: 'Badge',
    summary:
      'Short status, count and label markers on shared Atlas surfaces. Labels, counts, dots and ribbons keep fixed 20, 26 and 32 px heights.',
    antdComponent: 'Badge · Badge.Ribbon · Tag',
    category: 'Data display',
    sourceUrl: 'https://ant.design/components/badge/',
    whenToUse: [
      'To show a short status, category or count beside the content it describes.',
      'Attach a count or dot to a button or avatar when new items need attention. Keep the full count available as text.',
      'Use Pill for selectable tags in a collection and Alert for messages that need an explanation.',
    ],
    examples: [
      {
        id: 'labels',
        title: 'Labels, variants and sizes',
        description:
          'Label badges render native Tag with the required label. Variant, semantic tone and size are independent; status text never relies on color alone, and hideLabel keeps the label as the name of an icon-only badge.',
        code: `import AtlasProvider from '../src/react/AtlasProvider';
import AtlasBadge from '../src/react/AtlasBadge';
import AtlasIcon from '../src/react/AtlasIcon';
import '../src/styles/atlas-badge.css';

export default function BadgeLabels() {
  return <AtlasProvider appearance="docs">
    <AtlasBadge kind="label" variant="solid" tone="brand" size="sm" label="Live" />
    <AtlasBadge kind="label" variant="soft" tone="info" size="md"
      trailing={<AtlasIcon name="settings" />} label="Export request" />
    <AtlasBadge kind="label" variant="outlined" tone="success" size="lg"
      leading={<AtlasIcon name="check" />} label="Paid" />
    <AtlasBadge kind="label" tone="info" label="Euro" hideLabel leading="€" />
  </AtlasProvider>;
}`,
      },
      {
        id: 'counts',
        title: 'Counts and dots',
        description:
          'Count badges render native Badge and are named by label. overflowCount shortens large numbers while the accessible name keeps the actual count; showZero keeps 0 visible.',
        code: `import AtlasProvider from '../src/react/AtlasProvider';
import AtlasBadge from '../src/react/AtlasBadge';
import '../src/styles/atlas-badge.css';

export default function BadgeCounts() {
  return <AtlasProvider appearance="docs">
    <AtlasBadge kind="count" tone="danger" count={8} label="Notifications" />
    <AtlasBadge kind="count" tone="danger" count={41} overflowCount={20} label="Notifications" />
    <AtlasBadge kind="count" tone="neutral" count={0} showZero label="Notifications" />
    <AtlasBadge kind="dot" tone="success" label="Online" /> <span>Online</span>
  </AtlasProvider>;
}`,
      },
      {
        id: 'controlled',
        title: 'Controlled count and dismissal',
        description:
          'The page owns the count and visibility. The remove action is named and keyboard operable; a restore action brings the label back.',
        code: `import { useState } from 'react';
import AtlasProvider from '../src/react/AtlasProvider';
import AtlasBadge from '../src/react/AtlasBadge';
import AtlasButton from '../src/react/AtlasButton';
import '../src/styles/atlas-badge.css';

export default function ControlledBadges() {
  const [count, setCount] = useState(5);
  const [visible, setVisible] = useState(true);
  return <AtlasProvider appearance="docs">
    <AtlasBadge kind="count" tone="danger" count={count} label="Notifications">
      <AtlasButton text="Inbox" fill="outline" />
    </AtlasBadge>
    <AtlasButton text="Add notification" onClick={() => setCount(value => value + 1)} />
    <AtlasButton text="Remove notification" disabled={count === 0}
      onClick={() => setCount(value => Math.max(0, value - 1))} />
    <p role="status" aria-live="polite">Unread notifications: {count}</p>
    {visible
      ? <AtlasBadge kind="label" label="Euro" closeLabel="Remove Euro" onClose={() => setVisible(false)} />
      : <AtlasButton text="Restore badge" fill="outline" onClick={() => setVisible(true)} />}
  </AtlasProvider>;
}`,
      },
      {
        id: 'attached',
        title: 'Attached badges and ribbon',
        description:
          'A count can sit on any of four corners of a button or avatar. A string or an icon element can replace the number and is named by label. The ribbon labels a content section without adding another border.',
        code: `import AtlasProvider from '../src/react/AtlasProvider';
import AtlasBadge from '../src/react/AtlasBadge';
import AtlasButton from '../src/react/AtlasButton';
import AtlasAvatar from '../src/react/AtlasAvatar';
import AtlasIcon from '../src/react/AtlasIcon';
import '../src/styles/atlas-badge.css';
import '../src/styles/atlas-avatar.css';

export default function AttachedBadges() {
  return <AtlasProvider appearance="docs">
    <AtlasBadge kind="count" tone="danger" count={3} placement="top-end" label="Notifications">
      <AtlasButton text="Messages" />
    </AtlasBadge>
    <AtlasBadge kind="count" tone="danger" count={2} placement="bottom-start" label="Notifications">
      <AtlasAvatar name="Deniz Kaya" />
    </AtlasBadge>
    <AtlasBadge kind="count" tone="success" count={<AtlasIcon name="check" />} label="Verified">
      <AtlasAvatar name="Deniz Kaya" />
    </AtlasBadge>
    <AtlasBadge kind="count" tone="danger" count="HOT" label="Offer">
      <AtlasButton text="Offers" />
    </AtlasBadge>
    <AtlasBadge kind="ribbon" tone="brand" label="Live">
      <section aria-labelledby="release-title">
        <h3 id="release-title">Release notes</h3>
        <p>Ready for review.</p>
      </section>
    </AtlasBadge>
  </AtlasProvider>;
}`,
      },
    ],
    apiDescription:
      'AtlasBadge composes installed native Ant Design 6.6.6 Badge, Badge.Ribbon and Tag. Counts, dots and ribbons follow the Badge reference; labels and dismissal follow the Tag reference at https://ant.design/components/tag/.',
    api: [
      {
        property: 'kind',
        type: "'label' | 'count' | 'dot' | 'ribbon'",
        defaultValue: "'label'",
        description:
          'Chooses Tag for labels, Badge for counts and dots, and Badge.Ribbon for ribbons.',
      },
      {
        property: 'variant / tone',
        type: "'solid' | 'soft' | 'outlined' / 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'",
        defaultValue: "'soft' / 'neutral'",
        description:
          'Surface treatment and semantic color from the central palette. Pair status tones with readable text.',
      },
      {
        property: 'size',
        type: "'sm' | 'md' | 'lg'",
        defaultValue: 'Inherited profile',
        description:
          'Fixed outer heights of 20, 26 and 32 px. An explicit size ignores the shared component profile.',
      },
      {
        property: 'label / hideLabel',
        type: 'string / boolean',
        defaultValue: 'Required / false',
        description:
          'Accessible text, visible on labels and ribbons. Counts announce label: count; hideLabel keeps it as the name of an icon-only label.',
      },
      {
        property: 'children',
        type: 'ReactNode',
        defaultValue: '—',
        description:
          'The attached host for counts, dots and labels, or the section a ribbon marks. The host keeps its own size.',
      },
      {
        property: 'leading / trailing',
        type: 'ReactNode / ReactNode',
        defaultValue: '— / —',
        description: 'Decorative content such as a Phosphor icon before or after the label text.',
      },
      {
        property: 'count / overflowCount / showZero',
        type: 'number | string | ReactElement / number / boolean',
        defaultValue: '— / 99 / false',
        description:
          'Native Badge count. Numbers above overflowCount show overflowCount+ while the accessible name keeps the actual count, and 0 hides unless showZero. A non-empty string or an element such as an icon shows as given; an element is named by label.',
      },
      {
        property: 'placement',
        type: "'top-end' | 'top-start' | 'bottom-end' | 'bottom-start'",
        defaultValue: "'top-end'",
        description: 'Corner of the attached host; ribbons use its start or end side.',
      },
      {
        property: 'offset / radius',
        type: "[number | string, number | string] / '0px' | '3px' | '5px' | '100%'",
        defaultValue: '— / General radius role',
        description: 'Native position adjustment and a per-badge corner override.',
      },
      {
        property: 'onClose / closeLabel',
        type: '(event: MouseEvent<HTMLElement>) => void / string',
        defaultValue: '— / —',
        description:
          'Supplied together for labels: closeLabel names the remove action. The caller removes the badge from its state.',
      },
    ],
    nativeApi: [
      {
        property: 'Badge.count / dot / overflowCount / showZero',
        type: 'ReactNode / boolean / number / boolean',
        defaultValue: '— / false / 99 / false',
        description:
          'Native count and dot rendering. A count of 0 is hidden unless showZero is set.',
      },
      {
        property: 'Badge.offset / title',
        type: '[number, number] / string',
        defaultValue: '— / count',
        description: 'Native position adjustment and the accessible actual count.',
      },
      {
        property: 'Badge.Ribbon.text / placement / color',
        type: "ReactNode / 'start' | 'end' / string",
        defaultValue: "— / 'end' / —",
        description: 'Native ribbon strip attached to a host section.',
      },
      {
        property: 'Tag.closable / onClose / icon',
        type: 'boolean | object / function / ReactNode',
        defaultValue: 'false / — / —',
        description:
          'Native label, icon and close behavior. See https://ant.design/components/tag/.',
      },
    ],
    accessibility: [
      'Status meaning is carried by readable text such as Paid, Refunded or Failed, never by color alone.',
      'Counts and dots are named by label; overflowed counts keep the actual number in the accessible name. Live counters announce the full count politely.',
      'The remove action has a name, works with Enter or Space and keeps focus inside the example. Escape does not remove a label.',
      'Keyboard focus uses one non-surrounding marker. Text stays at least 14 CSS px in Outfit and wraps at 320 CSS px.',
    ],
    notes: [
      'Labels, counts and dots paint fixed 20, 26 and 32 px outer heights. A dot reserves the same box around a smaller native dot.',
      'Text uses Outfit at weight 400. Corners follow the general radius role: 0, 3, 5 px or 100%, with 5 px by default.',
      'Colors come from the existing semantic palette. Motion uses the shared Cubic easing and respects reduced motion.',
      'Uses installed Ant Design Badge and Tag; no package was added. Examples use local state only; Storybook, approved decisions and GenUI registries are unchanged.',
    ],
  },
];
