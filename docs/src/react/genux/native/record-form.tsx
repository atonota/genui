import { useMemo, useState } from 'react';
import { cloneRecord, recordsEqual } from '../../../data/field-kit';
import type { JsonValue } from '../../../genux/contracts';
import type { NativeAdapterProps } from '../../../genux/native-contract';
import { definition, readRecordForm } from '../../../genux/native/record-form';
import { nativeFieldDefinitions, type NativeRecord } from '../../../genux/native/record-fields';
import { useI18n } from '../../useI18n';
import { RecordForm } from '../../workspace/kit/RecordForm';

const noErrors = {};

/** Draft-only adapter: edits become validated JSON values; commit never writes host data. */
export default function NativeRecordForm({
  data,
  disabled,
  onChange,
  onAction,
  actionAvailable = false,
}: NativeAdapterProps & { actionAvailable?: boolean }) {
  const { t } = useI18n();
  const form = useMemo(() => readRecordForm(data), [data]);
  const fields = useMemo(() => nativeFieldDefinitions(form.fields, true), [form.fields]);
  const [reviewed, setReviewed] = useState<NativeRecord | null>(null);
  const [rejected, setRejected] = useState(false);
  const emit = (draft: NativeRecord) => {
    let next;
    try {
      next = definition.withValue!(data, draft as unknown as JsonValue);
    } catch {
      setRejected(true);
      return;
    }
    setRejected(false);
    onChange(next.value as JsonValue);
  };
  // Derived, so a parent that rejects or replaces the draft also clears the review.
  const reviewReady = reviewed !== null && recordsEqual(reviewed, form.value);
  return (
    <RecordForm<NativeRecord>
      record={form.record}
      draft={form.value}
      fields={fields}
      errors={noErrors}
      organization={form.organization}
      title={form.title}
      disabled={disabled}
      onDraftChange={emit}
      onCommit={() => {
        if (actionAvailable) onAction();
        else setReviewed(cloneRecord(form.value));
      }}
      onCancel={() => {
        setReviewed(null);
        emit(cloneRecord(form.record));
      }}
    >
      {rejected && <p role="alert">{t('The draft change was not accepted.')}</p>}
      {reviewReady && (
        <p role="status">{t('Draft validated for local review. Nothing has been saved.')}</p>
      )}
    </RecordForm>
  );
}
