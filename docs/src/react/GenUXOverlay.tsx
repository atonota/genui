import {
  Drawer as NativeDrawer,
  Modal as NativeModal,
  type DrawerProps,
  type ModalProps,
} from 'antd';
import { TweakerOpenButton, useHasTweaker, useTweakerOpen } from './GenUXTweaker';
import { useGenUXAppearance } from './GenUXAppearance';
import { useCallback, useLayoutEffect, useRef, type AriaAttributes, type Ref } from 'react';

function useSuspendedPanel(
  suspended: boolean,
  forwarded: Ref<HTMLDivElement> | undefined,
  hidden: AriaAttributes['aria-hidden'],
) {
  const panel = useRef<HTMLDivElement | null>(null);
  const desired = useRef({ suspended, hidden });
  desired.current = { suspended, hidden };
  const apply = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      // Inert first: a suspended dialog must leave both focus and the AT tree.
      // panelRef is the public AntD6 panel handle; no structural DOM query needed.
      node.toggleAttribute('inert', desired.current.suspended);
      if (desired.current.suspended) node.setAttribute('aria-hidden', 'true');
      else if (desired.current.hidden === undefined) node.removeAttribute('aria-hidden');
      else node.setAttribute('aria-hidden', String(desired.current.hidden));
    }
  }, []);
  // Native motion may memoize the panel/ref while it stays open.
  useLayoutEffect(() => apply(panel.current), [suspended, hidden, apply]);
  return useCallback(
    (node: HTMLDivElement | null) => {
      panel.current = node;
      apply(node);
      if (typeof forwarded === 'function') return forwarded(node);
      if (forwarded) forwarded.current = node;
    },
    [forwarded, apply],
  );
}

/** The visible top dialog owns focus and Escape; example data remains mounted. */
export function Drawer(props: DrawerProps) {
  const hasContext = useHasTweaker();
  const hasTweaker = useGenUXAppearance() === 'docs' && hasContext;
  const open = useTweakerOpen();
  const suspended = hasTweaker && open;
  const panelRef = useSuspendedPanel(suspended, props.panelRef, props['aria-hidden']);
  if (!hasTweaker) return <NativeDrawer {...props} />;
  return (
    <NativeDrawer
      {...props}
      panelRef={panelRef}
      rootClassName={[props.rootClassName, props.open && !suspended ? 'genux-overlay-active' : '']
        .filter(Boolean)
        .join(' ')}
      focusable={
        suspended
          ? { ...props.focusable, trap: false, focusTriggerAfterClose: false }
          : props.focusable
      }
      autoFocus={suspended ? false : props.autoFocus}
      keyboard={suspended ? false : props.keyboard}
      extra={
        <>
          {props.extra}
          <TweakerOpenButton />
        </>
      }
    />
  );
}

export function Modal(props: ModalProps & Pick<AriaAttributes, 'aria-hidden'>) {
  const hasContext = useHasTweaker();
  const hasTweaker = useGenUXAppearance() === 'docs' && hasContext;
  const open = useTweakerOpen();
  const suspended = hasTweaker && open;
  const panelRef = useSuspendedPanel(suspended, props.panelRef, props['aria-hidden']);
  if (!hasTweaker) return <NativeModal {...props} />;
  return (
    <NativeModal
      {...props}
      panelRef={panelRef}
      rootClassName={[props.rootClassName, props.open && !suspended ? 'genux-overlay-active' : '']
        .filter(Boolean)
        .join(' ')}
      focusable={
        suspended
          ? { ...props.focusable, trap: false, focusTriggerAfterClose: false }
          : props.focusable
      }
      keyboard={suspended ? false : props.keyboard}
      title={
        <div className="genux-overlay-title">
          {props.title}
          <TweakerOpenButton />
        </div>
      }
    />
  );
}
