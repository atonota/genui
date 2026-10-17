import type { ComponentProps } from 'react';
import { InputNumber } from 'antd';
import type { InputNumberProps } from 'antd';
import GenUXInputFrame, {
  genuxNativeClassName,
  useGenUXInputState,
  type GenUXInputSize,
} from './GenUXInputFrame';

type NativeInputNumberRef = ComponentProps<typeof InputNumber>['ref'];

export type GenUXInputNumberProps<T extends number | string = number | string> = Omit<
  InputNumberProps<T>,
  'size'
> & {
  size?: GenUXInputSize;
  ref?: NativeInputNumberRef;
  /** Internal: an outer owner such as NumberStepper paints the single well. */
  unframed?: boolean;
};

export default function GenUXInputNumber<T extends number | string = number | string>({
  size,
  status,
  disabled,
  readOnly,
  variant = 'filled',
  className,
  unframed = false,
  ref,
  ...rest
}: GenUXInputNumberProps<T>) {
  const state = useGenUXInputState({ size, status, disabled, readOnly });
  const control = (
    <InputNumber<T>
      {...rest}
      ref={ref}
      className={genuxNativeClassName(className)}
      size={state.nativeSize}
      status={status}
      disabled={disabled}
      readOnly={readOnly}
      variant={variant}
    />
  );
  if (unframed) return control;
  return (
    <GenUXInputFrame kind="number" state={state} variant={variant}>
      {control}
    </GenUXInputFrame>
  );
}
