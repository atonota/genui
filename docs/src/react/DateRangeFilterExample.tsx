import { useId, useState } from 'react';
import { Checkbox, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import GenUXButton from './GenUXButton';
import { GenUXDateTimeRange, type GenUXDateTimeRangeValue } from './GenUXDateTime';
import { useI18n } from './useI18n';

/** Fixed sample sync date keeps presets and server markup deterministic. */
const LAST_SYNC_TEXT = '2026-10-14';
const LAST_SYNC = dayjs(LAST_SYNC_TEXT);
const ISO = 'YYYY-MM-DD';

type Preset = 'last7' | 'last30' | 'today' | 'custom';
type Period = [Dayjs, Dayjs];

/** Inclusive periods counted back from the last sync. */
const presetPeriods: Record<Exclude<Preset, 'custom'>, Period> = {
  last7: [LAST_SYNC.subtract(6, 'day'), LAST_SYNC],
  last30: [LAST_SYNC.subtract(29, 'day'), LAST_SYNC],
  today: [LAST_SYNC, LAST_SYNC],
};

/** Same inclusive length, ending the day before the period starts. */
const previousPeriod = ([start, end]: Period): Period => {
  const days = end.diff(start, 'day') + 1;
  return [start.subtract(days, 'day'), start.subtract(1, 'day')];
};

const isAfterSync = (day: Dayjs) => day.isAfter(LAST_SYNC, 'day');

/** Complete, ordered and not after the last sync; otherwise null. */
const completePeriod = (value: GenUXDateTimeRangeValue): Period | null => {
  const [start, end] = value ?? [null, null];
  return start && end && !start.isAfter(end, 'day') && !isAfterSync(end) ? [start, end] : null;
};

const periodKey = (value: GenUXDateTimeRangeValue) => {
  const [start, end] = value ?? [null, null];
  return `${start?.format(ISO) ?? ''}/${end?.format(ISO) ?? ''}`;
};

type Filter = {
  preset: Preset;
  period: GenUXDateTimeRangeValue;
  compare: boolean;
  comparison: GenUXDateTimeRangeValue;
  comparisonEdited: boolean;
};

const initialFilter: Filter = {
  preset: 'last7',
  period: presetPeriods.last7,
  compare: false,
  comparison: previousPeriod(presetPeriods.last7),
  comparisonEdited: false,
};

/** An untouched comparison follows the previous period of the same length. */
const withPeriod = (filter: Filter, period: GenUXDateTimeRangeValue, preset: Preset): Filter => {
  const complete = completePeriod(period);
  return {
    ...filter,
    preset,
    period,
    comparison: !filter.comparisonEdited && complete ? previousPeriod(complete) : filter.comparison,
  };
};

/** Every field that shapes later behavior counts, even while comparison is off:
    re-enabling restores the kept dates and comparisonEdited stops auto-follow. */
const isPending = (draft: Filter, applied: Filter) =>
  draft.preset !== applied.preset ||
  periodKey(draft.period) !== periodKey(applied.period) ||
  draft.compare !== applied.compare ||
  periodKey(draft.comparison) !== periodKey(applied.comparison) ||
  draft.comparisonEdited !== applied.comparisonEdited;

/** Draft filter: nothing reaches the sample report until Apply; Cancel restores the applied filter. */
export function DateRangeFilterExample() {
  const { locale, t } = useI18n();
  const id = useId();
  const [applied, setApplied] = useState<Filter>(initialFilter);
  const [draft, setDraft] = useState<Filter>(initialFilter);

  const periodReady = completePeriod(draft.period) !== null;
  const comparisonReady = !draft.compare || completePeriod(draft.comparison) !== null;
  const ready = periodReady && comparisonReady;
  const pending = isPending(draft, applied);
  const hint = !periodReady
    ? t('Choose a start and an end date to apply.')
    : !comparisonReady
      ? t('Choose both comparison dates to apply.')
      : pending
        ? t('Changes are not applied yet.')
        : null;

  const showPeriod = (value: GenUXDateTimeRangeValue) => {
    const [start, end] = value ?? [null, null];
    return t('{start} to {end}', {
      start: start ? start.format(ISO) : t('Not chosen'),
      end: end ? end.format(ISO) : t('Not chosen'),
    });
  };
  const result = applied.compare
    ? t('{period}, compared with {comparison}', {
        period: showPeriod(applied.period),
        comparison: showPeriod(applied.comparison),
      })
    : showPeriod(applied.period);
  const lastSync = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(
    LAST_SYNC.toDate(),
  );
  const placeholder: [string, string] = [t('Start date'), t('End date')];

  const apply = () => {
    if (ready) setApplied(draft);
  };
  const cancel = () => setDraft(applied);

  return (
    <div className="date-range-filter" data-date-range-filter>
      <p className="date-range-filter-sync">
        <span>{t('Sample data available through')}</span>{' '}
        <time dateTime={LAST_SYNC_TEXT}>{lastSync}</time>
      </p>
      <div className="date-range-filter-field">
        <label htmlFor={`${id}-preset`}>{t('Date range shortcut')}</label>
        <Select
          id={`${id}-preset`}
          data-filter-preset
          value={draft.preset}
          onChange={(preset: Preset) =>
            setDraft(current =>
              preset === 'custom'
                ? { ...current, preset }
                : withPeriod(current, presetPeriods[preset], preset),
            )
          }
          options={[
            { value: 'last7', label: t('Last {count} days', { count: '7' }) },
            { value: 'last30', label: t('Last {count} days', { count: '30' }) },
            { value: 'today', label: t('Latest available day') },
            { value: 'custom', label: t('Custom') },
          ]}
        />
      </div>
      <GenUXDateTimeRange
        id={`${id}-period`}
        mode="date"
        label={t('Report period')}
        help={t('Pick the start, then the end. Days after the last sync are unavailable.')}
        placeholder={placeholder}
        allowClear
        value={draft.period}
        onChange={(next: GenUXDateTimeRangeValue) =>
          setDraft(current => withPeriod(current, next, 'custom'))
        }
        disabledDate={isAfterSync}
        defaultPickerValue={[LAST_SYNC, LAST_SYNC]}
      />
      <div className="date-range-filter-compare" data-filter-compare>
        <Checkbox
          checked={draft.compare}
          onChange={event => setDraft(current => ({ ...current, compare: event.target.checked }))}
        >
          {t('Compare with another period')}
        </Checkbox>
      </div>
      {draft.compare && (
        <GenUXDateTimeRange
          id={`${id}-comparison`}
          mode="date"
          label={t('Comparison period')}
          help={t('Starts as the previous period of the same length. You can change it.')}
          placeholder={placeholder}
          allowClear
          value={draft.comparison}
          onChange={(next: GenUXDateTimeRangeValue) =>
            setDraft(current => ({ ...current, comparison: next, comparisonEdited: true }))
          }
          disabledDate={isAfterSync}
          defaultPickerValue={[LAST_SYNC, LAST_SYNC]}
        />
      )}
      <div className="date-range-filter-actions">
        <GenUXButton
          text={t('Apply')}
          fill="solid"
          data-filter-apply
          disabled={!ready}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onClick={apply}
        />
        <GenUXButton
          text={t('Cancel')}
          fill="outline"
          data-filter-cancel
          disabled={!pending}
          onClick={cancel}
        />
        {hint && (
          <p id={`${id}-hint`} className="date-range-filter-hint">
            {hint}
          </p>
        )}
      </div>
      <p className="date-time-result">
        <span>{t('Applied report period')}</span>{' '}
        <output data-date-filter-result aria-live="polite" htmlFor={`${id}-period`}>
          {result}
        </output>
      </p>
    </div>
  );
}

export default DateRangeFilterExample;
