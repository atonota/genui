import { useEffect, useId, useState, type ReactNode } from 'react';
import { DatePicker, Select } from 'antd';
import Input from '../../GenUXInput';
import InputNumber from '../../GenUXInputNumber';
import dayjs, { type Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import {
  entityOptionLabel,
  fieldAvailability,
  presentFieldValue,
  safeDecimal,
  validDateOnly,
  validInstant,
} from '../../../data/field-kit';
import { normalizeSearch } from '../../../i18n';
import { useI18n } from '../../useI18n';
import GenUXIcon from '../../GenUXIcon';
import type { FieldDefinition, FieldScalar, RecordIdentity } from './contracts';

dayjs.extend(utc);

export type DateFieldProps = {
  value?: string | null;
  onChange?: (value: string | null) => void;
  id?: string;
  disabled?: boolean;
  status?: 'error' | 'warning';
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
};
export function DateField({ value, onChange, ...props }: DateFieldProps) {
  return (
    <DatePicker<Dayjs>
      {...props}
      className="kit-date-field"
      variant="filled"
      classNames={{ popup: { root: 'genux-select-popup kit-date-popup' } }}
      value={value && validDateOnly(value) ? dayjs(value) : null}
      format="YYYY-MM-DD"
      onChange={next => onChange?.(next ? next.format('YYYY-MM-DD') : null)}
    />
  );
}
export function InstantField({ value, onChange, ...props }: DateFieldProps) {
  return (
    <DatePicker<Dayjs>
      {...props}
      className="kit-date-field"
      variant="filled"
      classNames={{ popup: { root: 'genux-select-popup kit-date-popup' } }}
      value={value && validInstant(value) ? dayjs.utc(value) : null}
      showTime
      format="YYYY-MM-DD HH:mm:ss [UTC]"
      onChange={next => onChange?.(next ? next.utc().toISOString() : null)}
    />
  );
}

export function FieldFrame({
  id,
  label,
  required = false,
  help,
  error,
  reason,
  labelTarget = true,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  help?: string;
  error?: string;
  reason?: string;
  labelTarget?: boolean;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="kit-field" data-field-frame={id}>
      <label id={`${id}-label`} htmlFor={labelTarget ? id : undefined}>
        {t(label)}
        {required && <span className="kit-required"> {t('(required)')}</span>}
      </label>
      {children}
      {help && (
        <p id={`${id}-help`} className="kit-field-help">
          {t(help)}
        </p>
      )}
      {reason && (
        <p id={`${id}-reason`} className="kit-field-help">
          {t(reason)}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="kit-field-error" aria-live="polite" aria-atomic="true">
          {t(error)}
        </p>
      )}
    </div>
  );
}

export function FieldValue<R extends RecordIdentity>({
  record,
  field,
  showReason = true,
}: {
  record: R;
  field: FieldDefinition<R>;
  showReason?: boolean;
}) {
  const { t, locale } = useI18n();
  const presentation = presentFieldValue(record, field, locale, t);
  return (
    <span
      className="kit-field-value"
      data-field-value={field.key}
      data-value-state={presentation.state}
    >
      {presentation.text}
      {(showReason || presentation.state === 'invalid') && presentation.reason && (
        <span className="kit-field-reason">{presentation.reason}</span>
      )}
    </span>
  );
}

export type FieldEditorProps<R extends RecordIdentity> = {
  field: FieldDefinition<R>;
  value?: FieldScalar;
  onChange: (value: FieldScalar) => void;
  onDraftError?: (message: string | null) => void;
  resetKey?: unknown;
  id?: string;
  disabled?: boolean;
  readOnly?: boolean;
  error?: string;
} & ({ record: R; context?: 'edit' } | { record?: R; context: 'filter' });

export function FieldEditor<R extends RecordIdentity>({
  record,
  field,
  value: override,
  onChange,
  onDraftError,
  resetKey,
  id: providedId,
  disabled = false,
  readOnly = false,
  error,
  context = 'edit',
}: FieldEditorProps<R>) {
  const generatedId = useId(),
    id = providedId ?? `kit-field-${generatedId}`;
  const { t } = useI18n();
  const [numericDraft, setNumericDraft] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const availability = record ? fieldAvailability(record, field) : { state: 'available' as const };
  const editability =
    record && availability.state === 'available' ? field.editable?.(record) : undefined;
  const value =
    override === undefined
      ? (context === 'edit' && availability.state !== 'available') || !record
        ? null
        : field.getValue(record)
      : override;
  useEffect(() => {
    setNumericDraft(null);
    setDraftError(null);
  }, [record?.id, field.key, value, resetKey]);
  const readonlyValue =
    context === 'edit' && (readOnly || !field.setValue || editability?.allowed === false);
  const unavailable = context === 'edit' && availability.state !== 'available';
  const blocked = disabled || readonlyValue || unavailable;
  const message = error ?? draftError ?? undefined;
  const help =
    field.help ??
    (field.kind === 'datetime'
      ? 'Edit an instant in UTC. Stored values include an explicit timezone.'
      : field.kind === 'date'
        ? 'Date only; no timezone conversion.'
        : undefined);
  const reason = unavailable
    ? (availability.reason ?? 'This field is not available for editing.')
    : readonlyValue
      ? (editability?.reason ?? 'This value is read-only.')
      : undefined;
  const resolve = (definition: string | ((record: R) => string) | undefined) =>
    typeof definition === 'function' ? (record ? definition(record) : undefined) : definition;
  const associatedUnit =
    ['number', 'money', 'unit', 'duration'].includes(field.kind) &&
    availability.state === 'available'
      ? (resolve(field.currency) ?? resolve(field.unit))
      : undefined;
  const describedBy =
    [
      help ? `${id}-help` : null,
      reason ? `${id}-reason` : null,
      message ? `${id}-error` : null,
      associatedUnit && !readonlyValue && !unavailable ? `${id}-unit` : null,
    ]
      .filter(Boolean)
      .join(' ') || undefined;
  const shared = {
    id,
    disabled: blocked,
    'aria-labelledby': `${id}-label`,
    'aria-describedby': describedBy,
    'aria-invalid': Boolean(message),
    'aria-required': context === 'edit' && Boolean(field.required),
    status: message ? ('error' as const) : undefined,
  };
  const reportDraft = (message: string | null) => {
    setDraftError(message);
    onDraftError?.(message);
  };
  let control: ReactNode;
  if ((readonlyValue || unavailable) && record && !disabled) {
    control = (
      <div
        id={id}
        role="textbox"
        tabIndex={0}
        aria-readonly="true"
        aria-required={context === 'edit' && Boolean(field.required)}
        aria-labelledby={`${id}-label`}
        aria-describedby={describedBy}
        aria-invalid={Boolean(message)}
        className="kit-readonly-value"
      >
        {!unavailable && readonlyValue && (
          <span className="kit-readonly-lock" aria-hidden="true">
            <GenUXIcon name="lock-simple" />
          </span>
        )}
        <FieldValue record={record} field={field} showReason={false} />
      </div>
    );
  } else if (unavailable && record) {
    control = (
      <div
        id={id}
        role="textbox"
        tabIndex={0}
        aria-readonly="true"
        aria-disabled="true"
        aria-labelledby={`${id}-label`}
        aria-describedby={describedBy}
        className="kit-readonly-value kit-field-unavailable"
      >
        <FieldValue record={record} field={field} showReason={false} />
      </div>
    );
  } else if (field.kind === 'choice' || field.kind === 'entity') {
    control = (
      <Select
        {...shared}
        allowClear
        value={value === null || value === '' ? null : String(value)}
        showSearch={{
          filterOption: (input, option) =>
            normalizeSearch(String(option?.label ?? '')).includes(normalizeSearch(input)),
        }}
        options={(field.options ?? []).map(option => ({
          value: option.value,
          label:
            field.kind === 'entity'
              ? entityOptionLabel(option, t)
              : option.description
                ? `${t(option.label)} — ${t(option.description)}`
                : t(option.label),
          disabled: option.disabled,
        }))}
        onChange={next => onChange(next === undefined ? null : next)}
      />
    );
  } else if (field.kind === 'boolean') {
    control = (
      <Select
        {...shared}
        allowClear
        value={value === null ? null : value === true ? 'yes' : 'no'}
        options={[
          { value: 'yes', label: t('Yes') },
          { value: 'no', label: t('No') },
        ]}
        onChange={next => onChange(next === undefined ? null : next === 'yes')}
      />
    );
  } else if (['number', 'money', 'unit', 'duration'].includes(field.kind)) {
    const precision = field.precision ?? (field.kind === 'number' ? 6 : 2);
    const numericError = (raw: string) =>
      raw.trim() === ''
        ? null
        : safeDecimal(Number(raw), precision)
          ? null
          : 'Enter a finite number with the supported precision.';
    control = (
      <div className="kit-numeric-field">
        <InputNumber
          {...shared}
          controls={false}
          stringMode
          value={numericDraft ?? (typeof value === 'number' ? String(value) : null)}
          onInput={raw => {
            setNumericDraft(raw);
            reportDraft(numericError(raw));
          }}
          onChange={next => {
            if (next === null || next === '') {
              reportDraft(null);
              onChange(null);
              return;
            }
            const message = numericError(String(next));
            reportDraft(message);
            if (!message) onChange(Number(next));
          }}
        />
        {associatedUnit && (
          <span id={`${id}-unit`} className="kit-field-unit">
            {t(associatedUnit)}
          </span>
        )}
      </div>
    );
  } else if (field.kind === 'date' || field.kind === 'datetime') {
    const Picker = field.kind === 'date' ? DateField : InstantField;
    control = (
      <Picker {...shared} value={typeof value === 'string' ? value : null} onChange={onChange} />
    );
  } else if (field.kind === 'multiline') {
    control = (
      <Input.TextArea
        {...shared}
        value={value === null ? '' : String(value)}
        onChange={event => onChange(event.target.value)}
        autoSize={{ minRows: 3, maxRows: 8 }}
      />
    );
  } else {
    control = (
      <Input
        {...shared}
        value={value === null ? '' : String(value)}
        onChange={event => onChange(event.target.value)}
      />
    );
  }
  return (
    <FieldFrame
      id={id}
      label={field.label}
      required={context === 'edit' && field.required}
      help={help}
      error={message}
      reason={reason}
      labelTarget={!(readonlyValue || unavailable)}
    >
      {control}
    </FieldFrame>
  );
}
