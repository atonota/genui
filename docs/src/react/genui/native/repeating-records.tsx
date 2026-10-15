import { useMemo } from 'react';
import RepeatingRecordEditor from '../../workspace/kit/RepeatingRecordEditor';
import type { JsonValue } from '../../../genui/contracts';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { nativeFieldDefinitions, type NativeRecord } from '../../../genui/native/record-fields';
import {
  createRepeatingRow,
  definition,
  readRepeatingRecords,
} from '../../../genui/native/repeating-records';
import '../../../styles/workspace-kit.css';
import '../../../styles/kit-records.css';

/** Rows always come from the controlled payload; the caller may reject or delay a change. */
export default function NativeRepeatingRecords({ data, disabled, onChange }: NativeAdapterProps) {
  const state = useMemo(() => readRepeatingRecords(data), [data]);
  const locked = disabled || state.readOnly;
  const fields = useMemo(
    () => nativeFieldDefinitions(state.fields, !state.readOnly),
    [state.fields, state.readOnly],
  );
  return (
    <RepeatingRecordEditor<NativeRecord>
      rows={state.rows}
      fields={fields}
      title={state.label}
      minRows={state.minRows}
      maxRows={state.maxRows}
      readOnly={locked}
      createRow={() => createRepeatingRow(state)}
      onRowsChange={rows => {
        if (locked) return;
        let value: JsonValue;
        try {
          value = definition.withValue!(data, rows as unknown as JsonValue).value!;
        } catch {
          return;
        }
        onChange(value);
      }}
    />
  );
}
