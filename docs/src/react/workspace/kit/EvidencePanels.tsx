import { useRef, useState } from 'react';
import { Checkbox, Select } from 'antd';
import AtlasButton from '../../AtlasButton';
import { useI18n } from '../../useI18n';
import { TweakerSettings } from '../../AtlasTweaker';
import { EntityPicker } from './EntityPicker';
import {
  RepeatingRecordEditor,
  validateNonNegativeNumber,
  validateLineProduct,
} from './RepeatingRecordEditor';
import {
  BulkActionBar,
  ChangeReview,
  CommandForm,
  ReviewQueue,
  SourceComparedEntry,
  ConflictResolver,
  CopyCreate,
  ImportCorrectionQueue,
  type ConflictDecision,
  type PreparedTarget,
  type TargetResult,
} from './ActionReview';
import { StateSurface } from './StateSurface';
import {
  isReadableSurface,
  type FieldDefinition,
  type FieldScalar,
  type RecordIdentity,
  type SurfaceState,
} from './contracts';
import { presentScalarValue, type FieldValueMetadata } from '../../../data/field-kit';
import {
  EQUIPMENT_FIELDS,
  initialEquipmentRecords,
  validateRecord,
  validInstant,
} from '../../../data/workspace-kit';
import { RecordPanel, type RecordPanelContainer } from './RecordPanel';

const showsEvidence = isReadableSurface;

export function formatAttachmentBytes(
  value: number | null,
  locale: 'en' | 'tr',
  t: (message: string, params?: Record<string, string | number>) => string,
): string {
  if (value === null || !Number.isSafeInteger(value) || value < 0) return t('Size unknown');
  const units = ['bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  const index =
    value === 0 ? 0 : Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  const size = new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    maximumFractionDigits: index ? 1 : 0,
  }).format(value / 1024 ** index);
  return index === 0
    ? t('{size} bytes', { size })
    : t('{size} {unit}', { size, unit: units[index] });
}

export type Attachment = Readonly<{
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number | null;
  preview?:
    | Readonly<{ kind: 'text'; text: string }>
    | Readonly<{ kind: 'unsupported' | 'unavailable'; reason?: string }>;
}>;
export function AttachmentPreview({
  attachment,
  state = { kind: 'ready' },
  onClose,
}: {
  attachment: Attachment | null;
  state?: SurfaceState;
  onClose?: () => void;
}) {
  const { t } = useI18n();
  const preview = attachment?.preview;
  return (
    <section className="kit-records kit-attachment-preview">
      <div className="kit-record-heading">
        <h3>{t('Attachment preview')}</h3>
        {onClose && (
          <AtlasButton fill="text" text={t('Close attachment preview')} onClick={onClose} />
        )}
      </div>
      <StateSurface
        state={
          attachment === null && state.kind === 'ready'
            ? { kind: 'empty', message: 'Choose an attachment to inspect.' }
            : state
        }
      >
        {attachment && showsEvidence(state) && (
          <>
            <p>{attachment.name}</p>
            {preview?.kind === 'text' ? (
              <pre className="kit-contained-scroll" tabIndex={0}>
                <code>{preview.text}</code>
              </pre>
            ) : (
              <p role="status">
                {t(
                  preview?.reason ??
                    (preview?.kind === 'unsupported'
                      ? 'This attachment type has no supplied preview.'
                      : 'Attachment content was not supplied. Metadata remains available.'),
                )}
              </p>
            )}
          </>
        )}
      </StateSurface>
    </section>
  );
}
export function AttachmentList({
  attachments,
  selectedId,
  onSelect,
  state = { kind: 'ready' },
}: {
  attachments: readonly Attachment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  state?: SurfaceState;
}) {
  const { t, locale } = useI18n();
  return (
    <section className="kit-records kit-attachment-list">
      <h3>{t('Attachments')}</h3>
      <StateSurface
        state={
          state.kind === 'ready' && attachments.length === 0
            ? { kind: 'empty', message: 'No attachments were supplied.' }
            : state
        }
      >
        {showsEvidence(state) && (
          <ul>
            {attachments.map(attachment => (
              <li key={attachment.id}>
                <AtlasButton
                  fill={selectedId === attachment.id ? 'solid' : 'ghost'}
                  text={attachment.name}
                  aria-pressed={selectedId === attachment.id}
                  onClick={() => onSelect(attachment.id)}
                />
                <span>{attachment.mimeType}</span>
                <span>{formatAttachmentBytes(attachment.sizeBytes, locale, t)}</span>
              </li>
            ))}
          </ul>
        )}
      </StateSurface>
      <p className="kit-caption">
        {t(
          'Only supplied attachment metadata and preview content are shown. Upload, download and storage are owned by the caller.',
        )}
      </p>
    </section>
  );
}
export type RecordEvent = Readonly<{
  id: string;
  at: string;
  actor: string | null;
  title: string;
  detail?: string;
  source?: string;
  changes?: readonly RecordDifference[];
}>;
export type RecordDifference<R extends RecordIdentity = RecordIdentity> = Readonly<{
  key: string;
  label: string;
  before: FieldScalar;
  after: FieldScalar;
  metadata?: FieldValueMetadata<R>;
  record?: R;
  beforeRecord?: R;
  afterRecord?: R;
}>;
export function EventItem({ event }: { event: RecordEvent }) {
  const { t, locale } = useI18n();
  const date = new Date(event.at);
  const valid = validInstant(event.at);
  return (
    <article className="kit-event" data-event-id={event.id}>
      <h4>{event.title}</h4>
      <p>
        {valid ? (
          <time dateTime={event.at}>
            {new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'UTC',
            }).format(date)}{' '}
            UTC
          </time>
        ) : (
          t('Event time is unknown.')
        )}
        {' · '}
        {event.actor ?? t('Actor unknown')}
      </p>
      {event.detail && <p>{event.detail}</p>}
      {event.source && (
        <p className="kit-caption">{t('Source: {source}', { source: event.source })}</p>
      )}
      {event.changes && <RecordDiff differences={event.changes} />}
    </article>
  );
}
export function EventList({
  events,
  state = { kind: 'ready' },
  title = 'Record events',
}: {
  events: readonly RecordEvent[];
  state?: SurfaceState;
  title?: string;
}) {
  const { t } = useI18n();
  return (
    <section className="kit-records kit-event-list">
      <h3>{t(title)}</h3>
      <StateSurface
        state={
          state.kind === 'ready' && events.length === 0
            ? { kind: 'empty', message: 'No events were supplied.' }
            : state
        }
      >
        {showsEvidence(state) && (
          <ol>
            {events.map(event => (
              <li key={event.id}>
                <EventItem event={event} />
              </li>
            ))}
          </ol>
        )}
      </StateSurface>
    </section>
  );
}
export function AuditDisplay({
  events,
  state,
}: {
  events: readonly RecordEvent[];
  state?: SurfaceState;
}) {
  const { t } = useI18n();
  return (
    <section className="kit-records">
      <EventList events={events} state={state} title="Supplied audit events" />
      <p className="kit-caption">
        {t('These supplied events do not establish a live, complete or tamper-proof audit trail.')}
      </p>
    </section>
  );
}
export function RecordDiff<R extends RecordIdentity = RecordIdentity>({
  differences,
  state = { kind: 'ready' },
  formatValue,
}: {
  differences: readonly RecordDifference<R>[];
  state?: SurfaceState;
  formatValue?: (value: FieldScalar, key: string) => string;
}) {
  const { t, locale } = useI18n();
  const format = (
    value: FieldScalar,
    difference: RecordDifference<R>,
    side: 'before' | 'after',
  ) => {
    if (formatValue) return formatValue(value, difference.key);
    if (difference.metadata)
      return presentScalarValue(value, difference.metadata, {
        record:
          (side === 'before' ? difference.beforeRecord : difference.afterRecord) ??
          difference.record,
        locale,
        translate: t,
      }).text;
    return value === null
      ? t('Not set')
      : typeof value === 'boolean'
        ? t(value ? 'Yes' : 'No')
        : String(value);
  };
  return (
    <section className="kit-records kit-record-diff">
      <h3>{t('Record differences')}</h3>
      <StateSurface
        state={
          state.kind === 'ready' && differences.length === 0
            ? { kind: 'empty', message: 'No differences were supplied.' }
            : state
        }
      >
        {showsEvidence(state) && differences.length > 0 && (
          <div
            className="kit-contained-scroll"
            tabIndex={0}
            role="region"
            aria-label={t('Record difference table')}
          >
            <table className="kit-review-table" role="table">
              <thead>
                <tr role="row">
                  <th scope="col" role="columnheader">
                    {t('Field')}
                  </th>
                  <th scope="col" role="columnheader">
                    {t('Before')}
                  </th>
                  <th scope="col" role="columnheader">
                    {t('After')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {differences.map(difference => (
                  <tr key={difference.key} role="row">
                    <th scope="row" role="rowheader">
                      {t(difference.label)}
                    </th>
                    <td role="cell" data-diff-label={t('Before')}>
                      {format(difference.before, difference, 'before')}
                    </td>
                    <td data-diff-label={t('After')}>
                      {format(difference.after, difference, 'after')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </StateSurface>
    </section>
  );
}

type ExampleLine = {
  id: string;
  description: string;
  quantity: number | null;
  price: number | null;
};
const lineFields: readonly FieldDefinition<ExampleLine>[] = [
  {
    key: 'description',
    label: 'Line description',
    kind: 'text',
    required: true,
    getValue: row => row.description,
    setValue: (row, value) => ({ ...row, description: String(value ?? '') }),
  },
  {
    key: 'quantity',
    label: 'Quantity',
    kind: 'unit',
    unit: 'items',
    required: true,
    precision: 0,
    getValue: row => row.quantity,
    setValue: (row, value) => ({ ...row, quantity: typeof value === 'number' ? value : null }),
    validate: value => validateNonNegativeNumber(value),
  },
  {
    key: 'price',
    label: 'Unit price',
    kind: 'money',
    currency: 'USD',
    required: true,
    precision: 2,
    getValue: row => row.price,
    setValue: (row, value) => ({ ...row, price: typeof value === 'number' ? value : null }),
    validate: (value, row) => validateLineProduct(row.quantity, value),
  },
];
const exampleAttachments: readonly Attachment[] = [
  {
    id: 'notes',
    name: 'Example notes.txt',
    mimeType: 'text/plain',
    sizeBytes: 58,
    preview: { kind: 'text', text: 'Supplied fixture content. No file service is connected.' },
  },
  {
    id: 'drawing',
    name: 'Example drawing.bin',
    mimeType: 'application/octet-stream',
    sizeBytes: null,
    preview: { kind: 'unsupported' },
  },
];
const exampleEvents: readonly RecordEvent[] = [
  {
    id: 'fixture-created',
    at: '2026-10-13T09:00:00Z',
    actor: 'Fixture author',
    title: 'Example record created',
    source: 'Local fixture',
    detail: 'This is supplied example history, not a live audit event.',
  },
];

/** Local consumer demonstrating the portable contracts. It owns no remote service. */
export function AdvancedRecordExamples() {
  const { t } = useI18n();
  const [entity, setEntity] = useState<string | null>('north');
  const [relatedIntent, setRelatedIntent] = useState('');
  const [lines, setLines] = useState<readonly ExampleLine[]>([
    { id: 'line-a', description: 'Sample kit', quantity: 1, price: 25 },
  ]);
  const lineSequence = useRef(1);
  const [attachment, setAttachment] = useState<string | null>('notes');
  const [checked, setChecked] = useState<readonly string[]>(['record-a']);
  const [prepared, setPrepared] = useState<readonly PreparedTarget[]>([]);
  const [results, setResults] = useState<readonly TargetResult[]>([]);
  const [changeMode, setChangeMode] = useState<'unchanged' | 'clear' | 'set'>('set');
  const [queueActive, setQueueActive] = useState<string | null>('record-a');
  const [completed, setCompleted] = useState<readonly string[]>([]);
  const [deferred, setDeferred] = useState<readonly string[]>([]);
  const [parameters, setParameters] = useState({ id: 'command-example', reason: '' });
  const [commandResult, setCommandResult] = useState('');
  const [panelRecords] = useState(() =>
    initialEquipmentRecords()
      .slice(0, 2)
      .map(record => ({ ...record, notes: `${record.notes}\n`.repeat(12) })),
  );
  const [panelContainer, setPanelContainer] = useState<RecordPanelContainer>('inline');
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelId, setPanelId] = useState(panelRecords[0]!.id);
  const [panelHistory, setPanelHistory] = useState<readonly string[]>([]);
  const [panelSection, setPanelSection] = useState('Identity');
  const panelStage = useRef<HTMLDivElement>(null);
  const panelOpener = useRef<HTMLElement | null>(null);
  const openEquipment = (recordId: string) => {
    panelOpener.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPanelId(recordId);
    setPanelHistory([]);
    setPanelOpen(true);
  };
  const [proposedOwner, setProposedOwner] = useState<FieldScalar>('Jordan Vale');
  const [conflictDecisions, setConflictDecisions] = useState<
    Readonly<Record<string, ConflictDecision>>
  >({});
  const [conflictResult, setConflictResult] = useState('');
  const sourceRecord = { id: 'source-copy', reason: 'Supplied source text' };
  const [copyCandidate, setCopyCandidate] = useState({
    id: 'new-copy',
    reason: 'Supplied source text',
  });
  const [copyResult, setCopyResult] = useState('');
  const [importActive, setImportActive] = useState('source-a');
  const [importReviewed, setImportReviewed] = useState<readonly string[]>([]);
  const [importValues, setImportValues] = useState<Record<string, FieldScalar>>({
    'source-a': 'Jordan Vale',
    'source-b': 'Alex Reed',
  });
  const commandFields: readonly FieldDefinition<typeof parameters>[] = [
    {
      key: 'reason',
      label: 'Decision reason',
      kind: 'multiline',
      required: true,
      getValue: value => value.reason,
      setValue: (value, next) => ({ ...value, reason: String(next ?? '') }),
    },
  ];
  const lineErrors = Object.fromEntries(
    lines.map(row => [row.id, validateRecord(row, lineFields)]),
  );
  return (
    <div className="kit-records kit-advanced-examples">
      <h2>{t('Entry, review and evidence examples')}</h2>
      <p className="kit-caption">
        {t(
          'All examples use local fixtures and explicit callbacks. They do not connect to a service or promote a design to Storybook.',
        )}
      </p>
      <section className="kit-records kit-panel-example">
        <h3>{t('Portable record panel and relation trail')}</h3>
        <TweakerSettings title="Record panel container">
          <label className="kit-panel-control">
            {t('Record panel container')}
            <Select
              value={panelContainer}
              options={(['page', 'inline', 'split', 'modal', 'drawer'] as const).map(value => ({
                value,
                label: t(
                  value === 'page'
                    ? 'Page'
                    : value === 'inline'
                      ? 'Inline'
                      : value === 'split'
                        ? 'Split inspector'
                        : value === 'modal'
                          ? 'Modal'
                          : 'Drawer',
                ),
              }))}
              onChange={setPanelContainer}
            />
          </label>
        </TweakerSettings>
        <p className="kit-caption">
          {t(
            'The same supplied equipment ID and return trail survive container changes. Closing does not discard caller-owned data or drafts.',
          )}
        </p>
        <AtlasButton
          fill="text"
          text={t('Reopen current inspector')}
          disabled={panelOpen}
          onClick={() => {
            panelOpener.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
            setPanelOpen(true);
          }}
        />
        <div
          ref={panelStage}
          className="kit-panel-example-stage"
          data-panel-layout={panelContainer}
        >
          <nav className="kit-panel-record-links" aria-label={t('Supplied equipment records')}>
            {panelRecords.map(record => (
              <AtlasButton
                key={record.id}
                fill="text"
                text={t('Inspect {id}', { id: record.id })}
                onClick={() => openEquipment(record.id)}
              />
            ))}
          </nav>
          <RecordPanel
            record={panelRecords.find(record => record.id === panelId) ?? null}
            fields={EQUIPMENT_FIELDS}
            open={panelOpen}
            onClose={() => setPanelOpen(false)}
            container={panelContainer}
            presentation="tabs"
            activeSection={panelSection}
            onSectionChange={setPanelSection}
            returnFocusRef={panelOpener}
            returnContext={{ label: 'Equipment examples', onReturn: () => setPanelOpen(false) }}
            returnTrail={panelHistory.map((recordId, index) => ({
              id: `${recordId}::${index}`,
              label: `${panelRecords.find(record => record.id === recordId)?.title ?? recordId} · ${recordId}`,
              onReturn: () => {
                setPanelId(recordId);
                setPanelHistory(current => current.slice(0, index));
              },
            }))}
          >
            <div className="kit-action-row">
              <AtlasButton
                fill="text"
                text={t('Open related equipment')}
                onClick={() => {
                  const next = panelRecords.find(record => record.id !== panelId);
                  if (next) {
                    setPanelHistory(current => [...current, panelId]);
                    setPanelId(next.id);
                  }
                }}
              />
              <AtlasButton
                fill="text"
                text={t('Close inspector at end')}
                onClick={() => setPanelOpen(false)}
              />
            </div>
            <p className="kit-caption">{t('End of supplied record content.')}</p>
          </RecordPanel>
        </div>
      </section>
      <EntityPicker
        label="Customer relation"
        value={entity}
        options={[
          { id: 'north', label: 'Acme', description: 'Northern office' },
          { id: 'south', label: 'Acme', description: 'Southern office' },
        ]}
        onChange={setEntity}
        onOpen={id =>
          setRelatedIntent(t('Open intent for {id}; no external record was loaded.', { id }))
        }
        onCreate={() => setRelatedIntent(t('Create relation intent; no record was created.'))}
      />
      <p role="status">{relatedIntent}</p>
      <RepeatingRecordEditor
        rows={lines}
        fields={lineFields}
        errorsById={lineErrors}
        onRowsChange={setLines}
        createRow={() => ({
          id: `line-${++lineSequence.current}`,
          description: '',
          quantity: 1,
          price: 0,
        })}
      />
      <section className="kit-bulk-example">
        <h3>{t('Prepared workset example')}</h3>
        <Checkbox.Group
          value={[...checked]}
          options={[
            { value: 'record-a', label: 'Record A' },
            { value: 'record-b', label: 'Record B' },
          ]}
          onChange={values => setChecked(values.map(String))}
        />
        <label>
          {t('Change mode')}
          <Select
            value={changeMode}
            options={[
              { value: 'unchanged', label: t('Unchanged') },
              { value: 'clear', label: t('Clear value') },
              { value: 'set', label: t('Set value') },
            ]}
            onChange={setChangeMode}
          />
        </label>
        <BulkActionBar
          checkedIds={checked}
          preparedIds={prepared.map(target => target.id)}
          activeId={queueActive}
          onPrepare={ids => {
            setPrepared(
              ids.map(id => ({
                id,
                changes: [
                  {
                    fieldKey: 'owner',
                    label: 'Owner',
                    mode: changeMode,
                    before: id === 'record-a' ? 'Alex Reed' : 'Sam Lee',
                    after: changeMode === 'set' ? 'Jordan Vale' : null,
                    mixed: ids.length > 1,
                  },
                ],
              })),
            );
            setResults([]);
          }}
          onClear={() => {
            setPrepared([]);
            setResults([]);
          }}
        />
        <ChangeReview
          targets={prepared}
          results={results}
          onApply={ids =>
            setResults(
              ids.map(id => ({
                id,
                state: id === 'record-a' ? 'success' : 'partial',
                message:
                  id === 'record-a'
                    ? 'Local fixture result accepted.'
                    : 'Example partial result; refresh before retry.',
                retryable: false,
              })),
            )
          }
          onCancel={() => {
            setPrepared([]);
            setResults([]);
          }}
        />
      </section>
      <ReviewQueue
        items={[
          { id: 'record-a', label: 'Record A' },
          { id: 'record-b', label: 'Record B' },
        ]}
        activeId={queueActive}
        completedIds={completed}
        deferredIds={deferred}
        onNavigate={setQueueActive}
        onDecision={(id, decision) => {
          if (decision === 'approve') setCompleted(current => [...current, id]);
          else setDeferred(current => [...current, id]);
        }}
      />
      <CommandForm
        parameters={parameters}
        fields={commandFields}
        onParametersChange={setParameters}
        onSubmit={value =>
          setCommandResult(
            t('Command intent validated with reason: {reason}. No business record changed.', {
              reason: value.reason,
            }),
          )
        }
        onCancel={() => setParameters({ id: 'command-example', reason: '' })}
      />
      <p role="status">{commandResult}</p>
      <AttachmentList
        attachments={exampleAttachments}
        selectedId={attachment}
        onSelect={setAttachment}
      />
      <AttachmentPreview
        attachment={exampleAttachments.find(item => item.id === attachment) ?? null}
        onClose={() => setAttachment(null)}
      />
      <EventList events={exampleEvents} />
      <AuditDisplay events={exampleEvents} />
      <RecordDiff
        differences={[
          { key: 'owner', label: 'Owner', before: 'Alex Reed', after: 'Jordan Vale' },
          {
            key: 'amount',
            label: 'Amount',
            before: null,
            after: 0,
            metadata: { kind: 'money', currency: 'USD', precision: 2 },
          },
        ]}
      />
      <SourceComparedEntry
        fields={[
          {
            key: 'owner',
            label: 'Owner',
            source: 'Supplied source owner',
            current: 'Alex Reed',
            proposed: proposedOwner,
          },
        ]}
        onUseSource={(_, value) => {
          setProposedOwner(value);
          setConflictDecisions({});
          setConflictResult('');
        }}
        onKeepCurrent={(_, value) => {
          setProposedOwner(value);
          setConflictDecisions({});
          setConflictResult('');
        }}
      />
      <ImportCorrectionQueue
        items={['source-a', 'source-b'].map((id, index) => ({
          id,
          label: index === 0 ? 'Supplied source A' : 'Supplied source B',
          fields: [
            {
              key: 'owner',
              label: 'Owner',
              source: index === 0 ? 'Jordan Vale' : 'Alex Reed',
              current: 'Sam Lee',
              proposed: importValues[id],
              metadata: { kind: 'text' as const },
            },
          ],
        }))}
        activeId={importActive}
        reviewedIds={importReviewed}
        onNavigate={setImportActive}
        onCorrection={(id, key, value) => {
          if (key !== 'owner') return;
          setImportValues(current => ({ ...current, [id]: value }));
          setImportReviewed(current => current.filter(value => value !== id));
        }}
        onReview={id => setImportReviewed(current => [...new Set([...current, id])])}
      />
      <ConflictResolver
        conflicts={[
          {
            key: 'owner',
            label: 'Owner',
            source: 'Supplied source owner',
            current: 'Alex Reed',
            proposed: proposedOwner,
          },
        ]}
        decisions={conflictDecisions}
        onDecisionChange={(key, decision) =>
          setConflictDecisions(current => ({ ...current, [key]: decision }))
        }
        onConfirm={() =>
          setConflictResult(
            t('Conflict choices confirmed locally. No remote value was overwritten.'),
          )
        }
      />
      <p role="status">{conflictResult}</p>
      <CopyCreate
        source={sourceRecord}
        candidate={copyCandidate}
        fields={commandFields}
        onCandidateChange={setCopyCandidate}
        onCreate={value =>
          setCopyResult(
            t('New record intent for {id}; the source remains unchanged.', { id: value.id }),
          )
        }
        onCancel={() => setCopyCandidate({ id: 'new-copy', reason: 'Supplied source text' })}
      />
      <p role="status">{copyResult}</p>
    </div>
  );
}
