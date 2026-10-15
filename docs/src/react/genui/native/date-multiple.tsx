import { useMemo } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import type { DateTimeModel, DateUnit } from '../../../data/date-time-model';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { canonicalDates, dateSelectable } from '../../../genui/native/date-multiple';
import { AtlasDateTimeMultiple } from '../../AtlasDateTime';

const dayFormat = 'YYYY-MM-DD';

/** The model publishes Monday weeks and calendar period starts, whatever the picker locale. */
function anchor(day: Dayjs, unit: DateUnit): Dayjs {
  if (unit === 'week') return day.subtract((day.day() + 6) % 7, 'day');
  if (unit === 'month') return day.startOf('month');
  if (unit === 'quarter') {
    const month = day.startOf('month');
    return month.month(month.month() - (month.month() % 3));
  }
  if (unit === 'year') return day.startOf('year');
  return day;
}

/** Multiple date selection; values stay offset-free local dates and drafts only reach `onChange`. */
export default function DateMultipleNative({ data, disabled, onChange }: NativeAdapterProps) {
  const model = data as unknown as DateTimeModel;
  const unit = model.unit ?? 'date';
  const dates = model.value as readonly string[] | null;
  const value = useMemo(() => dates?.map(date => dayjs(date)) ?? null, [dates]);
  const selectable = useMemo(() => {
    const seen = new Map<string, boolean>();
    return (date: string) => {
      let allowed = seen.get(date);
      if (allowed === undefined) {
        allowed = dateSelectable(data, date);
        seen.set(date, allowed);
      }
      return allowed;
    };
  }, [data]);
  // Open on the model's dates rather than the host clock.
  const pickerStart = value?.[0] ?? (model.minDate ? dayjs(model.minDate) : undefined);
  return (
    <AtlasDateTimeMultiple
      label={model.label}
      mode={unit}
      help={model.help}
      error={model.error}
      status={model.status}
      disabled={disabled || model.disabled === true}
      readOnly={model.readOnly}
      value={value}
      defaultPickerValue={pickerStart}
      disabledDate={(current, info) => {
        // Coarser navigation panels stay usable; only the unit's own cells are judged.
        const panel = info?.type;
        if (panel && panel !== unit && !(unit === 'week' && panel === 'date')) return false;
        return !selectable(anchor(current, unit).format(dayFormat));
      }}
      onChange={next =>
        onChange(canonicalDates((next ?? []).map(day => anchor(day, unit).format(dayFormat))))
      }
    />
  );
}
