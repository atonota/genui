import type { ReactNode } from 'react';
import AtlasIcon from './AtlasIcon';
import AtlasListy, { type AtlasListyEntry } from './AtlasListy';
import { useI18n } from './useI18n';

type BasicPatternId = 'plain' | 'unordered' | 'ordered' | 'icon' | 'nested';

/** One live reference section; the coordinator places it inside the documentation AtlasProvider. */
function Pattern({
  id,
  title,
  summary,
  children,
}: {
  id: BasicPatternId;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  const heading = `listy-pattern-${id}`;
  return (
    <section data-listy-pattern={id} aria-labelledby={heading}>
      <h3 id={heading}>{title}</h3>
      <p>{summary}</p>
      {children}
    </section>
  );
}

// Simple rows keep the compact size family; the first one is the page's size reference.
const plainRows = ['Release notes', 'Team calendar', 'Shared drafts', 'Archived projects'] as const;
const details = [
  ['owner', 'Owner', 'Ada Lovelace'],
  ['status', 'Status', 'In review'],
  ['region', 'Region', 'Europe (Frankfurt)'],
  ['updated', 'Last updated', '16 October 2026'],
] as const;
const bullets = [
  ['brief', 'Share the planning brief with every collaborator before the review meeting'],
  ['owners', 'Name one owner for each open question so decisions do not stall'],
  ['risks', 'Record accessibility and performance risks next to the work they affect'],
] as const;
const steps = [
  ['draft', 'Draft the proposal with goals, scope and the people it affects'],
  ['review', 'Collect review notes from design, engineering and support'],
  ['approve', 'Approve the final scope and publish it to the shared workspace'],
  ['ship', 'Ship the change and confirm the outcome against the original goals'],
] as const;
const icons = [
  [
    'home',
    'house',
    'Home overview',
    'Recent activity and pinned work from every workspace you follow',
  ],
  ['light', 'sun', 'Light appearance', 'Bright surfaces for well lit rooms and printed reviews'],
  ['dark', 'moon', 'Dark appearance', 'Dimmed surfaces for low light and long evening sessions'],
  [
    'private',
    'lock-simple',
    'Private workspace',
    'Only invited members can open, comment on or export these files',
  ],
] as const;

// Path segments carry the hierarchy; native group headers name the top level.
const tree = [
  ['studio', 'design'],
  ['studio', 'design', 'library'],
  ['studio', 'research'],
  ['operations', 'support'],
  ['operations', 'support', 'escalations'],
] as const;
const names: Record<string, string> = {
  studio: 'Studio',
  design: 'Design',
  library: 'Component library',
  research: 'User research',
  operations: 'Operations',
  support: 'Customer support',
  escalations: 'Escalation handbook',
};

/** Plain, unordered, ordered, icon and nested Listy references on the shared row primitive. */
export default function ListyBasicPatterns() {
  const { t } = useI18n();
  const name = (segment: string) => t(names[segment] ?? segment);
  const nested: AtlasListyEntry[] = tree.map(path => ({
    key: path.join('/'),
    label: name(path[path.length - 1]!),
    description: `${t('Inside')} ${path.slice(0, -1).map(name).join(' / ')}`,
  }));
  return (
    <>
      <Pattern
        id="plain"
        title={t('Plain list')}
        summary={t('Single line rows and key-value details share one list surface.')}
      >
        <AtlasListy
          label={t('Plain list')}
          items={plainRows.map(label => ({ key: label, label: t(label) }))}
        />
        <AtlasListy
          label={t('Record details')}
          items={details.map(([key, label, value]) => ({
            key,
            label: t(label),
            trailing: t(value),
          }))}
        />
      </Pattern>
      <Pattern
        id="unordered"
        title={t('Unordered list')}
        summary={t('Items without a sequence carry a quiet marker.')}
      >
        <AtlasListy
          label={t('Unordered list')}
          items={bullets.map(([key, label]) => ({
            key,
            label: t(label),
            leading: <span aria-hidden="true">•</span>,
          }))}
        />
      </Pattern>
      <Pattern
        id="ordered"
        title={t('Ordered list')}
        summary={t('Numbers state the order the steps happen in.')}
      >
        <AtlasListy
          label={t('Ordered list')}
          items={steps.map(([key, label], index) => ({
            key,
            label: t(label),
            leading: <span>{`${index + 1}.`}</span>,
          }))}
        />
      </Pattern>
      <Pattern
        id="icon"
        title={t('Icon list')}
        summary={t('A decorative icon supports each label without replacing it.')}
      >
        <AtlasListy
          label={t('Icon list')}
          items={icons.map(([key, icon, label, description]) => ({
            key,
            label: t(label),
            description: t(description),
            leading: <AtlasIcon name={icon} />,
          }))}
        />
      </Pattern>
      <Pattern
        id="nested"
        title={t('Nested list')}
        summary={t('Group headers name each area; descriptions state where every item sits.')}
      >
        <AtlasListy
          label={t('Nested list')}
          items={nested}
          group={{
            key: item => item.key.split('/')[0] ?? item.key,
            title: groupKey => name(groupKey),
          }}
        />
      </Pattern>
    </>
  );
}
