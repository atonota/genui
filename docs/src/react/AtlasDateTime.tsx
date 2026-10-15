import { useId, type CSSProperties, type ReactNode } from 'react';
import { DatePicker, TimePicker } from 'antd';
import type { DatePickerProps, RangePickerProps } from 'antd/es/date-picker';
import type { TimePickerProps, TimeRangePickerProps } from 'antd/es/time-picker';
import type { Dayjs } from 'dayjs';
import { atlasLength, useAtlasAppearance } from './AtlasAppearance';
import {
  useAtlasInputState,
  type AtlasInputSize,
  type AtlasInputState,
  type AtlasInputStatus,
} from './AtlasInputFrame';
import { atlasSizeProfiles } from './AtlasSizeProfile';
import { useI18n } from './useI18n';
import '../styles/atlas-date-time.css';

/** Atlas modes name the user's intent; `moment` and `time` map onto native AntD pickers. */
export type AtlasDateTimeMode = 'date' | 'week' | 'month' | 'quarter' | 'year' | 'moment' | 'time';
export type AtlasDateTimeRangeValue = [Dayjs | null, Dayjs | null] | null;
/** Multiple selection has no time part, so `moment` and `time` stay single or range only. */
export type AtlasDateTimeMultipleMode = Exclude<AtlasDateTimeMode, 'moment' | 'time'>;

/** Props the adapter resolves itself; every other native picker prop passes through. */
type AdapterOwned =
  | 'id'
  | 'mode'
  | 'value'
  | 'defaultValue'
  | 'onChange'
  | 'picker'
  | 'showTime'
  | 'multiple'
  | 'size'
  | 'status'
  | 'disabled'
  | 'readOnly'
  | 'inputReadOnly'
  | 'open'
  | 'variant'
  | 'bordered'
  | 'classNames'
  | 'styles'
  | 'popupClassName'
  | 'dropdownClassName'
  | 'popupStyle';

type FieldProps = {
  label: ReactNode;
  id?: string;
  help?: ReactNode;
  error?: ReactNode;
  mode?: AtlasDateTimeMode;
  size?: AtlasInputSize;
  status?: AtlasInputStatus;
  disabled?: boolean;
  /** Keeps the value visible and focusable while the panel stays closed and changes are ignored. */
  readOnly?: boolean;
};

type SingleChange = NonNullable<DatePickerProps<Dayjs, false>['onChange']>;
type RangeChange = NonNullable<RangePickerProps['onChange']>;
type MultipleChange = NonNullable<DatePickerProps<Dayjs, true>['onChange']>;

export type AtlasDateTimeProps = Omit<DatePickerProps<Dayjs, false>, AdapterOwned> &
  FieldProps & { value: Dayjs | null; onChange: SingleChange };
export type AtlasDateTimeRangeProps = Omit<RangePickerProps, AdapterOwned> &
  FieldProps & { value: AtlasDateTimeRangeValue; onChange: RangeChange };
export type AtlasDateTimeMultipleProps = Omit<DatePickerProps<Dayjs, true>, AdapterOwned> &
  Omit<FieldProps, 'mode'> & {
    mode?: AtlasDateTimeMultipleMode;
    value: Dayjs[] | null;
    onChange: MultipleChange;
  };

const popupClassNames = { popup: { root: 'atlas-date-time-popup atlas-control' } };
const ignoreChange = () => {};

/** Portal beside the field so scoped popup styles apply; only browsers call this. */
function popupContainer(trigger?: HTMLElement): HTMLElement {
  return trigger?.parentElement ?? (trigger?.ownerDocument ?? document).body;
}

/**
 * Native placements measured against the visible viewport, not the scrollable page.
 * With the popup bounded to half the remaining viewport in CSS, one side always fits after a flip.
 */
const popupOverflow = { adjustX: 1, adjustY: 1, shiftX: true, shiftY: true };
const popupPlacements: NonNullable<DatePickerProps['builtinPlacements']> = {
  bottomLeft: {
    points: ['tl', 'bl'],
    offset: [0, 4],
    overflow: popupOverflow,
    htmlRegion: 'visible',
  },
  bottomRight: {
    points: ['tr', 'br'],
    offset: [0, 4],
    overflow: popupOverflow,
    htmlRegion: 'visible',
  },
  topLeft: {
    points: ['bl', 'tl'],
    offset: [0, -4],
    overflow: popupOverflow,
    htmlRegion: 'visible',
  },
  topRight: {
    points: ['br', 'tr'],
    offset: [0, -4],
    overflow: popupOverflow,
    htmlRegion: 'visible',
  },
};

type DateMode = Exclude<AtlasDateTimeMode, 'time'>;
function pickerFor(mode: DateMode) {
  return mode === 'moment' ? { picker: 'date' as const, showTime: true } : { picker: mode };
}

type FieldControl = { fieldId: string; state: AtlasInputState; describedBy?: string };

function useFieldControl({ id, help, error, size, status, disabled, readOnly }: FieldProps) {
  const generatedId = useId();
  const fieldId = id ?? `atlas-date-time-${generatedId}`;
  const state = useAtlasInputState({
    size,
    status: status ?? (error ? 'error' : undefined),
    disabled,
    readOnly,
  });
  const describedBy =
    [
      state.readOnly ? `${fieldId}-readonly` : null,
      help ? `${fieldId}-help` : null,
      error ? `${fieldId}-error` : null,
    ]
      .filter(Boolean)
      .join(' ') || undefined;
  return { fieldId, state, describedBy };
}

/** Shared native props. inputReadOnly alone only stops typing; the closed panel keeps the value fixed. */
function nativeFieldProps(
  { fieldId, state }: FieldControl,
  allowClear: DatePickerProps['allowClear'],
  getPopupContainer: DatePickerProps['getPopupContainer'],
  builtinPlacements: DatePickerProps['builtinPlacements'],
) {
  return {
    id: fieldId,
    size: state.nativeSize,
    status: state.status || undefined,
    disabled: state.disabled,
    variant: 'filled' as const,
    classNames: popupClassNames,
    getPopupContainer: getPopupContainer ?? popupContainer,
    builtinPlacements: builtinPlacements ?? popupPlacements,
    allowClear: state.readOnly ? false : allowClear,
    ...(state.readOnly ? { open: false, inputReadOnly: true } : {}),
  };
}

type FieldStyle = CSSProperties & Record<`--atlas-date-time-${string}`, string>;

function FieldShell({
  field,
  mode,
  label,
  help,
  error,
  children,
}: {
  field: FieldControl;
  mode: AtlasDateTimeMode;
  label: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const appearance = useAtlasAppearance();
  const { fieldId, state, describedBy } = field;
  /** Height follows the shared size profiles, like the input frame. */
  const height = atlasSizeProfiles.find(profile => profile.value === state.size)?.height_px;
  const style: FieldStyle = {};
  if (height != null) style['--atlas-date-time-height'] = atlasLength(height, appearance);
  return (
    <div
      className="atlas-date-time"
      role="group"
      aria-labelledby={`${fieldId}-label`}
      aria-describedby={describedBy}
      data-atlas-date-time={mode}
      data-size={state.size}
      data-status={state.status || undefined}
      data-disabled={state.disabled || undefined}
      data-readonly={state.readOnly || undefined}
      style={style}
    >
      <label id={`${fieldId}-label`} className="atlas-date-time-label" htmlFor={fieldId}>
        {label}
      </label>
      <div className="atlas-date-time-control">{children}</div>
      {state.readOnly && (
        <p id={`${fieldId}-readonly`} className="atlas-date-time-help">
          {t('Read-only. The value is shown but cannot be changed.')}
        </p>
      )}
      {help && (
        <p id={`${fieldId}-help`} className="atlas-date-time-help">
          {help}
        </p>
      )}
      {error && (
        <p
          id={`${fieldId}-error`}
          className="atlas-date-time-error"
          aria-live="polite"
          aria-atomic="true"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/** Single native picker. Values and callbacks stay native Dayjs; no serialization happens here. */
export default function AtlasDateTime({
  label,
  id,
  help,
  error,
  mode = 'date',
  size,
  status,
  disabled,
  readOnly,
  value,
  onChange,
  allowClear,
  getPopupContainer,
  builtinPlacements,
  ...native
}: AtlasDateTimeProps) {
  const field = useFieldControl({ label, id, help, error, size, status, disabled, readOnly });
  const shared = nativeFieldProps(field, allowClear, getPopupContainer, builtinPlacements);
  const commit = field.state.readOnly ? ignoreChange : onChange;
  return (
    <FieldShell field={field} mode={mode} label={label} help={help} error={error}>
      {mode === 'time' ? (
        // Both pickers share rc-picker's single props; the differing semantic maps are adapter-owned.
        <TimePicker
          {...(native as unknown as TimePickerProps)}
          {...shared}
          value={value}
          onChange={commit}
        />
      ) : (
        <DatePicker<Dayjs>
          {...native}
          {...shared}
          {...pickerFor(mode)}
          value={value}
          onChange={commit}
        />
      )}
    </FieldShell>
  );
}

/** Native range picker; the callback fires only after AntD completes both endpoints. */
export function AtlasDateTimeRange({
  label,
  id,
  help,
  error,
  mode = 'date',
  size,
  status,
  disabled,
  readOnly,
  value,
  onChange,
  allowClear,
  getPopupContainer,
  builtinPlacements,
  ...native
}: AtlasDateTimeRangeProps) {
  const field = useFieldControl({ label, id, help, error, size, status, disabled, readOnly });
  const shared = nativeFieldProps(field, allowClear, getPopupContainer, builtinPlacements);
  const commit = field.state.readOnly ? ignoreChange : onChange;
  return (
    <FieldShell field={field} mode={mode} label={label} help={help} error={error}>
      {mode === 'time' ? (
        <TimePicker.RangePicker
          {...(native as unknown as TimeRangePickerProps)}
          {...shared}
          value={value}
          onChange={commit}
        />
      ) : (
        <DatePicker.RangePicker
          {...native}
          {...shared}
          {...pickerFor(mode)}
          value={value}
          onChange={commit}
        />
      )}
    </FieldShell>
  );
}

/**
 * Native multiple date picker; toggles stay a draft until AntD's own confirm reports the complete Dayjs list.
 * The installed picker skips confirmation by default, so `needConfirm` keeps the OK step explicit.
 */
export function AtlasDateTimeMultiple({
  label,
  id,
  help,
  error,
  mode = 'date',
  size,
  status,
  disabled,
  readOnly,
  value,
  onChange,
  allowClear,
  getPopupContainer,
  builtinPlacements,
  ...native
}: AtlasDateTimeMultipleProps) {
  const field = useFieldControl({ label, id, help, error, size, status, disabled, readOnly });
  const shared = nativeFieldProps(field, allowClear, getPopupContainer, builtinPlacements);
  const commit = field.state.readOnly ? ignoreChange : onChange;
  return (
    <FieldShell field={field} mode={mode} label={label} help={help} error={error}>
      <DatePicker<Dayjs, true>
        {...native}
        {...shared}
        picker={mode}
        multiple
        needConfirm
        value={value}
        onChange={commit}
      />
    </FieldShell>
  );
}
