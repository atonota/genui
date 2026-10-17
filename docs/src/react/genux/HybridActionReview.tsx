import { useState, useSyncExternalStore } from 'react';
import type { CardAction } from '../../data/card-model';
import type { TrustedReviewBinding } from '../../genux/actions/authorization';
import { captureActionReview, type PreparedActionReview } from '../../genux/action-review';
import type { GenUXAction, GenUXRuntime, GenUXSnapshot, JsonValue } from '../../genux/contracts';
import GenUXButton from '../GenUXButton';
import { GenUXAlert, GenUXModal } from '../GenUXFeedback';
import { useI18n } from '../useI18n';

type ReviewDescriptor = Pick<
  GenUXAction,
  'surfaceId' | 'componentId' | 'actionId' | 'baseRevision'
>;
interface ReviewTarget {
  action?: CardAction;
  primaryAction?: CardAction;
  secondaryActions?: CardAction[];
}

/** A captured review stays current only while its exact surface and model remain published. */
function isCurrent(snapshot: GenUXSnapshot, review: PreparedActionReview): boolean {
  const { binding } = review;
  const latest = captureActionReview(snapshot, {
    surfaceId: binding.surfaceId,
    componentId: binding.componentId,
    actionId: binding.actionId,
    baseRevision: binding.revision,
  });
  return (
    !!latest &&
    latest.binding.scopeId === binding.scopeId &&
    latest.binding.generation === binding.generation &&
    latest.binding.modelJSON === binding.modelJSON &&
    latest.binding.surfaceJSON === binding.surfaceJSON
  );
}

function actionLabel(binding: PreparedActionReview['binding']): string {
  const target = JSON.parse(binding.modelJSON) as ReviewTarget;
  return (
    [target.primaryAction, ...(target.secondaryActions ?? []), target.action].find(
      item => item?.id === binding.actionId,
    )?.label ?? binding.actionId
  );
}

/**
 * Version-bound before/after review. Approval only hands the exact fresh binding
 * to the trusted host callback; it never executes, sends or reports a result.
 */
export default function HybridActionReview({
  runtime,
  descriptor,
  onApprove,
  onCancel,
}: {
  runtime: GenUXRuntime;
  descriptor: ReviewDescriptor;
  onApprove: (binding: TrustedReviewBinding) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  );
  // The captured artifact is frozen; only an explicit refresh replaces it.
  const [review, setReview] = useState<PreparedActionReview | null>(() =>
    captureActionReview(runtime.getSnapshot(), descriptor),
  );
  const [approved, setApproved] = useState(false);
  const state = !review
    ? 'unavailable'
    : !isCurrent(snapshot, review)
      ? 'stale'
      : approved
        ? 'approved'
        : 'current';
  const refresh = () => {
    const latest = runtime.getSnapshot();
    setReview(captureActionReview(latest, { ...descriptor, baseRevision: latest.revision }));
    setApproved(false);
  };
  const approve = () => {
    if (!review || approved || !isCurrent(runtime.getSnapshot(), review)) return;
    setApproved(true);
    onApprove(Object.freeze({ ...review.binding, approved: true as const }));
  };
  const show = (value: JsonValue): string => {
    if (value === null || value === '' || (Array.isArray(value) && !value.length))
      return t('Empty');
    if (typeof value === 'string') return value;
    if (Array.isArray(value) && value.every(item => typeof item === 'string'))
      return value.join(', ');
    return JSON.stringify(value);
  };
  return (
    <GenUXModal
      open
      title={t('Review action before approval')}
      onCancel={onCancel}
      footer={[
        <GenUXButton key="cancel" fill="text" text={t('Cancel')} onClick={onCancel} />,
        <GenUXButton
          key="refresh"
          fill="outline"
          text={t('Refresh review')}
          disabled={state === 'current' || state === 'approved'}
          onClick={refresh}
        />,
        <GenUXButton
          key="approve"
          fill="solid"
          text={t('Approve reviewed action')}
          disabled={state !== 'current'}
          onClick={approve}
        />,
      ]}
    >
      <div data-genux-action-review={state}>
        {state === 'unavailable' && (
          <GenUXAlert
            status="warning"
            title={t('This action cannot be reviewed now.')}
            description={t('Refresh after the stream completes and the action is available.')}
          />
        )}
        {state === 'stale' && (
          <GenUXAlert
            status="warning"
            title={t('The Card changed after this review was prepared.')}
            description={t(
              'Refresh the review before approving. The previous review can no longer be approved.',
            )}
          />
        )}
        {state === 'approved' && (
          <GenUXAlert
            status="info"
            title={t('Review approval passed to the host.')}
            description={t('This page did not execute or confirm the operation.')}
          />
        )}
        {review && (
          <>
            <dl>
              <div>
                <dt>{t('Scope')}</dt>
                <dd>{review.binding.scopeId}</dd>
              </div>
              <div>
                <dt>{t('Action')}</dt>
                <dd>{actionLabel(review.binding)}</dd>
              </div>
              <div>
                <dt>{t('Card version')}</dt>
                <dd>
                  {t('Revision {revision} · generation {generation}', {
                    revision: review.binding.revision,
                    generation: review.binding.generation,
                  })}
                </dd>
              </div>
              <div>
                <dt>{t('Selected records')}</dt>
                <dd>
                  {review.selectedRecordIds.length
                    ? review.selectedRecordIds.join(', ')
                    : t('None')}
                </dd>
              </div>
            </dl>
            {review.changes.length ? (
              <ul aria-label={t('Changes to review')}>
                {review.changes.map((change, index) => (
                  <li key={`${review.binding.id}-${index}`}>
                    <strong>{change.label}</strong>
                    <dl>
                      <div>
                        <dt>{t('Before')}</dt>
                        <dd>
                          {change.sensitive ? t('Sensitive value hidden') : show(change.before)}
                        </dd>
                      </div>
                      <div>
                        <dt>{t('After')}</dt>
                        <dd>
                          {change.sensitive ? t('Sensitive value hidden') : show(change.after)}
                        </dd>
                      </div>
                    </dl>
                    {change.sensitive && (
                      <p>
                        {change.changed
                          ? t('Changed (sensitive value)')
                          : t('Unchanged (sensitive value)')}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t('No local changes. The action applies to the published Card data.')}</p>
            )}
          </>
        )}
        <p>
          {t(
            'Approving passes this exact review to the host. This page does not execute the action or report a result.',
          )}
        </p>
      </div>
    </GenUXModal>
  );
}
