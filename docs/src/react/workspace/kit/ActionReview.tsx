import { useRef, type ReactNode } from 'react';
import GenUXButton from '../../GenUXButton';
import { useI18n } from '../../useI18n';
import { RecordForm } from './RecordForm';
import type {
  Capability,
  FieldDefinition,
  FieldErrors,
  FieldScalar,
  OperationState,
  RecordIdentity,
  SurfaceState,
} from './contracts';
import { isReadableSurface } from './contracts';
import { StateSurface } from './StateSurface';
import { Radio } from 'antd';
import { cloneRecord, presentScalarValue, type FieldValueMetadata } from '../../../data/field-kit';

function useStableEntryBase<R extends RecordIdentity>(
  value: R,
  resetKey: unknown,
  acknowledged: boolean,
): R {
  const snapshot = useRef<{
    id: string;
    resetKey: unknown;
    acknowledged: boolean;
    record: R;
  } | null>(null);
  if (
    !snapshot.current ||
    snapshot.current.id !== value.id ||
    !Object.is(snapshot.current.resetKey, resetKey) ||
    (acknowledged && !snapshot.current.acknowledged)
  )
    snapshot.current = { id: value.id, resetKey, acknowledged, record: cloneRecord(value) };
  snapshot.current.acknowledged = acknowledged;
  return snapshot.current.record;
}

export type PreparedChange = Readonly<{
  fieldKey: string;
  label: string;
  mode: 'unchanged' | 'clear' | 'set';
  before: FieldScalar;
  after: FieldScalar;
  mixed?: boolean;
}>;
export type PreparedTarget = Readonly<{
  id: string;
  label?: string;
  eligible?: boolean;
  reason?: string;
  changes: readonly PreparedChange[];
}>;
export type TargetResult = Readonly<{
  id: string;
  state: 'pending' | 'success' | 'failed' | 'partial' | 'unknown';
  message?: string;
  retryable?: boolean;
}>;
const RESULT_LABELS = {
  pending: 'Pending result',
  success: 'Applied result',
  failed: 'Failed result',
  partial: 'Partial result',
  unknown: 'Unknown outcome',
} as const;

export function ChangeReview({
  targets,
  results = [],
  onApply,
  onCancel,
  onRetry,
  operation,
  formatValue,
}: {
  targets: readonly PreparedTarget[];
  results?: readonly TargetResult[];
  onApply?: (ids: readonly string[]) => void;
  onCancel?: () => void;
  onRetry?: (id: string) => void;
  operation?: OperationState;
  formatValue?: (value: FieldScalar, fieldKey: string) => string;
}) {
  const { t, locale } = useI18n();
  const show = (value: FieldScalar, fieldKey: string) =>
    formatValue
      ? formatValue(value, fieldKey)
      : value === null || value === ''
        ? t('Not set')
        : typeof value === 'boolean'
          ? t(value ? 'Yes' : 'No')
          : typeof value === 'number'
            ? new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US').format(value)
            : value;
  const resultById = new Map(results.map(result => [result.id, result]));
  const actionable = targets.filter(
    target =>
      target.eligible !== false &&
      target.changes.some(change => change.mode !== 'unchanged') &&
      !resultById.has(target.id),
  );
  return (
    <section className="kit-records kit-change-review">
      <h3>{t('Prepared change review')}</h3>
      <p className="kit-caption">
        {t(
          'Prepared target IDs are a snapshot. Inspection and checked records do not change this review.',
        )}
      </p>
      {targets.length === 0 && <p>{t('No prepared targets.')}</p>}
      {targets.map(target => {
        const result = resultById.get(target.id);
        return (
          <section key={target.id} className="kit-review-target" data-prepared-target={target.id}>
            <h4>
              {target.label ?? target.id} <span>{target.label ? target.id : ''}</span>
            </h4>
            {target.eligible === false && <p>{t(target.reason ?? 'This target is excluded.')}</p>}
            <div
              className="kit-contained-scroll"
              tabIndex={0}
              role="region"
              aria-label={t('Before and after for {id}', { id: target.id })}
            >
              <table className="kit-review-table">
                <thead>
                  <tr>
                    <th>{t('Field')}</th>
                    <th>{t('Change mode')}</th>
                    <th>{t('Before')}</th>
                    <th>{t('After')}</th>
                  </tr>
                </thead>
                <tbody>
                  {target.changes.map(change => (
                    <tr key={change.fieldKey}>
                      <th scope="row">{t(change.label)}</th>
                      <td>
                        {t(
                          change.mode === 'unchanged'
                            ? 'Unchanged'
                            : change.mode === 'clear'
                              ? 'Clear value'
                              : 'Set value',
                        )}
                        {change.mixed ? ` · ${t('Mixed values')}` : ''}
                      </td>
                      <td>{show(change.before, change.fieldKey)}</td>
                      <td>
                        {change.mode === 'unchanged'
                          ? show(change.before, change.fieldKey)
                          : change.mode === 'clear'
                            ? t('Cleared')
                            : show(change.after, change.fieldKey)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result && (
              <div
                className="kit-result"
                data-result-state={result.state}
                role={result.state === 'failed' || result.state === 'partial' ? 'alert' : 'status'}
              >
                <strong>{t(RESULT_LABELS[result.state])}</strong>
                {result.message && <p>{t(result.message)}</p>}
                {result.state === 'unknown' && (
                  <p>
                    {t(
                      'The outcome is unconfirmed. Refresh or reconcile before repeating the operation.',
                    )}
                  </p>
                )}
                {onRetry && result.retryable && (
                  <GenUXButton
                    fill="text"
                    text={t('Retry {id}', { id: target.id })}
                    disabled={
                      result.state === 'pending' ||
                      result.state === 'unknown' ||
                      operation?.kind === 'pending' ||
                      operation?.kind === 'unknown'
                    }
                    onClick={() => {
                      if (
                        result.state !== 'pending' &&
                        result.state !== 'unknown' &&
                        operation?.kind !== 'pending' &&
                        operation?.kind !== 'unknown'
                      )
                        onRetry(target.id);
                    }}
                  />
                )}
              </div>
            )}
          </section>
        );
      })}
      {operation?.message && <p role="status">{t(operation.message)}</p>}
      <div className="kit-action-row">
        {onApply && (
          <GenUXButton
            text={t('Apply prepared changes')}
            disabled={
              actionable.length === 0 ||
              operation?.kind === 'pending' ||
              operation?.kind === 'unknown'
            }
            onClick={() => onApply(actionable.map(target => target.id))}
          />
        )}
        {onCancel && (
          <GenUXButton
            fill="text"
            text={t('Cancel prepared changes')}
            disabled={operation?.kind === 'pending' || operation?.kind === 'unknown'}
            onClick={onCancel}
          />
        )}
      </div>
    </section>
  );
}

export function BulkActionBar({
  checkedIds,
  preparedIds,
  activeId = null,
  onPrepare,
  onClear,
  capability,
}: {
  checkedIds: readonly string[];
  preparedIds: readonly string[];
  activeId?: string | null;
  onPrepare: (ids: readonly string[]) => void;
  onClear: () => void;
  capability?: Capability;
}) {
  const { t } = useI18n();
  const checked = [...new Set(checkedIds)];
  const prepared = [...new Set(preparedIds)];
  return (
    <section className="kit-records kit-bulk-bar" aria-label={t('Bulk action preparation')}>
      <p>
        {t('Checked: {checked} · prepared: {prepared} · inspected: {active}', {
          checked: checked.length,
          prepared: prepared.length,
          active: activeId ?? t('None'),
        })}
      </p>
      <div className="kit-action-row">
        <GenUXButton
          text={t('Prepare checked records')}
          disabled={checked.length === 0 || capability?.allowed === false}
          onClick={() => onPrepare([...checked])}
        />
        <GenUXButton
          fill="text"
          text={t('Clear prepared targets')}
          disabled={prepared.length === 0}
          onClick={onClear}
        />
      </div>
      {capability?.allowed === false && (
        <p>{t(capability.reason ?? 'Bulk actions are not available.')}</p>
      )}
    </section>
  );
}

export function CommandForm<R extends RecordIdentity>({
  parameters,
  fields,
  errors = {},
  onParametersChange,
  onSubmit,
  onCancel = () => {},
  capability,
  operation,
  title = 'Command parameters',
  children,
  base: suppliedBase,
  dirty,
  resetKey,
}: {
  parameters: R;
  fields: readonly FieldDefinition<R>[];
  errors?: FieldErrors;
  onParametersChange: (parameters: R) => void;
  onSubmit: (parameters: R) => void;
  onCancel?: () => void;
  capability?: Capability;
  operation?: OperationState;
  title?: string;
  children?: ReactNode;
  base?: R;
  dirty?: boolean;
  resetKey?: unknown;
}) {
  const { t } = useI18n();
  const baseline = useStableEntryBase(parameters, resetKey, operation?.kind === 'success');
  return (
    <section className="kit-records kit-command-form">
      <p className="kit-caption">
        {t(
          'These are operation parameters, separate from editing the inspected record. Submission is an explicit intent.',
        )}
      </p>
      <RecordForm
        record={suppliedBase ?? baseline}
        draft={parameters}
        fields={fields}
        errors={errors}
        onDraftChange={onParametersChange}
        onCommit={onSubmit}
        onCancel={onCancel}
        capability={capability}
        operation={operation}
        dirty={dirty}
        title={title}
      >
        {children}
      </RecordForm>
    </section>
  );
}

export type QueueItem = Readonly<{ id: string; label: string }>;
export function ReviewQueue({
  items,
  activeId,
  completedIds,
  deferredIds,
  onNavigate,
  onDecision,
  capability,
  decisionParameters,
}: {
  items: readonly QueueItem[];
  activeId: string | null;
  completedIds: readonly string[];
  deferredIds: readonly string[];
  onNavigate: (id: string) => void;
  onDecision: (id: string, decision: 'approve' | 'defer') => void;
  capability?: Capability;
  decisionParameters?: ReactNode;
}) {
  const { t } = useI18n();
  const completed = new Set(completedIds);
  const deferred = new Set(deferredIds);
  const remaining = items.filter(item => !completed.has(item.id) && !deferred.has(item.id));
  const index = remaining.findIndex(item => item.id === activeId);
  const active = items.find(item => item.id === activeId);
  const actionable = activeId !== null && index >= 0 && capability?.allowed !== false;
  return (
    <section className="kit-records kit-review-queue">
      <h3>{t('Review queue')}</h3>
      <p>
        {t('Remaining: {remaining} · Completed: {completed} · Deferred: {deferred}', {
          remaining: remaining.length,
          completed: completed.size,
          deferred: deferred.size,
        })}
      </p>
      <p>
        {index >= 0
          ? t('Queue position {position} of {count}: {label}', {
              position: index + 1,
              count: remaining.length,
              label: active?.label ?? activeId ?? '',
            })
          : t(remaining.length ? 'Choose a remaining queued record.' : 'No queued records remain.')}
      </p>
      <p className="kit-caption">
        {t(
          'Navigation only changes inspection. Approve and defer are separate explicit decisions.',
        )}
      </p>
      <div className="kit-action-row">
        <GenUXButton
          fill="text"
          text={t('Previous queued record')}
          disabled={index <= 0}
          onClick={() => onNavigate(remaining[index - 1]!.id)}
        />
        <GenUXButton
          fill="text"
          text={t('Next queued record')}
          disabled={remaining.length === 0 || index >= remaining.length - 1}
          onClick={() => onNavigate(remaining[index + 1]!.id)}
        />
      </div>
      {decisionParameters}
      <div className="kit-action-row">
        <GenUXButton
          text={t('Approve record')}
          disabled={!actionable}
          onClick={() => {
            if (activeId !== null) onDecision(activeId, 'approve');
          }}
        />
        <GenUXButton
          fill="text"
          text={t('Defer record')}
          disabled={!actionable}
          onClick={() => {
            if (activeId !== null) onDecision(activeId, 'defer');
          }}
        />
      </div>
      {capability?.allowed === false && (
        <p>{t(capability.reason ?? 'Review decisions are not available.')}</p>
      )}
    </section>
  );
}

export type SourceComparedField<R extends RecordIdentity = RecordIdentity> = Readonly<{
  key: string;
  label: string;
  source: FieldScalar;
  current: FieldScalar;
  proposed: FieldScalar;
  metadata?: FieldValueMetadata<R>;
  record?: R;
  sourceRecord?: R;
  currentRecord?: R;
  proposedRecord?: R;
}>;
export function SourceComparedEntry<R extends RecordIdentity = RecordIdentity>({
  fields,
  onUseSource,
  onKeepCurrent,
  disabled = false,
}: {
  fields: readonly SourceComparedField<R>[];
  onUseSource: (key: string, value: FieldScalar) => void;
  onKeepCurrent?: (key: string, value: FieldScalar) => void;
  disabled?: boolean;
}) {
  const { t, locale } = useI18n();
  const show = (field: SourceComparedField<R>, side: 'source' | 'current' | 'proposed') =>
    presentScalarValue(
      field[side],
      field.metadata ?? { kind: typeof field[side] === 'number' ? 'number' : 'text' },
      { record: field[`${side}Record`] ?? field.record, locale, translate: t },
    ).text;
  return (
    <section className="kit-records">
      <h3>{t('Source-compared entry')}</h3>
      <p className="kit-caption">
        {t(
          'Source, current and proposed values are supplied by the caller. No file parsing or automatic extraction occurs.',
        )}
      </p>
      {fields.length === 0 && <p>{t('No source mappings were supplied.')}</p>}
      {fields.map(field => (
        <section key={field.key} className="kit-review-target">
          <h4>{t(field.label)}</h4>
          <dl className="kit-display-fields">
            <div>
              <dt>{t('Source value')}</dt>
              <dd>{show(field, 'source')}</dd>
            </div>
            <div>
              <dt>{t('Current value')}</dt>
              <dd>{show(field, 'current')}</dd>
            </div>
            <div>
              <dt>{t('Proposed value')}</dt>
              <dd>{show(field, 'proposed')}</dd>
            </div>
          </dl>
          <div className="kit-action-row">
            <GenUXButton
              fill="text"
              text={t('Use source for {field}', { field: t(field.label) })}
              disabled={disabled}
              onClick={() => {
                if (!disabled) onUseSource(field.key, field.source);
              }}
            />
            {onKeepCurrent && (
              <GenUXButton
                fill="text"
                text={t('Keep current {field}', { field: t(field.label) })}
                disabled={disabled}
                onClick={() => {
                  if (!disabled) onKeepCurrent(field.key, field.current);
                }}
              />
            )}
          </div>
        </section>
      ))}
    </section>
  );
}

export type ConflictDecision = 'current' | 'proposed';

export type ImportCorrectionItem<R extends RecordIdentity = RecordIdentity> = Readonly<{
  id: string;
  label?: string;
  fields: readonly SourceComparedField<R>[];
  errors?: FieldErrors;
  state?: SurfaceState;
  operation?: OperationState;
}>;
export function ImportCorrectionQueue<R extends RecordIdentity = RecordIdentity>({
  items,
  activeId,
  reviewedIds,
  onNavigate,
  onCorrection,
  onReview,
}: {
  items: readonly ImportCorrectionItem<R>[];
  activeId: string | null;
  reviewedIds: readonly string[];
  onNavigate: (id: string) => void;
  onCorrection: (id: string, key: string, value: FieldScalar) => void;
  onReview: (id: string, fields: readonly SourceComparedField<R>[]) => void;
}) {
  const { t } = useI18n();
  const index = items.findIndex(item => item.id === activeId);
  const item = items[index];
  const reviewed = new Set(reviewedIds);
  const state = item?.state ?? { kind: 'ready' };
  const blocked =
    !item ||
    !isReadableSurface(state) ||
    ['pending', 'unknown'].includes(item.operation?.kind ?? '');
  const errors = Object.values(item?.errors ?? {}).filter(Boolean);
  return (
    <section className="kit-records kit-import-corrections" data-correction-id={item?.id}>
      <h3>{t('Import correction queue')}</h3>
      <p className="kit-caption">
        {t('Supplied mappings only. No file parsing, extraction or server save is performed.')}
      </p>
      <p>
        {t('Reviewed {reviewed} of {total}', {
          reviewed: items.filter(item => reviewed.has(item.id)).length,
          total: items.length,
        })}
      </p>
      {!items.length && (
        <StateSurface state={{ kind: 'empty', message: 'No correction items were supplied.' }} />
      )}
      {items.length > 0 && !item && <p role="status">{t('Choose a correction item.')}</p>}
      <div className="kit-action-row">
        <GenUXButton
          fill="text"
          text={t('Previous correction')}
          disabled={index <= 0}
          onClick={() => {
            if (index > 0) onNavigate(items[index - 1]!.id);
          }}
        />
        <GenUXButton
          fill="text"
          text={t('Next correction')}
          disabled={!items.length || index >= items.length - 1}
          onClick={() => {
            const next = items[index + 1];
            if (next) onNavigate(next.id);
          }}
        />
      </div>
      {item && (
        <>
          <h4>{item.label ?? item.id}</h4>
          <StateSurface state={state} />
          {isReadableSurface(state) && (
            <SourceComparedEntry
              fields={item.fields}
              disabled={blocked}
              onUseSource={(key, value) => {
                if (!blocked) onCorrection(item.id, key, value);
              }}
              onKeepCurrent={(key, value) => {
                if (!blocked) onCorrection(item.id, key, value);
              }}
            />
          )}
          {errors.length > 0 && (
            <ul aria-live="polite">
              {errors.map((error, index) => (
                <li key={index}>{t(error)}</li>
              ))}
            </ul>
          )}
          {item.operation?.message && <p role="status">{t(item.operation.message)}</p>}
          {reviewed.has(item.id) && <p role="status">{t('This correction item was reviewed.')}</p>}
          <GenUXButton
            text={t('Mark correction reviewed')}
            disabled={blocked || errors.length > 0 || reviewed.has(item.id)}
            onClick={() => {
              if (!blocked && !errors.length && !reviewed.has(item.id))
                onReview(item.id, item.fields);
            }}
          />
        </>
      )}
    </section>
  );
}

export function ConflictResolver<R extends RecordIdentity = RecordIdentity>({
  conflicts,
  decisions,
  onDecisionChange,
  onConfirm,
}: {
  conflicts: readonly SourceComparedField<R>[];
  decisions: Readonly<Record<string, ConflictDecision | undefined>>;
  onDecisionChange: (key: string, decision: ConflictDecision) => void;
  onConfirm?: (decisions: Readonly<Record<string, ConflictDecision | undefined>>) => void;
}) {
  const { t, locale } = useI18n();
  const show = (conflict: SourceComparedField<R>, side: 'source' | 'current' | 'proposed') =>
    presentScalarValue(
      conflict[side],
      conflict.metadata ?? { kind: typeof conflict[side] === 'number' ? 'number' : 'text' },
      { record: conflict[`${side}Record`] ?? conflict.record, locale, translate: t },
    ).text;
  return (
    <section className="kit-records">
      <h3>{t('Conflict resolution')}</h3>
      <p className="kit-caption">
        {t(
          'Choose each supplied conflict explicitly. Confirmation reports decisions; it does not overwrite a remote record.',
        )}
      </p>
      {conflicts.map(conflict => (
        <fieldset className="kit-fieldset" key={conflict.key}>
          <legend>{t(conflict.label)}</legend>
          <p className="kit-conflict-source">
            {t('Source value')}: {show(conflict, 'source')}
          </p>
          <Radio.Group
            value={decisions[conflict.key]}
            onChange={event =>
              onDecisionChange(conflict.key, event.target.value as ConflictDecision)
            }
            options={[
              {
                value: 'current',
                label: t('Keep current: {value}', {
                  value: show(conflict, 'current'),
                }),
              },
              {
                value: 'proposed',
                label: t('Use proposed: {value}', {
                  value: show(conflict, 'proposed'),
                }),
              },
            ]}
          />
        </fieldset>
      ))}
      {onConfirm && (
        <GenUXButton
          text={t('Confirm conflict choices')}
          disabled={conflicts.length === 0 || conflicts.some(conflict => !decisions[conflict.key])}
          onClick={() => onConfirm(decisions)}
        />
      )}
    </section>
  );
}

export function CopyCreate<R extends RecordIdentity>({
  source,
  candidate,
  fields,
  errors = {},
  onCandidateChange,
  onCreate,
  onCancel,
  base: suppliedBase,
  dirty,
  resetKey,
  operation,
}: {
  source: R;
  candidate: R;
  fields: readonly FieldDefinition<R>[];
  errors?: FieldErrors;
  onCandidateChange: (candidate: R) => void;
  onCreate: (candidate: R) => void;
  onCancel: () => void;
  base?: R;
  dirty?: boolean;
  resetKey?: unknown;
  operation?: OperationState;
}) {
  const { t } = useI18n();
  const baseline = useStableEntryBase(candidate, resetKey, operation?.kind === 'success');
  const identityAllowed = source.id !== candidate.id;
  return (
    <section className="kit-records kit-copy-create">
      <h3>{t('Copy as a new record')}</h3>
      <p>
        {t('Source ID: {source}; candidate ID: {candidate}.', {
          source: source.id,
          candidate: candidate.id,
        })}
      </p>
      <RecordForm
        record={suppliedBase ?? baseline}
        draft={candidate}
        fields={fields}
        errors={errors}
        onDraftChange={onCandidateChange}
        onCommit={value => {
          if (identityAllowed) onCreate(value);
        }}
        onCancel={onCancel}
        dirty={dirty}
        operation={operation}
        capability={{
          allowed: identityAllowed,
          reason: 'A copied record needs a distinct caller-supplied ID.',
        }}
      />
    </section>
  );
}
