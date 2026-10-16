import type { ComponentProps } from 'react';
import { InputNumber } from 'antd';
import type { InputNumberProps } from 'antd';
import AtlasInputFrame, {
  atlasNativeClassName,
  useAtlasInputState,
  type AtlasInputSize,
} from './AtlasInputFrame';

type NativeInputNumberRef = ComponentProps<typeof InputNumber>['ref'];

export type AtlasInputNumberProps<T extends number | string = number | string> = Omit<
  InputNumberProps<T>,
  'size'
> & {
  size?: AtlasInputSize;
  ref?: NativeInputNumberRef;
  /** Internal: an outer owner such as NumberStepper paints the single well. */
  unframed?: boolean;
};

export default function AtlasInputNumber<T extends number | string = number | string>({
  size,
  status,
  disabled,
  readOnly,
  variant = 'filled',
  className,
  unframed = false,
  ref,
  ...rest
}: AtlasInputNumberProps<T>) {
  const state = useAtlasInputState({ size, status, disabled, readOnly });
  const control = (
    <InputNumber<T>
      {...rest}
      ref={ref}
      className={atlasNativeClassName(className)}
      size={state.nativeSize}
      status={status}
      disabled={disabled}
      readOnly={readOnly}
      variant={variant}
    />
  );
  if (unframed) return control;
  return (
    <AtlasInputFrame kind="number" state={state} variant={variant}>
      {control}
    </AtlasInputFrame>
  );
}
