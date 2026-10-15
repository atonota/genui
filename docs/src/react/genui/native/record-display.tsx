import { useMemo } from 'react';
import RecordDisplay from '../../workspace/kit/RecordDisplay';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import {
  nativeFieldDefinitions,
  parseNativeFields,
  parseNativeRecords,
  type NativeRecord,
} from '../../../genui/native/record-fields';
import {
  RECORD_DISPLAY_PRESENTATIONS,
  type RecordDisplayPresentation,
} from '../../../genui/native/record-display';
import '../../../styles/workspace-kit.css';
import '../../../styles/kit-records.css';

/** Validated JSON record rendered through the existing read-only RecordDisplay; no edit or host callbacks. */
export default function NativeRecordDisplay({ data }: NativeAdapterProps) {
  const { fields, record } = useMemo(() => {
    const parsed = parseNativeFields(data.fields);
    return {
      fields: nativeFieldDefinitions(parsed, false),
      record:
        data.record === null ? null : (parseNativeRecords([data.record], parsed, 1)[0] ?? null),
    };
  }, [data.fields, data.record]);
  const presentation = RECORD_DISPLAY_PRESENTATIONS.includes(
    data.presentation as RecordDisplayPresentation,
  )
    ? (data.presentation as RecordDisplayPresentation)
    : 'page';
  return (
    <RecordDisplay<NativeRecord>
      record={record}
      fields={fields}
      title={typeof data.title === 'string' ? data.title : 'Record details'}
      presentation={presentation}
    />
  );
}
