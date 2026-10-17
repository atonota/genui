import GenUXButton, { type GenUXButtonProps } from './GenUXButton';
import type { GenUXIconName } from './GenUXIcon';

export type GenUXIconButtonProps = Omit<
  GenUXButtonProps,
  'text' | 'width' | 'position' | 'iconOnly' | 'icon'
> & {
  icon: GenUXIconName;
  'aria-label': string;
};

/** Named action with the shared Button geometry, states and native semantics. */
export default function GenUXIconButton(props: GenUXIconButtonProps) {
  return <GenUXButton {...props} width="content" iconOnly />;
}
