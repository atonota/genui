import { nativeRecord, type NativeDefinition, type NativePayload } from '../native-contract';
import { parseNativeFields, parseNativeRecords } from './record-fields';

export const RECORD_DISPLAY_PRESENTATIONS = ['page', 'sections', 'tabs', 'accordion'] as const;
export type RecordDisplayPresentation = (typeof RECORD_DISPLAY_PRESENTATIONS)[number];

// Read-only display: section switching is panel-local UI state, never a payload value,
// and the payload cannot grant edit capability, callbacks or host navigation.
export const definition: NativeDefinition = {
  name: 'GenUXRecordDisplay',
  readOnly: true,
  parse(input) {
    const data = nativeRecord(
      input,
      ['title', 'presentation', 'fields', 'record'],
      ['fields', 'record'],
    );
    if (
      data.title !== undefined &&
      (typeof data.title !== 'string' || !data.title.trim() || data.title.length > 120)
    )
      throw new Error('Record display title is invalid.');
    if (
      data.presentation !== undefined &&
      !RECORD_DISPLAY_PRESENTATIONS.includes(data.presentation as RecordDisplayPresentation)
    )
      throw new Error('Record display presentation is invalid.');
    const fields = parseNativeFields(data.fields);
    if (data.record !== null) parseNativeRecords([data.record], fields, 1);
    return data;
  },
};

export const sample: NativePayload = {
  title: 'Supplier record',
  presentation: 'tabs',
  fields: [
    { key: 'name', label: 'Supplier name', kind: 'text', section: 'Overview' },
    {
      key: 'status',
      label: 'Status',
      kind: 'choice',
      section: 'Overview',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'paused', label: 'Paused' },
      ],
    },
    {
      key: 'balance',
      label: 'Open balance',
      kind: 'money',
      currency: 'EUR',
      precision: 2,
      section: 'Finance',
    },
    { key: 'onboarded', label: 'Onboarded', kind: 'date', section: 'Finance' },
  ],
  record: {
    id: 'supplier-1',
    name: 'Aster Logistics',
    status: 'active',
    balance: 1250.5,
    onboarded: '2026-03-02',
  },
};
