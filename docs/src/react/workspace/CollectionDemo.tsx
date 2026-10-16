import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
} from 'react';
import { Checkbox, Select } from 'antd';
import Input from '../AtlasInput';
import { Drawer } from '../AtlasOverlay';
import { DateField } from './kit/Fields';
import AtlasProvider from '../AtlasProvider';
import ExamplePreview from '../ExamplePreview';
import AtlasButton from '../AtlasButton';
import AtlasPill from '../AtlasPill';
import AtlasSplitter from '../AtlasSplitter';
import { workspacePillColorIndex } from '../../data/workspace-pill-colors';
import { selectedLabel } from '../selectedLabel';
import { useI18n } from '../useI18n';
import { TweakerSettings } from '../AtlasTweaker';
import WorkspaceFrame, { type WorkspaceProfile } from './WorkspaceFrame';
import RecordSummary from './RecordSummary';
import CollectionViews, {
  COLLECTION_VIEWS,
  COLLECTION_COLUMNS,
  type CollectionView,
  type CollectionColumn,
  type CollectionGroup,
} from './CollectionViews';
import {
  initialRecords,
  filterRecords,
  sortRecords,
  currencyTotals,
  moneyText,
  bulkUpdate,
  STATUS_LABELS,
  PAYMENT_LABELS,
  EXPERIMENT_DATE,
  type WorkspaceRecord,
  type WorkspaceFilter,
  type SortCriterion,
  type BulkChange,
  type RecordStatus,
} from '../../data/workspace';

type RowDraft = { id: string; amount: string; owner: string; notes: string };
type Feedback = {
  kind: 'saved' | 'bulk' | 'status' | 'approved' | 'deferred';
  id?: string;
  count?: number;
} | null;
type Preview = { signature: string; result: ReturnType<typeof bulkUpdate> };
const tableViews = new Set<CollectionView>(['table', 'grouped', 'tree', 'editable']);
const initialColumns = COLLECTION_COLUMNS.map(column => column.key);

// Both routes share this demo; each keeps its own literal workbench ID.
function CollectionWorkbench({
  tableOnly,
  ...frame
}: ComponentProps<typeof WorkspaceFrame> & { tableOnly: boolean }) {
  const workspace = <WorkspaceFrame {...frame} />;
  return tableOnly ? (
    <ExamplePreview id="data-table-workspace" title="Data table examples">
      {workspace}
    </ExamplePreview>
  ) : (
    <ExamplePreview id="collection-views-workspace" title="Collection view examples">
      {workspace}
    </ExamplePreview>
  );
}

export function DataTableDemo({ documentation = false }: { documentation?: boolean } = {}) {
  return <CollectionDemo tableOnly initialProfile="desktop" documentation={documentation} />;
}

export default function CollectionDemo({
  tableOnly = false,
  initialProfile = 'mobile',
  documentation = true,
}: {
  tableOnly?: boolean;
  initialProfile?: WorkspaceProfile;
  documentation?: boolean;
} = {}) {
  const { t, locale } = useI18n();
  const [profile, setProfile] = useState<WorkspaceProfile>(initialProfile);
  const [view, setView] = useState<CollectionView>('table');
  const [records, setRecords] = useState(initialRecords);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<WorkspaceFilter['status']>('all');
  const [owner, setOwner] = useState('all');
  const [city, setCity] = useState('all');
  const [payment, setPayment] = useState<WorkspaceFilter['payment']>('all');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [dueBefore, setDueBefore] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sortField, setSortField] = useState<SortCriterion['field']>('id');
  const [sortDirection, setSortDirection] = useState<SortCriterion['direction']>('asc');
  const [secondSort, setSecondSort] = useState<SortCriterion['field'] | 'none'>('none');
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [drawer, setDrawer] = useState<'filters' | 'columns' | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<CollectionColumn[]>(initialColumns);
  const [groupKey, setGroupKey] = useState<CollectionGroup>('status');
  const [expandedIds, setExpandedIds] = useState<string[]>(['SP-26-0401']);
  const [calendarMonth, setCalendarMonth] = useState('2026-10');
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const [deferredIds, setDeferredIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<RowDraft | null>(null);
  const [draftError, setDraftError] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [bulkField, setBulkField] = useState<BulkChange['field']>('owner');
  const [bulkMode, setBulkMode] = useState<BulkChange['mode']>('unchanged');
  const [bulkValue, setBulkValue] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const pendingActionFocus = useRef<string | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (pendingActionFocus.current) {
      (
        document.getElementById(pendingActionFocus.current) ??
        document.getElementById('collection-search')
      )?.focus();
      pendingActionFocus.current = null;
    }
  }, [records, deferredIds]);
  const previousDetailOpen = useRef(false);
  const previousDraftId = useRef<string | null>(null);
  const draftId = draft?.id ?? null;
  useLayoutEffect(() => {
    if (draftId) document.getElementById('collection-edit-amount')?.focus();
    else if (previousDraftId.current)
      (
        document.getElementById(`collection-edit-${previousDraftId.current}`) ??
        document.getElementById('collection-search')
      )?.focus();
    previousDraftId.current = draftId;
  }, [draftId]);
  useLayoutEffect(() => {
    if (detailOpen) detailRef.current?.focus();
    else if (previousDetailOpen.current)
      (
        document.getElementById(`collection-open-${activeId}`) ??
        document.getElementById('collection-search')
      )?.focus();
    previousDetailOpen.current = detailOpen;
  }, [detailOpen, activeId]);
  const amountValid = (value: string) =>
    value.trim() === '' ||
    (Number.isFinite(Number(value)) &&
      Number(value) >= 0 &&
      Number.isSafeInteger(Math.round(Number(value) * 100)));
  const filterValid =
    amountValid(minAmount) &&
    amountValid(maxAmount) &&
    (!minAmount.trim() || !maxAmount.trim() || Number(minAmount) <= Number(maxAmount));
  const filtered = useMemo(
    () =>
      filterValid
        ? sortRecords(
            filterRecords(records, {
              query,
              status,
              owner,
              city,
              payment,
              minAmount: minAmount.trim() ? Number(minAmount) : undefined,
              maxAmount: maxAmount.trim() ? Number(maxAmount) : undefined,
              dueBefore,
              overdueOnly,
            }),
            [
              { field: sortField, direction: sortDirection },
              ...(secondSort === 'none' || secondSort === sortField
                ? []
                : [{ field: secondSort, direction: sortDirection }]),
            ],
            locale,
          )
        : [],
    [
      filterValid,
      records,
      query,
      status,
      owner,
      city,
      payment,
      minAmount,
      maxAmount,
      dueBefore,
      overdueOnly,
      sortField,
      sortDirection,
      secondSort,
      locale,
    ],
  );
  const active = records.find(record => record.id === activeId);
  const hiddenSelected = checkedIds.filter(id => !filtered.some(record => record.id === id)).length;
  const options = COLLECTION_VIEWS.filter(item => !tableOnly || tableViews.has(item.value)).map(
    item => ({ value: item.value, label: t(item.label) }),
  );
  const uniqueOwners = [...new Set(records.map(record => record.owner).filter(Boolean))];
  const uniqueCities = [...new Set(records.map(record => record.city).filter(Boolean))];
  const signature = JSON.stringify({
    ids: [...checkedIds].sort(),
    bulkField,
    bulkMode,
    bulkValue,
    records,
  });
  const currentPreview = preview?.signature === signature ? preview.result : null;
  const bulkValid =
    checkedIds.length > 0 && bulkMode !== 'unchanged' && (bulkMode !== 'set' || !!bulkValue.trim());
  const clearFilters = () => {
    setQuery('');
    setStatus('all');
    setOwner('all');
    setCity('all');
    setPayment('all');
    setMinAmount('');
    setMaxAmount('');
    setDueBefore('');
    setOverdueOnly(false);
  };
  const openRecord = (record: WorkspaceRecord) => {
    setActiveId(record.id);
    setDetailOpen(true);
  };
  const closeRecord = () => {
    setDetailOpen(false);
  };
  const startEdit = (record: WorkspaceRecord) => {
    if (record.readOnly || draft) return;
    setDraft({
      id: record.id,
      amount: record.amount === null ? '' : String(record.amount),
      owner: record.owner,
      notes: record.notes,
    });
    setDraftError(false);
    setActiveId(record.id);
  };
  const saveDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || !amountValid(draft.amount)) {
      setDraftError(true);
      return;
    }
    const record = records.find(item => item.id === draft.id);
    if (!record || record.readOnly) return;
    setRecords(current =>
      current.map(item =>
        item.id === draft.id
          ? {
              ...item,
              amount: draft.amount.trim() === '' ? null : Number(draft.amount),
              owner: draft.owner.trim(),
              notes: draft.notes,
            }
          : item,
      ),
    );
    setFeedback({ kind: 'saved', id: draft.id });
    setDraft(null);
    setDraftError(false);
  };
  const updateStatus = (record: WorkspaceRecord, next: RecordStatus) => {
    if (record.readOnly) return;
    setRecords(current =>
      current.map(item => (item.id === record.id ? { ...item, status: next } : item)),
    );
    setFeedback({ kind: next === 'approved' ? 'approved' : 'status', id: record.id });
  };
  const choiceGroup = <T extends string>(
    id: string,
    label: string,
    value: T,
    choices: { value: T; label: string }[],
    change: (next: T) => void,
  ) => (
    <div className="workspace-field" role="group" aria-labelledby={`${id}-label`}>
      <strong id={`${id}-label`}>{label}</strong>
      <div className="collection-choice-group">
        {choices.map(option => (
          <AtlasButton
            key={option.value}
            id={`${id}-${option.value}`}
            fill={value === option.value ? 'solid' : 'text'}
            text={option.label}
            aria-pressed={value === option.value}
            onClick={() => change(option.value)}
          />
        ))}
      </div>
    </div>
  );
  const editor = draft && (
    <form className="collection-editor" id="collection-editor" onSubmit={saveDraft} noValidate>
      <h4>{t('Local draft for {id}', { id: draft.id })}</h4>
      <p>
        {t(
          'A blank amount means unknown. Zero is a valid amount. The record currency is unchanged.',
        )}
      </p>
      <div className="workspace-field">
        <label htmlFor="collection-edit-amount">{t('Amount')}</label>
        <Input
          id="collection-edit-amount"
          inputMode="decimal"
          value={draft.amount}
          aria-invalid={draftError}
          aria-describedby={draftError ? 'collection-edit-error' : undefined}
          status={draftError ? 'error' : undefined}
          onChange={event => {
            setDraft(current => (current ? { ...current, amount: event.target.value } : null));
            setDraftError(false);
          }}
        />
      </div>
      {draftError && (
        <p id="collection-edit-error" role="alert">
          {t('Enter a finite amount of zero or more, or leave it blank.')}
        </p>
      )}
      <div className="workspace-field">
        <label htmlFor="collection-edit-owner">{t('Owner')}</label>
        <Input
          id="collection-edit-owner"
          value={draft.owner}
          onChange={event =>
            setDraft(current => (current ? { ...current, owner: event.target.value } : null))
          }
        />
      </div>
      <div className="workspace-field">
        <label htmlFor="collection-edit-notes">{t('Notes')}</label>
        <Input.TextArea
          id="collection-edit-notes"
          value={draft.notes}
          rows={3}
          onChange={event =>
            setDraft(current => (current ? { ...current, notes: event.target.value } : null))
          }
        />
      </div>
      <div className="collection-inline">
        <AtlasButton id="collection-edit-save" htmlType="submit" text={t('Save local draft')} />
        <AtlasButton
          id="collection-edit-cancel"
          fill="text"
          text={t('Cancel draft')}
          onClick={() => {
            setDraft(null);
            setDraftError(false);
          }}
        />
      </div>
    </form>
  );
  const bulkFields = [
    { value: 'owner', label: t('Owner') },
    { value: 'city', label: t('City') },
    { value: 'notes', label: t('Notes') },
  ];
  const bulkModes = [
    { value: 'unchanged', label: t('Leave unchanged') },
    { value: 'clear', label: t('Clear value') },
    { value: 'set', label: t('Set value') },
  ];
  const bulkPanel = (
    <div className="collection-view-stack">
      <p>
        {t(
          'Bulk edit is a local capability example, not an approved view type. Review the exact targets before applying a change.',
        )}
      </p>
      <p>{t('{count} selected loaded records', { count: checkedIds.length })}</p>
      <div className="collection-control-grid">
        <div className="workspace-field">
          <label htmlFor="collection-bulk-field">{t('Field to update')}</label>
          <Select<BulkChange['field']>
            id="collection-bulk-field"
            value={bulkField}
            onChange={setBulkField}
            options={bulkFields}
            labelRender={selectedLabel(bulkFields)}
          />
        </div>
        <div className="workspace-field">
          <label htmlFor="collection-bulk-mode">{t('Change mode')}</label>
          <Select<BulkChange['mode']>
            id="collection-bulk-mode"
            value={bulkMode}
            onChange={setBulkMode}
            options={bulkModes}
            labelRender={selectedLabel(bulkModes)}
          />
        </div>
        {bulkMode === 'set' && (
          <div className="workspace-field">
            <label htmlFor="collection-bulk-value">{t('New value')}</label>
            <Input
              id="collection-bulk-value"
              value={bulkValue}
              onChange={event => setBulkValue(event.target.value)}
            />
          </div>
        )}
      </div>
      {bulkMode === 'unchanged' && (
        <p>{t('Leave unchanged produces no changes. Choose clear or set to create a preview.')}</p>
      )}
      {bulkMode === 'set' && !bulkValue.trim() && (
        <p>{t('Enter a value to preview the update.')}</p>
      )}
      <div className="collection-inline">
        <AtlasButton
          id="collection-bulk-preview"
          disabled={!bulkValid}
          text={t('Preview selected changes')}
          onClick={() =>
            setPreview({
              signature,
              result: bulkUpdate(records, checkedIds, {
                field: bulkField,
                mode: bulkMode,
                value: bulkValue,
              }),
            })
          }
        />
        <AtlasButton
          id="collection-bulk-apply"
          text={t('Apply locally')}
          disabled={!currentPreview || currentPreview.appliedIds.length === 0}
          onClick={() => {
            if (!currentPreview) return;
            setRecords(currentPreview.records);
            setFeedback({ kind: 'bulk', count: currentPreview.appliedIds.length });
            setPreview(null);
          }}
        />
      </div>
      {currentPreview && (
        <section className="collection-bulk-preview" aria-label={t('Bulk change preview')}>
          <h4>{t('{count} editable targets', { count: currentPreview.appliedIds.length })}</h4>
          <ul>
            {currentPreview.appliedIds.map(id => (
              <li key={id}>
                {id}: {bulkMode === 'clear' ? t('Value will be cleared') : bulkValue.trim()}
              </li>
            ))}
          </ul>
          <p>
            {t('{count} read-only records excluded', { count: currentPreview.excludedIds.length })}
          </p>
          {currentPreview.excludedIds.length > 0 && (
            <ul>
              {currentPreview.excludedIds.map(id => (
                <li key={id}>
                  {id} · {t('Read only')}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {checkedIds.length === 0 && (
        <p>{t('Select records in another view or use Select visible loaded records above.')}</p>
      )}
    </div>
  );
  const showDetails =
    detailOpen &&
    active &&
    ['table', 'list', 'grouped', 'tree', 'pairs', 'board', 'calendar', 'gantt', 'review'].includes(
      view,
    );
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined}>
      <CollectionWorkbench
        tableOnly={tableOnly}
        profile={profile}
        onProfileChange={setProfile}
        title={tableOnly ? 'Data table examples' : 'Collection view examples'}
        kind="collection"
      >
        <div className="collection-toolbar">
          <div className="collection-control-grid">
            <div className="workspace-field">
              <label htmlFor="collection-search">{t('Search loaded records')}</label>
              <Input
                id="collection-search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={t('Order ID, customer, title or owner')}
              />
            </div>
            <TweakerSettings title="View">
              <div className="workspace-field">
                <label htmlFor="collection-view">{t('View')}</label>
                <Select<CollectionView>
                  id="collection-view"
                  value={view}
                  onChange={value => {
                    setView(value);
                    setDetailOpen(false);
                  }}
                  options={options}
                  labelRender={selectedLabel(options)}
                />
              </div>
            </TweakerSettings>
          </div>
          <div className="collection-inline">
            <AtlasButton
              id="collection-filters"
              fill="text"
              text={t('Filter and sort')}
              onClick={() => setDrawer('filters')}
            />
            <AtlasButton
              id="collection-customize"
              fill="text"
              text={t('Choose table columns')}
              onClick={() => setDrawer('columns')}
            />
            <AtlasButton
              id="collection-clear-filters"
              fill="text"
              text={t('Clear filters')}
              onClick={clearFilters}
            />
          </div>
          <p id="collection-results" role="status">
            {t('{visible} of {total} loaded records', {
              visible: filtered.length,
              total: records.length,
            })}
            {' · '}
            {t('{count} selected records', { count: checkedIds.length })}
            {hiddenSelected > 0 && (
              <>
                {' '}
                ·{' '}
                {t('{count} selected records are outside the current filters', {
                  count: hiddenSelected,
                })}
              </>
            )}
          </p>
          <div className="collection-inline">
            <AtlasButton
              id="collection-select-visible"
              fill="text"
              text={t('Select visible loaded records')}
              disabled={filtered.length === 0}
              onClick={() =>
                setCheckedIds(current => [
                  ...new Set([...current, ...filtered.map(record => record.id)]),
                ])
              }
            />
            <AtlasButton
              id="collection-clear-selection"
              fill="text"
              text={t('Clear selection')}
              disabled={checkedIds.length === 0}
              onClick={() => setCheckedIds([])}
            />
          </div>
          <div className="collection-inline" aria-label={t('Totals by currency')}>
            {currencyTotals(filtered).map(total => (
              <AtlasPill
                key={total.currency}
                colorIndex={workspacePillColorIndex.currency[total.currency]}
              >
                {total.currency}: {moneyText(total.amount, total.currency, locale)}
              </AtlasPill>
            ))}
          </div>
          {currencyTotals(filtered).some(total => total.amount === null) && (
            <p role="status">
              {t(
                'Unsupported totals are shown as unknown. Reduce the amount to a supported range.',
              )}
            </p>
          )}
          {filtered.some(record => record.amount === null) && (
            <p>
              {t('{count} unknown amounts are excluded from totals.', {
                count: filtered.filter(record => record.amount === null).length,
              })}
            </p>
          )}
          {draft && view !== 'editable' && (
            <p>
              {t('An unsaved row draft is preserved. Return to Row editing to save or cancel it.')}
            </p>
          )}
          {feedback && (
            <p role="status" aria-live="polite">
              {feedback.kind === 'saved'
                ? t('Draft for {id} saved locally.', { id: feedback.id! })
                : feedback.kind === 'bulk'
                  ? t('{count} records updated locally.', { count: feedback.count! })
                  : feedback.kind === 'approved'
                    ? t('{id} approved locally.', { id: feedback.id! })
                    : feedback.kind === 'deferred'
                      ? t('{id} deferred from the local review queue.', { id: feedback.id! })
                      : t('Status for {id} changed locally.', { id: feedback.id! })}
            </p>
          )}
        </div>
        {!filterValid && (
          <p role="alert">
            {t('Enter non-negative amount limits and keep the minimum at or below the maximum.')}
          </p>
        )}
        <AtlasSplitter
          id="collection-workspace-splitter"
          className="collection-workspace"
          label={t(
            tableOnly ? 'Data table and record inspector' : 'Collection and record inspector',
          )}
          orientation="auto"
          initialSizes={[65, 35]}
          panels={[
            {
              id: 'records',
              label: t('Record results'),
              children: (
                <>
                  {filtered.length === 0 && view !== 'bulk' && view !== 'compare' && (
                    <div className="collection-empty">
                      <h4>{t('No records match the current filters.')}</h4>
                      <AtlasButton text={t('Clear filters')} onClick={clearFilters} />
                    </div>
                  )}
                  <section
                    className="collection-active-view"
                    data-collection-view={view}
                    hidden={filtered.length === 0 && view !== 'bulk' && view !== 'compare'}
                    aria-label={options.find(option => option.value === view)?.label}
                  >
                    <CollectionViews
                      view={view}
                      profile={profile}
                      records={filtered}
                      allRecords={records}
                      checkedIds={checkedIds}
                      onSelectionChange={setCheckedIds}
                      activeId={activeId}
                      onOpen={openRecord}
                      onEdit={startEdit}
                      editingId={draft?.id ?? null}
                      visibleColumns={visibleColumns}
                      groupKey={groupKey}
                      onGroupChange={setGroupKey}
                      expandedIds={expandedIds}
                      onExpandedChange={setExpandedIds}
                      calendarMonth={calendarMonth}
                      onMonthChange={setCalendarMonth}
                      differencesOnly={differencesOnly}
                      onDifferencesChange={setDifferencesOnly}
                      deferredIds={deferredIds}
                      onApprove={record => {
                        pendingActionFocus.current = 'collection-review-heading';
                        updateStatus(record, 'approved');
                      }}
                      onDefer={record => {
                        pendingActionFocus.current = 'collection-review-heading';
                        setDeferredIds(current => [...new Set([...current, record.id])]);
                        setFeedback({ kind: 'deferred', id: record.id });
                      }}
                      onRestoreDeferred={() => setDeferredIds([])}
                      onStatusChange={(record, next) => {
                        pendingActionFocus.current = `collection-status-${record.id}`;
                        updateStatus(record, next);
                      }}
                      editor={editor}
                      bulkPanel={bulkPanel}
                    />
                  </section>
                </>
              ),
            },
            {
              id: 'inspector',
              label: t('Selected record details'),
              children: (
                <>
                  <div className="collection-empty" hidden={Boolean(showDetails)}>
                    <h4>{t('Record inspector')}</h4>
                    <p>
                      {t('Open a record to inspect its details. Checked records remain separate.')}
                    </p>
                  </div>
                  <div
                    className="workspace-disclosure collection-detail-shell"
                    data-open={Boolean(showDetails)}
                    aria-hidden={!showDetails}
                    inert={!showDetails}
                  >
                    <div className="workspace-disclosure-clip">
                      {active && (
                        <section
                          className="collection-detail"
                          ref={detailRef}
                          tabIndex={-1}
                          aria-label={t('Selected record details')}
                        >
                          <AtlasButton
                            fill="text"
                            id="collection-detail-back"
                            text={t('Close details')}
                            onClick={closeRecord}
                          />
                          <RecordSummary record={active} compact />
                        </section>
                      )}
                    </div>
                  </div>
                </>
              ),
            },
          ]}
        />
        <Drawer
          rootClassName="atlas-demo workspace-lab workspace-overlay live-preview"
          title={t(drawer === 'columns' ? 'Choose table columns' : 'Filter and sort')}
          open={drawer !== null}
          onClose={() => setDrawer(null)}
          size="min(512px, 100vw)"
          closable={{ 'aria-label': t('Close panel') }}
          focusable={{ trap: true, focusTriggerAfterClose: true }}
          destroyOnHidden={false}
        >
          {drawer === 'columns' ? (
            <div className="collection-view-stack">
              <p>
                {t(
                  'Order ID, selection and actions remain available. Column choices affect the desktop table views.',
                )}
              </p>
              {COLLECTION_COLUMNS.map(column => (
                <Checkbox
                  key={column.key}
                  id={`collection-column-${column.key}`}
                  checked={visibleColumns.includes(column.key)}
                  onChange={event =>
                    setVisibleColumns(current =>
                      event.target.checked
                        ? initialColumns.filter(key => current.includes(key) || key === column.key)
                        : current.filter(key => key !== column.key),
                    )
                  }
                >
                  {t(column.label)}
                </Checkbox>
              ))}
            </div>
          ) : (
            <div className="collection-view-stack">
              <p>
                {t('All filters combine with AND. Dates use the fixed example date {date}.', {
                  date: EXPERIMENT_DATE,
                })}
              </p>
              {choiceGroup(
                'collection-status',
                t('Status'),
                status ?? 'all',
                [
                  { value: 'all', label: t('All statuses') },
                  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({
                    value: value as RecordStatus,
                    label: t(label),
                  })),
                ],
                setStatus,
              )}
              {choiceGroup(
                'collection-owner',
                t('Owner'),
                owner,
                [
                  { value: 'all', label: t('All owners') },
                  ...uniqueOwners.map(value => ({ value, label: value })),
                ],
                setOwner,
              )}
              {choiceGroup(
                'collection-city',
                t('City'),
                city,
                [
                  { value: 'all', label: t('All cities') },
                  ...uniqueCities.map(value => ({ value, label: value })),
                ],
                setCity,
              )}
              {choiceGroup(
                'collection-payment',
                t('Payment'),
                payment ?? 'all',
                [
                  { value: 'all', label: t('All payment states') },
                  ...Object.entries(PAYMENT_LABELS).map(([value, label]) => ({
                    value: value as keyof typeof PAYMENT_LABELS,
                    label: t(label),
                  })),
                ],
                setPayment,
              )}
              <div className="workspace-field">
                <label htmlFor="collection-min">{t('Minimum amount')}</label>
                <Input
                  id="collection-min"
                  inputMode="decimal"
                  value={minAmount}
                  onChange={event => setMinAmount(event.target.value)}
                />
              </div>
              <div className="workspace-field">
                <label htmlFor="collection-max">{t('Maximum amount')}</label>
                <Input
                  id="collection-max"
                  inputMode="decimal"
                  value={maxAmount}
                  onChange={event => setMaxAmount(event.target.value)}
                />
              </div>
              <div className="workspace-field">
                <label htmlFor="collection-due">{t('Due on or before')}</label>
                <DateField
                  id="collection-due"
                  value={dueBefore || null}
                  onChange={value => setDueBefore(value ?? '')}
                />
              </div>
              <Checkbox
                id="collection-overdue"
                checked={overdueOnly}
                onChange={event => setOverdueOnly(event.target.checked)}
              >
                {t('Overdue and not shipped')}
              </Checkbox>
              {choiceGroup(
                'collection-sort',
                t('Primary sort'),
                sortField,
                [
                  { value: 'id', label: t('Order ID') },
                  { value: 'customer', label: t('Customer') },
                  { value: 'amount', label: t('Amount') },
                  { value: 'due', label: t('Due date') },
                  { value: 'status', label: t('Status') },
                  { value: 'owner', label: t('Owner') },
                ],
                setSortField,
              )}
              {choiceGroup(
                'collection-sort-direction',
                t('Sort direction'),
                sortDirection,
                [
                  { value: 'asc', label: t('Ascending') },
                  { value: 'desc', label: t('Descending') },
                ],
                setSortDirection,
              )}
              {choiceGroup(
                'collection-sort-second',
                t('Secondary sort'),
                secondSort,
                [
                  { value: 'none', label: t('No secondary sort') },
                  { value: 'id', label: t('Order ID') },
                  { value: 'customer', label: t('Customer') },
                  { value: 'amount', label: t('Amount') },
                  { value: 'due', label: t('Due date') },
                  { value: 'status', label: t('Status') },
                  { value: 'owner', label: t('Owner') },
                ],
                setSecondSort,
              )}
              <AtlasButton text={t('Clear filters')} fill="text" onClick={clearFilters} />
            </div>
          )}
        </Drawer>
      </CollectionWorkbench>
    </AtlasProvider>
  );
}
