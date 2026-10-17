import GenUXButton, { type GenUXButtonProps } from './GenUXButton';
import type { GenUXIconName } from './GenUXIcon';

export type GenUXSlotButtonProps = Omit<
  GenUXButtonProps,
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
  icon: GenUXIconName;
  'aria-label': string;
  /** Class a host such as Input.Search assigns to its action. */
  className?: string;
};

/** Field-well action on the shared Button renderer: flat, transparent and sized
    by the owning frame's --slot-size and --slot-radius roles. */
export default function GenUXSlotButton({ className, ...props }: GenUXSlotButtonProps) {
  return (
    <GenUXButton
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
GenUXSlotButton.__ANT_BUTTON = true;
