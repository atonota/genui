import { useId, useState, type ReactNode } from 'react';
import { Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import AtlasProvider from './AtlasProvider';
import AtlasDateTime, {
  AtlasDateTimeRange,
  type AtlasDateTimeMode,
  type AtlasDateTimeProps,
  type AtlasDateTimeRangeValue,
} from './AtlasDateTime';
import DataEntryCatalog, { DataEntryGrid, type DataEntrySection } from './DataEntryCatalog';
import DateRangeFilterExample from './DateRangeFilterExample';
import { TweakerSettings } from './AtlasTweaker';
import ExamplePreview from './ExamplePreview';
import { useI18n } from './useI18n';

/** Fixed sample reference keeps presets and server markup deterministic. */
const REFERENCE_TEXT = '2026-10-14';
const REFERENCE = dayjs(REFERENCE_TEXT);

/** Local wall formats; date-only values never pass through toISOString. */
const valueFormats: Record<AtlasDateTimeMode, string> = {
  date: 'YYYY-MM-DD',
  week: 'gggg-[W]ww',
  month: 'YYYY-MM',
  quarter: 'YYYY-[Q]Q',
  year: 'YYYY',
  moment: 'YYYY-MM-DD HH:mm [UTC]Z',
  time: 'HH:mm:ss',
};

const singleExamples = [
  { mode: 'date', title: 'Day', label: 'Delivery date', help: 'Choose one calendar day.' },
  {
    mode: 'week',
    title: 'Week',
    label: 'Sprint week',
    help: 'Choose a whole week. The result shows the week-based year and week number.',
  },
  {
    mode: 'month',
    title: 'Month',
    label: 'Billing month',
    help: 'Choose a month without a specific day.',
  },
  {
    mode: 'quarter',
    title: 'Quarter',
    label: 'Reporting quarter',
    help: 'Choose one of the four quarters of a year.',
  },
  {
    mode: 'year',
    title: 'Year',
    label: 'Fiscal year',
    help: 'Choose a year from the decade view.',
  },
] as const;

const momentExamples = [
  {
    mode: 'moment',
    title: 'Moment',
    label: 'Meeting start',
    help: 'Day and time in your local time zone. The result shows the UTC offset.',
  },
  {
    mode: 'time',
    title: 'Time',
    label: 'Daily reminder',
    help: 'Only the time of day is shown.',
  },
] as const;

const rangeExamples = [
  { mode: 'date', title: 'Day range', label: 'Stay dates', help: 'Check-in and check-out days.' },
  {
    mode: 'week',
    title: 'Week range',
    label: 'Sprint weeks',
    help: 'First and last week of the sprint.',
  },
  {
    mode: 'month',
    title: 'Month range',
    label: 'Billing months',
    help: 'First and last billing month.',
  },
  {
    mode: 'quarter',
    title: 'Quarter range',
    label: 'Reporting quarters',
    help: 'First and last reporting quarter.',
  },
  { mode: 'year', title: 'Year range', label: 'Fiscal years', help: 'First and last fiscal year.' },
  {
    mode: 'moment',
    title: 'Moment range',
    label: 'Maintenance window',
    help: 'Start and end moments, each with a time.',
  },
  {
    mode: 'time',
    title: 'Time range',
    label: 'Working hours',
    help: 'Choose the start and end time.',
  },
] as const;

/** Local sample fixtures; no calendar, sales or market service is consulted. */
const officeHolidays = new Set(['2026-10-29']);
const isWeekend = (day: Dayjs) => day.day() === 0 || day.day() === 6;
const isOffice = (day: Dayjs) => !isWeekend(day) && !officeHolidays.has(day.format('YYYY-MM-DD'));
const ordersOn = (day: Dayjs) => ((day.date() * 37 + (day.month() + 1) * 11) % 90) + 10;
const changeOn = (day: Dayjs) => (((day.date() * 53 + (day.month() + 1) * 7) % 41) - 20) / 10;

type CellRender = NonNullable<AtlasDateTimeProps['cellRender']>;
type CellNote = { text: string; trend?: 'up' | 'down' } | null;
const noteCells =
  (note: (day: Dayjs) => CellNote): CellRender =>
  (current, info) => {
    if (info.type !== 'date' || typeof current !== 'object') return info.originNode;
    const detail = note(current);
    return (
      <div className="ant-picker-cell-inner date-time-cell" data-trend={detail?.trend}>
        <span>{current.date()}</span>
        {detail && <span className="date-time-cell-note">{detail.text}</span>}
      </div>
    );
  };

function Example({
  title,
  result,
  resultFor,
  children,
}: {
  title: string;
  result: string;
  resultFor: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="date-time-example">
      <h4>{title}</h4>
      {children}
      <p className="date-time-result">
        <span>{t('Selected value')}</span> <output htmlFor={resultFor}>{result}</output>
      </p>
    </div>
  );
}

type Availability = 'editable' | 'readOnly' | 'disabled';

function DateTimeExamples() {
  const { locale, t } = useI18n();
  const id = useId();
  const [availability, setAvailability] = useState<Availability>('editable');
  const [singles, setSingles] = useState<Partial<Record<string, Dayjs | null>>>({});
  const [ranges, setRanges] = useState<Partial<Record<string, AtlasDateTimeRangeValue>>>({});
  const single = (key: string) => ({
    id: `${id}-${key}`,
    value: singles[key] ?? null,
    onChange: (next: Dayjs | null) => setSingles(current => ({ ...current, [key]: next })),
  });
  const range = (key: string) => ({
    id: `${id}-${key}`,
    value: ranges[key] ?? null,
    onChange: (next: AtlasDateTimeRangeValue) =>
      setRanges(current => ({ ...current, [key]: next })),
  });
  const show = (value: Dayjs | null | undefined, mode: AtlasDateTimeMode) =>
    value ? value.format(valueFormats[mode]) : t('Nothing selected');
  const showRange = (value: AtlasDateTimeRangeValue | undefined, mode: AtlasDateTimeMode) =>
    value
      ? t('{start} to {end}', {
          start: value[0] ? value[0].format(valueFormats[mode]) : t('Not chosen'),
          end: value[1] ? value[1].format(valueFormats[mode]) : t('Not chosen'),
        })
      : t('Nothing selected');
  const numbers = new Intl.NumberFormat(locale);
  const percents = new Intl.NumberFormat(locale, {
    style: 'percent',
    signDisplay: 'exceptZero',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const formatChange = (day: Dayjs) => percents.format(changeOn(day) / 100);
  const availabilityProps = {
    disabled: availability === 'disabled',
    readOnly: availability === 'readOnly',
  };
  const singlePresets = [
    { label: t('Yesterday'), value: REFERENCE.subtract(1, 'day') },
    { label: t('Last week'), value: REFERENCE.subtract(1, 'week') },
    { label: t('Last month'), value: REFERENCE.subtract(1, 'month') },
  ];
  const rangePresets = [7, 14, 30, 90].map(days => ({
    label: t('Last {count} days', { count: String(days) }),
    value: [REFERENCE.subtract(days - 1, 'day'), REFERENCE] as [Dayjs, Dayjs],
  }));
  const officeCells = noteCells(day =>
    officeHolidays.has(day.format('YYYY-MM-DD'))
      ? { text: t('Holiday') }
      : isWeekend(day)
        ? { text: t('Off') }
        : null,
  );
  const salesCells = noteCells(day => ({ text: numbers.format(ordersOn(day)) }));
  const financeCells = noteCells(day => {
    const change = changeOn(day);
    return {
      text: formatChange(day),
      trend: change > 0 ? 'up' : change < 0 ? 'down' : undefined,
    };
  });
  const sales = singles.sales ?? null;
  const trading = singles.finance ?? null;

  const sections: DataEntrySection[] = [
    {
      id: 'report-filter',
      title: t('Report date filter'),
      description: t(
        'Pick a shortcut or your own period, optionally compare it with another period, then apply. The sample report changes only when you apply.',
      ),
      content: (
        <ExamplePreview id="date-time-report-filter" title={t('Report date filter')}>
          <DataEntryGrid>
            <DateRangeFilterExample />
          </DataEntryGrid>
        </ExamplePreview>
      ),
    },
    {
      id: 'single',
      title: t('Single selections'),
      description: t(
        'Each picker opens the native calendar for its unit. Use Tweaker to compare editable, read-only and disabled fields.',
      ),
      content: (
        <ExamplePreview id="date-time-single" title={t('Single selections')}>
          <DataEntryGrid>
            {singleExamples.map(example => (
              <Example
                key={example.mode}
                title={t(example.title)}
                resultFor={`${id}-${example.mode}`}
                result={show(singles[example.mode], example.mode)}
              >
                <AtlasDateTime
                  {...single(example.mode)}
                  {...availabilityProps}
                  mode={example.mode}
                  label={t(example.label)}
                  help={t(example.help)}
                  defaultPickerValue={REFERENCE}
                />
              </Example>
            ))}
          </DataEntryGrid>
        </ExamplePreview>
      ),
    },
    {
      id: 'moment',
      title: t('Moments and time'),
      description: t(
        'A moment combines a calendar day with a time. Confirm the selection to commit it.',
      ),
      content: (
        <ExamplePreview id="date-time-moment" title={t('Moments and time')}>
          <DataEntryGrid>
            {momentExamples.map(example => (
              <Example
                key={example.mode}
                title={t(example.title)}
                resultFor={`${id}-${example.mode}`}
                result={show(singles[example.mode], example.mode)}
              >
                <AtlasDateTime
                  {...single(example.mode)}
                  mode={example.mode}
                  label={t(example.label)}
                  help={t(example.help)}
                  {...(example.mode === 'moment' ? { defaultPickerValue: REFERENCE } : {})}
                />
              </Example>
            ))}
          </DataEntryGrid>
        </ExamplePreview>
      ),
    },
    {
      id: 'range',
      title: t('Ranges'),
      description: t(
        'Choose a start, then an end. The value is committed only after both endpoints are chosen.',
      ),
      content: (
        <ExamplePreview id="date-time-range" title={t('Ranges')}>
          <DataEntryGrid>
            {rangeExamples.map(example => (
              <Example
                key={example.mode}
                title={t(example.title)}
                resultFor={`${id}-range-${example.mode}`}
                result={showRange(ranges[`range-${example.mode}`], example.mode)}
              >
                <AtlasDateTimeRange
                  {...range(`range-${example.mode}`)}
                  mode={example.mode}
                  label={t(example.label)}
                  help={t(example.help)}
                  {...(example.mode === 'time'
                    ? {}
                    : { defaultPickerValue: [REFERENCE, REFERENCE] })}
                />
              </Example>
            ))}
          </DataEntryGrid>
        </ExamplePreview>
      ),
    },
    {
      id: 'presets',
      title: t('Quick presets'),
      description: t(
        'Presets count back from the sample reference date {date}, so the examples stay the same on every visit.',
        { date: REFERENCE_TEXT },
      ),
      content: (
        <ExamplePreview id="date-time-presets" title={t('Quick presets')}>
          <DataEntryGrid>
            <Example
              title={t('Single preset')}
              resultFor={`${id}-preset`}
              result={show(singles.preset, 'date')}
            >
              <AtlasDateTime
                {...single('preset')}
                label={t('Report date')}
                help={t('Choose Yesterday, Last week or Last month, or pick any day.')}
                presets={singlePresets}
                defaultPickerValue={REFERENCE}
              />
            </Example>
            <Example
              title={t('Range presets')}
              resultFor={`${id}-preset-range`}
              result={showRange(ranges['preset-range'], 'date')}
            >
              <AtlasDateTimeRange
                {...range('preset-range')}
                label={t('Report period')}
                help={t('Choose a recent period or pick both endpoints.')}
                presets={rangePresets}
                defaultPickerValue={[REFERENCE, REFERENCE]}
              />
            </Example>
          </DataEntryGrid>
        </ExamplePreview>
      ),
    },
    {
      id: 'cells',
      title: t('Informative cells'),
      description: t(
        'Calendar cells can carry local sample data. Every marker is written as text, so meaning never depends on color alone.',
      ),
      content: (
        <ExamplePreview id="date-time-cells" title={t('Informative cells')}>
          <DataEntryGrid>
            <Example
              title={t('Office calendar')}
              resultFor={`${id}-office`}
              result={show(singles.office, 'date')}
            >
              <AtlasDateTime
                {...single('office')}
                label={t('Office day')}
                help={t('Weekends and the Republic Day holiday on 29 October are unavailable.')}
                cellRender={officeCells}
                disabledDate={day => !isOffice(day)}
                defaultPickerValue={REFERENCE}
              />
            </Example>
            <Example
              title={t('E-commerce')}
              resultFor={`${id}-sales`}
              result={
                sales
                  ? t('{date}: {count} orders', {
                      date: sales.format(valueFormats.date),
                      count: numbers.format(ordersOn(sales)),
                    })
                  : t('Nothing selected')
              }
            >
              <AtlasDateTime
                {...single('sales')}
                label={t('Sales day')}
                help={t('Each day shows its order count from a fixed local sample.')}
                cellRender={salesCells}
                defaultPickerValue={REFERENCE}
              />
            </Example>
            <Example
              title={t('Finance')}
              resultFor={`${id}-finance`}
              result={
                trading
                  ? t('{date}: {change}', {
                      date: trading.format(valueFormats.date),
                      change: formatChange(trading),
                    })
                  : t('Nothing selected')
              }
            >
              <AtlasDateTime
                {...single('finance')}
                label={t('Trading day')}
                help={t('Each day shows a sample daily change with its sign.')}
                cellRender={financeCells}
                defaultPickerValue={REFERENCE}
              />
            </Example>
          </DataEntryGrid>
        </ExamplePreview>
      ),
    },
  ];

  return (
    <div className="date-time-catalog" data-date-time-catalog>
      <TweakerSettings title="Date and time">
        <label className="playground-control" htmlFor={`${id}-availability`}>
          {t('Single selection availability')}
          <Select
            id={`${id}-availability`}
            data-date-time-availability
            value={availability}
            onChange={setAvailability}
            options={[
              { value: 'editable', label: t('Editable') },
              { value: 'readOnly', label: t('Read-only') },
              { value: 'disabled', label: t('Disabled') },
            ]}
          />
        </label>
      </TweakerSettings>
      <DataEntryCatalog slug="date-time" title={t('Date and time')} sections={sections} />
    </div>
  );
}

export default function DateTimeDemo({ documentation = false }: { documentation?: boolean } = {}) {
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined}>
      <DateTimeExamples />
    </AtlasProvider>
  );
}
