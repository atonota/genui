import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Collapse, Select } from 'antd';
import Input from '../GenUXInput';
import { Drawer, Modal } from '../GenUXOverlay';
import { toggleCollapseOnSpace } from '../keyboard';
import {
  dateText,
  DELIVERY_LABELS,
  initialRecords,
  moneyText,
  PAYMENT_LABELS,
  STATUS_LABELS,
  type WorkspaceRecord,
} from '../../data/workspace';
import { normalizeSearch } from '../../i18n';
import GenUXButton from '../GenUXButton';
import GenUXSplitter from '../GenUXSplitter';
import GenUXIcon from '../GenUXIcon';
import GenUXClearIcon from '../GenUXClearIcon';
import GenUXProvider, { useGenUXAppearance } from '../GenUXProvider';
import ExamplePreview from '../ExamplePreview';
import { selectedLabel } from '../selectedLabel';
import { useI18n } from '../useI18n';
import { TweakerSettings } from '../GenUXTweaker';
import RecordSummary from './RecordSummary';
import WorkspaceFrame, { type WorkspaceProfile } from './WorkspaceFrame';

const presentations = [
  { value: 'page', label: 'Full page' },
  { value: 'modal', label: 'Modal' },
  { value: 'drawer-right', label: 'Right drawer' },
  { value: 'bottom-sheet', label: 'Bottom sheet' },
  { value: 'top-sheet', label: 'Top sheet' },
  { value: 'inline', label: 'Inline disclosure' },
  { value: 'docked', label: 'Docked panel' },
  { value: 'split', label: 'Split pane' },
] as const;
const contents = [
  { value: 'summary', label: 'Summary' },
  { value: 'all-fields', label: 'All fields' },
  { value: 'payments', label: 'Payments' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'approvals', label: 'Approvals' },
  { value: 'related', label: 'Related records' },
  { value: 'activity', label: 'Example activity' },
  { value: 'attachments', label: 'Attachment metadata' },
  { value: 'history', label: 'Example version comparison' },
] as const;
type Presentation = (typeof presentations)[number]['value'];
type Content = (typeof contents)[number]['value'];
type Draft = Pick<WorkspaceRecord, 'customer' | 'owner' | 'notes'>;
type Errors = { customer?: boolean; owner?: boolean };
const overlayMode = (mode: Presentation) =>
  mode === 'modal' || mode === 'drawer-right' || mode === 'bottom-sheet' || mode === 'top-sheet';
const draftOf = (record: WorkspaceRecord): Draft => ({
  customer: record.customer,
  owner: record.owner,
  notes: record.notes,
});
const changed = (record: WorkspaceRecord, draft: Draft) =>
  record.customer !== draft.customer ||
  record.owner !== draft.owner ||
  record.notes !== draft.notes;

function DetailContent({
  content,
  record,
  records,
  onOpenRelated,
}: {
  content: Content;
  record: WorkspaceRecord;
  records: WorkspaceRecord[];
  onOpenRelated: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  const date = (value: string | null) => (value === null ? t('Not set') : dateText(value, locale));
  if (content === 'summary') return <RecordSummary record={record} />;
  if (content === 'all-fields')
    return (
      <>
        <RecordSummary record={record} />
        <dl className="workspace-detail-facts">
          <div>
            <dt>{t('Priority')}</dt>
            <dd>{t(record.priority === 'high' ? 'High' : 'Normal')}</dd>
          </div>
          <div>
            <dt>{t('Payment')}</dt>
            <dd>{t(PAYMENT_LABELS[record.payment])}</dd>
          </div>
          <div>
            <dt>{t('Delivery')}</dt>
            <dd>{t(DELIVERY_LABELS[record.delivery])}</dd>
          </div>
          <div>
            <dt>{t('Parent record')}</dt>
            <dd>{record.parentId ?? t('No parent record')}</dd>
          </div>
          <div>
            <dt>{t('Access')}</dt>
            <dd>{t(record.readOnly ? 'Read only' : 'Editable locally')}</dd>
          </div>
        </dl>
        <h4>{t('Order lines')}</h4>
        <div
          className="workspace-detail-table"
          tabIndex={0}
          role="region"
          aria-label={t('Order lines')}
        >
          <table>
            <thead>
              <tr>
                <th scope="col">{t('Product')}</th>
                <th scope="col">{t('Quantity')}</th>
                <th scope="col">{t('Unit price')}</th>
                <th scope="col">{t('Line total')}</th>
              </tr>
            </thead>
            <tbody>
              {record.lines.map(line => (
                <tr key={line.id}>
                  <th scope="row">{line.product}</th>
                  <td>{line.quantity}</td>
                  <td>{moneyText(line.unitPrice, record.currency, locale)}</td>
                  <td>{moneyText(line.quantity * line.unitPrice, record.currency, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="workspace-caption">
          {t(
            'Line items and record totals are independent fictional examples; they are not an invoice.',
          )}
        </p>
      </>
    );
  if (content === 'payments')
    return (
      <section className="workspace-detail-section">
        <h4>{t('Payment overview')}</h4>
        <dl className="workspace-detail-facts">
          <div>
            <dt>{t('Payment')}</dt>
            <dd>{t(PAYMENT_LABELS[record.payment])}</dd>
          </div>
          <div>
            <dt>{t('Amount')}</dt>
            <dd>
              {record.amount === null
                ? t('Not set')
                : moneyText(record.amount, record.currency, locale)}
            </dd>
          </div>
        </dl>
        <p>{t('These are example totals. No payment is processed.')}</p>
      </section>
    );
  if (content === 'delivery')
    return (
      <section className="workspace-detail-section">
        <h4>{t('Delivery overview')}</h4>
        <dl className="workspace-detail-facts">
          <div>
            <dt>{t('Delivery')}</dt>
            <dd>{t(DELIVERY_LABELS[record.delivery])}</dd>
          </div>
          <div>
            <dt>{t('City')}</dt>
            <dd>{record.city || t('Not set')}</dd>
          </div>
          <div>
            <dt>{t('Start date')}</dt>
            <dd>{date(record.start)}</dd>
          </div>
          <div>
            <dt>{t('Due date')}</dt>
            <dd>{date(record.due)}</dd>
          </div>
        </dl>
        <p>{t('This fictional schedule is not connected to a delivery service.')}</p>
      </section>
    );
  if (content === 'approvals')
    return (
      <section className="workspace-detail-section">
        <h4>{t('Approval overview')}</h4>
        <dl className="workspace-detail-facts">
          <div>
            <dt>{t('Status')}</dt>
            <dd>{t(STATUS_LABELS[record.status])}</dd>
          </div>
          <div>
            <dt>{t('Owner')}</dt>
            <dd>{record.owner || t('Not set')}</dd>
          </div>
        </dl>
        <p>{t('This is a fixture status. No approval request or external action is sent.')}</p>
      </section>
    );
  if (content === 'related') {
    const related = records.filter(
      item => item.id === record.parentId || item.parentId === record.id,
    );
    return (
      <section className="workspace-detail-section">
        <h4>{t('Related records')}</h4>
        {related.length ? (
          <ul className="workspace-details-related">
            {related.map(item => (
              <li key={item.id}>
                <GenUXButton
                  fill="text"
                  text={`${item.id} · ${item.customer}`}
                  onClick={() => onOpenRelated(item.id)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p>{t('No related records in this fixture.')}</p>
        )}
      </section>
    );
  }
  if (content === 'activity')
    return (
      <section className="workspace-detail-section">
        <h4>{t('Example activity')}</h4>
        <p>
          {t('Illustrative activity for {id}; this is not a live audit log.', { id: record.id })}
        </p>
        <ol>
          <li>{t('Example event: record included in the fixture.')}</li>
          <li>{t('Example event: owner assigned in the fixture.')}</li>
        </ol>
      </section>
    );
  if (content === 'attachments')
    return (
      <section className="workspace-detail-section">
        <h4>{t('Attachment metadata example')}</h4>
        <dl className="workspace-detail-facts">
          <div>
            <dt>{t('File name')}</dt>
            <dd>{record.id}-example.pdf</dd>
          </div>
          <div>
            <dt>{t('File type')}</dt>
            <dd>PDF</dd>
          </div>
          <div>
            <dt>{t('Example size')}</dt>
            <dd>48 KiB</dd>
          </div>
        </dl>
        <p>{t('Metadata only. No file is stored or available for download.')}</p>
      </section>
    );
  return (
    <section className="workspace-detail-section">
      <h4>{t('Example version comparison')}</h4>
      <p>
        {t(
          'The earlier value is a static fixture example, not saved history. The current value follows this local record.',
        )}
      </p>
      <div
        className="workspace-detail-table"
        tabIndex={0}
        role="region"
        aria-label={t('Example version comparison')}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">{t('Field')}</th>
              <th scope="col">{t('Earlier example')}</th>
              <th scope="col">{t('Current local value')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">{t('Notes')}</th>
              <td>{t('Initial example note')}</td>
              <td>{record.notes || t('No notes')}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function RecordDetailsExamples() {
  const { t } = useI18n();
  const appearance = useGenUXAppearance();
  const [records, setRecords] = useState(initialRecords);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(records.map(record => [record.id, draftOf(record)])),
  );
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, Errors>>({});
  const [profile, setProfile] = useState<WorkspaceProfile>('mobile');
  const [query, setQuery] = useState('');
  const [presentation, setPresentation] = useState<Presentation>('split');
  const [container, setContainer] = useState<Presentation>('split');
  const [content, setContent] = useState<Content>('summary');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement | null>(null);
  const search = useRef<HTMLInputElement | null>(null);
  const pendingContainer = useRef<Presentation | null>(null);
  const focusHeading = useRef(false);
  const restoreAfterClose = useRef(false);
  const focusEditor = useRef<'customer' | 'edit' | null>(null);
  const visible = records.filter(record =>
    normalizeSearch(
      `${record.id} ${record.title} ${record.customer} ${record.owner} ${record.city} ${t(STATUS_LABELS[record.status])}`,
    ).includes(normalizeSearch(query)),
  );
  const record = records.find(item => item.id === activeId);
  const position = visible.findIndex(item => item.id === activeId);
  const draft = record ? (drafts[record.id] ?? draftOf(record)) : null;
  const dirty = record && draft ? changed(record, draft) : false;
  const modal = overlayMode(container);
  const restoreFocus = () => {
    if (opener.current?.isConnected) opener.current.focus();
    else search.current?.focus();
  };
  useEffect(() => {
    if (open && !overlayMode(container) && focusHeading.current) {
      focusHeading.current = false;
      heading.current?.focus();
    }
    if (!open && restoreAfterClose.current && !overlayMode(container)) {
      restoreAfterClose.current = false;
      restoreFocus();
    }
  }, [open, activeId, container]);
  useEffect(() => {
    if (!focusEditor.current) return;
    const target = document.getElementById(`details-${focusEditor.current}`);
    if (target?.isConnected) {
      focusEditor.current = null;
      target.focus();
    }
  }, [activeId, editing]);
  const choosePresentation = (value: Presentation) => {
    setPresentation(value);
    if (open && overlayMode(container) && value !== container) {
      // Native exit finishes before moving the single body to a different container.
      pendingContainer.current = value;
      setOpen(false);
    } else {
      pendingContainer.current = null;
      setContainer(value);
      if (open && !overlayMode(value)) focusHeading.current = true;
    }
  };
  const close = () => {
    pendingContainer.current = null;
    restoreAfterClose.current = true;
    setOpen(false);
  };
  const afterOverlayChange = (isOpen: boolean) => {
    if (isOpen) return;
    const next = pendingContainer.current;
    if (next) {
      pendingContainer.current = null;
      setContainer(next);
      focusHeading.current = !overlayMode(next);
      setOpen(true);
    } else if (restoreAfterClose.current) {
      restoreAfterClose.current = false;
      restoreFocus();
    }
  };
  const openRecord = (id: string, trigger?: HTMLElement) => {
    if (trigger) opener.current = trigger;
    pendingContainer.current = null;
    setActiveId(id);
    focusHeading.current = !overlayMode(container);
    setOpen(true);
  };
  const updateDraft = (field: keyof Draft, value: string) => {
    if (!record || record.readOnly) return;
    setDrafts(previous => ({
      ...previous,
      [record.id]: { ...(previous[record.id] ?? draftOf(record)), [field]: value },
    }));
    setSavedId(null);
  };
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!record || !draft || record.readOnly) return;
    const invalid = { customer: !draft.customer.trim(), owner: !draft.owner.trim() };
    setErrors(previous => ({ ...previous, [record.id]: invalid }));
    if (invalid.customer || invalid.owner) {
      document.getElementById(invalid.customer ? 'details-customer' : 'details-owner')?.focus();
      return;
    }
    setRecords(previous =>
      previous.map(item => (item.id === record.id ? { ...item, ...draft } : item)),
    );
    focusEditor.current = 'edit';
    setEditing(previous => ({ ...previous, [record.id]: false }));
    setSavedId(record.id);
  };
  const presentationOptions = presentations.map(item => ({
    value: item.value,
    label: t(item.label),
  }));
  const contentOptions = contents.map(item => ({ value: item.value, label: t(item.label) }));

  const body =
    record && draft ? (
      <div
        className="workspace-detail-body"
        data-details-record={record.id}
        data-details-content={content}
      >
        <div className="workspace-detail-heading">
          <p className="workspace-caption">
            {record.id} · {t(presentations.find(item => item.value === container)!.label)}
          </p>
          <h4 id="details-record-title" ref={heading} tabIndex={-1}>
            {record.title}
          </h4>
          <p>{record.customer}</p>
        </div>
        <div className="control-row" role="group" aria-label={t('Record navigation')}>
          <GenUXButton
            id="details-previous"
            fill="text"
            text={t('Previous record')}
            disabled={position <= 0}
            onClick={() => {
              if (container === 'inline') focusHeading.current = true;
              setActiveId(visible[position - 1]!.id);
            }}
          />
          <span role="status">
            {position < 0
              ? t('Record is outside the current results.')
              : t('Record {current} of {total}', { current: position + 1, total: visible.length })}
          </span>
          <GenUXButton
            id="details-next"
            fill="text"
            text={t('Next record')}
            disabled={position < 0 || position >= visible.length - 1}
            onClick={() => {
              if (container === 'inline') focusHeading.current = true;
              setActiveId(visible[position + 1]!.id);
            }}
          />
          <GenUXButton
            id="details-close"
            fill="text"
            text={t(container === 'page' ? 'Back to results' : 'Close details')}
            onClick={close}
          />
        </div>
        {modal && appearance !== 'docs' && (
          <div className="workspace-detail-modes" onKeyDownCapture={toggleCollapseOnSpace}>
            <Collapse
              destroyOnHidden={false}
              items={[
                {
                  key: 'choices',
                  label: t('Change presentation or content'),
                  children: (
                    <>
                      <div role="group" aria-label={t('Presentation')} className="control-row">
                        {presentations.map(item => (
                          <GenUXButton
                            key={item.value}
                            fill={presentation === item.value ? 'tint' : 'text'}
                            text={t(item.label)}
                            aria-pressed={presentation === item.value}
                            onClick={() => choosePresentation(item.value)}
                          />
                        ))}
                      </div>
                      <div role="group" aria-label={t('Detail content')} className="control-row">
                        {contents.map(item => (
                          <GenUXButton
                            key={item.value}
                            fill={content === item.value ? 'tint' : 'text'}
                            text={t(item.label)}
                            aria-pressed={content === item.value}
                            onClick={() => setContent(item.value)}
                          />
                        ))}
                      </div>
                    </>
                  ),
                },
              ]}
            />
          </div>
        )}
        <DetailContent
          content={content}
          record={record}
          records={records}
          onOpenRelated={id => openRecord(id)}
        />
        <section className="workspace-detail-editor" aria-labelledby="details-edit-title">
          <h4 id="details-edit-title">{t('Local draft')}</h4>
          {record.readOnly ? (
            <p>
              {t('This fixture record is read only. Inspection is available; editing is disabled.')}
            </p>
          ) : null}
          <p role="status">
            {dirty
              ? t('Unsaved changes for this record.')
              : t('No unsaved changes for this record.')}
          </p>
          {!editing[record.id] && (
            <GenUXButton
              id="details-edit"
              fill="text"
              text={t('Edit locally')}
              disabled={record.readOnly}
              onClick={() => {
                focusEditor.current = 'customer';
                setEditing(previous => ({ ...previous, [record.id]: true }));
              }}
            />
          )}
          {editing[record.id] && (
            <form className="workspace-detail-form" noValidate onSubmit={save}>
              <div>
                <label htmlFor="details-customer">{t('Customer')}</label>
                <Input
                  id="details-customer"
                  value={draft.customer}
                  onChange={event => updateDraft('customer', event.target.value)}
                  required
                  status={errors[record.id]?.customer ? 'error' : undefined}
                  aria-invalid={!!errors[record.id]?.customer}
                  aria-describedby={
                    errors[record.id]?.customer ? 'details-customer-error' : undefined
                  }
                />
                {errors[record.id]?.customer && (
                  <p className="workspace-detail-error" id="details-customer-error" role="alert">
                    {t('Enter a customer name.')}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="details-owner">{t('Owner')}</label>
                <Input
                  id="details-owner"
                  value={draft.owner}
                  onChange={event => updateDraft('owner', event.target.value)}
                  required
                  status={errors[record.id]?.owner ? 'error' : undefined}
                  aria-invalid={!!errors[record.id]?.owner}
                  aria-describedby={errors[record.id]?.owner ? 'details-owner-error' : undefined}
                />
                {errors[record.id]?.owner && (
                  <p className="workspace-detail-error" id="details-owner-error" role="alert">
                    {t('Enter an owner name.')}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="details-notes">{t('Notes')}</label>
                <Input.TextArea
                  id="details-notes"
                  value={draft.notes}
                  rows={4}
                  onChange={event => updateDraft('notes', event.target.value)}
                />
              </div>
              <div className="control-row">
                <GenUXButton
                  id="details-save"
                  text={t('Validate and save locally')}
                  htmlType="submit"
                />
                <GenUXButton
                  id="details-cancel"
                  fill="text"
                  text={t('Discard this draft')}
                  onClick={() => {
                    setDrafts(previous => ({ ...previous, [record.id]: draftOf(record) }));
                    setErrors(previous => ({ ...previous, [record.id]: {} }));
                    focusEditor.current = 'edit';
                    setEditing(previous => ({ ...previous, [record.id]: false }));
                    setSavedId(null);
                  }}
                />
              </div>
            </form>
          )}
          <p className="workspace-caption">
            {t(
              'Drafts are kept by record while this page is open. Reloading discards all local changes.',
            )}
          </p>
        </section>
        {savedId === record.id && (
          <p role="status">
            {t('Changes validated locally for {id}. No data was sent.', { id: record.id })}
          </p>
        )}
      </div>
    ) : null;

  const recordBrowser = (
    <section
      className="workspace-details-results"
      tabIndex={open && container === 'docked' ? 0 : undefined}
      hidden={open && container === 'page'}
      aria-label={t('Record results')}
    >
      <p role="status">{t('{count} records', { count: visible.length })}</p>
      {visible.length ? (
        <ol className="workspace-details-list">
          {visible.map(item => (
            <li key={item.id} data-active={open && activeId === item.id}>
              <GenUXButton
                id={`details-open-${item.id}`}
                data-record-open={item.id}
                fill={open && activeId === item.id ? 'tint' : 'text'}
                width="full"
                text={`${item.id} · ${item.title}`}
                aria-pressed={open && activeId === item.id}
                onClick={event => openRecord(item.id, event.currentTarget)}
              />
              <p>{item.customer}</p>
              <p className="workspace-caption">
                {t(STATUS_LABELS[item.status])} · {item.owner}
                {drafts[item.id] && changed(item, drafts[item.id]!)
                  ? ` · ${t('Unsaved changes')}`
                  : ''}
              </p>
              <div
                className="workspace-disclosure"
                data-open={open && activeId === item.id && container === 'inline'}
                aria-hidden={!(open && activeId === item.id && container === 'inline')}
                inert={!(open && activeId === item.id && container === 'inline')}
              >
                <div className="workspace-disclosure-clip">
                  {activeId === item.id && container === 'inline' && (
                    <section
                      className="workspace-details-inline"
                      aria-labelledby="details-record-title"
                    >
                      {body}
                    </section>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p>{t('No records match your search. Change or clear the search to continue.')}</p>
      )}
    </section>
  );
  const detailPanel = (
    <section
      className={`workspace-disclosure workspace-details-panel workspace-details-${container}`}
      data-open={open && !!body}
      aria-hidden={!open || !body}
      inert={!open || !body}
      tabIndex={open && container === 'docked' ? 0 : undefined}
      aria-labelledby="details-record-title"
    >
      <div className="workspace-disclosure-clip">
        <div className="workspace-details-panel-content">{body}</div>
      </div>
    </section>
  );
  const resizable = container === 'split' || container === 'docked';
  return (
    <WorkspaceFrame
      profile={profile}
      onProfileChange={setProfile}
      title="Record detail presentations"
      kind="details"
    >
      <div className="workspace-details" data-presentation={container}>
        <div className="workspace-details-toolbar">
          <div>
            <label htmlFor="details-search">{t('Search records')}</label>
            <Input
              id="details-search"
              ref={node => {
                search.current = node?.input ?? null;
              }}
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={t('Order ID, customer, owner or city')}
              allowClear={appearance === 'docs' ? { clearIcon: <GenUXClearIcon /> } : true}
            />
          </div>
          <TweakerSettings title="Change presentation or content">
            <div>
              <label htmlFor="details-presentation">{t('Presentation')}</label>
              <Select<Presentation>
                id="details-presentation"
                value={presentation}
                onChange={choosePresentation}
                options={presentationOptions}
                labelRender={selectedLabel(presentationOptions)}
              />
            </div>
            <div>
              <label htmlFor="details-content">{t('Detail content')}</label>
              <Select<Content>
                id="details-content"
                value={content}
                onChange={setContent}
                options={contentOptions}
                labelRender={selectedLabel(contentOptions)}
              />
            </div>
          </TweakerSettings>
        </div>
        <p className="workspace-caption">
          {t(
            'Choose a presentation, then open a record. Search, drafts and record selection remain shared across the examples.',
          )}
        </p>
        {resizable ? (
          <GenUXSplitter
            id="record-details-splitter"
            className="workspace-details-splitter"
            label={t('Record browser and details')}
            orientation="auto"
            initialSizes={[40, 60]}
            panels={[
              { id: 'browser', label: t('Record results'), children: recordBrowser },
              {
                id: 'details',
                label: t('Record details'),
                children: (
                  <>
                    <div className="workspace-details-empty" hidden={open && Boolean(body)}>
                      <h4>{t('Record details')}</h4>
                      <p>{t('Open a record to inspect and edit it beside the results.')}</p>
                    </div>
                    {detailPanel}
                  </>
                ),
              },
            ]}
          />
        ) : (
          <div className="workspace-details-layout" data-presentation={container} data-open={open}>
            {recordBrowser}
            {!modal && container !== 'inline' && detailPanel}
          </div>
        )}
        {container === 'modal' && (
          <Modal
            rootClassName="genux-demo live-preview workspace-lab workspace-overlay workspace-details-overlay"
            title={t('Record details')}
            open={open}
            onCancel={close}
            afterOpenChange={afterOverlayChange}
            keyboard
            focusable={{ trap: true, focusTriggerAfterClose: true }}
            mask={{ closable: true }}
            closeIcon={<GenUXIcon name="x" />}
            closable={{ 'aria-label': t('Close details') }}
            destroyOnHidden
            footer={null}
            width="min(var(--workspace-details-modal-width), calc(100vw - 2 * var(--space-sm)))"
          >
            {body}
          </Modal>
        )}
        {(container === 'drawer-right' ||
          container === 'bottom-sheet' ||
          container === 'top-sheet') && (
          <Drawer
            rootClassName="genux-demo live-preview workspace-lab workspace-overlay workspace-details-overlay"
            title={t('Record details')}
            open={open}
            placement={
              container === 'drawer-right'
                ? 'right'
                : container === 'bottom-sheet'
                  ? 'bottom'
                  : 'top'
            }
            size={
              container === 'drawer-right'
                ? 'min(var(--workspace-details-panel-width), 100vw)'
                : 'var(--workspace-details-sheet-height)'
            }
            onClose={close}
            afterOpenChange={afterOverlayChange}
            keyboard
            focusable={{ trap: true, focusTriggerAfterClose: true }}
            mask={{ closable: true }}
            closeIcon={<GenUXIcon name="x" />}
            closable={{ 'aria-label': t('Close details') }}
            destroyOnHidden
          >
            {body}
          </Drawer>
        )}
      </div>
    </WorkspaceFrame>
  );
}

export default function RecordDetailsDemo({
  documentation = false,
}: { documentation?: boolean } = {}) {
  return (
    <GenUXProvider appearance={documentation ? 'docs' : undefined}>
      <ExamplePreview id="record-details-workspace" title="Record detail presentations">
        <RecordDetailsExamples />
      </ExamplePreview>
    </GenUXProvider>
  );
}
