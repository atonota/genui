import { useId, useState } from 'react';
import { Checkbox, Radio } from 'antd';
import Input from '../AtlasInput';
import type { AtlasCardCallbacks, AtlasCardModel, CardMetric } from '../../data/card-model';
import {
  formatCardBytes,
  formatCardDelta,
  formatCardFact,
  formatCardMetric,
} from '../../data/card-projection';
import AtlasButton from '../AtlasButton';
import AtlasPill from '../AtlasPill';
import AtlasIcon from '../AtlasIcon';
import { useI18n } from '../useI18n';
import { AtlasCard, type CardAppearanceProps } from './AtlasCard';

export interface PurposeCardProps extends AtlasCardCallbacks, CardAppearanceProps {
  model: AtlasCardModel;
  /** Trusted host DOM identity for returning focus from a separate inspector. */
  primaryActionId?: string;
}

function MetricValue({ metric }: { metric: CardMetric }) {
  const { t, locale } = useI18n();
  const meanings = {
    positive: 'Favorable change',
    negative: 'Unfavorable change',
    neutral: 'Neutral change',
  };
  return (
    <div className="atlas-card-metric">
      <p className="atlas-card-metric-label">{t(metric.label)}</p>
      <p className="atlas-card-metric-value" data-card-metric-value>
        {t(formatCardMetric(metric, locale))}
      </p>
      <p className="atlas-card-metric-period">{t(metric.period)}</p>
      {metric.delta !== undefined && metric.delta !== null && (
        <p className="atlas-card-delta" data-card-delta-meaning={metric.meaning ?? 'neutral'}>
          <span>{formatCardDelta(metric.delta, locale)}</span>
          {metric.comparison && <span>{t(metric.comparison)}</span>}
          <span className="atlas-card-change-meaning">
            {t(meanings[metric.meaning ?? 'neutral'])}
          </span>
        </p>
      )}
    </div>
  );
}

function CardDetails({ heading, body }: { heading: string; body: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const { t } = useI18n();
  return (
    <div className="atlas-card-details">
      <AtlasButton
        text={t(heading)}
        fill="text"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(value => !value)}
      />
      <div
        id={id}
        className="atlas-card-details-panel"
        data-open={open}
        aria-hidden={!open}
        inert={!open}
      >
        <div>
          <p>{t(body)}</p>
        </div>
      </div>
    </div>
  );
}

/** Purpose-specific content shares one native surface; callbacks remain fully host owned. */
export function PurposeCard({
  model,
  primaryActionId,
  onAction,
  onSelectionChange,
  onMove,
  onFieldChange,
  ...appearance
}: PurposeCardProps) {
  const { t, locale } = useI18n();
  const localId = useId();
  const blocked = model.state === 'disabled' || model.state === 'loading';
  const primary = model.primaryAction;
  const actionBlocked =
    blocked ||
    (model.state === 'error' && primary?.intent !== 'retry') ||
    primary?.disabled ||
    !onAction;
  const secondary = model.secondaryActions?.slice(0, 4) ?? [];
  const mediaSymbols = {
    place: 'PL',
    vehicle: 'EV',
    person: 'PE',
    product: 'PR',
    document: 'DO',
    course: 'LE',
    media: 'ME',
  };
  const laneLabels = { planned: 'Planned', active: 'In progress', done: 'Done' };
  const selectionLabel = t('Select {title} ({id})', { title: t(model.title), id: model.id });
  const selection = model.selection ? (
    model.selection.mode === 'single' ? (
      <Radio
        name={model.selection.group}
        value={model.id}
        aria-label={selectionLabel}
        checked={model.selection.selected}
        disabled={blocked || !onSelectionChange}
        onChange={event => onSelectionChange?.(event.target.checked, model)}
      >
        {t('Select')}
      </Radio>
    ) : (
      <Checkbox
        checked={model.selection.selected}
        aria-label={selectionLabel}
        disabled={blocked || !onSelectionChange}
        onChange={event => onSelectionChange?.(event.target.checked, model)}
      >
        {t('Select')}
      </Checkbox>
    )
  ) : undefined;
  return (
    <AtlasCard
      {...appearance}
      title={t(model.title)}
      eyebrow={model.eyebrow ? t(model.eyebrow) : undefined}
      description={model.description ? t(model.description) : undefined}
      modelId={model.id}
      purpose={model.kind}
      state={model.state}
      stateMessage={model.stateMessage ? t(model.stateMessage) : undefined}
      selected={model.selection?.selected}
      layout={model.layout}
      density={model.density}
      header={
        (model.status || selection) && (
          <>
            {model.status && (
              <AtlasPill
                colorIndex={model.status.colorIndex}
                color={model.status.colorIndex === undefined ? model.status.tone : undefined}
              >
                {t(model.status.label)}
              </AtlasPill>
            )}
            {selection}
          </>
        )
      }
      media={
        model.media && (
          <div
            role="img"
            aria-label={t(model.media.label)}
            className="atlas-card-visual"
            data-card-media={model.media.kind}
          >
            <span aria-hidden="true">
              {model.media.kind === 'monogram'
                ? Array.from(model.media.label).slice(0, 3).join('').toUpperCase()
                : mediaSymbols[model.media.symbol ?? 'document']}
            </span>
            {model.media.kind === 'symbol' && (
              <span aria-hidden="true" className="atlas-card-visual-caption">
                {t(model.media.label)}
              </span>
            )}
          </div>
        )
      }
      body={
        <>
          {model.metric && <MetricValue metric={model.metric} />}
          {model.metrics && (
            <ul className="atlas-card-metrics" aria-label={t('Metrics')}>
              {model.metrics.map(metric => (
                <li key={metric.id}>
                  <MetricValue metric={metric} />
                </li>
              ))}
            </ul>
          )}
          {model.facts && (
            <dl className="atlas-card-facts">
              {model.facts.map(fact => (
                <div key={fact.key}>
                  <dt>{t(fact.label)}</dt>
                  <dd>{t(formatCardFact(fact, locale))}</dd>
                </div>
              ))}
            </dl>
          )}
          {model.pricing && (
            <div className="atlas-card-pricing">
              <p className="atlas-card-metric-value">
                {formatCardMetric(
                  {
                    value: model.pricing.amount,
                    currency: model.pricing.currency,
                    label: '',
                    period: '',
                  },
                  locale,
                )}{' '}
                <span className="atlas-card-price-interval">{t(model.pricing.interval)}</span>
              </p>
              <ul>
                {model.pricing.features.map(feature => (
                  <li key={feature}>{t(feature)}</li>
                ))}
              </ul>
            </div>
          )}
          {model.task && (
            <section
              className="atlas-card-task"
              aria-label={t('Task progress')}
              data-card-task={model.task.lane}
            >
              <p>
                {t('Priority')}:{' '}
                {t({ low: 'Low', normal: 'Normal', high: 'High' }[model.task.priority])} ·{' '}
                {t(laneLabels[model.task.lane])}
              </p>
              <label htmlFor={`${localId}-progress`}>
                {t('{completed} of {total} tasks complete', {
                  completed: model.task.completed,
                  total: model.task.total,
                })}
              </label>
              <progress
                id={`${localId}-progress`}
                max={Math.max(1, model.task.total)}
                value={Math.min(model.task.completed, model.task.total)}
              />
              <div className="atlas-card-task-moves">
                {(['planned', 'active', 'done'] as const).map(lane => (
                  <AtlasButton
                    key={lane}
                    fill="text"
                    text={t('Move to {lane}', { lane: t(laneLabels[lane]) })}
                    disabled={blocked || !onMove || lane === model.task?.lane}
                    onClick={() => onMove?.(lane, model)}
                  />
                ))}
              </div>
            </section>
          )}
          {model.items && (
            <ol className="atlas-card-items">
              {model.items.map(item => (
                <li key={item.id} data-card-item-state={item.state}>
                  <div>
                    <p>{t(item.title)}</p>
                    {item.detail && <p className="atlas-card-item-detail">{t(item.detail)}</p>}
                  </div>
                  {item.state && (
                    <span>
                      {t(
                        { pending: 'Pending', active: 'In progress', complete: 'Complete' }[
                          item.state
                        ],
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
          {model.fields && (
            <div className="atlas-card-fields" role="group" aria-label={t(model.title)}>
              {model.fields.map(field => (
                <div key={field.key}>
                  <label htmlFor={`${localId}-${field.key}`}>
                    {t(field.label)}
                    {field.required && <span> ({t('Required')})</span>}
                  </label>
                  <Input
                    id={`${localId}-${field.key}`}
                    variant="filled"
                    value={field.value}
                    required={field.required}
                    readOnly={field.readOnly}
                    disabled={blocked || (!field.readOnly && !onFieldChange)}
                    status={field.error ? 'error' : undefined}
                    aria-invalid={field.error ? true : undefined}
                    aria-describedby={
                      [
                        field.readOnly ? `${localId}-${field.key}-help` : undefined,
                        field.error ? `${localId}-${field.key}-error` : undefined,
                      ]
                        .filter(Boolean)
                        .join(' ') || undefined
                    }
                    onChange={event => {
                      if (!blocked && !field.readOnly)
                        onFieldChange?.(field.key, event.target.value, model);
                    }}
                    suffix={field.readOnly ? <AtlasIcon name="lock-simple" /> : undefined}
                  />
                  {field.readOnly && (
                    <p id={`${localId}-${field.key}-help`} className="atlas-card-item-detail">
                      {t('Read-only. You can select and copy this value.')}
                    </p>
                  )}
                  {field.error && (
                    <p
                      id={`${localId}-${field.key}-error`}
                      className="atlas-card-field-error"
                      role="alert"
                    >
                      {t(field.error)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          {model.file && (
            <dl className="atlas-card-facts">
              <div>
                <dt>{t('File')}</dt>
                <dd>{model.file.name}</dd>
              </div>
              <div>
                <dt>{t('Format')}</dt>
                <dd>{model.file.mime}</dd>
              </div>
              <div>
                <dt>{t('Size')}</dt>
                <dd>{formatCardBytes(model.file.sizeBytes, locale)}</dd>
              </div>
              {model.file.durationSeconds !== undefined && (
                <div>
                  <dt>{t('Duration')}</dt>
                  <dd>{t('{seconds} seconds', { seconds: model.file.durationSeconds })}</dd>
                </div>
              )}
            </dl>
          )}
          {model.connection && (
            <p className="atlas-card-connection">
              {t('Connection')}:{' '}
              {t(
                {
                  available: 'Available to connect',
                  connected: 'Connected by host',
                  unavailable: 'Unavailable',
                }[model.connection],
              )}
            </p>
          )}
          {model.details && <CardDetails {...model.details} />}
        </>
      }
      footer={
        (model.source ||
          (primary && actionBlocked) ||
          secondary.some(action => action.disabled && action.reason)) && (
          <>
            {model.source && (
              <div className="atlas-card-source" data-card-source>
                <p>
                  {t('Source')}: {t(model.source.label)}
                </p>
                <p>
                  {model.source.sourceId} ·{' '}
                  <time dateTime={model.source.observedAt}>
                    {formatCardFact(
                      {
                        key: 'observed',
                        label: '',
                        value: model.source.observedAt,
                        format: 'date',
                      },
                      locale,
                    )}
                  </time>{' '}
                  ·{' '}
                  {t(
                    { recorded: 'Recorded source', host: 'Host supplied', user: 'User supplied' }[
                      model.source.mode
                    ],
                  )}
                </p>
              </div>
            )}
            {primary && actionBlocked && (
              <p className="atlas-card-action-reason" id={`${localId}-primary-reason`}>
                {t(
                  primary.reason ??
                    (blocked || model.state === 'error'
                      ? 'This card is unavailable for changes.'
                      : primary.disabled
                        ? 'This action is unavailable.'
                        : 'No action handler is connected.'),
                )}
              </p>
            )}
            {secondary
              .filter(action => action.disabled && action.reason)
              .map(action => (
                <p
                  key={action.id}
                  id={`${localId}-${action.id}-reason`}
                  className="atlas-card-action-reason"
                >
                  {t(action.reason!)}
                </p>
              ))}
          </>
        )
      }
      actions={
        (primary || secondary.length > 0) && (
          <>
            {primary && (
              <AtlasButton
                id={primaryActionId}
                data-card-primary
                text={t(primary.label)}
                disabled={actionBlocked}
                aria-describedby={actionBlocked ? `${localId}-primary-reason` : undefined}
                onClick={() => onAction?.(primary, model)}
              />
            )}
            {secondary.map(action => (
              <AtlasButton
                key={action.id}
                data-card-secondary
                text={t(action.label)}
                fill="text"
                disabled={
                  blocked ||
                  (model.state === 'error' && action.intent !== 'retry') ||
                  action.disabled ||
                  !onAction
                }
                aria-describedby={
                  action.disabled && action.reason ? `${localId}-${action.id}-reason` : undefined
                }
                onClick={() => onAction?.(action, model)}
              />
            ))}
          </>
        )
      }
    />
  );
}

export function EntityCard(props: PurposeCardProps) {
  return <PurposeCard {...props} />;
}
export function MetricCard(props: PurposeCardProps) {
  return <PurposeCard {...props} />;
}
export default PurposeCard;
