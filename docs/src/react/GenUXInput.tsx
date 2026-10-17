import type { ComponentProps } from 'react';
import { Input } from 'antd';
import { useI18n } from './useI18n';
import GenUXSlotButton from './GenUXSlotButton';
import GenUXInputFrame, {
  genuxNativeClassName,
  useGenUXInputState,
  type GenUXInputSize,
} from './GenUXInputFrame';

type Sized<P> = Omit<P, 'size'> & { size?: GenUXInputSize };
export type GenUXInputProps = Sized<ComponentProps<typeof Input>>;
export type GenUXPasswordProps = Sized<ComponentProps<typeof Input.Password>>;
export type GenUXTextAreaProps = Sized<ComponentProps<typeof Input.TextArea>>;
export type GenUXSearchProps = Sized<ComponentProps<typeof Input.Search>>;

function GenUXInputBase({
  size,
  status,
  disabled,
  readOnly,
  variant = 'filled',
  className,
  ...rest
}: GenUXInputProps) {
  const state = useGenUXInputState({ size, status, disabled, readOnly });
  return (
    <GenUXInputFrame kind="text" state={state} variant={variant}>
      <Input
        {...rest}
        className={genuxNativeClassName(className)}
        size={state.nativeSize}
        status={status}
        disabled={disabled}
        readOnly={readOnly}
        variant={variant}
      />
    </GenUXInputFrame>
  );
}

function GenUXPassword({
  size,
  status,
  disabled,
  readOnly,
  variant = 'filled',
  className,
  ...rest
}: GenUXPasswordProps) {
  const state = useGenUXInputState({ size, status, disabled, readOnly });
  return (
    <GenUXInputFrame kind="password" state={state} variant={variant}>
      <Input.Password
        {...rest}
        className={genuxNativeClassName(className)}
        size={state.nativeSize}
        status={status}
        disabled={disabled}
        readOnly={readOnly}
        variant={variant}
      />
    </GenUXInputFrame>
  );
}

function GenUXTextArea({
  size,
  status,
  disabled,
  readOnly,
  variant = 'filled',
  className,
  ...rest
}: GenUXTextAreaProps) {
  const state = useGenUXInputState({ size, status, disabled, readOnly });
  return (
    <GenUXInputFrame kind="textarea" state={state} variant={variant}>
      <Input.TextArea
        {...rest}
        className={genuxNativeClassName(className)}
        size={state.nativeSize}
        status={status}
        disabled={disabled}
        readOnly={readOnly}
        variant={variant}
      />
    </GenUXInputFrame>
  );
}

function GenUXSearch({
  size,
  status,
  disabled,
  readOnly,
  variant = 'filled',
  className,
  enterButton,
  ...rest
}: GenUXSearchProps) {
  const { t } = useI18n();
  const state = useGenUXInputState({ size, status, disabled, readOnly });
  // The default action is a real slot button; Input.Search keeps onSearch and Enter.
  const action = enterButton ?? (
    <GenUXSlotButton icon="search" aria-label={t('Search')} disabled={disabled} />
  );
  return (
    <GenUXInputFrame kind="search" state={state} variant={variant}>
      <Input.Search
        {...rest}
        enterButton={action}
        className={genuxNativeClassName(className)}
        size={state.nativeSize}
        status={status}
        disabled={disabled}
        readOnly={readOnly}
        variant={variant}
      />
    </GenUXInputFrame>
  );
}

const GenUXInput = Object.assign(GenUXInputBase, {
  Password: GenUXPassword,
  TextArea: GenUXTextArea,
  Search: GenUXSearch,
});

export default GenUXInput;
