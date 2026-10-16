import { useContext, type CSSProperties, type ReactNode } from 'react';
import { ConfigProvider, type InputProps } from 'antd';
import { inputPaddingInline } from '../data/input-surfaces';
import { atlasLength, useAtlasAppearance } from './AtlasAppearance';
import { AtlasSizeContext, atlasSizeProfiles, type AtlasSize } from './AtlasSizeProfile';

/** Native size and status follow the public AntD Input contract. */
type NativeSize = NonNullable<InputProps['size']>;
export type AtlasInputKind = 'text' | 'password' | 'textarea' | 'search' | 'number';
export type AtlasInputSize = AtlasSize | NativeSize;
export type AtlasInputStatus = NonNullable<InputProps['status']>;
export type AtlasInputVariant = NonNullable<InputProps['variant']>;

const sizeAliases: Record<AtlasInputSize, AtlasSize> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  small: 'sm',
  medium: 'md',
  middle: 'md',
  large: 'lg',
};
const nativeSizes: Record<AtlasSize, NativeSize> = { sm: 'small', md: 'middle', lg: 'large' };

function resolveSize(value: AtlasInputSize | undefined): AtlasSize | undefined {
  if (!value) return undefined;
  const size = sizeAliases[value];
  return atlasSizeProfiles.some(profile => profile.value === size) ? size : undefined;
}

export interface AtlasInputState {
  size: AtlasSize;
  nativeSize: NativeSize;
  status: AtlasInputStatus;
  disabled: boolean;
  readOnly: boolean;
}

/** Explicit props win; otherwise Atlas size context and AntD config are inherited.
    Form status reaches the native control's classes, which the stylesheet reads. */
export function useAtlasInputState({
  size,
  status,
  disabled,
  readOnly,
}: {
  size?: AtlasInputSize;
  status?: AtlasInputStatus;
  disabled?: boolean;
  readOnly?: boolean;
}): AtlasInputState {
  const contextSize = useContext(AtlasSizeContext);
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
export const atlasNativeClassName = (className?: string) =>
  className ? `atlas-input-native ${className}` : 'atlas-input-native';

type FrameStyle = CSSProperties & Record<`--atlas-input-${string}`, string>;

/** Single paint owner for the field well; native children keep semantics and refs.
    variant mirrors the native AntD variant; only underlined changes the well's rest edge. */
export default function AtlasInputFrame({
  kind,
  state,
  variant = 'filled',
  children,
}: {
  kind: AtlasInputKind;
  state: AtlasInputState;
  variant?: AtlasInputVariant;
  children: ReactNode;
}) {
  const appearance = useAtlasAppearance();
  /** Height comes from the shared size profiles; padding from the input surface model. */
  const height = atlasSizeProfiles.find(profile => profile.value === state.size)?.height_px;
  const style: FrameStyle = {
    '--atlas-input-padding-inline': atlasLength(inputPaddingInline[state.size], appearance),
  };
  if (height != null) style['--atlas-input-height'] = atlasLength(height, appearance);
  const Tag = kind === 'text' || kind === 'password' ? 'span' : 'div';
  return (
    <Tag
      className="atlas-input-frame"
      data-atlas-input={kind}
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
