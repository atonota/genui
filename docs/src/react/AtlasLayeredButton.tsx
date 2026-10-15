import AtlasButton, { type AtlasButtonProps } from './AtlasButton';

type WithoutShadow<Props> = Props extends unknown ? Omit<Props, 'shadow'> : never;
export type AtlasLayeredButtonProps = WithoutShadow<AtlasButtonProps>;

/** The approved 8px flat layer uses the same Button renderer and native semantics. */
export default function AtlasLayeredButton(props: AtlasLayeredButtonProps = {}) {
  return <AtlasButton {...props} shadow="layeredFlat8" />;
}
