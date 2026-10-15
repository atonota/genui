import AtlasButton, { type AtlasButtonProps } from './AtlasButton';
import type { AtlasIconName } from './AtlasIcon';

export type AtlasIconButtonProps = Omit<
  AtlasButtonProps,
  'text' | 'width' | 'position' | 'iconOnly' | 'icon'
> & {
  icon: AtlasIconName;
  'aria-label': string;
};

/** Named action with the shared Button geometry, states and native semantics. */
export default function AtlasIconButton(props: AtlasIconButtonProps) {
  return <AtlasButton {...props} width="content" iconOnly />;
}
