import { useId, useRef, useState } from 'react';
import { Breadcrumb, Dropdown } from 'antd';
import AtlasIcon, { type AtlasIconName } from './AtlasIcon';

export type AtlasBreadcrumbDestination = {
  key: string;
  label: string;
  href: string;
};
export type AtlasBreadcrumbItem = {
  key: string;
  label: string;
  href?: string;
  icon?: AtlasIconName;
  iconOnly?: boolean;
  menuLabel?: string;
  menu?: readonly AtlasBreadcrumbDestination[];
};
export type AtlasBreadcrumbProps = {
  label: string;
  items: readonly AtlasBreadcrumbItem[];
};

function ItemLabel({ item }: { item: AtlasBreadcrumbItem }) {
  return (
    <>
      {item.icon && <AtlasIcon name={item.icon} />}
      {(!item.iconOnly || !item.icon) && <span>{item.label}</span>}
    </>
  );
}

function SiblingNavigation({
  item,
  currentKey,
}: {
  item: AtlasBreadcrumbItem;
  currentKey?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const label = item.menuLabel ?? item.label;
  return (
    <Dropdown
      trigger={['click']}
      placement="bottomLeft"
      align={{
        htmlRegion: 'visible',
        overflow: { adjustX: true, adjustY: true, shiftX: true, shiftY: true },
      }}
      open={open}
      onOpenChange={setOpen}
      autoFocus
      transitionName="atlas-breadcrumb-popup-motion"
      classNames={{ root: 'atlas-breadcrumb-popup' }}
      getPopupContainer={node => node.closest<HTMLElement>('.atlas-demo') ?? document.body}
      menu={{
        id,
        'aria-label': label,
        inert: !open,
        'aria-hidden': !open || undefined,
        onKeyDownCapture: event => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            trigger.current?.focus();
          } else if (
            (event.key === 'Enter' || event.key === ' ') &&
            !event.altKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.shiftKey &&
            event.target instanceof HTMLElement
          ) {
            // Native Menu initially focuses its li. Activating the contained
            // real link also works before the first arrow-key movement.
            const link = event.target
              .closest('[role="menuitem"]')
              ?.querySelector<HTMLAnchorElement>('a[href]');
            if (!link) return;
            event.preventDefault();
            event.stopPropagation();
            link.click();
          }
        },
        selectable: true,
        selectedKeys: currentKey ? [currentKey] : [],
        items: item.menu?.map(destination => ({
          key: destination.key,
          label: (
            <a
              href={destination.href}
              aria-current={destination.key === currentKey ? 'page' : undefined}
              tabIndex={-1}
            >
              {destination.label}
            </a>
          ),
        })),
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="atlas-breadcrumb-trigger atlas-control"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          } else if (event.key === 'Escape' && open) {
            event.preventDefault();
            setOpen(false);
          }
        }}
      >
        <AtlasIcon name="arrowRight" className="atlas-icon atlas-breadcrumb-chevron" />
      </button>
    </Dropdown>
  );
}

/** Native path navigation with explicit current-page and sibling-menu semantics. */
export default function AtlasBreadcrumb({ label, items }: AtlasBreadcrumbProps) {
  const currentKey = items.at(-1)?.key;
  return (
    <Breadcrumb
      className="atlas-breadcrumb-nav"
      aria-label={label}
      separator=""
      items={items.map(item => ({ key: item.key, title: item.label }))}
      itemRender={route => {
        const index = items.findIndex(candidate => candidate.key === route.key);
        const item = items[index];
        if (!item) return null;
        const current = item.key === currentKey;
        const content = <ItemLabel item={current ? { ...item, iconOnly: false } : item} />;
        // Each step owns its preceding separator so wrapping never orphans it.
        return (
          <span className="atlas-breadcrumb-step">
            {index > 0 && (
              <span className="ant-breadcrumb-separator" aria-hidden="true">
                <span aria-hidden="true">/</span>
              </span>
            )}
            <span className="atlas-breadcrumb-part">
              {current ? (
                <span className="atlas-breadcrumb-current" aria-current="page">
                  {content}
                </span>
              ) : item.href ? (
                <a
                  className="atlas-breadcrumb-link atlas-control"
                  href={item.href}
                  aria-label={item.iconOnly ? item.label : undefined}
                >
                  {content}
                </a>
              ) : (
                <span className="atlas-breadcrumb-label">{content}</span>
              )}
              {item.menu?.length ? <SiblingNavigation item={item} currentKey={currentKey} /> : null}
            </span>
          </span>
        );
      }}
    />
  );
}
