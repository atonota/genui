import dayjs, { type Dayjs } from 'dayjs';
import type { DatePickerProps } from 'antd/es/date-picker';
import type { DateTimeModel, DateUnit } from '../../../data/date-time-model';
import { definition } from '../../../genux/native/date-time';
import type { NativeAdapterProps } from '../../../genux/native-contract';
import GenUXDateTime, {
  GenUXDateTimeRange,
  type GenUXDateTimeMode,
  type GenUXDateTimeRangeValue,
} from '../../GenUXDateTime';

type Base = 'date' | 'time' | 'datetime';
/** Fixed carrier day for time-only wall times; only HH:mm:ss is ever read back. */
const timeCarrier = '2000-01-03';

const baseOf = (kind: DateTimeModel['kind']): Base =>
  kind.startsWith('datetime') ? 'datetime' : kind.startsWith('time') ? 'time' : 'date';

/** dayjs reads offset-free ISO text as local wall time; nothing converts to UTC or reads the clock. */
function toDayjs(text: string, base: Base): Dayjs {
  return dayjs(base === 'time' ? `${timeCarrier}T${text}` : text);
}

/** Model anchors: ISO Monday weeks and first days of month, quarter and year. */
function anchor(value: Dayjs, unit: DateUnit): Dayjs {
  const day = value.startOf('day');
  if (unit === 'week') return day.subtract((day.day() + 6) % 7, 'day');
  if (unit === 'month') return day.startOf('month');
  if (unit === 'quarter') {
    const month = day.startOf('month');
    return month.month(month.month() - (month.month() % 3));
  }
  if (unit === 'year') return day.startOf('year');
  return day;
}

function toText(value: Dayjs, base: Base, unit: DateUnit, showSeconds?: boolean): string {
  if (base === 'date') return anchor(value, unit).format('YYYY-MM-DD');
  const time = showSeconds === false ? value.second(0) : value;
  return time.format(base === 'time' ? 'HH:mm:ss' : 'YYYY-MM-DD[T]HH:mm:ss');
}

/** Mirrors the model: bounds and restrictions judge the anchor of the picked unit only. */
function blockedDate(model: DateTimeModel, unit: DateUnit) {
  const dates = new Set(model.disabledDates ?? []);
  const weekdays = new Set(model.disabledWeekdays ?? []);
  return (current: Dayjs, info?: { type?: string }): boolean => {
    // Other panels (a year grid in a date picker) only navigate; they never commit a value.
    if (info?.type && info.type !== unit && !(unit === 'week' && info.type === 'date'))
      return false;
    const day = anchor(current, unit);
    const text = day.format('YYYY-MM-DD');
    return (
      (model.minDate !== undefined && text < model.minDate) ||
      (model.maxDate !== undefined && text > model.maxDate) ||
      dates.has(text) ||
      weekdays.has(day.day())
    );
  };
}

/**
 * Trusted day cell renderer built from validated plain-text notes; no serialized function.
 * The native cell stays intact and the note is cell text, so it is read with its date.
 */
export function dateTimeCellRender(
  model: DateTimeModel,
): DatePickerProps<Dayjs, false>['cellRender'] {
  const notes = new Map((model.cellNotes ?? []).map(note => [note.date, note.label]));
  if (!notes.size) return undefined;
  return (current, info) => {
    if (info.type !== 'date' || !dayjs.isDayjs(current)) return info.originNode;
    const label = notes.get(current.format('YYYY-MM-DD'));
    if (label === undefined) return info.originNode;
    return (
      <>
        {info.originNode}
        <span className="genux-date-time-cell-note">{label}</span>
      </>
    );
  };
}

/** Controlled JSON DateTimeValue rendered through the existing GenUX date and time fields. */
export default function GenUXDateTimePicker({ data, disabled, onChange }: NativeAdapterProps) {
  const model = definition.parse(data) as unknown as DateTimeModel;
  const base = baseOf(model.kind);
  const unit = model.unit ?? 'date';
  const mode: GenUXDateTimeMode = base === 'time' ? 'time' : base === 'datetime' ? 'moment' : unit;
  const locked = disabled || model.disabled === true || model.readOnly === true;
  const text = (value: Dayjs) => toText(value, base, unit, model.showSeconds);
  const disabledDate = base === 'time' ? undefined : blockedDate(model, unit);
  const cellRender = dateTimeCellRender(model);

  if (model.kind.endsWith('-range')) {
    const [start, end] = (model.value as readonly string[] | null) ?? [];
    const value: GenUXDateTimeRangeValue =
      start && end ? [toDayjs(start, base), toDayjs(end, base)] : null;
    const presets = model.presets?.map(preset => {
      const [from, to] = preset.value as readonly string[];
      return {
        label: preset.label,
        value: [toDayjs(from!, base), toDayjs(to!, base)] as [Dayjs, Dayjs],
      };
    });
    return (
      <GenUXDateTimeRange
        label={model.label}
        help={model.help}
        error={model.error}
        mode={mode}
        status={model.status}
        disabled={locked}
        readOnly={model.readOnly === true}
        allowClear={model.required !== true}
        needConfirm={model.needConfirm}
        minuteStep={model.minuteStep}
        use12Hours={model.use12Hours}
        showSecond={model.showSeconds}
        disabledDate={disabledDate}
        cellRender={cellRender}
        presets={presets}
        value={value}
        onChange={(dates: GenUXDateTimeRangeValue) => {
          // Only a cleared field or a complete pair is a valid range value.
          if (!dates) onChange(null);
          else if (dates[0] && dates[1]) onChange([text(dates[0]), text(dates[1])]);
        }}
      />
    );
  }

  const presets = model.presets?.map(preset => ({
    label: preset.label,
    value: toDayjs(preset.value as string, base),
  }));
  return (
    <GenUXDateTime
      label={model.label}
      help={model.help}
      error={model.error}
      mode={mode}
      status={model.status}
      disabled={locked}
      readOnly={model.readOnly === true}
      allowClear={model.required !== true}
      needConfirm={model.needConfirm}
      minuteStep={model.minuteStep}
      use12Hours={model.use12Hours}
      showSecond={model.showSeconds}
      disabledDate={disabledDate}
      cellRender={cellRender}
      presets={presets}
      value={typeof model.value === 'string' ? toDayjs(model.value, base) : null}
      onChange={(date: Dayjs | null) => onChange(date ? text(date) : null)}
    />
  );
}
