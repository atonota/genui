import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from 'react';
import { Button, Dropdown, type DropdownProps, type GetRef, type MenuProps } from 'antd';
import GenUXIcon from './GenUXIcon';

export type GenUXDropdownProps = {
  label: string;
  items: NonNullable<MenuProps['items']>;
  onAction: (key: string) => void;
  classNames?: DropdownProps['classNames'];
  styles?: DropdownProps['styles'];
};

function withPopupClasses(items: NonNullable<MenuProps['items']>): NonNullable<MenuProps['items']> {
  return items.map(item => {
    if (!item || !('children' in item)) return item;
    if (item.type === 'group') return { ...item, children: withPopupClasses(item.children ?? []) };
    return {
      ...item,
      popupClassName: `genux-dropdown-subpopup ${item.popupClassName ?? ''}`.trim(),
      children: withPopupClasses(item.children),
    };
  });
}

const POPUP_MOTION_NAME = 'genux-dropdown-popup-motion';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// The global reduced-motion stylesheet sets `animation: none`, so the native CSS
// motion never receives animationend and a closed popup would stay in its
// leave-active phase forever. Disable the framework motion itself while the
// preference matches. The store is SSR-safe and follows live media changes.
function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}
function getReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}
function getServerReducedMotion() {
  return false;
}

/** Native action menus; navigation destinations remain Breadcrumb's responsibility. */
export default function GenUXDropdown({
  label,
  items,
  onAction,
  classNames,
  styles,
}: GenUXDropdownProps) {
  const id = useId();
  const trigger = useRef<GetRef<typeof Button>>(null);
  const [open, setOpen] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    getServerReducedMotion,
  );
  // AntD returns an explicit empty transitionName unchanged, and rc-motion treats
  // an empty motionName as "no motion": show/hide is synchronous and the popup's
  // `-hidden` leaved class applies immediately. The nested Menu motion shares the
  // same name so submenus never strand in leave-active either.
  const popupMotionName = reducedMotion ? '' : POPUP_MOTION_NAME;
  // Native autoFocus schedules an uncancelled frame that can focus the hidden
  // menu after a fast close. The public popup wrapper ref is re-attached whenever
  // `open` changes, so the owned root menu's first enabled item is focused
  // synchronously on visible mount/open and never when closed. Lookup is scoped
  // to the owned menu id, so native hidden measurement and submenus are skipped.
  const focusMenu = useCallback(
    (popup: HTMLElement | null) => {
      if (!open || !popup) return;
      const menu = popup.ownerDocument.getElementById(id);
      if (!menu || !popup.contains(menu)) return;
      const first = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
        item =>
          item.closest('[role="menu"]') === menu && item.getAttribute('aria-disabled') !== 'true',
      );
      (first ?? menu).focus({ preventScroll: true });
    },
    [open, id],
  );
  useEffect(() => {
    if (!open) return;
    let frame: number | undefined;
    const reconcileVisibility = () => {
      frame = undefined;
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return;
      const owned =
        document.getElementById(id)?.contains(active) ||
        active.closest<HTMLElement>('[data-genux-dropdown-owner]')?.dataset.genuxDropdownOwner ===
          id;
      if (!owned) return;
      const rect = active.getBoundingClientRect();
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const right = left + (viewport?.width ?? window.innerWidth);
      const bottom = top + (viewport?.height ?? window.innerHeight);
      if (rect.left < left || rect.right > right || rect.top < top || rect.bottom > bottom) {
        // Keep the same native focus/open submenu while revealing its anchor.
        // Native Trigger realigns both portal layers in response to the scroll.
        trigger.current?.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
          behavior: 'instant',
        });
      }
    };
    const scheduleVisibility = () => {
      if (frame === undefined) frame = window.requestAnimationFrame(reconcileVisibility);
    };
    window.addEventListener('resize', scheduleVisibility);
    window.visualViewport?.addEventListener('resize', scheduleVisibility);
    return () => {
      window.removeEventListener('resize', scheduleVisibility);
      window.visualViewport?.removeEventListener('resize', scheduleVisibility);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [open, id]);
  const close = () => {
    setOpen(false);
    setOpenKeys([]);
    trigger.current?.focus();
  };
  const handlePopupKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (
      (event.key === ' ' || event.key === 'Enter') &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      event.target instanceof HTMLElement
    ) {
      const item = event.target.closest<HTMLElement>('[role="menuitem"]');
      if (!item || item.getAttribute('aria-disabled') === 'true') return;
      // Submenu titles keep native Enter so it opens the next level.
      if (event.key === 'Enter' && item.hasAttribute('aria-haspopup')) return;
      // Cancel leaf activation before close() refocuses the trigger, which
      // would otherwise receive the same Enter and reopen the menu.
      event.preventDefault();
      event.stopPropagation();
      item.click();
    }
  };
  const mergedClassNames: DropdownProps['classNames'] =
    typeof classNames === 'function'
      ? info => {
          const value = classNames(info) ?? {};
          return { ...value, root: `genux-dropdown-popup ${value.root ?? ''}`.trim() };
        }
      : { ...classNames, root: `genux-dropdown-popup ${classNames?.root ?? ''}`.trim() };
  return (
    <Dropdown
      trigger={['click']}
      open={open}
      onOpenChange={value => {
        setOpen(value);
        if (!value) setOpenKeys([]);
      }}
      autoFocus={false}
      placement="bottomLeft"
      align={{
        htmlRegion: 'visible',
        overflow: { adjustX: true, adjustY: true, shiftX: true, shiftY: true },
      }}
      transitionName={popupMotionName}
      getPopupContainer={node => node.closest<HTMLElement>('.genux-demo') ?? document.body}
      classNames={mergedClassNames}
      styles={styles}
      popupRender={node => (
        <div ref={focusMenu} inert={!open} aria-hidden={!open || undefined}>
          {node}
        </div>
      )}
      menu={{
        id,
        'aria-label': label,
        inert: !open,
        'aria-hidden': !open || undefined,
        onKeyDownCapture: handlePopupKey,
        items: withPopupClasses(items),
        selectable: false,
        openKeys,
        onOpenChange: setOpenKeys,
        triggerSubMenuAction: 'click',
        builtinPlacements: {
          rightTop: {
            points: ['tl', 'tr'],
            overflow: { adjustX: true, adjustY: true, shiftX: true, shiftY: true },
          },
          leftTop: {
            points: ['tr', 'tl'],
            overflow: { adjustX: true, adjustY: true, shiftX: true, shiftY: true },
          },
        },
        subMenuOpenDelay: 0,
        subMenuCloseDelay: 0,
        motion: { motionName: popupMotionName },
        getPopupContainer: node => node.closest<HTMLElement>('.genux-demo') ?? document.body,
        expandIcon: <GenUXIcon name="arrowRight" />,
        popupRender: (node, info) => {
          const visible = open && info.keys.every(key => openKeys.includes(key));
          return (
            <div
              data-genux-dropdown-owner={id}
              inert={!visible}
              aria-hidden={!visible || undefined}
              onKeyDownCapture={handlePopupKey}
            >
              {node}
            </div>
          );
        },
        onClick: info => {
          onAction(info.key);
          close();
        },
      }}
    >
      <Button
        ref={trigger}
        type="text"
        className="genux-dropdown-trigger genux-control"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          } else if (event.key === 'Escape' && open) {
            event.preventDefault();
            close();
          }
        }}
      >
        <span>{label}</span>
        <GenUXIcon name="arrowRight" className="genux-icon genux-dropdown-chevron" />
      </Button>
    </Dropdown>
  );
}
