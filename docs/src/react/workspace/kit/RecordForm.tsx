import {
  useEffect,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import AtlasButton from '../../AtlasButton';
import { useI18n } from '../../useI18n';
import { FieldEditor } from './Fields';
import {
  fieldAvailability,
  cloneRecord,
  isEmptyFieldValue,
  recordsEqual,
  protectedDraftFields,
  authorizedRecordDraft,
  setDraftFieldValue,
  validateFieldValue,
  validateRecord,
} from '../../../data/field-kit';
import type { FieldDefinition, FieldErrors, RecordFormProps, RecordIdentity } from './contracts';
import {
  DraftErrorsContext,
  type RegisteredDraftError,
  type RegisteredDraftErrors,
} from './DraftErrors';

const hasValue = (value: Parameters<typeof isEmptyFieldValue>[0]) => !isEmptyFieldValue(value);

export function ErrorSummary({
  errors,
  labels,
  onReveal,
  nonFieldErrors = [],
}: {
  errors: FieldErrors;
  labels: Readonly<Record<string, string>>;
  onReveal: (key: string) => void;
  nonFieldErrors?: readonly string[];
}) {
  const { t } = useI18n();
  const entries = Object.entries(errors).filter(([, message]) => message);
  if (!entries.length && !nonFieldErrors.length) return null;
  return (
    <section className="kit-error-summary" role="alert" tabIndex={-1} aria-label={t('Form errors')}>
      <h3>{t('Correct {count} fields', { count: entries.length })}</h3>
      <ul>
        {entries.map(([key, message]) => {
          const label = labels[key];
          return (
            <li key={key}>
              {label ? (
                <AtlasButton
                  fill="text"
                  text={t('Go to {field}', { field: t(label) })}
                  onClick={() => onReveal(key)}
                />
              ) : (
                <span>{t('Form-level error')}</span>
              )}
              <span>{t(message)}</span>
            </li>
          );
        })}
        {nonFieldErrors.map((message, index) => (
          <li key={`form-${index}`}>{t(message)}</li>
        ))}
      </ul>
    </section>
  );
}

export function SectionNavigator({
  sections,
  activeSection,
  onSectionChange,
  errorsBySection = {},
  completedBySection = {},
  tabs = false,
  showProgress = true,
  idPrefix,
  label = 'Record sections',
  disabled = false,
}: {
  sections: readonly string[];
  activeSection: string;
  onSectionChange: (section: string) => void;
  errorsBySection?: Readonly<Record<string, number>>;
  completedBySection?: Readonly<Record<string, { completed: number; total: number }>>;
  tabs?: boolean;
  showProgress?: boolean;
  idPrefix?: string;
  label?: string;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const generatedId = useId();
  const prefix = idPrefix ?? generatedId;
  return (
    <nav
      className="kit-section-navigation"
      role={tabs ? 'tablist' : undefined}
      aria-label={t(label)}
    >
      {sections.map((section, index) => (
        <AtlasButton
          key={section}
          id={`${prefix}-section-${index}`}
          role={tabs ? 'tab' : undefined}
          disabled={disabled}
          tabIndex={tabs ? (activeSection === section ? 0 : -1) : undefined}
          fill={activeSection === section ? 'solid' : 'ghost'}
          aria-selected={tabs ? activeSection === section : undefined}
          aria-pressed={tabs ? undefined : activeSection === section}
          aria-controls={tabs ? `${prefix}-panel-${index}` : undefined}
          text={
            showProgress
              ? t('{section} · {completed}/{total} filled · {errors} errors', {
                  section: t(section),
                  completed: completedBySection[section]?.completed ?? 0,
                  total: completedBySection[section]?.total ?? 0,
                  errors: errorsBySection[section] ?? 0,
                })
              : t(section)
          }
          onClick={() => onSectionChange(section)}
          onKeyDown={event => {
            if (
              disabled ||
              !tabs ||
              event.altKey ||
              event.ctrlKey ||
              event.metaKey ||
              !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
            )
              return;
            event.preventDefault();
            const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
            const delta = event.key === 'ArrowRight' ? (rtl ? -1 : 1) : rtl ? 1 : -1;
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? sections.length - 1
                  : (index + delta + sections.length) % sections.length;
            onSectionChange(sections[next]!);
            document.getElementById(`${prefix}-section-${next}`)?.focus();
          }}
        />
      ))}
    </nav>
  );
}

export function FormShell({
  title,
  navigation,
  errorSummary,
  children,
  actions,
  onSubmit,
}: {
  title: string;
  navigation?: ReactNode;
  errorSummary?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  onSubmit: () => void;
}) {
  return (
    <form
      className="kit-record-form"
      noValidate
      onSubmit={event => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <h3>{title}</h3>
      {navigation}
      {errorSummary}
      {children}
      {actions}
    </form>
  );
}

export function RecordForm<R extends RecordIdentity>({
  record,
  draft,
  fields: suppliedFields,
  errors,
  onDraftChange,
  onCommit,
  onCancel,
  readOnly = false,
  disabled = false,
  stale,
  dirty: suppliedDirty,
  nonFieldErrors = [],
  capability,
  operation,
  organization = 'page',
  title = 'Record entry',
  children,
}: RecordFormProps<R>) {
  const { t } = useI18n();
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const pendingSummaryFocus = useRef(false);
  const baseline = useRef<{ id: string; record: R } | null>(null);
  if (!baseline.current || baseline.current.id !== record.id || recordsEqual(record, draft))
    baseline.current = { id: record.id, record: cloneRecord(record) };
  const base = baseline.current.record;
  const fields = useMemo(
    () => protectedDraftFields(record, suppliedFields),
    [record, suppliedFields],
  );
  const sections = useMemo(
    () => [...new Set(fields.map(field => field.section ?? 'Record fields'))],
    [fields],
  );
  const [active, setActive] = useState(sections[0] ?? 'Record fields');
  const activeSection =
    organization === 'accordion' && active === ''
      ? ''
      : sections.includes(active)
        ? active
        : (sections[0] ?? 'Record fields');
  const [localErrors, setLocalErrors] = useState<FieldErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [draftErrors, setDraftErrors] = useState<FieldErrors>({});
  const [cancelRequested, setCancelRequested] = useState(false);
  const [nestedDraftErrors, setNestedDraftErrors] = useState<
    Readonly<Record<string, RegisteredDraftErrors>>
  >({});
  const reportNestedErrors = useCallback((scope: string, entries: RegisteredDraftErrors) => {
    setNestedDraftErrors(current => {
      if (recordsEqual(current[scope] ?? {}, entries)) return current;
      const next = { ...current };
      if (Object.keys(entries).length) next[scope] = entries;
      else delete next[scope];
      return next;
    });
  }, []);
  const draftRegistry = useMemo(
    () => ({ resetKey: record.id, report: reportNestedErrors }),
    [record.id, reportNestedErrors],
  );
  const nestedErrors: Record<string, RegisteredDraftError> = {};
  for (const [scope, entries] of Object.entries(nestedDraftErrors))
    for (const [key, error] of Object.entries(entries))
      nestedErrors[`nested:${scope}:${key}`] = error;
  const nestedMessages = Object.fromEntries(
    Object.entries(nestedErrors).map(([key, error]) => [key, error.message]),
  );
  useEffect(() => {
    setLocalErrors({});
    setAttempted(false);
    setDraftErrors({});
    setCancelRequested(false);
    pendingFocus.current = null;
    pendingSummaryFocus.current = false;
  }, [record.id]);
  const identityError =
    record.id !== draft.id ? 'The draft record identity cannot change.' : undefined;
  const mergedErrors: FieldErrors = {
    ...(attempted ? validateRecord(draft, fields) : localErrors),
    ...errors,
    ...draftErrors,
    ...nestedMessages,
    ...(attempted && identityError ? { _identity: identityError } : {}),
  };
  const staleDraft = stale ?? (!recordsEqual(record, draft) && !recordsEqual(record, base));
  const dirty =
    (suppliedDirty ?? !recordsEqual(record, draft)) ||
    Object.values(draftErrors).some(Boolean) ||
    Object.keys(nestedMessages).length > 0;
  const outcomeLocked = operation?.kind === 'pending' || operation?.kind === 'unknown';
  const locked =
    disabled ||
    staleDraft ||
    readOnly ||
    capability?.allowed === false ||
    operation?.kind === 'pending' ||
    operation?.kind === 'unknown';
  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      Reflect.set(event, 'returnValue', '');
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty]);
  const sectionFor = (key: string) =>
    fields.find(field => field.key === key)?.section ?? 'Record fields';
  const reveal = (key: string) => {
    pendingSummaryFocus.current = false;
    pendingFocus.current = key;
    if (!nestedErrors[key]) setActive(sectionFor(key));
    setLocalErrors(current => ({ ...current }));
  };
  useLayoutEffect(() => {
    if (pendingSummaryFocus.current) {
      pendingSummaryFocus.current = false;
      rootRef.current?.querySelector<HTMLElement>('.kit-error-summary')?.focus();
      return;
    }
    const key = pendingFocus.current;
    if (key === null) return;
    pendingFocus.current = null;
    const nested = nestedErrors[key];
    if (nested) {
      const input = document.getElementById(nested.controlId);
      if (input && rootRef.current?.contains(input)) input.focus();
      return;
    }
    const frame = [
      ...(rootRef.current?.querySelectorAll<HTMLElement>('[data-field-key]') ?? []),
    ].find(element => element.dataset.fieldKey === key);
    const control = frame?.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not(:disabled), textarea:not(:disabled), [role="combobox"]:not(:disabled), button:not(:disabled), [tabindex="0"], [tabindex="-1"]',
    );
    (control ?? frame)?.focus();
  });
  const validate = (field: FieldDefinition<R>, value = field.getValue(draft), candidate = draft) =>
    validateFieldValue(candidate, field, value);
  const submit = () => {
    if (locked) return;
    setAttempted(true);
    const found: Record<string, string> = {
      ...validateRecord(draft, fields),
      ...errors,
      ...draftErrors,
      ...nestedMessages,
    };
    if (identityError) found._identity = identityError;
    setLocalErrors(found);
    const first = fields.find(field => found[field.key]);
    if (first) {
      reveal(first.key);
      return;
    }
    const firstNested = Object.keys(nestedMessages)[0];
    if (firstNested) {
      reveal(firstNested);
      return;
    }
    if (Object.values(found).some(Boolean) || nonFieldErrors.length) {
      pendingFocus.current = null;
      pendingSummaryFocus.current = true;
      return;
    }
    onCommit(authorizedRecordDraft(record, draft, suppliedFields), { base: cloneRecord(base) });
  };
  const progress = Object.fromEntries(
    sections.map(section => {
      const group = fields.filter(
        field =>
          (field.section ?? 'Record fields') === section &&
          fieldAvailability(draft, field).state === 'available',
      );
      return [
        section,
        {
          completed: group.filter(field => hasValue(field.getValue(draft))).length,
          total: group.length,
        },
      ];
    }),
  );
  const errorCounts = Object.fromEntries(
    sections.map(section => [
      section,
      fields.filter(
        field => (field.section ?? 'Record fields') === section && mergedErrors[field.key],
      ).length,
    ]),
  );
  const navigate = organization !== 'page' && organization !== 'sections';
  const index = sections.indexOf(activeSection);
  return (
    <DraftErrorsContext.Provider value={draftRegistry}>
      <div
        ref={rootRef}
        className="kit-records"
        data-kit-form={record.id}
        data-form-organization={organization}
        data-dirty={dirty}
        data-form-stale={staleDraft}
        data-record-operation={
          operation?.appliedIds?.includes(record.id)
            ? 'applied'
            : operation?.failedIds?.includes(record.id)
              ? 'failed'
              : (operation?.kind ?? 'idle')
        }
      >
        <FormShell
          title={t(title)}
          onSubmit={submit}
          navigation={
            navigate && organization !== 'accordion' ? (
              <SectionNavigator
                sections={sections}
                activeSection={activeSection}
                onSectionChange={setActive}
                errorsBySection={errorCounts}
                completedBySection={progress}
                tabs={organization === 'tabs'}
                idPrefix={id}
              />
            ) : undefined
          }
          errorSummary={
            attempted ? (
              <ErrorSummary
                errors={mergedErrors}
                nonFieldErrors={nonFieldErrors}
                labels={{
                  ...Object.fromEntries(fields.map(field => [field.key, field.label])),
                  ...Object.fromEntries(
                    Object.entries(nestedErrors).map(([key, error]) => [
                      key,
                      `${t('Child record {id}', { id: error.childId })} · ${t(error.label)}`,
                    ]),
                  ),
                }}
                onReveal={reveal}
              />
            ) : undefined
          }
          actions={
            <div className="kit-action-row">
              <AtlasButton
                htmlType="submit"
                disabled={locked}
                text={t(operation?.kind === 'pending' ? 'Commit pending' : 'Commit draft')}
              />
              <AtlasButton
                fill="text"
                text={t('Cancel draft')}
                onClick={() => {
                  if (outcomeLocked) return;
                  if (dirty) setCancelRequested(true);
                  else onCancel('explicit');
                }}
                disabled={outcomeLocked}
              />
            </div>
          }
        >
          {cancelRequested && (
            <div
              className="kit-discard-review"
              role="group"
              aria-label={t('Discard unsaved changes?')}
            >
              <p>
                {t('This draft has unsaved changes. Keep editing or explicitly discard the draft.')}
              </p>
              <div className="kit-action-row">
                <AtlasButton
                  fill="text"
                  text={t('Keep editing')}
                  onClick={() => setCancelRequested(false)}
                  disabled={outcomeLocked}
                />
                <AtlasButton
                  text={t('Discard draft')}
                  disabled={outcomeLocked}
                  onClick={() => {
                    if (!outcomeLocked) {
                      setCancelRequested(false);
                      onCancel('explicit');
                    }
                  }}
                />
              </div>
            </div>
          )}
          {staleDraft && (
            <p role="status">
              {t(
                'The record changed since this draft began. Review the latest values before committing.',
              )}
            </p>
          )}
          {organization === 'steps' && (
            <p className="kit-caption" aria-current="step">
              {t('Step {current} of {total}', { current: index + 1, total: sections.length })}
            </p>
          )}
          <p className="kit-caption">
            {t(
              'Section navigation is unrestricted. Explicit commit validates every available field; navigation never commits.',
            )}
          </p>
          {capability?.allowed === false && (
            <p role="status">{t(capability.reason ?? 'Editing is not available.')}</p>
          )}
          {readOnly && <p role="status">{t('This record is read only.')}</p>}
          {operation?.message && (
            <p
              role={operation.kind === 'error' || operation.kind === 'partial' ? 'alert' : 'status'}
            >
              {t(operation.message)}
            </p>
          )}
          {sections.map(section => {
            const open = !navigate || section === activeSection;
            const sectionIndex = sections.indexOf(section);
            return (
              <section key={section} className="kit-form-section">
                {organization === 'accordion' && (
                  <AtlasButton
                    id={`${id}-accordion-${sectionIndex}`}
                    fill="text"
                    aria-expanded={open}
                    aria-controls={`${id}-panel-${sectionIndex}`}
                    text={t('{section} · {completed}/{total} filled · {errors} errors', {
                      section: t(section),
                      ...progress[section]!,
                      errors: errorCounts[section] ?? 0,
                    })}
                    onClick={() => setActive(open ? '' : section)}
                  />
                )}
                <div
                  id={`${id}-panel-${sectionIndex}`}
                  role={organization === 'tabs' ? 'tabpanel' : undefined}
                  aria-labelledby={
                    organization === 'tabs'
                      ? `${id}-section-${sectionIndex}`
                      : organization === 'accordion'
                        ? `${id}-accordion-${sectionIndex}`
                        : undefined
                  }
                  className="kit-disclosure"
                  data-open={open}
                  inert={!open}
                  aria-hidden={!open}
                >
                  <div className="kit-disclosure-clip">
                    <fieldset
                      className="kit-fieldset"
                      aria-labelledby={
                        organization === 'accordion' ? `${id}-accordion-${sectionIndex}` : undefined
                      }
                    >
                      {organization !== 'accordion' && <legend>{t(section)}</legend>}
                      <p className="kit-caption">
                        {t('{completed} of {total} fields filled; {errors} errors.', {
                          ...progress[section]!,
                          errors: errorCounts[section] ?? 0,
                        })}
                      </p>
                      {fields
                        .filter(field => (field.section ?? 'Record fields') === section)
                        .map((field, fieldIndex) => (
                          <div key={field.key} data-field-key={field.key} tabIndex={-1}>
                            <FieldEditor
                              id={`${id}-field-${sectionIndex}-${fieldIndex}`}
                              record={draft}
                              field={field}
                              value={
                                fieldAvailability(draft, field).state === 'available'
                                  ? field.getValue(draft)
                                  : null
                              }
                              disabled={disabled || outcomeLocked || staleDraft}
                              readOnly={readOnly || capability?.allowed === false}
                              onDraftError={message =>
                                setDraftErrors(current => {
                                  const next = { ...current };
                                  if (message) next[field.key] = message;
                                  else delete next[field.key];
                                  return next;
                                })
                              }
                              error={mergedErrors[field.key]}
                              onChange={value => {
                                if (
                                  locked ||
                                  !field.setValue ||
                                  fieldAvailability(draft, field).state !== 'available' ||
                                  field.editable?.(draft).allowed === false
                                )
                                  return;
                                const next = setDraftFieldValue(draft, field, value);
                                onDraftChange(next);
                                setLocalErrors(current => {
                                  const nextErrors = { ...current };
                                  const message = validate(field, value, next);
                                  if (message) nextErrors[field.key] = message;
                                  else delete nextErrors[field.key];
                                  return nextErrors;
                                });
                              }}
                            />
                          </div>
                        ))}
                    </fieldset>
                  </div>
                </div>
              </section>
            );
          })}
          {organization === 'steps' && (
            <div className="kit-action-row">
              <AtlasButton
                fill="text"
                text={t('Previous section')}
                disabled={index <= 0}
                onClick={() => setActive(sections[index - 1]!)}
              />
              <AtlasButton
                fill="text"
                text={t('Next section')}
                disabled={index >= sections.length - 1}
                onClick={() => setActive(sections[index + 1]!)}
              />
            </div>
          )}
          {children}
        </FormShell>
      </div>
    </DraftErrorsContext.Provider>
  );
}

export default RecordForm;
