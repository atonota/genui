import GenUXButton, { type GenUXButtonProps } from './GenUXButton';

type WithoutShadow<Props> = Props extends unknown ? Omit<Props, 'shadow'> : never;
export type GenUXLayeredButtonProps = WithoutShadow<GenUXButtonProps>;

/** The approved 8px flat layer uses the same Button renderer and native semantics. */
export default function GenUXLayeredButton(props: GenUXLayeredButtonProps = {}) {
  return <GenUXButton {...props} shadow="layeredFlat8" />;
}
