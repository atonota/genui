import { useId, useState, type MouseEvent, type ReactNode } from 'react';
import { Checkbox, Flex, Radio, Switch, Typography } from 'antd';
import AtlasButton from './AtlasButton';
import AtlasListy, { type AtlasListyEntry } from './AtlasListy';
import ExamplePreview from './ExamplePreview';
import { useI18n } from './useI18n';

/** Native controls toggle themselves; a row click only forwards clicks that land on its text. */
const fromControl = (target: EventTarget) =>
  target instanceof Element && target.closest('label, input, button') !== null;

function ListyPattern({
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
    <section data-listy-pattern={id} aria-labelledby={heading}>
      <Flex vertical gap="small">
        <Typography.Title level={3} id={heading}>
          {title}
        </Typography.Title>
        <Typography.Paragraph>{description}</Typography.Paragraph>
        {children}
      </Flex>
    </section>
  );
}

const roles = [
  { key: 'product-design', label: 'Product design' },
  { key: 'product-engineering', label: 'Product engineering' },
  { key: 'operations', label: 'Operations' },
] as const;
type RoleKey = (typeof roles)[number]['key'];

/** Single choice: one native radio per row, all sharing one name for native arrow keys. */
export function ListySelectPattern() {
  const { t } = useI18n();
  const name = useId();
  const [value, setValue] = useState<RoleKey | null>(null);
  const chosen = roles.find(role => role.key === value);
  const items: AtlasListyEntry[] = roles.map(role => ({
    key: role.key,
    label: t(role.label),
    leading: (
      <Radio
        name={name}
        checked={role.key === value}
        onChange={event => {
          if (event.target.checked) setValue(role.key);
        }}
        aria-label={t(role.label)}
      />
    ),
    selected: role.key === value,
    interactive: true,
    rowProps: {
      onClick: (event: MouseEvent<HTMLDivElement>) => {
        if (!fromControl(event.target)) setValue(role.key);
      },
    },
  }));
  return (
    <ListyPattern
      id="select"
      title={t('Single select')}
      description={t('Each row holds one native radio; the row text picks the same choice.')}
    >
      <ExamplePreview id="listy-select" title={t('Single select')}>
        <Flex vertical gap="small">
          <AtlasListy label={t('Role')} items={items} />
          <p role="status">
            {chosen ? `${t('Selected')} ${t(chosen.label)}` : t('Nothing selected')}
          </p>
        </Flex>
      </ExamplePreview>
    </ListyPattern>
  );
}

const teams = [
  { key: 'design', label: 'Design' },
  { key: 'engineering', label: 'Engineering' },
  { key: 'operations', label: 'Operations' },
] as const;
type TeamKey = (typeof teams)[number]['key'];
const teamKeys = teams.map(team => team.key);

/** Multiple choice with a native tri-state Select all and an explicit clear action. */
export function ListyCheckboxPattern() {
  const { t } = useI18n();
  const [picked, setPicked] = useState<readonly TeamKey[]>([]);
  // Rebuilding from the source order keeps the selection stable whatever the click order.
  const toggle = (key: TeamKey, on: boolean) =>
    setPicked(current => teamKeys.filter(item => (item === key ? on : current.includes(item))));
  const count = picked.length;
  const items: AtlasListyEntry[] = teams.map(team => {
    const on = picked.includes(team.key);
    return {
      key: team.key,
      label: t(team.label),
      leading: (
        <Checkbox
          checked={on}
          onChange={event => toggle(team.key, event.target.checked)}
          aria-label={t(team.label)}
        />
      ),
      selected: on,
      interactive: true,
      rowProps: {
        onClick: (event: MouseEvent<HTMLDivElement>) => {
          if (!fromControl(event.target)) toggle(team.key, !on);
        },
      },
    };
  });
  return (
    <ListyPattern
      id="checkbox"
      title={t('Multiple select')}
      description={t('Pick any number of teams; Select all reflects a partial choice.')}
    >
      <ExamplePreview id="listy-checkbox" title={t('Multiple select')}>
        <Flex vertical gap="small">
          <Flex wrap align="center" justify="space-between" gap="small">
            <Checkbox
              checked={count === teams.length}
              indeterminate={count > 0 && count < teams.length}
              onChange={event => setPicked(event.target.checked ? teamKeys : [])}
            >
              {t('Select all')}
            </Checkbox>
            <AtlasButton text={t('Clear selection')} fill="text" onClick={() => setPicked([])} />
          </Flex>
          <AtlasListy label={t('Teams')} items={items} />
          <p role="status">{`${count} ${t('selected')}`}</p>
        </Flex>
      </ExamplePreview>
    </ListyPattern>
  );
}

const preferences = [
  {
    key: 'notifications',
    label: 'Notifications',
    on: 'Alerts arrive as they happen.',
    off: 'Alerts are paused.',
  },
  {
    key: 'digest',
    label: 'Weekly digest',
    on: 'A summary arrives every Monday.',
    off: 'No summary is sent.',
  },
] as const;
type PreferenceKey = (typeof preferences)[number]['key'];

/** Settings rows: a native switch per row, its description follows the real state. */
export function ListySettingsPattern() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState<Readonly<Record<PreferenceKey, boolean>>>({
    notifications: true,
    digest: false,
  });
  const [last, setLast] = useState<PreferenceKey | null>(null);
  const change = (key: PreferenceKey, on: boolean) => {
    setEnabled(current => ({ ...current, [key]: on }));
    setLast(key);
  };
  const changed = preferences.find(preference => preference.key === last);
  const items: AtlasListyEntry[] = preferences.map(preference => {
    const on = enabled[preference.key];
    return {
      key: preference.key,
      label: t(preference.label),
      description: t(on ? preference.on : preference.off),
      trailing: (
        <Switch
          checked={on}
          onChange={checked => change(preference.key, checked)}
          aria-label={t(preference.label)}
        />
      ),
      interactive: true,
      rowProps: {
        onClick: (event: MouseEvent<HTMLDivElement>) => {
          if (!fromControl(event.target)) change(preference.key, !on);
        },
      },
    };
  });
  return (
    <ListyPattern
      id="settings"
      title={t('Settings')}
      description={t('Switches change this page only; nothing is saved.')}
    >
      <ExamplePreview id="listy-settings" title={t('Settings')}>
        <Flex vertical gap="small">
          <AtlasListy label={t('Preferences')} items={items} />
          <p role="status">
            {changed
              ? `${t(changed.label)}: ${enabled[changed.key] ? t('On') : t('Off')}`
              : t('No changes yet')}
          </p>
        </Flex>
      </ExamplePreview>
    </ListyPattern>
  );
}

const records = [
  { key: 'roadmap', label: 'Atlas roadmap', description: 'Planning document' },
  { key: 'billing', label: 'Billing export', description: 'Finance spreadsheet' },
  { key: 'review', label: 'Design review', description: 'Meeting notes' },
] as const;
type RecordKey = (typeof records)[number]['key'];

/** Row actions: one named button per record; the row itself stays non-interactive. */
export function ListyActionsPattern() {
  const { t } = useI18n();
  const [opened, setOpened] = useState<RecordKey | null>(null);
  const current = records.find(record => record.key === opened);
  const items: AtlasListyEntry[] = records.map(record => ({
    key: record.key,
    label: t(record.label),
    description: t(record.description),
    trailing: (
      <AtlasButton
        text={t('Open')}
        fill="outline"
        aria-label={`${t('Open record')} ${t(record.label)}`}
        onClick={() => setOpened(record.key)}
      />
    ),
    selected: record.key === opened,
  }));
  return (
    <ListyPattern
      id="actions"
      title={t('Row actions')}
      description={t('Each record carries its own action button.')}
    >
      <ExamplePreview id="listy-actions" title={t('Row actions')}>
        <Flex vertical gap="small">
          <AtlasListy label={t('Records')} items={items} />
          <p role="status">
            {current ? `${t('Opened')} ${t(current.label)}` : t('No record opened')}
          </p>
        </Flex>
      </ExamplePreview>
    </ListyPattern>
  );
}

/** Control-bearing Listy references; the coordinator renders them inside AtlasProvider. */
export default function ListyControlPatterns() {
  return (
    <>
      <ListySelectPattern />
      <ListyCheckboxPattern />
      <ListySettingsPattern />
      <ListyActionsPattern />
    </>
  );
}
