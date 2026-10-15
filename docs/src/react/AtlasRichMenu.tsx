import type { MenuProps } from 'antd';
import AtlasDropdown from './AtlasDropdown';
import AtlasIcon, { type AtlasIconName } from './AtlasIcon';

export type AtlasRichMenuItem = {
  id: string;
  label: string;
  description: string;
  icon?: AtlasIconName;
  disabled?: boolean;
};

export type AtlasRichMenuGroup = {
  id: string;
  label: string;
  items: AtlasRichMenuItem[];
};

export type AtlasRichMenuProps = {
  label: string;
  groups: AtlasRichMenuGroup[];
  onAction: (id: string) => void;
};

/** Grouped actions with descriptions; AtlasDropdown keeps the native menu, focus and dismissal. */
export default function AtlasRichMenu({ label, groups, onAction }: AtlasRichMenuProps) {
  const items: NonNullable<MenuProps['items']> = groups.map(group => ({
    type: 'group' as const,
    key: group.id,
    label: group.label,
    children: group.items.map(item => ({
      key: item.id,
      disabled: item.disabled,
      label: (
        <span className="atlas-rich-menu-item" data-rich-menu-item={item.id}>
          {item.icon && (
            <span className="atlas-rich-menu-icon" aria-hidden="true">
              <AtlasIcon name={item.icon} className="atlas-icon" />
            </span>
          )}
          <span className="atlas-rich-menu-text">
            <span className="atlas-rich-menu-title">{item.label}</span>{' '}
            <span className="atlas-rich-menu-description">{item.description}</span>
          </span>
        </span>
      ),
    })),
  }));
  return (
    <AtlasDropdown
      label={label}
      items={items}
      onAction={onAction}
      classNames={{ root: 'atlas-rich-menu-popup' }}
    />
  );
}
