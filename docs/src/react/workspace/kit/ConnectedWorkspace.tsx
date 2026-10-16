import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { Select } from 'antd';
import {
  ORDER_SCHEMA,
  EQUIPMENT_SCHEMA,
  initialKitState,
  beginKitDraft,
  commitKitDraft,
  discardKitDraft,
  fieldAvailability,
  formatFieldValue,
  type KitDatasetState,
  type RecordSchema,
} from '../../../data/workspace-kit';
import AtlasButton from '../../AtlasButton';
import AtlasSplitter from '../../AtlasSplitter';
import AtlasProvider from '../../AtlasProvider';
import ExamplePreview from '../../ExamplePreview';
import { useI18n } from '../../useI18n';
import { TweakerSettings } from '../../AtlasTweaker';
import WorkspaceFrame, { type WorkspaceProfile } from '../WorkspaceFrame';
import { RecordCollection } from './RecordCollection';
import { RecordForm } from './RecordForm';
import { RecordDisplay } from './RecordDisplay';
import { RecordTabs } from './RecordPanel';
import { BulkActionBar } from './ActionReview';
import { AdvancedRecordExamples } from './EvidencePanels';
import { EditableGrid, type GridDrafts } from './EditableGrid';
import type { GroupDefinition, GroupState, RecordIdentity } from './contracts';

type InspectionState = { openIds: string[]; pinnedIds: string[]; pinned: boolean };
const initialInspection = (ids: readonly string[]): InspectionState => ({
  openIds: [...ids].slice(0, 3),
  pinnedIds: [],
  pinned: false,
});

function SchemaWorkspace<R extends RecordIdentity>({
  schema,
  state,
  setState,
  gridDrafts,
  setGridDrafts,
  group,
  onGroupChange,
  inspection,
  setInspection,
}: {
  schema: RecordSchema<R>;
  state: KitDatasetState<R>;
  setState: Dispatch<SetStateAction<KitDatasetState<R>>>;
  gridDrafts: GridDrafts<R>;
  setGridDrafts: Dispatch<SetStateAction<GridDrafts<R>>>;
  group: GroupState;
  onGroupChange: (group: GroupState) => void;
  inspection: InspectionState;
  setInspection: Dispatch<SetStateAction<InspectionState>>;
}) {
  const { t, locale } = useI18n();
  const detailRoot = useRef<HTMLDivElement>(null);
  const activate = (id: string | null) => {
    if (id && !inspection.openIds.includes(id)) {
      const removable = inspection.openIds.find(
        value => !inspection.pinnedIds.includes(value) && value !== state.draft?.id,
      );
      if (inspection.openIds.length >= 6 && !removable) {
        setState(previous => ({
          ...previous,
          message: 'Unpin or close a record before opening another tab.',
        }));
        return;
      }
      setInspection(previous => ({
        ...previous,
        openIds: [
          ...previous.openIds.filter(value => value !== removable || previous.openIds.length < 6),
          id,
        ],
      }));
    }
    setState(previous => ({ ...previous, activeId: id }));
  };
  const tabIds = [...new Set([...inspection.openIds, ...(state.draft ? [state.draft.id] : [])])];
  const tabs = tabIds.flatMap(id => {
    const record =
      state.records.find(value => value.id === id) ?? (state.draft?.id === id ? state.draft : null);
    if (!record) return [];
    const titleField = schema.fields.find(field => field.key === 'title');
    return [
      {
        id,
        label: titleField ? formatFieldValue(record, titleField, locale) : id,
        pinned: inspection.pinnedIds.includes(id) || state.draft?.id === id,
      },
    ];
  });
  const wasEditing = useRef(Boolean(state.draft));
  useLayoutEffect(() => {
    const editing = Boolean(state.draft);
    if (editing !== wasEditing.current) {
      const target = editing
        ? detailRoot.current?.querySelector<HTMLElement>(
            'input:not(:disabled):not([type="hidden"]),textarea:not(:disabled),button:not(:disabled)',
          )
        : detailRoot.current?.querySelector<HTMLElement>('button:not(:disabled)');
      target?.focus();
    }
    wasEditing.current = editing;
  }, [Boolean(state.draft)]);
  const active = state.records.find(record => record.id === state.activeId) ?? null;
  const canEdit = active !== null && (!('readOnly' in active) || active.readOnly !== true);
  const hasGridDrafts = Object.keys(gridDrafts).length > 0;
  const groups = useMemo<readonly GroupDefinition<R>[]>(() => {
    const status = schema.fields.find(field => field.key === 'status');
    const amount = schema.fields.find(field => field.kind === 'money');
    return [
      {
        id: 'needs-attention',
        label: 'Needs attention',
        kind: 'overlapping',
        matches: record =>
          Boolean(
            status &&
              fieldAvailability(record, status).state === 'available' &&
              ['draft', 'pending', 'maintenance'].includes(String(status.getValue(record))),
          ),
      },
      {
        id: 'zero-or-missing',
        label: 'Zero or missing amount',
        kind: 'overlapping',
        matches: record =>
          Boolean(
            amount &&
              (!amount.availability || amount.availability(record).state === 'available') &&
              (amount.getValue(record) === 0 || amount.getValue(record) === null),
          ),
      },
    ];
  }, [schema]);
  // Fictional fixture: only the order customer pairs an initials avatar; no photo source is invented.
  const collectionFields = useMemo(
    () =>
      schema.fields.map(field =>
        schema.id === 'orders' && field.key === 'customer'
          ? {
              ...field,
              identity: (record: R) => ({ name: formatFieldValue(record, field, locale) }),
            }
          : field,
      ),
    [schema, locale],
  );
  const editCapability = (record: R) => {
    if ('readOnly' in record && record.readOnly === true)
      return { allowed: false, reason: 'This supplied record is read-only.' };
    if (
      !inspection.openIds.includes(record.id) &&
      inspection.openIds.length >= 6 &&
      inspection.openIds.every(id => inspection.pinnedIds.includes(id))
    )
      return { allowed: false, reason: 'Unpin or close a record before opening another tab.' };
    if (state.draft)
      return { allowed: false, reason: 'Finish or discard the current form draft first.' };
    if (hasGridDrafts)
      return {
        allowed: false,
        reason: 'Commit or cancel grid drafts before opening a record form.',
      };
    return { allowed: true };
  };
  return (
    <div className="workspace-kit" data-connected-schema={schema.id}>
      <div className="kit-connected-actions">
        <AtlasButton
          id={`kit-${schema.id}-create`}
          text={t('Create record')}
          disabled={
            Boolean(state.draft) ||
            hasGridDrafts ||
            (inspection.openIds.length >= 6 &&
              inspection.openIds.every(id => inspection.pinnedIds.includes(id)))
          }
          onClick={() => {
            const next = beginKitDraft(state, schema);
            setState(next);
            if (next.draft) activate(next.draft.id);
          }}
        />
      </div>
      <p className="kit-commit-status" role="status">
        {t(state.message)}
      </p>
      {hasGridDrafts && <p>{t('Commit or cancel grid drafts before opening a record form.')}</p>}
      <p>
        {t('Active: {active}; checked: {checked}; prepared: {prepared}.', {
          active: state.activeId ?? t('None'),
          checked: state.checkedIds.length,
          prepared: state.preparedIds.length,
        })}
      </p>
      {state.preparedIds.length > 0 && (
        <p>
          {t('Prepared record IDs')}: {state.preparedIds.join(', ')}
        </p>
      )}
      <AtlasSplitter
        id={`connected-${schema.id}-splitter`}
        className="kit-connected-splitter"
        label={t('Collection and record inspector')}
        orientation="auto"
        initialSizes={[60, 40]}
        panels={[
          {
            id: 'collection',
            label: t(schema.label),
            children: (
              <RecordCollection
                records={state.records}
                fields={collectionFields}
                columns={[
                  {
                    key: 'identity',
                    label: 'Identity',
                    fieldKeys: schema.id === 'orders' ? ['title', 'customer'] : ['title', 'serial'],
                  },
                ]}
                query={state.query}
                onQueryChange={query => setState(previous => ({ ...previous, query }))}
                activeId={state.activeId}
                onActiveIdChange={activate}
                checkedIds={state.checkedIds}
                onCheckedIdsChange={checkedIds =>
                  setState(previous => ({ ...previous, checkedIds: [...checkedIds] }))
                }
                projection={state.projection}
                onProjectionChange={projection =>
                  setState(previous => ({ ...previous, projection: [...projection] }))
                }
                view={state.view}
                onViewChange={view => setState(previous => ({ ...previous, view }))}
                group={group}
                groups={groups}
                onGroupChange={onGroupChange}
                recordCapabilities={record => ({ edit: editCapability(record) })}
                onEdit={id => {
                  if (
                    !hasGridDrafts &&
                    editCapability(state.records.find(record => record.id === id)!).allowed
                  ) {
                    const next = beginKitDraft(state, schema, id);
                    setState(next);
                    if (next.draft) activate(id);
                  }
                }}
                bulkActions={
                  <BulkActionBar
                    checkedIds={state.checkedIds}
                    preparedIds={state.preparedIds}
                    activeId={state.activeId}
                    onPrepare={ids =>
                      setState(previous => ({
                        ...previous,
                        preparedIds: [...ids],
                        message:
                          'Prepared targets are a snapshot; changing checked records does not change it.',
                      }))
                    }
                    onClear={() => setState(previous => ({ ...previous, preparedIds: [] }))}
                  />
                }
                title={schema.label}
                dateFieldKey={schema.id === 'orders' ? 'due' : 'inspected'}
                startFieldKey={schema.id === 'orders' ? 'start' : 'calibrationStart'}
                endFieldKey={schema.id === 'orders' ? 'due' : 'calibrationEnd'}
              />
            ),
          },
          {
            id: 'inspector',
            label: t('Record inspector'),
            children: (
              <div ref={detailRoot} className="kit-connected-detail">
                <RecordTabs
                  tabs={tabs}
                  activeId={state.activeId}
                  onActiveIdChange={activate}
                  panelId={`kit-${schema.id}-inspection`}
                  onPinnedChange={(id, pinned) =>
                    setInspection(previous => ({
                      ...previous,
                      pinnedIds: pinned
                        ? [...new Set([...previous.pinnedIds, id])]
                        : previous.pinnedIds.filter(value => value !== id),
                    }))
                  }
                  onCloseTab={id => {
                    const remaining = inspection.openIds.filter(value => value !== id);
                    setInspection(previous => ({
                      ...previous,
                      openIds: remaining,
                      pinnedIds: previous.pinnedIds.filter(value => value !== id),
                    }));
                    if (state.activeId === id)
                      setState(previous => ({ ...previous, activeId: remaining.at(-1) ?? null }));
                  }}
                />
                <aside
                  className="kit-connected-inspector"
                  data-pinned={inspection.pinned}
                  aria-label={t('Record inspector')}
                >
                  <div className="kit-inspector-tools">
                    <AtlasButton
                      fill="text"
                      text={t(inspection.pinned ? 'Unpin inspector' : 'Pin inspector')}
                      aria-pressed={inspection.pinned}
                      onClick={() =>
                        setInspection(previous => ({ ...previous, pinned: !previous.pinned }))
                      }
                    />
                  </div>
                  <div
                    id={`kit-${schema.id}-inspection`}
                    role="tabpanel"
                    aria-label={t('Committed record')}
                  >
                    {state.draft && state.original ? (
                      <RecordForm
                        record={state.original}
                        draft={state.draft}
                        fields={schema.fields}
                        errors={state.errors}
                        onDraftChange={draft =>
                          setState(previous => ({ ...previous, draft, errors: {} }))
                        }
                        onCommit={draft =>
                          setState(previous =>
                            commitKitDraft({ ...previous, draft }, schema.fields),
                          )
                        }
                        onCancel={() => setState(previous => discardKitDraft(previous))}
                        title={t('Draft for {id}', { id: state.draft.id })}
                      />
                    ) : (
                      <RecordDisplay
                        record={active}
                        fields={schema.fields}
                        recordId={state.activeId}
                        capability={
                          active
                            ? editCapability(active)
                            : { allowed: canEdit, reason: 'Record not found.' }
                        }
                        onEdit={id => {
                          if (
                            !hasGridDrafts &&
                            editCapability(state.records.find(record => record.id === id)!).allowed
                          ) {
                            const next = beginKitDraft(state, schema, id);
                            setState(next);
                            if (next.draft) activate(id);
                          }
                        }}
                        title={t('Committed record')}
                      />
                    )}
                    {state.draft && active && active.id !== state.draft.id && (
                      <RecordDisplay
                        record={active}
                        fields={schema.fields}
                        recordId={active.id}
                        title={t('Committed record')}
                      />
                    )}
                  </div>
                </aside>
              </div>
            ),
          },
        ]}
      />
      <EditableGrid
        records={state.records}
        fields={schema.fields}
        projection={schema.fields
          .filter(field => field.key === 'title' || ['money', 'unit', 'date'].includes(field.kind))
          .map(field => field.key)}
        drafts={gridDrafts}
        onDraftsChange={setGridDrafts}
        capability={record =>
          state.draft
            ? { allowed: false, reason: 'Finish or discard the current form draft first.' }
            : 'readOnly' in record && record.readOnly === true
              ? { allowed: false, reason: 'This supplied record is read-only.' }
              : { allowed: true }
        }
        onCommit={rows => {
          setState(previous =>
            previous.draft
              ? { ...previous, message: 'Finish or discard the current form draft first.' }
              : {
                  ...previous,
                  records: previous.records.map(
                    record => rows.find(row => row.id === record.id) ?? record,
                  ),
                  message:
                    'Grid drafts committed locally. Collection and display values are updated.',
                },
          );
          if (!state.draft) setGridDrafts({});
        }}
        onCancel={() =>
          setState(previous => ({
            ...previous,
            message: 'Grid drafts cancelled. Committed values are unchanged.',
          }))
        }
      />
    </div>
  );
}

/** One dataset owner per schema; presentation changes never replace committed values or drafts. */
export function ConnectedWorkspaceExamples() {
  const { t } = useI18n();
  const [schemaId, setSchemaId] = useState<'orders' | 'equipment'>('orders');
  const [profile, setProfile] = useState<WorkspaceProfile>('mobile');
  const [orders, setOrders] = useState(() => initialKitState(ORDER_SCHEMA));
  const [equipment, setEquipment] = useState(() => initialKitState(EQUIPMENT_SCHEMA));
  const [ordersInspection, setOrdersInspection] = useState(() =>
    initialInspection(ORDER_SCHEMA.initialRecords().map(record => record.id)),
  );
  const [equipmentInspection, setEquipmentInspection] = useState(() =>
    initialInspection(EQUIPMENT_SCHEMA.initialRecords().map(record => record.id)),
  );
  const [ordersGridDrafts, setOrdersGridDrafts] = useState<
    GridDrafts<ReturnType<typeof ORDER_SCHEMA.createRecord>>
  >({});
  const [equipmentGridDrafts, setEquipmentGridDrafts] = useState<
    GridDrafts<ReturnType<typeof EQUIPMENT_SCHEMA.createRecord>>
  >({});
  const [ordersGroup, setOrdersGroup] = useState<GroupState>({
    fieldKey: null,
    activeGroupId: null,
  });
  const [equipmentGroup, setEquipmentGroup] = useState<GroupState>({
    fieldKey: null,
    activeGroupId: null,
  });
  return (
    <WorkspaceFrame
      kind="connected-kit"
      title="Connected Collection, Form and Record display"
      profile={profile}
      onProfileChange={setProfile}
    >
      <div className="workspace-kit">
        <TweakerSettings title="Record schema">
          <div className="kit-connected-controls">
            <div className="kit-field">
              <label htmlFor="kit-record-schema">{t('Record schema')}</label>
              <Select
                id="kit-record-schema"
                value={schemaId}
                options={[
                  { value: 'orders', label: t('Orders') },
                  { value: 'equipment', label: t('Equipment') },
                ]}
                onChange={setSchemaId}
              />
            </div>
          </div>
        </TweakerSettings>
        <p>
          {t(
            'Create or edit a draft, commit explicitly, then open the same record in the collection and display. Schema and layout changes retain each schema’s dataset and draft.',
          )}
        </p>
        {schemaId === 'orders' ? (
          <SchemaWorkspace
            key="orders"
            schema={ORDER_SCHEMA}
            state={orders}
            setState={setOrders}
            gridDrafts={ordersGridDrafts}
            setGridDrafts={setOrdersGridDrafts}
            group={ordersGroup}
            onGroupChange={setOrdersGroup}
            inspection={ordersInspection}
            setInspection={setOrdersInspection}
          />
        ) : (
          <SchemaWorkspace
            key="equipment"
            schema={EQUIPMENT_SCHEMA}
            state={equipment}
            setState={setEquipment}
            gridDrafts={equipmentGridDrafts}
            setGridDrafts={setEquipmentGridDrafts}
            group={equipmentGroup}
            onGroupChange={setEquipmentGroup}
            inspection={equipmentInspection}
            setInspection={setEquipmentInspection}
          />
        )}
        <AdvancedRecordExamples />
      </div>
    </WorkspaceFrame>
  );
}

export default function ConnectedWorkspace({
  documentation = false,
}: { documentation?: boolean } = {}) {
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined}>
      <ExamplePreview
        id="record-workspace-connected"
        title="Connected Collection, Form and Record display"
      >
        <ConnectedWorkspaceExamples />
      </ExamplePreview>
    </AtlasProvider>
  );
}
