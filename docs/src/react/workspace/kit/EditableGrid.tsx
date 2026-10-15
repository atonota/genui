import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Select } from 'antd';
import AtlasButton from '../../AtlasButton';
import AtlasPagination from '../../AtlasPagination';
import { useI18n } from '../../useI18n';
import { fieldAvailability } from '../../../data/field-kit';
import { FieldEditor, FieldValue } from './Fields';
import type { FieldDefinition, FieldScalar, OperationState, RecordIdentity } from './contracts';
import {
  gridCapabilityFor,
  cloneGridRecord,
  collectionPage,
  projectedFields,
  gridRecordsEqual,
  validateGridDrafts,
  prepareGridCommit,
  type GridDrafts,
  type GridCapability,
} from '../../../data/collection-kit';
export { validateGridDrafts, prepareGridCommit } from '../../../data/collection-kit';
export type { GridDrafts, GridErrors, GridCapability } from '../../../data/collection-kit';

export type EditableGridProps<R extends RecordIdentity> = {
  records: readonly R[];
  fields: readonly FieldDefinition<R>[];
  projection?: readonly string[];
  drafts: GridDrafts<R>;
  onDraftsChange: (drafts: GridDrafts<R>) => void;
  onCommit: (records: readonly R[]) => void;
  onCancel: () => void;
  capability?: GridCapability<R>;
  title?: string;
  operation?: OperationState;
  baselines?: GridDrafts<R>;
  pageSize?: number;
};
type EditingCell = { recordId: string; fieldKey: string; before: FieldScalar };
export function EditableGrid<R extends RecordIdentity>(props: EditableGridProps<R>) {
  const { t } = useI18n();
  const prefix = useId();
  const root = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const errorSummary = useRef<HTMLElement>(null);
  const pendingSummaryFocus = useRef(false);
  const [mode, setMode] = useState<'cell' | 'row'>('cell');
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [rowId, setRowId] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [revealed, setRevealed] = useState<readonly string[]>([]);
  const [inputErrors, setInputErrors] = useState<Record<string, Record<string, string>>>({});
  const [pageNumber, setPageNumber] = useState(1);
  const capturedBaselines = useRef<Record<string, R>>({});
  const initializedBaselines = useRef(false);
  if (!initializedBaselines.current) {
    capturedBaselines.current = Object.fromEntries(
      Object.keys(props.drafts).flatMap(id => {
        const record = props.records.find(item => item.id === id);
        return record ? [[id, cloneGridRecord(record)]] : [];
      }),
    );
    initializedBaselines.current = true;
  }
  const rowBefore = useRef<Record<string, FieldScalar>>({});
  const baselines = { ...capturedBaselines.current, ...props.baselines };
  const blockedOperation =
    props.operation?.kind === 'pending' || props.operation?.kind === 'unknown';
  const appliedIds = new Set(props.operation?.appliedIds ?? []);
  const actionableDrafts = Object.fromEntries(
    Object.entries(props.drafts).filter(([id]) => !appliedIds.has(id)),
  );
  const actionableCount = Object.keys(actionableDrafts).length;
  const fields = projectedFields(props.fields, [
    ...(props.projection ?? props.fields.map(field => field.key)),
    ...revealed,
  ]);
  const errors = {
    ...validateGridDrafts(
      props.records,
      actionableDrafts,
      props.fields,
      props.capability,
      baselines,
    ),
  };
  for (const [id, values] of Object.entries(inputErrors))
    if (!appliedIds.has(id) && Object.keys(values).length)
      errors[id] = { ...errors[id], ...values };
  const page = collectionPage(props.records, pageNumber, props.pageSize);
  const hasInputErrors = Object.entries(inputErrors).some(
    ([id, values]) => !appliedIds.has(id) && Object.keys(values).length,
  );
  useEffect(() => {
    for (const id of Object.keys(capturedBaselines.current))
      if (!Object.hasOwn(props.drafts, id)) delete capturedBaselines.current[id];
    for (const id of Object.keys(props.drafts))
      if (!capturedBaselines.current[id]) {
        const record = props.records.find(item => item.id === id);
        if (record) capturedBaselines.current[id] = cloneGridRecord(record);
      }
  }, [props.drafts, props.records]);
  const clearInputError = (id: string, key?: string) =>
    setInputErrors(previous => {
      const next = { ...previous };
      if (key) {
        const row = { ...next[id] };
        delete row[key];
        next[id] = row;
      } else delete next[id];
      return next;
    });
  const draftCount = Object.keys(props.drafts).length;
  const focusErrorSummary = () => {
    if (errorSummary.current) errorSummary.current.focus();
    else pendingSummaryFocus.current = true;
  };
  useLayoutEffect(() => {
    if (!pendingSummaryFocus.current) return;
    pendingSummaryFocus.current = false;
    errorSummary.current?.focus();
  });
  useEffect(() => {
    if (editing) {
      document.getElementById(prefix + '-' + editing.recordId + '-' + editing.fieldKey)?.focus();
    } else if (pendingFocus.current) {
      [...(root.current?.querySelectorAll<HTMLButtonElement>('[data-edit-trigger]') ?? [])]
        .find(button => button.dataset.editTrigger === pendingFocus.current)
        ?.focus();
      pendingFocus.current = null;
    }
  }, [editing?.recordId, editing?.fieldKey, prefix, page.page, revealed]);
  const canEdit = (record: R, current: R, field: FieldDefinition<R>) =>
    Boolean(
      !blockedOperation &&
        !appliedIds.has(record.id) &&
        field.setValue &&
        gridCapabilityFor(record, props.capability).allowed &&
        fieldAvailability(record, field).state === 'available' &&
        fieldAvailability(current, field).state === 'available' &&
        field.editable?.(record).allowed !== false &&
        field.editable?.(current).allowed !== false,
    );
  const begin = (record: R, field: FieldDefinition<R>) => {
    const current = props.drafts[record.id] ?? record;
    if (hasInputErrors || !canEdit(record, current, field)) return;
    if (!capturedBaselines.current[record.id])
      capturedBaselines.current[record.id] = cloneGridRecord(record);
    rowBefore.current = Object.fromEntries(
      props.fields
        .filter(item => canEdit(record, current, item))
        .map(item => [item.key, item.getValue(current)]),
    );
    setEditing({ recordId: record.id, fieldKey: field.key, before: field.getValue(current) });
    setRowId(mode === 'row' ? record.id : null);
  };
  const change = (record: R, field: FieldDefinition<R>, value: FieldScalar) => {
    const current = props.drafts[record.id] ?? record;
    if (!field.setValue || !canEdit(record, current, field)) return;
    if (!capturedBaselines.current[record.id])
      capturedBaselines.current[record.id] = cloneGridRecord(record);
    const draft = field.setValue(current, value);
    props.onDraftsChange({ ...props.drafts, [record.id]: draft });
    setTouched(previous => new Set([...previous, record.id + '::' + field.key]));
  };
  const close = () => {
    if (editing) pendingFocus.current = editing.recordId + '::' + editing.fieldKey;
    setEditing(null);
    setRowId(null);
  };
  const cancelCell = (record: R, field: FieldDefinition<R>) => {
    if (
      !editing ||
      !field.setValue ||
      editing.recordId !== record.id ||
      (mode !== 'row' && editing.fieldKey !== field.key)
    )
      return;
    const current = props.drafts[record.id] ?? record;
    const restored =
      mode === 'row'
        ? props.fields.reduce(
            (draft, item) =>
              item.setValue &&
              canEdit(record, current, item) &&
              Object.hasOwn(rowBefore.current, item.key)
                ? item.setValue(draft, rowBefore.current[item.key])
                : draft,
            current,
          )
        : field.setValue(current, editing.before);
    clearInputError(record.id, mode === 'row' ? undefined : field.key);
    const drafts = { ...props.drafts };
    if (gridRecordsEqual(restored, record)) delete drafts[record.id];
    else drafts[record.id] = restored;
    props.onDraftsChange(drafts);
    close();
  };
  const finish = (record: R, field: FieldDefinition<R>) => {
    const draft = props.drafts[record.id] ?? record;
    const fieldErrors = {
      ...(validateGridDrafts(
        props.records,
        { [record.id]: draft },
        props.fields,
        props.capability,
        baselines,
      )[record.id] ?? {}),
      ...inputErrors[record.id],
    };
    setTouched(previous => new Set([...previous, record.id + '::' + field.key]));
    if (
      mode === 'row'
        ? Object.keys(fieldErrors).length === 0
        : !fieldErrors[field.key] && !fieldErrors.id && !fieldErrors.$record
    )
      close();
  };
  return (
    <section
      className="kit-editable-grid"
      aria-busy={props.operation?.kind === 'pending'}
      aria-label={t(props.title ?? 'Editable record grid')}
    >
      <h4>{t(props.title ?? 'Editable record grid')}</h4>
      <p>
        {t(
          'Cell and row editors share multiple local drafts. Enter commits the current cell to its draft; Escape cancels that cell. Tab keeps native focus navigation. Commit all drafts submits validated rows through the supplied callback.',
        )}
      </p>
      <label>
        {t('Editing mode')}
        <Select
          value={mode}
          disabled={blockedOperation || hasInputErrors}
          options={[
            { value: 'cell', label: t('Cell editing') },
            { value: 'row', label: t('Row editing') },
          ]}
          onChange={value => {
            setMode(value);
            close();
          }}
        />
      </label>
      <p role="status">{t('{count} row drafts retained', { count: draftCount })}</p>
      {blockedOperation && (
        <p role="status">
          {t(
            props.operation?.kind === 'unknown'
              ? 'The previous result is unknown. Reconcile it before editing, cancelling or submitting again.'
              : 'The submitted operation is pending. Draft editing and repeat submission are locked.',
          )}
        </p>
      )}
      {hasInputErrors && (
        <p role="status">
          {t('Correct or cancel the invalid cell before changing rows, pages or editing mode.')}
        </p>
      )}
      {props.operation?.message && <p role="status">{t(props.operation.message)}</p>}
      {attempted && Object.keys(errors).length > 0 && (
        <section
          ref={errorSummary}
          className="kit-grid-error-summary"
          role="alert"
          tabIndex={-1}
          aria-label={t('Grid errors')}
        >
          <h5>{t('Review row errors before committing.')}</h5>
          {Object.entries(errors).map(([id, values]) => (
            <div key={id}>
              <strong>{id}</strong>
              <ul>
                {Object.entries(values).map(([key, message]) => (
                  <li key={key}>
                    {props.fields.find(field => field.key === key)?.label
                      ? t(props.fields.find(field => field.key === key)!.label) + ': '
                      : ''}
                    {t(message)}
                    {props.fields.some(field => field.key === key) && (
                      <AtlasButton
                        fill="text"
                        text={t('Show {field} for {id}', {
                          field: t(props.fields.find(field => field.key === key)!.label),
                          id,
                        })}
                        onClick={() => {
                          pendingFocus.current = id + '::' + key;
                          setRevealed(previous => [...new Set([...previous, key])]);
                          const index = props.records.findIndex(record => record.id === id);
                          if (index >= 0) setPageNumber(Math.floor(index / page.size) + 1);
                        }}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
      <div
        ref={root}
        className="kit-table-scroll atlas-control"
        role="region"
        tabIndex={0}
        aria-label={t('Editable table with horizontal scrolling')}
      >
        <table className="kit-table">
          <caption>{t('{count} records on this page', { count: page.records.length })}</caption>
          <thead>
            <tr>
              <th scope="col">{t('Record ID')}</th>
              {fields.map(field => (
                <th key={field.key} scope="col">
                  {t(field.label)}
                </th>
              ))}
              <th scope="col">{t('Draft actions')}</th>
            </tr>
          </thead>
          <tbody>
            {page.records.map(record => {
              const row = props.drafts[record.id] ?? record;
              const rowCapability = gridCapabilityFor(record, props.capability);
              return (
                <tr
                  key={record.id}
                  data-grid-row={record.id}
                  data-operation-result={
                    props.operation?.failedIds?.includes(record.id)
                      ? 'failed'
                      : props.operation?.appliedIds?.includes(record.id)
                        ? 'applied'
                        : undefined
                  }
                >
                  <th scope="row">
                    {record.id}
                    {props.drafts[record.id] && <p>{t('Unsaved draft')}</p>}
                    {errors[record.id]?.id && <p role="status">{t(errors[record.id].id)}</p>}
                    {errors[record.id]?.$record && (
                      <p role="status">{t(errors[record.id].$record)}</p>
                    )}
                    {attempted &&
                      Object.entries(errors[record.id] ?? {})
                        .filter(
                          ([key]) =>
                            key !== 'id' &&
                            key !== '$record' &&
                            !fields.some(field => field.key === key),
                        )
                        .map(([key, message]) => (
                          <p key={key} role="status">
                            {t(props.fields.find(field => field.key === key)?.label ?? key)}:{' '}
                            {t(message)}
                          </p>
                        ))}
                    {props.operation?.failedIds?.includes(record.id) && (
                      <p role="status">
                        {t('This record failed. Review the supplied result before retrying.')}
                      </p>
                    )}
                    {props.operation?.appliedIds?.includes(record.id) && (
                      <p role="status">{t('Applied successfully.')}</p>
                    )}
                    {!rowCapability.allowed && (
                      <p>{t(rowCapability.reason ?? 'This record is read-only.')}</p>
                    )}
                  </th>
                  {fields.map(field => {
                    const originalAvailability = fieldAvailability(record, field);
                    const currentAvailability = fieldAvailability(row, field);
                    const availability =
                      originalAvailability.state !== 'available'
                        ? originalAvailability
                        : currentAvailability;
                    const editability = field.editable?.(record);
                    const blocked =
                      blockedOperation ||
                      appliedIds.has(record.id) ||
                      !rowCapability.allowed ||
                      !field.setValue ||
                      availability.state !== 'available' ||
                      editability?.allowed === false ||
                      field.editable?.(row).allowed === false;
                    const active =
                      mode === 'row'
                        ? rowId === record.id
                        : editing?.recordId === record.id && editing.fieldKey === field.key;
                    const error =
                      attempted || touched.has(record.id + '::' + field.key)
                        ? errors[record.id]?.[field.key]
                        : undefined;
                    const reason = !rowCapability.allowed
                      ? rowCapability.reason
                      : availability && availability.state !== 'available'
                        ? availability.reason
                        : editability?.allowed === false
                          ? editability.reason
                          : !field.setValue
                            ? 'This value is read-only.'
                            : undefined;
                    return (
                      <td
                        key={field.key}
                        data-kind={field.kind}
                        data-editing-cell={active}
                        onKeyDown={event => {
                          if (!active || blocked) return;
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelCell(record, field);
                          } else if (
                            event.key === 'Enter' &&
                            (field.kind !== 'multiline' || event.ctrlKey || event.metaKey)
                          ) {
                            event.preventDefault();
                            finish(record, field);
                          }
                        }}
                      >
                        {active ? (
                          <FieldEditor
                            id={prefix + '-' + record.id + '-' + field.key}
                            record={row}
                            field={field}
                            error={error}
                            disabled={blocked}
                            onChange={value => change(record, field, value)}
                            onDraftError={message =>
                              setInputErrors(previous => {
                                if ((previous[record.id]?.[field.key] ?? null) === message)
                                  return previous;
                                const row = { ...previous[record.id] };
                                if (message) row[field.key] = message;
                                else delete row[field.key];
                                return { ...previous, [record.id]: row };
                              })
                            }
                          />
                        ) : (
                          <>
                            <FieldValue
                              record={originalAvailability.state === 'available' ? row : record}
                              field={field}
                            />
                            {!blocked ? (
                              <AtlasButton
                                data-edit-trigger={record.id + '::' + field.key}
                                disabled={hasInputErrors}
                                fill="text"
                                text={t('Edit {field} for {id}', {
                                  field: t(field.label),
                                  id: record.id,
                                })}
                                onClick={() => begin(record, field)}
                              />
                            ) : (
                              reason && <p className="kit-field-reason">{t(reason)}</p>
                            )}
                            {error && (
                              <p className="kit-field-error" aria-live="polite">
                                {t(error)}
                              </p>
                            )}
                          </>
                        )}
                      </td>
                    );
                  })}
                  <td>
                    {(props.drafts[record.id] ||
                      Object.keys(inputErrors[record.id] ?? {}).length > 0) && (
                      <AtlasButton
                        fill="text"
                        text={t('Cancel draft for {id}', { id: record.id })}
                        disabled={blockedOperation}
                        onClick={() => {
                          if (blockedOperation) return;
                          clearInputError(record.id);
                          const next = { ...props.drafts };
                          delete next[record.id];
                          props.onDraftsChange(next);
                          if (editing?.recordId === record.id || rowId === record.id) close();
                        }}
                      />
                    )}
                    {rowId === record.id && (
                      <AtlasButton
                        fill="text"
                        text={t('Finish row editing')}
                        disabled={blockedOperation}
                        onClick={() => {
                          setAttempted(true);
                          if (!Object.keys(errors[record.id] ?? {}).length) close();
                        }}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        {t(
          'Baseline checks protect drafts begun in this mounted grid. Supply baselines for drafts created elsewhere; no server versioning is implied.',
        )}
      </p>
      <AtlasPagination
        current={page.page}
        total={props.records.length}
        pageSize={page.size}
        onChange={nextPage => {
          close();
          setPageNumber(nextPage);
        }}
        showSizeChanger={false}
        showQuickJumper
        disabled={hasInputErrors || blockedOperation}
        label={t('Editable grid pages')}
      />
      <div className="kit-actions">
        <AtlasButton
          text={t('Commit all drafts')}
          disabled={!actionableCount || blockedOperation}
          onClick={() => {
            if (blockedOperation) return;
            setAttempted(true);
            if (hasInputErrors) {
              focusErrorSummary();
              return;
            }
            const prepared = prepareGridCommit(
              props.records,
              actionableDrafts,
              props.fields,
              props.capability,
              baselines,
            );
            if (Object.keys(prepared.errors).length) {
              focusErrorSummary();
              return;
            }
            props.onCommit(prepared.records);
            close();
          }}
        />
        <AtlasButton
          fill="text"
          text={t('Cancel all drafts')}
          disabled={(!draftCount && !hasInputErrors) || blockedOperation}
          onClick={() => {
            if (blockedOperation) return;
            setInputErrors({});
            props.onDraftsChange({});
            props.onCancel();
            setAttempted(false);
            close();
          }}
        />
      </div>
      <p>
        {t(
          'Column resize, pinning, range selection, paste and fill are outside this grid contract.',
        )}
      </p>
    </section>
  );
}
export default EditableGrid;
