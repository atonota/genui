import type { WorkspaceRecord } from '../../data/workspace';
import { ORDER_FIELDS } from '../../data/workspace-kit';
import { FieldValue } from './kit/Fields';
import GenUXPill from '../GenUXPill';
import { workspacePillColorIndex } from '../../data/workspace-pill-colors';
import { useI18n } from '../useI18n';

/** Read-only record core shared by the collection and detail experiments. */
export default function RecordSummary({
  record,
  compact = false,
}: {
  record: WorkspaceRecord;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const value = (key: string) => {
    const field = ORDER_FIELDS.find(item => item.key === key);
    return field ? <FieldValue record={record} field={field} /> : t('Not set');
  };
  return (
    <div className="workspace-record-summary" data-record-summary={record.id}>
      <dl>
        <div>
          <dt>{t('Order ID')}</dt>
          <dd>{value('id')}</dd>
        </div>
        <div>
          <dt>{t('Customer')}</dt>
          <dd>{value('customer')}</dd>
        </div>
        <div>
          <dt>{t('Status')}</dt>
          <dd>
            <GenUXPill colorIndex={workspacePillColorIndex.status[record.status]}>
              {value('status')}
            </GenUXPill>
          </dd>
        </div>
        <div>
          <dt>{t('Amount')}</dt>
          <dd>{value('amount')}</dd>
        </div>
        {!compact && (
          <>
            <div>
              <dt>{t('Owner')}</dt>
              <dd>{value('owner')}</dd>
            </div>
            <div>
              <dt>{t('City')}</dt>
              <dd>{record.city || t('Not set')}</dd>
            </div>
            <div>
              <dt>{t('Start date')}</dt>
              <dd>{value('start')}</dd>
            </div>
            <div>
              <dt>{t('Due date')}</dt>
              <dd>{value('due')}</dd>
            </div>
            <div className="workspace-summary-note">
              <dt>{t('Notes')}</dt>
              <dd>{value('notes')}</dd>
            </div>
          </>
        )}
      </dl>
    </div>
  );
}
