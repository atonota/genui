import { useContext, type CSSProperties, type ReactNode } from 'react';
import { ConfigProvider, type InputProps } from 'antd';
import { inputPaddingInline } from '../data/input-surfaces';
import { genuxLength, useGenUXAppearance } from './GenUXAppearance';
import { GenUXSizeContext, genuxSizeProfiles, type GenUXSize } from './GenUXSizeProfile';

/** Native size and status follow the public AntD Input contract. */
type NativeSize = NonNullable<InputProps['size']>;
export type GenUXInputKind = 'text' | 'password' | 'textarea' | 'search' | 'number';
export type GenUXInputSize = GenUXSize | NativeSize;
export type GenUXInputStatus = NonNullable<InputProps['status']>;
export type GenUXInputVariant = NonNullable<InputProps['variant']>;

const sizeAliases: Record<GenUXInputSize, GenUXSize> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  small: 'sm',
  medium: 'md',
  middle: 'md',
  large: 'lg',
};
const nativeSizes: Record<GenUXSize, NativeSize> = { sm: 'small', md: 'middle', lg: 'large' };

function resolveSize(value: GenUXInputSize | undefined): GenUXSize | undefined {
  if (!value) return undefined;
  const size = sizeAliases[value];
  return genuxSizeProfiles.some(profile => profile.value === size) ? size : undefined;
}

export interface GenUXInputState {
  size: GenUXSize;
  nativeSize: NativeSize;
  status: GenUXInputStatus;
  disabled: boolean;
  readOnly: boolean;
}

/** Explicit props win; otherwise GenUX size context and AntD config are inherited.
    Form status reaches the native control's classes, which the stylesheet reads. */
export function useGenUXInputState({
  size,
  status,
  disabled,
  readOnly,
}: {
  size?: GenUXInputSize;
  status?: GenUXInputStatus;
  disabled?: boolean;
  readOnly?: boolean;
}): GenUXInputState {
  const contextSize = useContext(GenUXSizeContext);
  const { componentSize, componentDisabled } = ConfigProvider.useConfig();
  const resolved = resolveSize(size) ?? contextSize ?? resolveSize(componentSize) ?? 'md';
  return {
    size: resolved,
    nativeSize: nativeSizes[resolved],
    status: status ?? '',
    disabled: disabled ?? componentDisabled ?? false,
    readOnly: readOnly ?? false,
  };
}

/** Stable hook for the input stylesheet to reset legacy paint on native children. */
export const genuxNativeClassName = (className?: string) =>
  className ? `genux-input-native ${className}` : 'genux-input-native';

type FrameStyle = CSSProperties & Record<`--genux-input-${string}`, string>;

/** Single paint owner for the field well; native children keep semantics and refs.
    variant mirrors the native AntD variant; only underlined changes the well's rest edge. */
export default function GenUXInputFrame({
  kind,
  state,
  variant = 'filled',
  children,
}: {
  kind: GenUXInputKind;
  state: GenUXInputState;
  variant?: GenUXInputVariant;
  children: ReactNode;
}) {
  const appearance = useGenUXAppearance();
  /** Height comes from the shared size profiles; padding from the input surface model. */
  const height = genuxSizeProfiles.find(profile => profile.value === state.size)?.height_px;
  const style: FrameStyle = {
    '--genux-input-padding-inline': genuxLength(inputPaddingInline[state.size], appearance),
  };
  if (height != null) style['--genux-input-height'] = genuxLength(height, appearance);
  const Tag = kind === 'text' || kind === 'password' ? 'span' : 'div';
  return (
    <Tag
      className="genux-input-frame"
      data-genux-input={kind}
      data-size={state.size}
      data-variant={variant}
      data-status={state.status || undefined}
      data-disabled={state.disabled || undefined}
      data-readonly={state.readOnly || undefined}
      style={style}
    >
      {children}
    </Tag>
  );
}
