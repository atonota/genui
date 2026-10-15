import { useI18n } from './useI18n';
import { useId, useRef, useState, type ComponentRef, type CSSProperties } from 'react';
import type { InputNumberProps } from 'antd';
import InputNumber from './AtlasInputNumber';
import * as decimalPackage from '@rc-component/mini-decimal';
import type { DecimalClass, ValueType } from '@rc-component/mini-decimal';
import AtlasSlotButton from './AtlasSlotButton';
import { useAtlasInputState } from './AtlasInputFrame';
import AtlasIcon from './AtlasIcon';
import { atlasSizeProfiles } from './AtlasSizeProfile';
import { atlasLength, useAtlasAppearance } from './AtlasAppearance';

// The installed package publishes ESM for bundlers and CommonJS for Node SSR.
const decimals =
  typeof decimalPackage.default === 'function'
    ? decimalPackage
    : (decimalPackage.default as unknown as typeof decimalPackage);
const { default: getMiniDecimal, getNumberPrecision, toFixed } = decimals;

export type NumberStepperProps = Omit<InputNumberProps, 'mode' | 'controls'> & {
  onRemove?: () => void;
};

function decimal(value: ValueType | null | undefined) {
  if (value === undefined || value === null) return null;
  const result = getMiniDecimal(value);
  return result.isInvalidate() ? null : result;
}

/** Native numeric editing with shared Atlas actions; removal is a separate intent. */
export default function NumberStepper({
  value,
  defaultValue,
  min = 1,
  max,
  step = 1,
  precision,
  stringMode,
  disabled,
  readOnly,
  size,
  onChange,
  onStep,
  onRemove,
  ...inputProps
}: NumberStepperProps) {
  const { t } = useI18n();
  const appearance = useAtlasAppearance();
  const helpId = useId();
  const input = useRef<ComponentRef<typeof InputNumber>>(null);
  // Explicit props win; otherwise the shared Atlas size context, then AntD config.
  const state = useAtlasInputState({ size, disabled, readOnly });
  const [localValue, setLocalValue] = useState<ValueType | null>(defaultValue ?? null);
  const currentValue = value === undefined ? localValue : value;
  const current = decimal(currentValue);
  const lower = decimal(min);
  const upper = decimal(max);
  const increment = decimal(step);
  const atMinimum = Boolean(current && lower && current.equals(lower));
  const belowMinimum = Boolean(current && lower && !lower.lessEquals(current));
  const atMaximum = Boolean(current && upper && upper.lessEquals(current));
  const invalidBounds = Boolean(lower && upper && !lower.lessEquals(upper));
  const blocked = Boolean(state.disabled || readOnly || invalidBounds);
  // Read-only stays selectable and must not paint as disabled.
  const frameDisabled = Boolean(state.disabled || invalidBounds);
  const profile = atlasSizeProfiles.find(item => item.value === state.size)!;
  const height = atlasLength(profile.height_px, appearance);
  // Resolve the field aliases on the same owner as the explicit native size.
  // Aliases inherited from the provider otherwise retain its resolved height.
  const sizeStyle = {
    '--atlas-input-height': height,
    '--atlas-component-height': height,
    '--field-height': height,
    '--control-height': height,
  } as CSSProperties;
  const downDisabled = blocked || !current || (atMinimum ? !onRemove : !increment || belowMinimum);
  const upDisabled = blocked || !increment || atMaximum;

  function commit(next: ValueType | null) {
    if (blocked) return;
    if (value === undefined) setLocalValue(next);
    onChange?.(next);
  }

  function clamp(candidate: DecimalClass) {
    if (upper && !candidate.lessEquals(upper)) return upper;
    if (lower && !lower.lessEquals(candidate)) return lower;
    return candidate;
  }

  function changeByStep(up: boolean) {
    if ((up ? upDisabled : downDisabled) || !increment) return;
    const offset = up ? increment : increment.negate();
    let next = clamp((current ?? getMiniDecimal(0)).add(offset.toString()));
    const digits =
      precision !== undefined && precision >= 0
        ? precision
        : Math.max(getNumberPrecision(next.toString()), getNumberPrecision(step));
    const unrounded = next.toString();
    const rounded = getMiniDecimal(toFixed(unrounded, '.', digits));
    // Follow AntD's rounding/cut fallback, then preserve bounds even when no
    // value at the requested precision exists inside a fractional interval.
    next = rounded.equals(clamp(rounded))
      ? rounded
      : getMiniDecimal(toFixed(unrounded, '.', digits, true));
    next = clamp(next);
    const nextValue = stringMode ? next.toString() : next.toNumber();
    if (!current || !next.equals(current)) commit(nextValue);
    onStep?.(nextValue, { offset: step, type: up ? 'up' : 'down', emitter: 'handler' });
    input.current?.focus();
  }

  function decreaseOrRemove() {
    if (downDisabled) return;
    if (atMinimum) onRemove?.();
    else changeByStep(false);
  }

  return (
    <div className="atlas-number-stepper-state">
      <div
        className="atlas-number-stepper atlas-input-frame"
        data-atlas-input="number"
        data-size={state.size}
        data-disabled={frameDisabled || undefined}
        data-readonly={readOnly || undefined}
        style={sizeStyle}
      >
        <AtlasSlotButton
          icon={atMinimum ? 'trash' : 'minus'}
          aria-label={atMinimum ? t('Remove') : t('Decrease')}
          state={downDisabled ? 'disabled' : 'default'}
          disabled={disabled}
          htmlType="button"
          onClick={decreaseOrRemove}
        />
        <InputNumber
          {...inputProps}
          ref={input}
          value={currentValue}
          min={min}
          max={max}
          step={step}
          precision={precision}
          stringMode={stringMode}
          disabled={disabled}
          readOnly={readOnly}
          aria-describedby={
            [inputProps['aria-describedby'], readOnly ? helpId : undefined]
              .filter(Boolean)
              .join(' ') || undefined
          }
          suffix={
            readOnly ? (
              <>
                {inputProps.suffix}
                <span className="atlas-readonly-indicator">
                  <AtlasIcon name="lock-simple" />
                </span>
              </>
            ) : (
              inputProps.suffix
            )
          }
          size={state.size}
          controls={false}
          mode="input"
          unframed
          onChange={commit}
          onStep={onStep}
        />
        <AtlasSlotButton
          icon="plus"
          aria-label={t('Increase')}
          state={upDisabled ? 'disabled' : 'default'}
          disabled={disabled}
          htmlType="button"
          onClick={() => changeByStep(true)}
        />
      </div>
      {readOnly && (
        <p id={helpId} className="atlas-readonly-help">
          {t('Read-only. You can select and copy this value.')}
        </p>
      )}
    </div>
  );
}
