import type { MenuProps } from 'antd';
import GenUXDropdown from './GenUXDropdown';
import GenUXIcon, { type GenUXIconName } from './GenUXIcon';

export type GenUXRichMenuItem = {
  id: string;
  label: string;
  description: string;
  icon?: GenUXIconName;
  disabled?: boolean;
};

export type GenUXRichMenuGroup = {
  id: string;
  label: string;
  items: GenUXRichMenuItem[];
};

export type GenUXRichMenuProps = {
  label: string;
  groups: GenUXRichMenuGroup[];
  onAction: (id: string) => void;
};

/** Grouped actions with descriptions; GenUXDropdown keeps the native menu, focus and dismissal. */
export default function GenUXRichMenu({ label, groups, onAction }: GenUXRichMenuProps) {
  const items: NonNullable<MenuProps['items']> = groups.map(group => ({
    type: 'group' as const,
    key: group.id,
    label: group.label,
    children: group.items.map(item => ({
      key: item.id,
      disabled: item.disabled,
      label: (
        <span className="genux-rich-menu-item" data-rich-menu-item={item.id}>
          {item.icon && (
            <span className="genux-rich-menu-icon" aria-hidden="true">
              <GenUXIcon name={item.icon} className="genux-icon" />
            </span>
          )}
          <span className="genux-rich-menu-text">
            <span className="genux-rich-menu-title">{item.label}</span>{' '}
            <span className="genux-rich-menu-description">{item.description}</span>
          </span>
        </span>
      ),
    })),
  }));
  return (
    <GenUXDropdown
      label={label}
      items={items}
      onAction={onAction}
      classNames={{ root: 'genux-rich-menu-popup' }}
    />
  );
}
