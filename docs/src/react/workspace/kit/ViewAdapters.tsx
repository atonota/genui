import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import { Checkbox } from 'antd';
import { EntityCard, MetricCard } from '../../cards';
import { entityCardFromFields } from '../../../data/card-field-adapter';
import type { AtlasCardCallbacks, AtlasCardModel } from '../../../data/card-model';
import AtlasButton from '../../AtlasButton';
import AtlasAvatar from '../../AtlasAvatar';
import { useI18n } from '../../useI18n';
import {
  presentFieldValue,
  validDateOnly,
  validInstant,
  entityOptionLabel,
  fieldAvailability,
} from '../../../data/field-kit';
import { FieldEditor, FieldValue } from './Fields';
import StateSurface from './StateSurface';
import { fieldOperators, validateFilterDraft } from './CollectionTools';
import { projectedFields } from '../../../data/collection-kit';
import type {
  CollectionColumn,
  FieldDefinition,
  FieldScalar,
  FilterClause,
  RecordCollectionProps,
  RecordIdentity,
} from './contracts';

export type ViewAdapterProps<R extends RecordIdentity> = RecordCollectionProps<R> & {
  records: readonly R[];
};
function Actions<R extends RecordIdentity>(
  props: ViewAdapterProps<R> & { record: R; openAction?: boolean },
) {
  const { t } = useI18n();
  const { record } = props;
  const edit = props.recordCapabilities?.(record).edit ?? props.capabilities?.edit;
  return (
    <div className="kit-actions">
      {props.openAction !== false && (
        <AtlasButton
          fill="text"
          aria-pressed={props.activeId === record.id}
          text={t('Open {id}', { id: record.id })}
          onClick={() => props.onActiveIdChange(record.id)}
        />
      )}
      {props.onEdit && (
        <AtlasButton
          fill="text"
          disabled={
            edit?.allowed === false ||
            props.operation?.kind === 'pending' ||
            props.operation?.kind === 'unknown'
          }
          title={edit?.reason ? t(edit.reason) : undefined}
          text={t('Edit {id}', { id: record.id })}
          onClick={() => props.onEdit?.(record.id)}
        />
      )}{' '}
      {props.operation?.appliedIds?.includes(record.id) && (
        <p role="status">{t('Applied successfully.')}</p>
      )}
      {props.operation?.failedIds?.includes(record.id) && (
        <p role="status">{t('This record failed. Review the supplied result before retrying.')}</p>
      )}
      {props.onEdit && edit?.allowed === false && (
        <p>{t(edit.reason ?? 'This record is read-only.')}</p>
      )}
    </div>
  );
}
function SelectRecord<R extends RecordIdentity>(props: ViewAdapterProps<R> & { record: R }) {
  const { t } = useI18n();
  return (
    <Checkbox
      className="kit-record-check"
      checked={props.checkedIds.includes(props.record.id)}
      aria-label={t('Select {id}', { id: props.record.id })}
      onChange={event =>
        props.onCheckedIdsChange(
          event.target.checked
            ? [...new Set([...props.checkedIds, props.record.id])]
            : props.checkedIds.filter(id => id !== props.record.id),
        )
      }
    />
  );
}
function shownFields<R extends RecordIdentity>(props: ViewAdapterProps<R>) {
  return projectedFields(props.fields, props.projection);
}
type ResolvedColumn<R extends RecordIdentity> = {
  key: string;
  label: string;
  fields: readonly FieldDefinition<R>[];
  composite: boolean;
};
function resolvedColumns<R extends RecordIdentity>(
  fields: readonly FieldDefinition<R>[],
  definitions: readonly CollectionColumn[] = [],
): ResolvedColumn<R>[] {
  const columns: ResolvedColumn<R>[] = [],
    claimedColumns = new Set<string>();
  const membership = new Map<string, CollectionColumn>();
  for (const definition of Array.isArray(definitions) ? definitions : []) {
    if (
      !definition ||
      typeof definition.key !== 'string' ||
      !definition.key.trim() ||
      typeof definition.label !== 'string' ||
      !definition.label.trim() ||
      !Array.isArray(definition.fieldKeys) ||
      claimedColumns.has(definition.key)
    )
      continue;
    claimedColumns.add(definition.key);
    for (const key of definition.fieldKeys)
      if (fields.some(field => field.key === key) && !membership.has(key))
        membership.set(key, definition);
  }
  // Composite runs never reorder the caller's ordered projection.
  for (const field of fields) {
    const definition = membership.get(field.key),
      previous = columns.at(-1);
    if (
      definition &&
      previous?.composite &&
      previous.key.startsWith('group:' + definition.key + ':')
    )
      previous.fields = [...previous.fields, field];
    else
      columns.push({
        key: definition ? 'group:' + definition.key + ':' + columns.length : 'field:' + field.key,
        label: definition?.label ?? field.label,
        fields: [field],
        composite: !!definition,
      });
  }
  return columns;
}

/** Pairs a decorative avatar with the visible value; unavailable or empty values never expose an identity. */
function IdentityValue<R extends RecordIdentity>({
  record,
  field,
}: {
  record: R;
  field: FieldDefinition<R>;
}) {
  const identity =
    field.identity &&
    fieldAvailability(record, field).state === 'available' &&
    field.getValue(record) !== null &&
    field.getValue(record) !== ''
      ? field.identity(record)
      : null;
  if (!identity?.name.trim()) return <FieldValue record={record} field={field} />;
  return (
    <span className="kit-identity-value" data-identity-field={field.key}>
      <span className="kit-identity-avatar" aria-hidden="true">
        <AtlasAvatar name={identity.name} src={identity.src} size="sm" />
      </span>
      <FieldValue record={record} field={field} />
    </span>
  );
}
function HeaderFilter<R extends RecordIdentity>({
  field,
  query,
  onQueryChange,
}: Pick<ViewAdapterProps<R>, 'query' | 'onQueryChange'> & { field: FieldDefinition<R> }) {
  const { t } = useI18n();
  const [value, setValue] = useState<FieldScalar>(null);
  const [error, setError] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const inputId = useId();
  const applied = query.filters.find(filter => filter.id === 'header-' + field.key);
  const appliedSignature = JSON.stringify(applied ?? null);
  useEffect(() => {
    setValue(applied?.value ?? null);
    setError('');
    setDraftError(null);
  }, [appliedSignature]);
  const operators = fieldOperators(field);
  const operator = operators.includes('contains')
    ? 'contains'
    : operators.includes('eq')
      ? 'eq'
      : operators[0];
  if (!operator) return <p>{t('Filtering is not available for this field.')}</p>;
  const apply = () => {
    if (draftError) {
      setError(draftError);
      return;
    }
    const filter: FilterClause = {
      id: 'header-' + field.key,
      fieldKey: field.key,
      operator,
      value,
    };
    const errors = validateFilterDraft([filter], [field]);
    setError(errors[filter.id] ?? '');
    if (!Object.keys(errors).length)
      onQueryChange({
        ...query,
        filters: [...query.filters.filter(item => item.id !== filter.id), filter],
      });
  };
  return (
    <div className="kit-header-filter">
      <AtlasButton
        fill="text"
        text={t('Filter {field}', { field: t(field.label) })}
        aria-expanded={open}
        aria-controls={inputId + '-panel'}
        onClick={() => setOpen(value => !value)}
      />
      <div
        id={inputId + '-panel'}
        className="kit-header-filter-panel workspace-disclosure"
        data-open={open}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="workspace-disclosure-clip">
          <FieldEditor
            id={inputId}
            field={{ ...field, label: t('Filter {field}', { field: t(field.label) }) }}
            context="filter"
            value={value}
            error={error}
            onChange={setValue}
            onDraftError={setDraftError}
            resetKey={resetKey}
          />
          <AtlasButton
            fill="text"
            text={t('Apply {field} filter', { field: t(field.label) })}
            onClick={apply}
          />
          {(value !== null || draftError) && (
            <AtlasButton
              fill="text"
              text={t('Reset {field} filter draft', { field: t(field.label) })}
              onClick={() => {
                setValue(applied?.value ?? null);
                setError('');
                setDraftError(null);
                setResetKey(value => value + 1);
              }}
            />
          )}
          {query.filters.some(filter => filter.id === 'header-' + field.key) && (
            <AtlasButton
              fill="text"
              text={t('Clear {field} filter', { field: t(field.label) })}
              onClick={() => {
                setValue(null);
                setError('');
                setDraftError(null);
                setResetKey(value => value + 1);
                onQueryChange({
                  ...query,
                  filters: query.filters.filter(filter => filter.id !== 'header-' + field.key),
                });
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
export function TableView<R extends RecordIdentity>(props: ViewAdapterProps<R>) {
  const { t } = useI18n();
  const tableId = useId();
  const columns = resolvedColumns(shownFields(props), props.columns);
  const hasComposite = columns.some(column => column.composite);
  const all =
    props.records.length > 0 && props.records.every(record => props.checkedIds.includes(record.id));
  const some = props.records.some(record => props.checkedIds.includes(record.id));
  const leafId = (columnIndex: number, fieldIndex: number) =>
    tableId + '-leaf-' + columnIndex + '-' + fieldIndex;
  const groupId = (columnIndex: number) => tableId + '-group-' + columnIndex;
  const sort = (key: string) => {
    const existing = props.query.sort.find(item => item.fieldKey === key);
    const next =
      existing?.direction === 'asc' ? 'desc' : existing?.direction === 'desc' ? null : 'asc';
    props.onQueryChange({
      ...props.query,
      sort: next
        ? [
            { fieldKey: key, direction: next },
            ...props.query.sort.filter(item => item.fieldKey !== key),
          ]
        : props.query.sort.filter(item => item.fieldKey !== key),
    });
  };
  const header = (
    field: FieldDefinition<R>,
    columnIndex: number,
    fieldIndex: number,
    rowSpan?: number,
  ) => {
    const sortIndex = props.query.sort.findIndex(item => item.fieldKey === field.key);
    const direction = props.query.sort[sortIndex]?.direction;
    return (
      <th
        key={field.key}
        id={leafId(columnIndex, fieldIndex)}
        scope="col"
        rowSpan={rowSpan}
        data-kind={field.kind}
        data-leaf-field={field.key}
        aria-sort={sortIndex === 0 ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}
      >
        <strong className="kit-column-field-label">{t(field.label)}</strong>
        <AtlasButton
          fill="text"
          text={t('Sort {field}', { field: t(field.label) })}
          onClick={() => sort(field.key)}
        />
        {direction && (
          <p>
            {t('{direction}; priority {number}', {
              direction: t(direction === 'asc' ? 'Ascending' : 'Descending'),
              number: sortIndex + 1,
            })}
          </p>
        )}
        <HeaderFilter field={field} query={props.query} onQueryChange={props.onQueryChange} />
      </th>
    );
  };
  return (
    <div
      className="kit-table-scroll atlas-control"
      role="region"
      aria-label={t('Record table with horizontal scrolling')}
      tabIndex={0}
    >
      <table className="kit-table">
        <caption>{t('{count} records on this page', { count: props.records.length })}</caption>
        <colgroup span={2} />
        {columns.map(column => (
          <colgroup key={column.key} span={column.fields.length} />
        ))}
        <colgroup span={1} />
        <thead>
          <tr>
            <th id={`${tableId}-select`} scope="col" rowSpan={hasComposite ? 2 : undefined}>
              <Checkbox
                className="kit-record-check"
                checked={all}
                indeterminate={some && !all}
                aria-label={t('Select records on this page')}
                onChange={event =>
                  props.onCheckedIdsChange(
                    event.target.checked
                      ? [
                          ...new Set([
                            ...props.checkedIds,
                            ...props.records.map(record => record.id),
                          ]),
                        ]
                      : props.checkedIds.filter(
                          id => !props.records.some(record => record.id === id),
                        ),
                  )
                }
              />
            </th>
            <th id={`${tableId}-identity`} scope="col" rowSpan={hasComposite ? 2 : undefined}>
              {t('Record ID')}
            </th>
            {columns.map((column, columnIndex) =>
              column.composite ? (
                <th
                  key={column.key}
                  id={groupId(columnIndex)}
                  scope="colgroup"
                  colSpan={column.fields.length}
                  data-column-type="composite"
                >
                  {t(column.label)}
                </th>
              ) : (
                header(column.fields[0], columnIndex, 0, hasComposite ? 2 : undefined)
              ),
            )}
            <th id={`${tableId}-actions`} scope="col" rowSpan={hasComposite ? 2 : undefined}>
              {t('Actions')}
            </th>
          </tr>
          {hasComposite && (
            <tr>
              {columns.flatMap((column, columnIndex) =>
                column.composite
                  ? column.fields.map((field, fieldIndex) => header(field, columnIndex, fieldIndex))
                  : [],
              )}
            </tr>
          )}
        </thead>
        <tbody>
          {props.records.map((record, rowIndex) => (
            <tr
              key={record.id}
              data-record-id={record.id}
              aria-current={props.activeId === record.id ? 'true' : undefined}
              data-active={props.activeId === record.id}
            >
              <td headers={`${tableId}-row-${rowIndex} ${tableId}-select`}>
                <SelectRecord {...props} record={record} />
              </td>
              <th id={`${tableId}-row-${rowIndex}`} headers={`${tableId}-identity`} scope="row">
                {record.id}
              </th>
              {columns.map((column, columnIndex) =>
                column.composite ? (
                  <td
                    key={column.key}
                    data-column-type="composite"
                    colSpan={column.fields.length}
                    headers={[
                      `${tableId}-row-${rowIndex}`,
                      groupId(columnIndex),
                      ...column.fields.map((_, fieldIndex) => leafId(columnIndex, fieldIndex)),
                    ].join(' ')}
                  >
                    <dl className="kit-composite-value" aria-label={t(column.label)}>
                      {column.fields.map(field => (
                        <div key={field.key} data-leaf-field={field.key} data-kind={field.kind}>
                          <dt>{t(field.label)}</dt>
                          <dd>
                            <IdentityValue record={record} field={field} />
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </td>
                ) : (
                  <td
                    key={column.key}
                    data-kind={column.fields[0].kind}
                    data-leaf-field={column.fields[0].key}
                    headers={`${tableId}-row-${rowIndex} ${leafId(columnIndex, 0)}`}
                  >
                    <IdentityValue record={record} field={column.fields[0]} />
                  </td>
                ),
              )}
              <td headers={`${tableId}-row-${rowIndex} ${tableId}-actions`}>
                <Actions {...props} record={record} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function ListView<R extends RecordIdentity>(
  props: ViewAdapterProps<R> & { cards?: boolean },
) {
  const fields = shownFields(props);
  const { t, locale } = useI18n();
  return (
    <ul className={props.cards ? 'kit-record-cards' : 'kit-record-list'}>
      {props.records.map(record => (
        <li
          key={record.id}
          data-record-id={record.id}
          aria-current={props.activeId === record.id ? 'true' : undefined}
          data-active={props.activeId === record.id}
        >
          {props.cards ? (
            <>
              <EntityCard
                model={{
                  ...entityCardFromFields(record, fields, { locale, translate: t }),
                  selection: {
                    mode: 'multiple',
                    selected: props.checkedIds.includes(record.id),
                    group: 'workspace-records',
                  },
                }}
                onAction={() => props.onActiveIdChange(record.id)}
                onSelectionChange={selected =>
                  props.onCheckedIdsChange(
                    selected
                      ? [...new Set([...props.checkedIds, record.id])]
                      : props.checkedIds.filter(id => id !== record.id),
                  )
                }
              />
              <Actions {...props} record={record} openAction={false} />
            </>
          ) : (
            <>
              <div className="kit-record-heading">
                <SelectRecord {...props} record={record} />
                <strong>{record.id}</strong>
              </div>
              <dl className="kit-record-fields">
                {fields.map(field => (
                  <div key={field.key}>
                    <dt>
                      <FieldLabel field={field} />
                    </dt>
                    <dd>
                      <FieldValue record={record} field={field} />
                    </dd>
                  </div>
                ))}
              </dl>
              <Actions {...props} record={record} />
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
/** A reusable peer-card adapter; callers retain collection query and selection ownership. */
export function GalleryView<R extends RecordIdentity>(props: ViewAdapterProps<R>) {
  return <ListView {...props} cards />;
}
/** Metrics are supplied by the host; this adapter invents neither aggregation nor data access. */
export function DashboardView({
  models,
  onAction,
}: {
  models: readonly AtlasCardModel[];
  onAction?: AtlasCardCallbacks['onAction'];
}) {
  const { t } = useI18n();
  return (
    <section className="kit-record-cards" aria-label={t('Metric dashboard')}>
      {models
        .filter(model => model.kind === 'metric')
        .map(model => (
          <MetricCard key={model.id} model={model} onAction={onAction} />
        ))}
    </section>
  );
}
function FieldLabel<R extends RecordIdentity>({ field }: { field: FieldDefinition<R> }) {
  const { t } = useI18n();
  return <>{t(field.label)}</>;
}
function stamp<R extends RecordIdentity>(record: R, field: FieldDefinition<R>): number | null {
  if (field.availability?.(record).state && field.availability(record).state !== 'available')
    return null;
  const value = field.getValue(record);
  if (
    typeof value !== 'string' ||
    !value ||
    (field.kind === 'date' ? !validDateOnly(value) : !validInstant(value))
  )
    return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}
export function EventTimeline<R extends RecordIdentity>(props: ViewAdapterProps<R>) {
  const { t, locale } = useI18n();
  const field = props.fields.find(item => item.key === props.dateFieldKey);
  if (!field || !['date', 'datetime'].includes(field.kind))
    return (
      <StateSurface
        state={{
          kind: 'unknown',
          message: 'Choose a date or timestamp field to display an event timeline.',
        }}
      />
    );
  const dated = props.records
    .filter(record => fieldDay(record, field) !== null)
    .slice()
    .sort((a, b) => stamp(a, field)! - stamp(b, field)! || a.id.localeCompare(b.id));
  const undated = props.records.filter(record => fieldDay(record, field) === null);
  let previous = '';
  return (
    <section className="kit-event-timeline">
      <h4>{t('Record event timeline')}</h4>
      <p>{t('Each event uses the selected record timestamp. No activity history is generated.')}</p>
      <ol>
        {dated.map(record => {
          const day = new Intl.DateTimeFormat(locale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: field.kind === 'date' ? 'UTC' : (field.timezone ?? 'UTC'),
          }).format(stamp(record, field)!);
          const heading = day !== previous;
          previous = day;
          return (
            <li key={record.id}>
              {heading && <h5>{day}</h5>}
              <time dateTime={String(field.getValue(record))}>
                <FieldValue record={record} field={field} />
              </time>
              <ListView {...props} records={[record]} />
            </li>
          );
        })}
      </ol>
      {!dated.length && <p>{t('No dated records in this scope.')}</p>}
      {undated.length > 0 && (
        <section>
          <h4>
            {t('Records without an available timestamp ({count})', { count: undated.length })}
          </h4>
          <ListView {...props} records={undated} />
        </section>
      )}
    </section>
  );
}
export function ViewAdapter<R extends RecordIdentity>(props: ViewAdapterProps<R>) {
  switch (props.view ?? 'table') {
    case 'list':
      return <ListView {...props} />;
    case 'cards':
      return <ListView {...props} cards />;
    case 'timeline':
      return <EventTimeline {...props} />;
    case 'table':
      return <TableView {...props} />;
    case 'board':
      return <BoardView {...props} />;
    case 'calendar':
      return <CalendarView {...props} />;
    case 'gantt':
      return <GanttView {...props} />;
    case 'tree':
      return <TreeView {...props} />;
  }
}
export default ViewAdapter;

function fieldDay<R extends RecordIdentity>(record: R, field: FieldDefinition<R>): string | null {
  const value = stamp(record, field);
  if (value === null) return null;
  if (field.kind === 'date') return String(field.getValue(record));
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: field.timezone ?? 'UTC',
    }).formatToParts(value);
    const part = (name: string) => parts.find(item => item.type === name)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  } catch {
    return null;
  }
}
export function BoardView<R extends RecordIdentity>(props: ViewAdapterProps<R>) {
  const { t, locale } = useI18n();
  const field =
    props.fields.find(item => item.key === (props.boardFieldKey ?? props.group?.fieldKey)) ??
    props.fields.find(item => item.kind === 'choice');
  if (!field)
    return (
      <StateSurface
        state={{ kind: 'unknown', message: 'Supply a board field to display lanes.' }}
      />
    );
  const lanes = new Map<string, { label: string; records: R[] }>();
  for (const option of field.options ?? [])
    lanes.set(JSON.stringify(option.value), {
      label: field.kind === 'entity' ? entityOptionLabel(option, t) : t(option.label),
      records: [],
    });
  for (const record of props.records) {
    const availability = field.availability?.(record);
    const presentation = presentFieldValue(record, field, locale, t);
    const key =
      availability && availability.state !== 'available'
        ? 'availability:' + availability.state
        : String(JSON.stringify(field.getValue(record)));
    const lane = lanes.get(key) ?? { label: presentation.text, records: [] };
    lane.records.push(record);
    lanes.set(key, lane);
  }
  return (
    <div
      className="kit-board atlas-control"
      role="region"
      tabIndex={0}
      aria-label={t('Board lanes with horizontal scrolling')}
    >
      {[...lanes].map(([key, lane]) => (
        <section key={key}>
          <h4>
            {lane.label} ({lane.records.length})
          </h4>
          {lane.records.length ? (
            <ListView {...props} records={lane.records} cards />
          ) : (
            <p>{t('No records in this lane.')}</p>
          )}
        </section>
      ))}
    </div>
  );
}
export function CalendarView<R extends RecordIdentity>(props: ViewAdapterProps<R>) {
  const { t, locale } = useI18n();
  const calendarId = useId();
  const [outsideOpen, setOutsideOpen] = useState(false);
  const field = props.fields.find(
    item => item.key === props.dateFieldKey && ['date', 'datetime'].includes(item.kind),
  );
  const [month, setMonth] = useState(
    () =>
      (field
        ? props.records
            .map(record => fieldDay(record, field))
            .find(Boolean)
            ?.slice(0, 7)
        : undefined) ?? new Date().toISOString().slice(0, 7),
  );
  if (!field)
    return (
      <StateSurface
        state={{
          kind: 'unknown',
          message: 'Choose a date or timestamp field to display a calendar.',
        }}
      />
    );
  const dated = props.records.map(record => ({ record, day: fieldDay(record, field) }));
  const undated = dated.filter(item => item.day === null).map(item => item.record);
  const outsideMonth = dated
    .filter(item => item.day !== null && !item.day.startsWith(month))
    .map(item => item.record);
  const inMonth = dated.filter(item => item.day?.startsWith(month)).length;
  const [year, monthNumber] = month.split('-').map(Number);
  const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1));
  const dayCount = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const leading = (monthStart.getUTCDay() + 6) % 7;
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(monthStart);
  const change = (delta: number) =>
    setMonth(new Date(Date.UTC(year, monthNumber - 1 + delta, 1)).toISOString().slice(0, 7));
  return (
    <section className="kit-calendar">
      <div className="kit-actions">
        <AtlasButton fill="text" text={t('Previous month')} onClick={() => change(-1)} />
        <h4 aria-live="polite">{monthLabel}</h4>
        <AtlasButton fill="text" text={t('Next month')} onClick={() => change(1)} />
      </div>
      <p>
        {t(
          'The calendar groups instants in the field timezone; date-only values retain their calendar date.',
        )}
      </p>
      <p className="kit-calendar-scope" role="status">
        {t(
          '{visible} records in this month; {outside} dated records outside it; {undated} records without an available date.',
          { visible: inMonth, outside: outsideMonth.length, undated: undated.length },
        )}
      </p>
      <div
        className="kit-table-scroll atlas-control"
        role="region"
        tabIndex={0}
        aria-label={t('Month calendar with horizontal scrolling')}
      >
        <table className="kit-calendar-table">
          <caption>
            {monthLabel} · {t(field.label)}
          </caption>
          <thead>
            <tr>
              {Array.from({ length: 7 }, (_, index) => (
                <th scope="col" key={index}>
                  {new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
                    new Date(Date.UTC(2026, 9, 12 + index)),
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.ceil((leading + dayCount) / 7) }, (_, week) => (
              <tr key={week}>
                {Array.from({ length: 7 }, (_, weekday) => {
                  const day = week * 7 + weekday - leading + 1;
                  if (day < 1 || day > dayCount) return <td key={weekday} />;
                  const date = `${month}-${String(day).padStart(2, '0')}`;
                  const records = dated.filter(item => item.day === date).map(item => item.record);
                  return (
                    <td key={weekday} data-calendar-day={date}>
                      <time dateTime={date}>{day}</time>
                      {records.length > 0 && <ListView {...props} records={records} />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {outsideMonth.length > 0 && (
        <section>
          <AtlasButton
            fill="text"
            text={t('Show dated records outside this month ({count})', {
              count: outsideMonth.length,
            })}
            aria-expanded={outsideOpen}
            aria-controls={calendarId + '-outside'}
            onClick={() => setOutsideOpen(value => !value)}
          />
          <div
            id={calendarId + '-outside'}
            className="kit-calendar-outside workspace-disclosure"
            data-open={outsideOpen}
            aria-hidden={!outsideOpen}
            inert={!outsideOpen}
          >
            <div className="workspace-disclosure-clip">
              <ListView
                {...props}
                records={outsideMonth}
                projection={[...props.projection, field.key]}
              />
            </div>
          </div>
        </section>
      )}
      {undated.length > 0 && (
        <section>
          <h4>{t('Records without an available date ({count})', { count: undated.length })}</h4>
          <ListView {...props} records={undated} />
        </section>
      )}
    </section>
  );
}
export function GanttView<R extends RecordIdentity>(props: ViewAdapterProps<R>) {
  const { t, locale } = useI18n();
  const start = props.fields.find(
    field => field.key === props.startFieldKey && ['date', 'datetime'].includes(field.kind),
  );
  const end = props.fields.find(
    field => field.key === props.endFieldKey && ['date', 'datetime'].includes(field.kind),
  );
  if (!start || !end)
    return (
      <StateSurface
        state={{
          kind: 'unknown',
          message: 'Supply start and end date fields before using Gantt spans.',
        }}
      />
    );
  const spans = props.records.map(record => ({
    record,
    start: stamp(record, start),
    end: stamp(record, end),
  }));
  const valid = spans.filter(
    (span): span is { record: R; start: number; end: number } =>
      span.start !== null && span.end !== null && span.end >= span.start,
  );
  const omitted = spans
    .filter(span => span.start === null || span.end === null || span.end < span.start)
    .map(span => span.record);
  const first = Math.min(...valid.map(span => span.start)),
    last = Math.max(...valid.map(span => span.end));
  const range = Math.max(last - first, 86400000);
  const tick = (value: number) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(value);
  return (
    <section className="kit-gantt">
      <h4>{t('Gantt date spans')}</h4>
      <p>
        {t(
          'Bars represent supplied start and end dates. Dependencies, progress and critical paths are not inferred.',
        )}
      </p>
      {valid.length > 0 ? (
        <div
          className="kit-table-scroll atlas-control"
          role="region"
          tabIndex={0}
          aria-label={t('Gantt spans with horizontal scrolling')}
        >
          <table className="kit-table kit-gantt-table">
            <caption>{t('{count} scheduled records', { count: valid.length })}</caption>
            <thead>
              <tr>
                <th scope="col">{t('Record ID')}</th>
                <th scope="col">{t(start.label)}</th>
                <th scope="col">{t(end.label)}</th>
                <th scope="col">
                  <div className="kit-gantt-axis">
                    <span>{tick(first)}</span>
                    <span>{tick(first + range / 2)}</span>
                    <span>{tick(first + range)}</span>
                  </div>
                </th>
                <th scope="col">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {valid.map(span => (
                <tr
                  key={span.record.id}
                  data-gantt-record={span.record.id}
                  data-start={String(start.getValue(span.record))}
                  data-end={String(end.getValue(span.record))}
                  data-record-id={span.record.id}
                  aria-current={props.activeId === span.record.id ? 'true' : undefined}
                >
                  <th scope="row">
                    <SelectRecord {...props} record={span.record} /> {span.record.id}
                  </th>
                  <td>
                    <FieldValue record={span.record} field={start} />
                  </td>
                  <td>
                    <FieldValue record={span.record} field={end} />
                  </td>
                  <td>
                    <div className="kit-gantt-track" aria-hidden="true">
                      <span
                        className="kit-gantt-span atlas-motion-layer"
                        style={
                          {
                            '--kit-span-offset': `${((span.start - first) / range) * 100}%`,
                            '--kit-span-width': `${Math.max(((span.end - span.start) / range) * 100, 1)}%`,
                          } as CSSProperties
                        }
                      />
                    </div>
                  </td>
                  <td>
                    <Actions {...props} record={span.record} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>{t('No valid date spans in this scope.')}</p>
      )}
      {omitted.length > 0 && (
        <section>
          <h4>{t('Unscheduled records ({count})', { count: omitted.length })}</h4>
          <p>{t('Missing, unavailable or reversed dates remain accessible here.')}</p>
          <ListView {...props} records={omitted} />
        </section>
      )}
    </section>
  );
}
export function TreeView<R extends RecordIdentity>(props: ViewAdapterProps<R>) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const treeId = useId();
  const [mountedChildren, setMountedChildren] = useState<ReadonlySet<string>>(new Set());
  if (!props.parentId)
    return (
      <StateSurface
        state={{ kind: 'unknown', message: 'Supply parent identities before using a tree view.' }}
      />
    );
  const byId = new Map(props.records.map(record => [record.id, record]));
  const children = new Map<string, R[]>(),
    roots: R[] = [];
  const parent = new Map(props.records.map(record => [record.id, props.parentId!(record)]));
  for (const record of props.records) {
    const key = parent.get(record.id);
    if (!key || !byId.has(key) || key === record.id) roots.push(record);
    else children.set(key, [...(children.get(key) ?? []), record]);
  }
  const visited = new Set<string>();
  const walk = (record: R): void => {
    if (visited.has(record.id)) return;
    visited.add(record.id);
    for (const child of children.get(record.id) ?? []) walk(child);
  };
  roots.forEach(walk);
  let cycles = 0;
  for (const record of props.records)
    if (!visited.has(record.id)) {
      roots.push(record);
      cycles++;
      walk(record);
    }
  const render = (items: readonly R[], path = new Set<string>()): ReactNode => (
    <ul className="kit-record-tree">
      {items
        .filter(record => !path.has(record.id))
        .map(record => {
          const descendants = (children.get(record.id) ?? []).filter(
            child => !path.has(child.id) && child.id !== record.id,
          );
          const open = expanded.has(record.id),
            nextPath = new Set([...path, record.id]);
          return (
            <li
              key={record.id}
              data-record-id={record.id}
              data-active={props.activeId === record.id}
              aria-current={props.activeId === record.id ? 'true' : undefined}
            >
              <div className="kit-record-heading">
                <SelectRecord {...props} record={record} />
                <strong>{record.id}</strong>
                {descendants.length > 0 && (
                  <AtlasButton
                    fill="text"
                    data-tree-expand={record.id}
                    aria-expanded={open}
                    aria-controls={treeId + '-children-' + record.id}
                    text={t(open ? 'Collapse children' : 'Expand children')}
                    onClick={event => {
                      event.currentTarget.focus();
                      setMountedChildren(previous => new Set([...previous, record.id]));
                      setExpanded(previous => {
                        const next = new Set(previous);
                        if (next.has(record.id)) next.delete(record.id);
                        else next.add(record.id);
                        return next;
                      });
                    }}
                  />
                )}
              </div>
              <dl className="kit-record-fields">
                {shownFields(props).map(field => (
                  <div key={field.key}>
                    <dt>{t(field.label)}</dt>
                    <dd>
                      <FieldValue record={record} field={field} />
                    </dd>
                  </div>
                ))}
              </dl>
              <Actions {...props} record={record} />
              {descendants.length > 0 && (
                <div
                  id={treeId + '-children-' + record.id}
                  className="kit-tree-children workspace-disclosure"
                  data-open={open}
                  aria-hidden={!open}
                  inert={!open}
                >
                  <div className="workspace-disclosure-clip">
                    {mountedChildren.has(record.id) ? render(descendants, nextPath) : null}
                  </div>
                </div>
              )}
            </li>
          );
        })}
    </ul>
  );
  return (
    <section className="kit-tree">
      <h4>{t('Hierarchical records')}</h4>
      <p>
        {t(
          'Parent and child selections are independent. Missing parents remain root records in this scope.',
        )}
      </p>
      {cycles > 0 && (
        <p role="status">
          {t('{count} cyclic parent chains are shown once without recursive loops.', {
            count: cycles,
          })}
        </p>
      )}
      {render(roots)}
    </section>
  );
}
