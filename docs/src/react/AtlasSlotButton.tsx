import AtlasButton, { type AtlasButtonProps } from './AtlasButton';
import type { AtlasIconName } from './AtlasIcon';

export type AtlasSlotButtonProps = Omit<
  AtlasButtonProps,
  | 'text'
  | 'width'
  | 'position'
  | 'iconOnly'
  | 'icon'
  | 'fill'
  | 'depth'
  | 'shadow'
  | 'border'
  | 'slotted'
  | 'slotClassName'
> & {
  icon: AtlasIconName;
  'aria-label': string;
  /** Class a host such as Input.Search assigns to its action. */
  className?: string;
};

/** Field-well action on the shared Button renderer: flat, transparent and sized
    by the owning frame's --slot-size and --slot-radius roles. */
export default function AtlasSlotButton({ className, ...props }: AtlasSlotButtonProps) {
  return (
    <AtlasButton
      {...props}
      width="content"
      fill="text"
      depth="flat"
      shadow="none"
      border="none"
      iconOnly
      slotted
      slotClassName={className}
    />
  );
}

// AntD hosts such as Input.Search clone Button-compatible actions instead of
// nesting them in a second native button; this renders an AntD Button.
AtlasSlotButton.__ANT_BUTTON = true;
