import type { CSSProperties, ReactNode } from 'react';
import { Checkbox, Select, Table, type TableColumnsType } from 'antd';
import GenUXButton from '../GenUXButton';
import GenUXIconButton from '../GenUXIconButton';
import GenUXPill from '../GenUXPill';
import { EntityCard } from '../cards';
import type { GenUXCardModel, CardTone } from '../../data/card-model';
import { workspacePillColorIndex } from '../../data/workspace-pill-colors';
import { selectedLabel } from '../selectedLabel';
import { useI18n } from '../useI18n';
import {
  STATUS_LABELS,
  PAYMENT_LABELS,
  groupRecords,
  moneyText,
  dateText,
  type WorkspaceRecord,
  type RecordStatus,
} from '../../data/workspace';

export const COLLECTION_VIEWS = [
  { value: 'table', label: 'Table' },
  { value: 'list', label: 'List' },
  { value: 'board', label: 'Board' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'gantt', label: 'Gantt · date spans' },
  { value: 'editable', label: 'Row editing' },
  { value: 'grouped', label: 'Grouped table' },
  { value: 'tree', label: 'Tree table' },
  { value: 'pairs', label: 'Label and value' },
  { value: 'compare', label: 'Comparison' },
  { value: 'review', label: 'Review queue example' },
  { value: 'bulk', label: 'Bulk edit example' },
] as const;
export type CollectionView = (typeof COLLECTION_VIEWS)[number]['value'];
export const COLLECTION_COLUMNS = [
  { key: 'customer', label: 'Customer' },
  { key: 'status', label: 'Status' },
  { key: 'owner', label: 'Owner' },
  { key: 'city', label: 'City' },
  { key: 'amount', label: 'Amount' },
  { key: 'due', label: 'Due date' },
] as const;
export type CollectionColumn = (typeof COLLECTION_COLUMNS)[number]['key'];
export type CollectionGroup = 'status' | 'owner' | 'city' | 'payment';
type TreeRecord = WorkspaceRecord & { children?: TreeRecord[] };
export type CollectionViewsProps = {
  view: CollectionView;
  profile: 'mobile' | 'desktop';
  records: WorkspaceRecord[];
  allRecords: WorkspaceRecord[];
  checkedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  activeId: string | null;
  onOpen: (record: WorkspaceRecord) => void;
  onEdit: (record: WorkspaceRecord) => void;
  editingId: string | null;
  visibleColumns: CollectionColumn[];
  groupKey: CollectionGroup;
  onGroupChange: (value: CollectionGroup) => void;
  expandedIds: string[];
  onExpandedChange: (ids: string[]) => void;
  calendarMonth: string;
  onMonthChange: (value: string) => void;
  differencesOnly: boolean;
  onDifferencesChange: (value: boolean) => void;
  deferredIds: string[];
  onApprove: (record: WorkspaceRecord) => void;
  onDefer: (record: WorkspaceRecord) => void;
  onRestoreDeferred: () => void;
  onStatusChange: (record: WorkspaceRecord, status: RecordStatus) => void;
  editor: ReactNode;
  bulkPanel: ReactNode;
};

export default function CollectionViews(props: CollectionViewsProps) {
  const { t, locale } = useI18n();
  const { records, checkedIds, onSelectionChange, onOpen, onEdit, profile, view } = props;
  const toggle = (record: WorkspaceRecord, checked: boolean) =>
    onSelectionChange(
      checked
        ? [...new Set([...checkedIds, record.id])]
        : checkedIds.filter(id => id !== record.id),
    );
  const openAction = (record: WorkspaceRecord) => (
    <GenUXButton
      id={`collection-open-${record.id}`}
      fill="text"
      text={t('Open {id}', { id: record.id })}
      onClick={() => onOpen(record)}
      aria-label={t('Open details for {id}', { id: record.id })}
    />
  );
  const recordCard = (record: WorkspaceRecord) => {
    const tones: Record<RecordStatus, CardTone> = {
      draft: 'default',
      pending: 'warning',
      approved: 'success',
      shipped: 'processing',
    };
    const model: GenUXCardModel = {
      id: record.id,
      kind: 'entity',
      title: record.customer,
      eyebrow: record.id,
      description: record.readOnly ? t('Read only') : undefined,
      status: {
        label: STATUS_LABELS[record.status],
        tone: tones[record.status],
        colorIndex: workspacePillColorIndex.status[record.status],
      },
      facts: [
        {
          key: 'amount',
          label: 'Amount',
          value: record.amount,
          format: 'currency',
          currency: record.currency,
        },
        { key: 'due', label: 'Due date', value: record.due, format: 'date' },
        { key: 'owner', label: 'Owner', value: record.owner || t('Unassigned') },
      ],
      selection: {
        mode: 'multiple',
        selected: checkedIds.includes(record.id),
        group: 'legacy-collection-records',
      },
      primaryAction: { id: 'inspect', label: t('Open {id}', { id: record.id }), intent: 'inspect' },
      density: 'compact',
    };
    return (
      <EntityCard
        model={model}
        primaryActionId={`collection-open-${record.id}`}
        onAction={() => onOpen(record)}
        onSelectionChange={selected => toggle(record, selected)}
      />
    );
  };
  const recordRows = (items: WorkspaceRecord[], editable = false, cards = false) => (
    <ul className="collection-record-list">
      {items.map(record => (
        <li
          key={record.id}
          className="collection-record-row"
          data-active={props.activeId === record.id}
        >
          {cards ? (
            recordCard(record)
          ) : (
            <>
              <Checkbox
                checked={checkedIds.includes(record.id)}
                onChange={event => toggle(record, event.target.checked)}
                aria-label={t('Select {id}', { id: record.id })}
              />
              <div className="collection-record-content">
                <strong>{record.customer}</strong>
                <span>{record.id}</span>
                <div className="collection-inline">
                  <GenUXPill colorIndex={workspacePillColorIndex.status[record.status]}>
                    {t(STATUS_LABELS[record.status])}
                  </GenUXPill>
                  <span>{moneyText(record.amount, record.currency, locale)}</span>
                </div>
                <p>
                  {t('Due date')}: {dateText(record.due, locale)} ·{' '}
                  {record.owner || t('Unassigned')}
                </p>
                {record.readOnly && <p>{t('Read only')}</p>}
                {editable ? (
                  <GenUXButton
                    id={`collection-edit-${record.id}`}
                    fill="text"
                    disabled={record.readOnly || !!props.editingId}
                    text={t('Edit {id}', { id: record.id })}
                    onClick={() => onEdit(record)}
                  />
                ) : (
                  openAction(record)
                )}
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
  const table = (items: TreeRecord[], tree = false, editable = false) => {
    const columns: TableColumnsType<TreeRecord> = [
      {
        key: 'id',
        title: t('Order ID'),
        dataIndex: 'id',
        width: 'var(--collection-column-id)',
        className: 'collection-col-id',
        render: (_, record) => (
          <span>
            {record.id}
            {record.readOnly && <span className="collection-cell-meta">{t('Read only')}</span>}
          </span>
        ),
      },
      ...props.visibleColumns.map((key): TableColumnsType<TreeRecord>[number] => ({
        key,
        dataIndex: key,
        title: t(COLLECTION_COLUMNS.find(column => column.key === key)!.label),
        width:
          key === 'customer'
            ? 'var(--collection-column-customer)'
            : key === 'amount'
              ? 'var(--collection-column-value)'
              : 'var(--collection-column-text)',
        className: `collection-col-${key}`,
        render: (_, record) =>
          key === 'status' ? (
            <GenUXPill colorIndex={workspacePillColorIndex.status[record.status]}>
              {t(STATUS_LABELS[record.status])}
            </GenUXPill>
          ) : key === 'amount' ? (
            moneyText(record.amount, record.currency, locale)
          ) : key === 'due' ? (
            dateText(record.due, locale)
          ) : (
            record[key] || t('Unassigned')
          ),
      })),
      {
        key: 'actions',
        title: t('Actions'),
        width: 'var(--collection-column-actions)',
        className: 'collection-col-actions',
        render: (_, record) =>
          editable ? (
            <GenUXButton
              id={`collection-edit-${record.id}`}
              fill="text"
              disabled={record.readOnly || !!props.editingId}
              text={t('Edit {id}', { id: record.id })}
              onClick={() => onEdit(record)}
            />
          ) : (
            openAction(record)
          ),
      },
    ];
    return (
      <div
        className="collection-table-scroll workspace-scroll genux-control"
        role="region"
        aria-label={t(
          tree ? 'Tree table with horizontal scrolling' : 'Order table with horizontal scrolling',
        )}
        tabIndex={0}
      >
        <Table<TreeRecord>
          rowKey="id"
          columns={columns}
          dataSource={items}
          pagination={false}
          tableLayout="auto"
          rowClassName={record => (props.activeId === record.id ? 'collection-row-active' : '')}
          locale={{
            emptyText: t('No records match the current filters.'),
            expand: t('Expand children'),
            collapse: t('Collapse children'),
          }}
          rowSelection={{
            selectedRowKeys: checkedIds,
            preserveSelectedRowKeys: true,
            hideSelectAll: true,
            checkStrictly: true,
            columnWidth: 'var(--collection-column-select)',
            getCheckboxProps: record => ({ 'aria-label': t('Select {id}', { id: record.id }) }),
            onChange: keys => onSelectionChange(keys.map(String)),
          }}
          expandable={
            tree
              ? {
                  expandIcon: ({ expanded, expandable, record, onExpand }) =>
                    expandable ? (
                      <GenUXIconButton
                        icon={expanded ? 'minus' : 'plus'}
                        fill="text"
                        aria-expanded={expanded}
                        aria-label={`${t(expanded ? 'Collapse children' : 'Expand children')} ${record.id}`}
                        onClick={event => {
                          event.stopPropagation();
                          onExpand(record, event);
                        }}
                      />
                    ) : null,
                  expandedRowKeys: props.expandedIds,
                  onExpandedRowsChange: keys => props.onExpandedChange(keys.map(String)),
                }
              : undefined
          }
        />
      </div>
    );
  };

  if (view === 'bulk') return props.bulkPanel;
  if (view === 'table' || view === 'list')
    return profile === 'mobile' || view === 'list'
      ? recordRows(records, false, view === 'table')
      : table(records);
  if (view === 'editable')
    return (
      <div className="collection-view-stack">
        <p>{t('Edit a local draft, then save or cancel. Leaving a field does not save it.')}</p>
        {profile === 'mobile' ? recordRows(records, true) : table(records, false, true)}
        {props.editor}
      </div>
    );
  if (view === 'grouped') {
    const options = [
      { value: 'status', label: t('Status') },
      { value: 'owner', label: t('Owner') },
      { value: 'city', label: t('City') },
      { value: 'payment', label: t('Payment') },
    ];
    return (
      <div className="collection-view-stack">
        <div className="workspace-field">
          <label htmlFor="collection-group">{t('Group by')}</label>
          <Select<CollectionGroup>
            id="collection-group"
            value={props.groupKey}
            onChange={props.onGroupChange}
            options={options}
            labelRender={selectedLabel(options)}
          />
        </div>
        {groupRecords(records, props.groupKey).map(group => {
          const label =
            props.groupKey === 'status'
              ? t(STATUS_LABELS[group.key as RecordStatus])
              : props.groupKey === 'payment'
                ? t(PAYMENT_LABELS[group.key as keyof typeof PAYMENT_LABELS])
                : group.key || t('Unassigned');
          return (
            <section key={group.key} className="collection-group">
              <h4>
                {t('{group} · {count} records', { group: label, count: group.records.length })}
              </h4>
              {profile === 'mobile' ? recordRows(group.records) : table(group.records)}
            </section>
          );
        })}
      </div>
    );
  }
  if (view === 'tree') {
    const ids = new Set(records.map(record => record.id));
    const nodes: TreeRecord[] = records.map(record => ({ ...record }));
    const byId = new Map(nodes.map(record => [record.id, record]));
    const roots: TreeRecord[] = [];
    for (const node of nodes) {
      const parent = node.parentId && ids.has(node.parentId) ? byId.get(node.parentId) : undefined;
      if (parent) (parent.children ??= []).push(node);
      else roots.push(node);
    }
    const mobileTree = (items: TreeRecord[]): ReactNode => (
      <ul className="collection-tree-list">
        {items.map(record => (
          <li key={record.id}>
            <div className="collection-tree-heading">
              <Checkbox
                checked={checkedIds.includes(record.id)}
                onChange={event => toggle(record, event.target.checked)}
                aria-label={t('Select {id}', { id: record.id })}
              />
              <span>{record.customer}</span>
              {openAction(record)}
            </div>
            {record.children && (
              <>
                <GenUXButton
                  fill="text"
                  text={t(
                    props.expandedIds.includes(record.id) ? 'Collapse children' : 'Expand children',
                  )}
                  aria-expanded={props.expandedIds.includes(record.id)}
                  onClick={() =>
                    props.onExpandedChange(
                      props.expandedIds.includes(record.id)
                        ? props.expandedIds.filter(id => id !== record.id)
                        : [...props.expandedIds, record.id],
                    )
                  }
                />
                {props.expandedIds.includes(record.id) && mobileTree(record.children)}
              </>
            )}
          </li>
        ))}
      </ul>
    );
    return (
      <div className="collection-view-stack">
        <p>
          {t(
            'Selection is independent for each parent and child. Filtered children remain visible even if their parent is filtered out.',
          )}
        </p>
        {profile === 'mobile' ? mobileTree(roots) : table(roots, true)}
      </div>
    );
  }
  if (view === 'board') {
    const options = Object.entries(STATUS_LABELS).map(([value, label]) => ({
      value,
      label: t(label),
    }));
    return (
      <div className="collection-board">
        {Object.entries(STATUS_LABELS).map(([status, label]) => {
          const items = records.filter(record => record.status === status);
          return (
            <section className="collection-board-column" key={status}>
              <h4>{t('{group} · {count} records', { group: t(label), count: items.length })}</h4>
              {items.length === 0 ? (
                <p>{t('No records in this column.')}</p>
              ) : (
                items.map(record => (
                  <article key={record.id} className="collection-board-item">
                    {recordCard(record)}
                    <label htmlFor={`collection-status-${record.id}`}>{t('Move to status')}</label>
                    <Select<RecordStatus>
                      id={`collection-status-${record.id}`}
                      value={record.status}
                      options={options}
                      labelRender={selectedLabel(options)}
                      disabled={record.readOnly}
                      onChange={value => props.onStatusChange(record, value)}
                    />
                  </article>
                ))
              )}
            </section>
          );
        })}
      </div>
    );
  }
  if (view === 'calendar') {
    const month = new Date(`${props.calendarMonth}-01T00:00:00Z`);
    const year = month.getUTCFullYear(),
      monthIndex = month.getUTCMonth();
    const count = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const leading = (month.getUTCDay() + 6) % 7;
    const monthTitle = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(month);
    const changeMonth = (delta: number) =>
      props.onMonthChange(
        new Date(Date.UTC(year, monthIndex + delta, 1)).toISOString().slice(0, 7),
      );
    const items = records.filter(record => record.due?.startsWith(props.calendarMonth));
    return (
      <div className="collection-view-stack">
        <div className="collection-inline">
          <GenUXButton
            id="collection-month-prev"
            fill="text"
            text={t('Previous month')}
            onClick={() => changeMonth(-1)}
          />
          <h4 aria-live="polite">{monthTitle}</h4>
          <GenUXButton
            id="collection-month-next"
            fill="text"
            text={t('Next month')}
            onClick={() => changeMonth(1)}
          />
        </div>
        <p>
          {t('{count} undated records remain outside the calendar.', {
            count: records.filter(record => record.due === null).length,
          })}
        </p>
        {profile !== 'mobile' && items.length === 0 && (
          <p role="status">{t('No due dates in this month.')}</p>
        )}
        {profile === 'mobile' ? (
          <ul className="collection-agenda">
            {items.length === 0 ? (
              <li>{t('No due dates in this month.')}</li>
            ) : (
              [...items]
                .sort((a, b) => a.due!.localeCompare(b.due!))
                .map(record => (
                  <li key={record.id}>
                    <strong>{dateText(record.due, locale)}</strong>
                    <p>{record.customer}</p>
                    {openAction(record)}
                  </li>
                ))
            )}
          </ul>
        ) : (
          <div
            className="collection-calendar-scroll workspace-scroll genux-control"
            role="region"
            tabIndex={0}
            aria-label={t('Calendar with horizontal scrolling')}
          >
            <div className="collection-calendar-grid" role="table" aria-label={monthTitle}>
              <div className="collection-calendar-header" role="row">
                {Array.from({ length: 7 }, (_, index) => (
                  <div role="columnheader" key={index}>
                    {new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
                      weekday: 'short',
                      timeZone: 'UTC',
                    }).format(new Date(Date.UTC(2026, 9, 12 + index)))}
                  </div>
                ))}
              </div>
              {Array.from({ length: Math.ceil((leading + count) / 7) }, (_, week) => (
                <div role="row" className="collection-calendar-week" key={week}>
                  {Array.from({ length: 7 }, (_, weekday) => {
                    const day = week * 7 + weekday - leading + 1;
                    const date = `${props.calendarMonth}-${String(day).padStart(2, '0')}`;
                    return (
                      <div role="cell" className="collection-calendar-day" key={weekday}>
                        {day > 0 && day <= count && (
                          <>
                            <strong>{day}</strong>
                            {items
                              .filter(record => record.due === date)
                              .map(record => (
                                <div key={record.id}>
                                  <span>{record.customer}</span>
                                  {openAction(record)}
                                </div>
                              ))}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  if (view === 'gantt') {
    const scheduled = records.filter(record => record.start && record.due);
    const first = Math.min(...scheduled.map(record => Date.parse(`${record.start}T00:00:00Z`)));
    const last = Math.max(...scheduled.map(record => Date.parse(`${record.due}T00:00:00Z`)));
    const span = Math.max(last - first, 86400000);
    return (
      <div className="collection-view-stack">
        <p>
          {t(
            'Bars show the actual start and due dates. Progress and dependencies are not simulated.',
          )}
        </p>
        <p>
          {t('{count} unscheduled records have incomplete dates.', {
            count: records.length - scheduled.length,
          })}
        </p>
        {profile === 'mobile' ? (
          <ul className="collection-agenda">
            {[...scheduled]
              .sort((a, b) => a.start!.localeCompare(b.start!))
              .map(record => (
                <li key={record.id}>
                  <strong>{record.customer}</strong>
                  <p>
                    {dateText(record.start, locale)} → {dateText(record.due, locale)}
                  </p>
                  {openAction(record)}
                </li>
              ))}
          </ul>
        ) : (
          <div
            className="collection-timeline-scroll workspace-scroll genux-control"
            role="region"
            tabIndex={0}
            aria-label={t('Timeline with horizontal scrolling')}
          >
            <table className="collection-timeline-table">
              <caption>{t('Scheduled orders')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('Order')}</th>
                  <th scope="col">{t('Start and due dates')}</th>
                  <th scope="col">{t('Timeline')}</th>
                </tr>
              </thead>
              <tbody>
                {scheduled.map(record => {
                  const start = Date.parse(`${record.start}T00:00:00Z`),
                    end = Date.parse(`${record.due}T00:00:00Z`);
                  return (
                    <tr key={record.id}>
                      <th scope="row">
                        {openAction(record)}
                        <p>{record.customer}</p>
                      </th>
                      <td>
                        {dateText(record.start, locale)} → {dateText(record.due, locale)}
                      </td>
                      <td>
                        <div className="collection-timeline-track" aria-hidden="true">
                          <span
                            className="collection-timeline-bar"
                            style={
                              {
                                '--collection-bar-start': `${((start - first) / span) * 100}%`,
                                '--collection-bar-width': `${Math.max(((end - start) / span) * 100, 1)}%`,
                              } as CSSProperties
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }
  if (view === 'pairs')
    return (
      <ul className="collection-pairs-list">
        {records.map(record => (
          <li key={record.id}>
            <h4>{record.id}</h4>
            <dl>
              <dt>{t('Customer')}</dt>
              <dd>{record.customer}</dd>
              <dt>{t('Owner')}</dt>
              <dd>{record.owner || t('Unassigned')}</dd>
              <dt>{t('City')}</dt>
              <dd>{record.city || t('Unassigned')}</dd>
              <dt>{t('Status')}</dt>
              <dd>{t(STATUS_LABELS[record.status])}</dd>
              <dt>{t('Amount')}</dt>
              <dd>{moneyText(record.amount, record.currency, locale)}</dd>
              <dt>{t('Due date')}</dt>
              <dd>{dateText(record.due, locale)}</dd>
              <dt>{t('Notes')}</dt>
              <dd>{record.notes || t('No note')}</dd>
            </dl>
            {openAction(record)}
          </li>
        ))}
      </ul>
    );
  if (view === 'compare') {
    const selected = props.allRecords.filter(record => checkedIds.includes(record.id));
    const fields = [
      { label: 'Customer', value: (record: WorkspaceRecord) => record.customer },
      { label: 'Status', value: (record: WorkspaceRecord) => t(STATUS_LABELS[record.status]) },
      { label: 'Owner', value: (record: WorkspaceRecord) => record.owner || t('Unassigned') },
      { label: 'City', value: (record: WorkspaceRecord) => record.city || t('Unassigned') },
      {
        label: 'Amount',
        value: (record: WorkspaceRecord) => moneyText(record.amount, record.currency, locale),
      },
      { label: 'Payment', value: (record: WorkspaceRecord) => t(PAYMENT_LABELS[record.payment]) },
      { label: 'Due date', value: (record: WorkspaceRecord) => dateText(record.due, locale) },
    ];
    const compared = fields.filter(
      field => !props.differencesOnly || new Set(selected.map(field.value)).size > 1,
    );
    return (
      <div className="collection-view-stack">
        <Checkbox
          id="collection-compare-differences"
          checked={props.differencesOnly}
          onChange={event => props.onDifferencesChange(event.target.checked)}
        >
          {t('Show differences only')}
        </Checkbox>
        {selected.length < 2 ? (
          <>
            <p>{t('Select at least two loaded records to compare them.')}</p>
            {recordRows(records)}
          </>
        ) : (
          <div
            className="collection-compare-scroll workspace-scroll genux-control"
            role="region"
            tabIndex={0}
            aria-label={t('Record comparison with horizontal scrolling')}
          >
            <table className="collection-comparison-table">
              <caption>{t('{count} selected records', { count: selected.length })}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('Field')}</th>
                  {selected.map(record => (
                    <th scope="col" key={record.id}>
                      {record.id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compared.map(field => (
                  <tr key={field.label}>
                    <th scope="row">{t(field.label)}</th>
                    {selected.map(record => (
                      <td key={record.id}>{field.value(record)}</td>
                    ))}
                  </tr>
                ))}
                {compared.length === 0 && (
                  <tr>
                    <td colSpan={selected.length + 1}>
                      {t('The selected records match in all compared fields.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }
  const queue = records.filter(
    record => record.status === 'pending' && !props.deferredIds.includes(record.id),
  );
  return (
    <div className="collection-view-stack">
      <p>
        {t(
          'Review is a local capability example, not an approved view type. Approval and defer actions affect only these fictional records.',
        )}
      </p>
      <h4 id="collection-review-heading" tabIndex={-1}>
        {t('{count} records awaiting review', { count: queue.length })}
      </h4>
      {props.deferredIds.length > 0 && (
        <GenUXButton
          fill="text"
          text={t('Restore {count} deferred records', { count: props.deferredIds.length })}
          onClick={props.onRestoreDeferred}
        />
      )}
      {queue.length === 0 ? (
        <p>{t('The current review queue is empty.')}</p>
      ) : (
        <ul className="collection-review-list">
          {queue.map(record => (
            <li key={record.id}>
              <h4>{record.customer}</h4>
              <p>
                {record.id} · {moneyText(record.amount, record.currency, locale)}
              </p>
              <p>{record.notes}</p>
              <div className="collection-inline">
                {openAction(record)}
                <GenUXButton
                  text={t('Approve {id}', { id: record.id })}
                  disabled={record.readOnly}
                  onClick={() => props.onApprove(record)}
                />
                <GenUXButton
                  fill="text"
                  text={t('Defer {id}', { id: record.id })}
                  onClick={() => props.onDefer(record)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
