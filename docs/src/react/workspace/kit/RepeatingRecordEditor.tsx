import { useContext, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import GenUXButton from '../../GenUXButton';
import { useI18n } from '../../useI18n';
import { FieldEditor } from './Fields';
import { StateSurface } from './StateSurface';
import { fieldAvailability, recordsEqual, setDraftFieldValue } from '../../../data/field-kit';
import { DraftErrorsContext, type RegisteredDraftErrors } from './DraftErrors';
import type {
  FieldDefinition,
  FieldErrors,
  OperationState,
  RecordIdentity,
  SurfaceState,
} from './contracts';
import { isReadableSurface } from './contracts';

export function validateNonNegativeNumber(value: unknown): string | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? null
    : 'Enter a finite number of zero or more.';
}
export function validateLineProduct(quantity: unknown, unitPrice: unknown): string | null {
  return (
    validateNonNegativeNumber(quantity) ??
    validateNonNegativeNumber(unitPrice) ??
    (Number.isFinite((quantity as number) * (unitPrice as number)) &&
    Math.abs((quantity as number) * (unitPrice as number)) <= Number.MAX_SAFE_INTEGER
      ? null
      : 'The line total exceeds the supported numeric range.')
  );
}
export type RepeatingRecordEditorProps<R extends RecordIdentity> = Readonly<{
  rows: readonly R[];
  fields: readonly FieldDefinition<R>[];
  errorsById?: Readonly<Record<string, FieldErrors>>;
  statesById?: Readonly<Record<string, SurfaceState>>;
  operationsById?: Readonly<Record<string, OperationState>>;
  onRowsChange: (rows: readonly R[]) => void;
  createRow?: () => R;
  readOnly?: boolean;
  title?: string;
  minRows?: number;
  maxRows?: number;
  resetKey?: unknown;
  onDraftErrorsChange?: (errors: Readonly<Record<string, FieldErrors>>) => void;
}>;

export function RepeatingRecordEditor<R extends RecordIdentity>({
  rows,
  fields,
  errorsById = {},
  statesById = {},
  operationsById = {},
  onRowsChange,
  createRow,
  readOnly = false,
  title = 'Repeating records',
  minRows = 0,
  maxRows = Number.POSITIVE_INFINITY,
  resetKey,
  onDraftErrorsChange,
}: RepeatingRecordEditorProps<R>) {
  const { t } = useI18n();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const removed = useRef<number | null>(null);
  const added = useRef<string | null>(null);
  const [notice, setNotice] = useState('');
  const registry = useContext(DraftErrorsContext);
  const effectiveReset = useMemo(
    () => ({ resetKey, form: registry?.resetKey }),
    [resetKey, registry?.resetKey],
  );
  const previousReset = useRef(effectiveReset);
  const [draftErrorsById, setDraftErrorsById] = useState<Readonly<Record<string, FieldErrors>>>({});
  const draftErrors = useRef<Readonly<Record<string, FieldErrors>>>({});
  const valuesAtError = useRef<Record<string, unknown>>({});
  const callbacks = useRef({ report: registry?.report, onDraftErrorsChange });
  useLayoutEffect(() => {
    callbacks.current = { report: registry?.report, onDraftErrorsChange };
  });
  const registered = (errors: Readonly<Record<string, FieldErrors>>): RegisteredDraftErrors => {
    const entries: Record<string, RegisteredDraftErrors[string]> = {};
    for (const [childId, messages] of Object.entries(errors))
      for (const [key, message] of Object.entries(messages)) {
        const index = fields.findIndex(field => field.key === key);
        if (index >= 0 && message)
          entries[JSON.stringify([childId, key])] = {
            message,
            childId,
            label: fields[index]!.label,
            controlId: `${id}-${childId}-${index}`,
          };
      }
    return entries;
  };
  const publishErrors = (next: Readonly<Record<string, FieldErrors>>) => {
    if (recordsEqual(draftErrors.current, next)) return false;
    draftErrors.current = next;
    setDraftErrorsById(next);
    callbacks.current.report?.(id, registered(next));
    callbacks.current.onDraftErrorsChange?.(next);
    return true;
  };
  const reportFieldError = (row: R, field: FieldDefinition<R>, message: string | null) => {
    const key = JSON.stringify([row.id, field.key]);
    const child = { ...draftErrors.current[row.id] };
    if (message) {
      child[field.key] = message;
      if (!Object.hasOwn(valuesAtError.current, key))
        valuesAtError.current[key] =
          fieldAvailability(row, field).state === 'available' ? field.getValue(row) : undefined;
    } else {
      delete child[field.key];
      delete valuesAtError.current[key];
    }
    const next = { ...draftErrors.current };
    if (Object.keys(child).length) next[row.id] = child;
    else delete next[row.id];
    publishErrors(next);
  };
  useLayoutEffect(() => {
    if (previousReset.current !== effectiveReset) {
      previousReset.current = effectiveReset;
      valuesAtError.current = {};
      publishErrors({});
      return;
    }
    const retained: Record<string, FieldErrors> = {};
    for (const [childId, errors] of Object.entries(draftErrors.current)) {
      const row = rows.find(row => row.id === childId);
      const messages: Record<string, string> = {};
      for (const [key, message] of Object.entries(errors)) {
        const field = fields.find(field => field.key === key);
        const identity = JSON.stringify([childId, key]);
        if (
          row &&
          field &&
          isReadableSurface(statesById[childId] ?? { kind: 'ready' }) &&
          fieldAvailability(row, field).state === 'available' &&
          recordsEqual(field.getValue(row), valuesAtError.current[identity])
        )
          messages[key] = message;
        else delete valuesAtError.current[identity];
      }
      if (Object.keys(messages).length) retained[childId] = messages;
    }
    if (!publishErrors(retained)) callbacks.current.report?.(id, registered(retained));
  }, [rows, fields, effectiveReset, statesById]);
  useLayoutEffect(
    () => () => {
      if (Object.keys(draftErrors.current).length) {
        draftErrors.current = {};
        callbacks.current.report?.(id, {});
        callbacks.current.onDraftErrorsChange?.({});
      }
    },
    [id],
  );
  const rowBlocked = (row: R) =>
    readOnly ||
    ['pending', 'unknown'].includes(operationsById[row.id]?.kind ?? '') ||
    !isReadableSurface(statesById[row.id] ?? { kind: 'ready' });
  useLayoutEffect(() => {
    if (removed.current === null && added.current === null) return;
    const frames = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-child-id]') ?? []);
    const frame =
      added.current !== null
        ? frames.find(element => element.dataset.childId === added.current)
        : frames[Math.min(removed.current ?? 0, frames.length - 1)];
    removed.current = null;
    added.current = null;
    const control = frame?.querySelector<HTMLElement>(
      'input:not(:disabled), textarea:not(:disabled), button:not(:disabled), [tabindex="-1"]',
    );
    (
      control ??
      root.current?.querySelector<HTMLElement>('[data-add-child]:not(:disabled)') ??
      root.current
    )?.focus();
  }, [rows]);
  const move = (index: number, offset: number) => {
    const row = rows[index];
    const destination = index + offset;
    if (!row || rowBlocked(row) || destination < 0 || destination >= rows.length) return;
    const next = [...rows];
    [next[index], next[destination]] = [next[destination]!, next[index]!];
    onRowsChange(next);
  };
  const add = () => {
    if (readOnly || !createRow || rows.length >= maxRows) return;
    const row = createRow();
    if (rows.some(existing => existing.id === row.id)) {
      setNotice('The supplied child ID already exists. No row was added.');
      return;
    }
    setNotice('');
    added.current = row.id;
    onRowsChange([...rows, row]);
  };
  return (
    <div ref={root} tabIndex={-1} className="kit-records kit-repeating">
      <h3>{t(title)}</h3>
      <p className="kit-caption">
        {t(
          'Child IDs own drafts, errors and supplied row results. Reordering does not change identity; changes are controlled by the caller.',
        )}
      </p>
      {notice && <p role="alert">{t(notice)}</p>}
      {rows.length === 0 && <p>{t('No child records yet.')}</p>}
      {rows.map((row, index) => {
        const state = statesById[row.id] ?? { kind: 'ready' };
        const operation = operationsById[row.id];
        const locked = rowBlocked(row);
        const unavailable = !isReadableSurface(state);
        return (
          <fieldset
            key={row.id}
            className="kit-fieldset"
            data-child-id={row.id}
            data-row-operation={operation?.kind ?? 'idle'}
          >
            <legend>{t('Child record {id}', { id: row.id })}</legend>
            <StateSurface state={state} />
            {operation && operation.kind !== 'idle' && (
              <p
                role={
                  operation.kind === 'error' || operation.kind === 'partial' ? 'alert' : 'status'
                }
              >
                {t(
                  operation.message ??
                    (operation.kind === 'pending'
                      ? 'This child result is pending.'
                      : operation.kind === 'unknown'
                        ? 'This child outcome is unconfirmed.'
                        : operation.kind === 'partial'
                          ? 'This child has a partial result.'
                          : operation.kind === 'error'
                            ? 'This child operation failed.'
                            : 'This child operation completed.'),
                )}
              </p>
            )}
            {fields.map((field, fieldIndex) => {
              const presentedField: FieldDefinition<R> = unavailable
                ? {
                    ...field,
                    availability: () => ({
                      state: state.kind === 'denied' ? 'restricted' : 'unavailable',
                      reason: state.message ?? 'This child record is not available for editing.',
                    }),
                  }
                : field;
              return (
                <div key={field.key}>
                  <FieldEditor
                    id={`${id}-${row.id}-${fieldIndex}`}
                    record={row}
                    field={presentedField}
                    error={draftErrorsById[row.id]?.[field.key] ?? errorsById[row.id]?.[field.key]}
                    resetKey={effectiveReset}
                    onDraftError={message => reportFieldError(row, field, message)}
                    disabled={locked && !readOnly}
                    readOnly={readOnly}
                    onChange={value => {
                      if (
                        locked ||
                        !field.setValue ||
                        fieldAvailability(row, field).state !== 'available' ||
                        field.editable?.(row).allowed === false
                      )
                        return;
                      onRowsChange(
                        rows.map(existing =>
                          existing.id === row.id
                            ? setDraftFieldValue(existing, field, value)
                            : existing,
                        ),
                      );
                    }}
                  />
                </div>
              );
            })}
            <div className="kit-action-row">
              <GenUXButton
                fill="text"
                text={t('Move {id} up', { id: row.id })}
                disabled={locked || index === 0}
                onClick={() => move(index, -1)}
              />
              <GenUXButton
                fill="text"
                text={t('Move {id} down', { id: row.id })}
                disabled={locked || index === rows.length - 1}
                onClick={() => move(index, 1)}
              />
              <GenUXButton
                fill="text"
                text={t('Remove {id}', { id: row.id })}
                disabled={locked || rows.length <= minRows}
                onClick={() => {
                  if (locked || rows.length <= minRows) return;
                  removed.current = index;
                  const retained = { ...draftErrors.current };
                  delete retained[row.id];
                  publishErrors(retained);
                  for (const key of Object.keys(valuesAtError.current))
                    if (JSON.parse(key)[0] === row.id) delete valuesAtError.current[key];
                  onRowsChange(rows.filter(existing => existing.id !== row.id));
                }}
              />
            </div>
          </fieldset>
        );
      })}
      <GenUXButton
        data-add-child=""
        text={t('Add child record')}
        disabled={readOnly || !createRow || rows.length >= maxRows}
        onClick={add}
      />
    </div>
  );
}
export default RepeatingRecordEditor;
