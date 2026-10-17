import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Segmented, Spin, theme, type ListyProps } from 'antd';
import type { ListyRef } from 'antd/lib/listy';
import GenUXAvatar from './GenUXAvatar';
import GenUXButton from './GenUXButton';
import GenUXEmptyState from './GenUXEmptyState';
import GenUXIcon from './GenUXIcon';
import GenUXListy, { type GenUXListyEntry } from './GenUXListy';
import ExamplePreview from './ExamplePreview';
import { useI18n } from './useI18n';

// Bounded native scrollers are measured in rows of the central control height role.
const visibleRows = { grouped: 6, virtual: 8 } as const;

function useBoundedHeight(rows: number) {
  const { token } = theme.useToken();
  return token.controlHeight * rows;
}

function Pattern({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const heading = useId();
  return (
    <section className="genux-listy-pattern" data-listy-pattern={id} aria-labelledby={heading}>
      <h3 id={heading}>{title}</h3>
      <p>{description}</p>
      {children}
    </section>
  );
}

const steps = ['Create account', 'Verify email', 'Invite team', 'Launch workspace'] as const;

/** Controlled progression; the current row is the selected one and carries aria-current. */
export function ListyStepsPattern() {
  const { t } = useI18n();
  // current === steps.length means every step is complete.
  const [current, setCurrent] = useState(0);
  const finished = current >= steps.length;
  const items: GenUXListyEntry[] = steps.map((name, index) => {
    const state = index < current ? 'complete' : index === current ? 'current' : 'upcoming';
    return {
      key: `step-${index + 1}`,
      label: t(name),
      // The trailing text carries the state; the leading mark is decorative.
      leading:
        state === 'complete' ? (
          <GenUXIcon name="check" />
        ) : (
          <span aria-hidden="true">{index + 1}</span>
        ),
      trailing: t(
        state === 'complete' ? 'Completed' : state === 'current' ? 'In progress' : 'Upcoming',
      ),
      selected: state === 'current',
      rowProps: state === 'current' ? { 'aria-current': 'step' } : undefined,
    };
  });
  return (
    <Pattern
      id="steps"
      title={t('Steps')}
      description={t('Each step completes in order; the current step stays selected.')}
    >
      <ExamplePreview id="listy-steps" title={t('Steps')}>
        <GenUXListy label={t('Workspace setup steps')} items={items} />
        <p role="status">
          {finished ? t('All steps complete') : `${t('Current step')}: ${t(steps[current]!)}`}
        </p>
        <GenUXButton
          text={t('Next step')}
          disabled={finished}
          onClick={() => setCurrent(step => Math.min(step + 1, steps.length))}
        />
        <GenUXButton
          text={t('Restart')}
          fill="outline"
          disabled={current === 0}
          onClick={() => setCurrent(0)}
        />
      </ExamplePreview>
    </Pattern>
  );
}

const services = [
  { key: 'service-api', label: 'Public API', state: 'Operational' },
  { key: 'service-search', label: 'Search index', state: 'Degraded' },
  { key: 'service-mail', label: 'Mail delivery', state: 'Maintenance' },
] as const;

type FeedState = 'ready' | 'loading' | 'empty';

/** Readable status rows plus caller-toggled loading and empty states of the same list. */
export function ListyStatusPattern() {
  const { t } = useI18n();
  const [feed, setFeed] = useState<FeedState>('ready');
  const items: GenUXListyEntry[] = services.map(service => ({
    key: service.key,
    label: t(service.label),
    trailing: t(service.state),
  }));
  return (
    <Pattern
      id="status"
      title={t('Status')}
      description={t('Sample service data; switch the list state to preview loading and empty.')}
    >
      <ExamplePreview id="listy-status" title={t('Status')}>
        <Segmented<FeedState>
          aria-label={t('List state')}
          value={feed}
          onChange={setFeed}
          options={[
            { value: 'ready', label: t('Loaded') },
            { value: 'loading', label: t('Loading') },
            { value: 'empty', label: t('Empty') },
          ]}
        />
        <div data-listy-state={feed} aria-busy={feed === 'loading'}>
          {feed === 'empty' ? (
            <GenUXEmptyState
              kind="empty"
              title={t('No services to show')}
              description={t('Switch the list state to show the sample services again.')}
              actionLabel={t('Show services')}
              onAction={() => setFeed('ready')}
            />
          ) : (
            <Spin spinning={feed === 'loading'}>
              <GenUXListy label={t('Service status')} items={items} />
            </Spin>
          )}
          {/* One persistent live region; the empty state announces itself. */}
          <p role="status">
            {feed === 'loading'
              ? t('Loading services')
              : feed === 'ready'
                ? `${items.length} ${t('services listed')}`
                : ''}
          </p>
        </div>
      </ExamplePreview>
    </Pattern>
  );
}

const people = [
  { key: 'person-ada', name: 'Ada Lovelace', role: 'Product design lead' },
  { key: 'person-alan', name: 'Alan Turing', role: 'Platform engineer' },
  { key: 'person-grace', name: 'Grace Hopper', role: 'Developer relations' },
  { key: 'person-katherine', name: 'Katherine Johnson', role: 'Data analyst' },
] as const;

/** Avatar rows: the visible name labels the row, so the avatar stays decorative. */
export function ListyRichPattern() {
  const { t } = useI18n();
  const items: GenUXListyEntry[] = people.map(person => ({
    key: person.key,
    label: person.name,
    description: t(person.role),
    leading: <GenUXAvatar name={person.name} decorative />,
  }));
  return (
    <Pattern
      id="rich"
      title={t('Rich content')}
      description={t('Rows with an avatar and a description grow instead of clipping.')}
    >
      <ExamplePreview id="listy-rich" title={t('Rich content')}>
        <GenUXListy label={t('Team members')} items={items} />
      </ExamplePreview>
    </Pattern>
  );
}

const products = [
  {
    key: 'product-hub',
    icon: 'house',
    label: 'Home hub',
    description: 'Connects lights, locks and sensors',
    price: 129,
  },
  {
    key: 'product-lamp',
    icon: 'sun',
    label: 'Desk lamp',
    description: 'Adjustable warm and cool light',
    price: 59,
  },
  {
    key: 'product-night',
    icon: 'moon',
    label: 'Night light',
    description: 'Dims automatically after sunset',
    price: 24,
  },
  {
    key: 'product-lock',
    icon: 'lock-simple',
    label: 'Smart lock',
    description: 'Keyless entry with an activity log',
    price: 189,
  },
] as const;

/** Product rows: icon, description and a locale-formatted price; no external imagery. */
export function ListyMarketPattern() {
  const { t, locale } = useI18n();
  const currency = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }),
    [locale],
  );
  const items: GenUXListyEntry[] = products.map(product => ({
    key: product.key,
    label: t(product.label),
    description: t(product.description),
    leading: <GenUXIcon name={product.icon} />,
    trailing: currency.format(product.price),
  }));
  return (
    <Pattern
      id="market"
      title={t('Market')}
      description={t('Sample catalog with prices; nothing is purchased.')}
    >
      <ExamplePreview id="listy-market" title={t('Market')}>
        <GenUXListy label={t('Products')} items={items} />
      </ExamplePreview>
    </Pattern>
  );
}

const teams = ['Design', 'Engineering', 'Marketing', 'Support'] as const;
const channels = [
  'Announcements',
  'Daily standup',
  'Reviews',
  'Planning',
  'Releases',
  'Incidents',
  'Research',
  'Hiring',
  'Retrospectives',
  'Off-topic',
] as const;
const teamChannels = teams.flatMap(team =>
  channels.map(channel => ({
    key: `${team.toLowerCase()}-${channel.toLowerCase().replace(/ /g, '-')}`,
    team,
    channel,
  })),
);
// Native group keys resolve through the stable row key; entries stay plain GenUXListyEntry.
const teamOf = new Map<string, string>(teamChannels.map(row => [row.key, row.team]));

/** Native grouping with sticky headers inside a bounded scroller. */
export function ListyGroupedPattern() {
  const { t } = useI18n();
  const height = useBoundedHeight(visibleRows.grouped);
  const items: GenUXListyEntry[] = teamChannels.map(row => ({
    key: row.key,
    label: t(row.channel),
  }));
  const group: ListyProps<GenUXListyEntry, string>['group'] = {
    key: item => teamOf.get(item.key) ?? teams[0],
    title: key => t(key),
  };
  return (
    <Pattern
      id="grouped"
      title={t('Grouped')}
      description={t('Team headers stay pinned while their channels scroll.')}
    >
      <ExamplePreview id="listy-grouped" title={t('Grouped')}>
        <GenUXListy
          label={t('Channels by team')}
          items={items}
          group={group}
          sticky
          virtual={false}
          height={height}
          classNames={() => ({ groupHeader: 'genux-listy-group-header genux-listy-team-header' })}
        />
      </ExamplePreview>
    </Pattern>
  );
}

const recordCount = 10000;

/** Native virtualization: 10000 stable rows, only the visible window is rendered. */
export function ListyVirtualPattern() {
  const { t } = useI18n();
  const height = useBoundedHeight(visibleRows.virtual);
  const listRef = useRef<ListyRef>(null);
  const [jumped, setJumped] = useState(false);
  const word = t('Record');
  const records = useMemo<GenUXListyEntry[]>(
    () =>
      Array.from({ length: recordCount }, (_, index) => ({
        key: `record-${index + 1}`,
        label: `${word} ${index + 1}`,
      })),
    [word],
  );
  return (
    <Pattern
      id="virtual"
      title={t('Virtual')}
      description={t('Ten thousand rows; only the visible rows are rendered.')}
    >
      <ExamplePreview id="listy-virtual" title={t('Virtual')}>
        <GenUXButton
          text={t('Jump to last item')}
          fill="outline"
          onClick={() => {
            listRef.current?.scrollTo({ key: `record-${recordCount}`, align: 'bottom' });
            setJumped(true);
          }}
        />
        <GenUXListy
          ref={listRef}
          label={t('Records')}
          items={records}
          virtual
          height={height}
          onScroll={() => setJumped(false)}
        />
        <p role="status">{jumped ? `${word} ${recordCount}` : ''}</p>
      </ExamplePreview>
    </Pattern>
  );
}

/** Data-oriented Listy reference patterns; the coordinator composes them on the Listy page. */
export default function ListyDataPatterns() {
  return (
    <>
      <ListyStepsPattern />
      <ListyStatusPattern />
      <ListyRichPattern />
      <ListyMarketPattern />
      <ListyGroupedPattern />
      <ListyVirtualPattern />
    </>
  );
}
