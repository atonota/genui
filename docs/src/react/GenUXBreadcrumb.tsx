import { useId, useRef, useState } from 'react';
import { Breadcrumb, Dropdown } from 'antd';
import GenUXIcon, { type GenUXIconName } from './GenUXIcon';

export type GenUXBreadcrumbDestination = {
  key: string;
  label: string;
  href: string;
};
export type GenUXBreadcrumbItem = {
  key: string;
  label: string;
  href?: string;
  icon?: GenUXIconName;
  iconOnly?: boolean;
  menuLabel?: string;
  menu?: readonly GenUXBreadcrumbDestination[];
};
export type GenUXBreadcrumbProps = {
  label: string;
  items: readonly GenUXBreadcrumbItem[];
};

function ItemLabel({ item }: { item: GenUXBreadcrumbItem }) {
  return (
    <>
      {item.icon && <GenUXIcon name={item.icon} />}
      {(!item.iconOnly || !item.icon) && <span>{item.label}</span>}
    </>
  );
}

function SiblingNavigation({
  item,
  currentKey,
}: {
  item: GenUXBreadcrumbItem;
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
      transitionName="genux-breadcrumb-popup-motion"
      classNames={{ root: 'genux-breadcrumb-popup' }}
      getPopupContainer={node => node.closest<HTMLElement>('.genux-demo') ?? document.body}
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
        className="genux-breadcrumb-trigger genux-control"
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
        <GenUXIcon name="arrowRight" className="genux-icon genux-breadcrumb-chevron" />
      </button>
    </Dropdown>
  );
}

/** Native path navigation with explicit current-page and sibling-menu semantics. */
export default function GenUXBreadcrumb({ label, items }: GenUXBreadcrumbProps) {
  const currentKey = items.at(-1)?.key;
  return (
    <Breadcrumb
      className="genux-breadcrumb-nav"
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
          <span className="genux-breadcrumb-step">
            {index > 0 && (
              <span className="ant-breadcrumb-separator" aria-hidden="true">
                <span aria-hidden="true">/</span>
              </span>
            )}
            <span className="genux-breadcrumb-part">
              {current ? (
                <span className="genux-breadcrumb-current" aria-current="page">
                  {content}
                </span>
              ) : item.href ? (
                <a
                  className="genux-breadcrumb-link genux-control"
                  href={item.href}
                  aria-label={item.iconOnly ? item.label : undefined}
                >
                  {content}
                </a>
              ) : (
                <span className="genux-breadcrumb-label">{content}</span>
              )}
              {item.menu?.length ? <SiblingNavigation item={item} currentKey={currentKey} /> : null}
            </span>
          </span>
        );
      }}
    />
  );
}
