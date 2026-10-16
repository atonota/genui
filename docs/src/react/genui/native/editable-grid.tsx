import { useMemo, useState } from 'react';
import AtlasButton from '../../AtlasButton';
import { useI18n } from '../../useI18n';
import EditableGrid from '../../workspace/kit/EditableGrid';
import type { JsonValue } from '../../../genui/contracts';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { nativeFieldDefinitions, type NativeRecord } from '../../../genui/native/record-fields';
import { definition, parseNativeGrid } from '../../../genui/native/editable-grid';

type Props = NativeAdapterProps & { actionAvailable?: boolean };

/**
 * Drafts stay controlled by `data.value`: each grid change is validated and offered
 * through onChange, and the parent may reject or delay it. Commit only opens a local
 * review; it never writes host records or reports operation success.
 */
export default function NativeEditableGrid({
  data,
  disabled,
  onChange,
  onAction,
  actionAvailable = false,
}: Props) {
  const { t } = useI18n();
  const model = useMemo(() => parseNativeGrid(data), [data]);
  const fields = useMemo(() => nativeFieldDefinitions(model.fields, !model.readOnly), [model]);
  const locked = disabled || model.readOnly;
  const draftsKey = JSON.stringify(model.drafts);
  const [preview, setPreview] = useState<{
    key: string;
    records: readonly NativeRecord[];
  } | null>(null);
  const review = preview?.key === draftsKey ? preview.records : null;
  return (
    <section className="genui-native-editable-grid">
      <EditableGrid
        title={model.title}
        records={model.records}
        fields={fields}
        drafts={model.drafts}
        pageSize={model.pageSize}
        capability={
          locked
            ? {
                allowed: false,
                reason: disabled ? 'Editing is unavailable right now.' : 'This grid is read-only.',
              }
            : undefined
        }
        onDraftsChange={next => {
          if (locked) return;
          let accepted: JsonValue;
          try {
            accepted = definition.withValue!(data, next as unknown as JsonValue).value;
          } catch {
            return;
          }
          onChange(accepted);
        }}
        onCommit={records => {
          if (!locked) setPreview({ key: draftsKey, records });
        }}
        onCancel={() => setPreview(null)}
      />
      {review && (
        <section role="status" aria-label={t('Draft review')}>
          <h5>{t('Review drafts before continuing')}</h5>
          <p>{t('Review only. These drafts are not saved.')}</p>
          <ul>
            {review.map(record => (
              <li key={record.id}>{record.id}</li>
            ))}
          </ul>
          {actionAvailable && !disabled && (
            <AtlasButton text={t('Continue with reviewed drafts')} onClick={() => onAction()} />
          )}
        </section>
      )}
    </section>
  );
}
