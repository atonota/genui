import type { ComponentProps } from 'react';
import { Input } from 'antd';
import { useI18n } from './useI18n';
import AtlasSlotButton from './AtlasSlotButton';
import AtlasInputFrame, {
  atlasNativeClassName,
  useAtlasInputState,
  type AtlasInputSize,
} from './AtlasInputFrame';

type Sized<P> = Omit<P, 'size'> & { size?: AtlasInputSize };
export type AtlasInputProps = Sized<ComponentProps<typeof Input>>;
export type AtlasPasswordProps = Sized<ComponentProps<typeof Input.Password>>;
export type AtlasTextAreaProps = Sized<ComponentProps<typeof Input.TextArea>>;
export type AtlasSearchProps = Sized<ComponentProps<typeof Input.Search>>;

function AtlasInputBase({
  size,
  status,
  disabled,
  readOnly,
  variant = 'filled',
  className,
  ...rest
}: AtlasInputProps) {
  const state = useAtlasInputState({ size, status, disabled, readOnly });
  return (
    <AtlasInputFrame kind="text" state={state} variant={variant}>
      <Input
        {...rest}
        className={atlasNativeClassName(className)}
        size={state.nativeSize}
        status={status}
        disabled={disabled}
        readOnly={readOnly}
        variant={variant}
      />
    </AtlasInputFrame>
  );
}

function AtlasPassword({
  size,
  status,
  disabled,
  readOnly,
  variant = 'filled',
  className,
  ...rest
}: AtlasPasswordProps) {
  const state = useAtlasInputState({ size, status, disabled, readOnly });
  return (
    <AtlasInputFrame kind="password" state={state} variant={variant}>
      <Input.Password
        {...rest}
        className={atlasNativeClassName(className)}
        size={state.nativeSize}
        status={status}
        disabled={disabled}
        readOnly={readOnly}
        variant={variant}
      />
    </AtlasInputFrame>
  );
}

function AtlasTextArea({
  size,
  status,
  disabled,
  readOnly,
  variant = 'filled',
  className,
  ...rest
}: AtlasTextAreaProps) {
  const state = useAtlasInputState({ size, status, disabled, readOnly });
  return (
    <AtlasInputFrame kind="textarea" state={state} variant={variant}>
      <Input.TextArea
        {...rest}
        className={atlasNativeClassName(className)}
        size={state.nativeSize}
        status={status}
        disabled={disabled}
        readOnly={readOnly}
        variant={variant}
      />
    </AtlasInputFrame>
  );
}

function AtlasSearch({
  size,
  status,
  disabled,
  readOnly,
  variant = 'filled',
  className,
  enterButton,
  ...rest
}: AtlasSearchProps) {
  const { t } = useI18n();
  const state = useAtlasInputState({ size, status, disabled, readOnly });
  // The default action is a real slot button; Input.Search keeps onSearch and Enter.
  const action = enterButton ?? (
    <AtlasSlotButton icon="search" aria-label={t('Search')} disabled={disabled} />
  );
  return (
    <AtlasInputFrame kind="search" state={state} variant={variant}>
      <Input.Search
        {...rest}
        enterButton={action}
        className={atlasNativeClassName(className)}
        size={state.nativeSize}
        status={status}
        disabled={disabled}
        readOnly={readOnly}
        variant={variant}
      />
    </AtlasInputFrame>
  );
}

const AtlasInput = Object.assign(AtlasInputBase, {
  Password: AtlasPassword,
  TextArea: AtlasTextArea,
  Search: AtlasSearch,
});

export default AtlasInput;
