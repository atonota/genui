import { useId } from 'react';
import { Select } from 'antd';
import GenUXButton from '../../GenUXButton';
import { useI18n } from '../../useI18n';
import { StateSurface } from './StateSurface';
import type { SurfaceState } from './contracts';
import { entityOptionLabel } from '../../../data/field-kit';
import { normalizeSearch } from '../../../i18n';

export type EntityOption = Readonly<{
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
}>;
export type EntityPickerProps = Readonly<{
  id?: string;
  label: string;
  value: string | null;
  options: readonly EntityOption[];
  onChange: (id: string | null) => void;
  state?: SurfaceState;
  onOpen?: (id: string) => void;
  onCreate?: () => void;
  disabled?: boolean;
  error?: string;
  required?: boolean;
}>;

export function EntityPicker({
  id,
  label,
  value,
  options,
  onChange,
  state = { kind: 'ready' },
  onOpen,
  onCreate,
  disabled = false,
  error,
  required = false,
}: EntityPickerProps) {
  const { t } = useI18n();
  const generatedId = useId();
  const controlId = id ?? `${generatedId}-entity`;
  const blocked = disabled || ['loading', 'denied', 'error', 'unknown'].includes(state.kind);
  const values = options.map(option => ({
    value: option.id,
    label: entityOptionLabel(option, t),
    disabled: option.disabled,
  }));
  if (value !== null && !options.some(option => option.id === value))
    values.unshift({ value, label: `${t('Unavailable relation')} · ${value}`, disabled: true });
  return (
    <div className="kit-records kit-entity-picker">
      <label htmlFor={controlId}>{t(label)}</label>
      <Select
        id={controlId}
        value={value ?? null}
        options={values}
        onChange={next => onChange(next ?? null)}
        allowClear
        disabled={blocked}
        loading={state.kind === 'loading'}
        showSearch={{
          filterOption: (input, option) =>
            normalizeSearch(String(option?.label ?? '')).includes(normalizeSearch(input)),
        }}
        status={error ? 'error' : undefined}
        aria-invalid={Boolean(error)}
        aria-required={required}
        aria-describedby={error ? `${controlId}-error` : undefined}
        notFoundContent={t(
          state.kind === 'no-match'
            ? 'No matching relations.'
            : 'No related records are available.',
        )}
      />
      {error && (
        <p id={`${controlId}-error`} aria-live="polite" aria-atomic="true">
          {t(error)}
        </p>
      )}
      <StateSurface
        state={
          state.kind === 'ready' && options.length === 0
            ? { kind: 'empty', message: 'No related records are available.' }
            : state
        }
      />
      <div className="kit-action-row">
        {onOpen && (
          <GenUXButton
            fill="text"
            text={t('Open related record')}
            disabled={value === null || blocked}
            onClick={() => {
              if (value !== null) onOpen(value);
            }}
          />
        )}
        {onCreate && (
          <GenUXButton
            fill="text"
            text={t('Create related record')}
            disabled={blocked}
            onClick={onCreate}
          />
        )}
      </div>
      <p className="kit-caption">
        {t(
          'The stored value is a record ID. Labels may change or repeat without changing the relationship.',
        )}
      </p>
    </div>
  );
}
export default EntityPicker;
