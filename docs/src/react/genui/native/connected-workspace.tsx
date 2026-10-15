import { useId, useMemo, useState } from 'react';
import { Select } from 'antd';
import AtlasButton from '../../AtlasButton';
import { useI18n } from '../../useI18n';
import { RecordCollection } from '../../workspace/kit/RecordCollection';
import { RecordDisplay } from '../../workspace/kit/RecordDisplay';
import { RecordForm } from '../../workspace/kit/RecordForm';
import type {
  Capability,
  CollectionView,
  ProjectionState,
  QueryState,
} from '../../workspace/kit/contracts';
import type { JsonValue } from '../../../genui/contracts';
import type { NativeAdapterProps, NativePayload } from '../../../genui/native-contract';
import { nativeFieldDefinitions, type NativeRecord } from '../../../genui/native/record-fields';
import {
  CONNECTED_VIEWS,
  readConnectedWorkspace,
  withConnectedValue,
  type ConnectedWorkspaceValue,
} from '../../../genui/native/connected-workspace';
import '../../../styles/workspace-kit.css';
import '../../../styles/kit-records.css';

const EMPTY_QUERY: QueryState = { search: '', filters: [], sort: [] };

/** Controlled: every selection, draft and local commit is proposed through onChange only. */
export default function NativeConnectedWorkspace({
  data,
  disabled,
  onChange,
  onAction,
  actionAvailable = false,
}: NativeAdapterProps & { actionAvailable?: boolean }) {
  const { t } = useI18n();
  const inspectId = useId();
  const model = useMemo(() => readConnectedWorkspace(data), [data]);
  const readFields = useMemo(() => nativeFieldDefinitions(model.fields), [model.fields]);
  const formFields = useMemo(() => nativeFieldDefinitions(model.fields, true), [model.fields]);
  const [query, setQuery] = useState<QueryState>(EMPTY_QUERY);
  const [projection, setProjection] = useState<ProjectionState>(() =>
    model.fields.map(field => field.key),
  );
  const { value } = model;
  const records = value.records ?? model.records;
  const active = records.find(record => record.id === value.activeId) ?? null;
  const original = value.draft
    ? (records.find(record => record.id === value.draft!.id) ?? null)
    : null;
  const emit = (next: Partial<ConnectedWorkspaceValue>) => {
    if (!disabled) onChange({ ...value, ...next } as unknown as JsonValue);
  };
  const editCapability = (): Capability =>
    disabled
      ? { allowed: false, reason: 'This preview is disabled.' }
      : value.draft
        ? { allowed: false, reason: 'Finish or discard the current form draft first.' }
        : { allowed: true };
  const beginDraft = (id: string) => {
    const record = records.find(candidate => candidate.id === id);
    if (record && editCapability().allowed) emit({ activeId: id, draft: { ...record } });
  };
  const titleField = model.fields.find(field => field.kind === 'text' && field.key !== 'id');
  const optionLabel = (record: NativeRecord) => {
    const title = titleField ? record[titleField.key] : null;
    return typeof title === 'string' && title ? `${title} (${record.id})` : record.id;
  };
  return (
    <section
      className="workspace-kit"
      data-native-connected-workspace=""
      aria-label={t(model.label ?? 'Connected records')}
    >
      <p role="note">
        {t(
          'Local preview only. Committing updates this widget’s JSON value; supplied host records and backend data are not changed.',
        )}
      </p>
      {value.records && <p role="status">{t('Showing locally committed preview values.')}</p>}
      <div className="kit-field">
        <label htmlFor={inspectId}>{t('Inspect record')}</label>
        <Select
          id={inspectId}
          value={value.activeId ?? undefined}
          placeholder={t('Choose a record')}
          options={records.map(record => ({ value: record.id, label: optionLabel(record) }))}
          disabled={disabled}
          onChange={(id: string) => emit({ activeId: id })}
        />
      </div>
      <RecordCollection
        records={records}
        fields={readFields}
        query={query}
        onQueryChange={setQuery}
        activeId={value.activeId}
        onActiveIdChange={activeId => emit({ activeId })}
        checkedIds={value.checkedIds}
        onCheckedIdsChange={checkedIds => emit({ checkedIds: [...checkedIds] })}
        projection={projection}
        onProjectionChange={next => setProjection([...next])}
        view={value.view}
        supportedViews={CONNECTED_VIEWS as readonly CollectionView[]}
        onViewChange={view => {
          if ((CONNECTED_VIEWS as readonly string[]).includes(view))
            emit({ view: view as ConnectedWorkspaceValue['view'] });
        }}
        recordCapabilities={() => ({ edit: editCapability() })}
        onEdit={beginDraft}
        title={model.label ?? 'Records'}
      />
      {value.draft && original ? (
        <RecordForm
          record={original}
          draft={value.draft}
          fields={formFields}
          errors={{}}
          disabled={disabled}
          onDraftChange={draft => emit({ draft })}
          onCommit={draft =>
            emit({
              records: records.map(record => (record.id === draft.id ? draft : record)),
              draft: null,
            })
          }
          onCancel={() => emit({ draft: null })}
          title={t('Local preview draft for {id}', { id: value.draft.id })}
        />
      ) : active ? (
        <RecordDisplay
          record={active}
          fields={readFields}
          recordId={active.id}
          capability={editCapability()}
          onEdit={beginDraft}
          title={t('Local preview record')}
        />
      ) : (
        <p>{t('Choose a record to inspect it.')}</p>
      )}
      {actionAvailable && (
        <AtlasButton text={t('Continue')} disabled={disabled} onClick={onAction} />
      )}
    </section>
  );
}

/** Docs/test host: accepts a proposed value only when the schema validates it, like the runtime. */
export function NativeConnectedWorkspacePreview({
  data,
  onChange,
}: {
  data: NativePayload;
  onChange?: (value: JsonValue) => void;
}) {
  const { t } = useI18n();
  const [current, setCurrent] = useState<NativePayload>(() =>
    withConnectedValue(data, data.value ?? null),
  );
  const [rejected, setRejected] = useState<string | null>(null);
  return (
    <>
      <NativeConnectedWorkspace
        data={current}
        disabled={false}
        onAction={() => {}}
        onChange={value => {
          try {
            setCurrent(withConnectedValue(current, value));
            setRejected(null);
            onChange?.(value);
          } catch (error) {
            setRejected(error instanceof Error ? error.message : 'The change was rejected.');
          }
        }}
      />
      {rejected && <p role="alert">{t(rejected)}</p>}
    </>
  );
}
