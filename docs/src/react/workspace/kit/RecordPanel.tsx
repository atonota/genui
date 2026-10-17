import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { Drawer, Modal } from '../../GenUXOverlay';
import GenUXSlider from '../../GenUXSlider';
import GenUXButton from '../../GenUXButton';
import GenUXIcon from '../../GenUXIcon';
import { useI18n } from '../../useI18n';
import { RecordDisplay } from './RecordDisplay';
import { isReadableSurface, type RecordDisplayProps, type RecordIdentity } from './contracts';

export type RecordPanelContainer = 'page' | 'inline' | 'split' | 'modal' | 'drawer';
export type RecordReturnTrailItem = Readonly<{ id: string; label: string; onReturn?: () => void }>;
export type RecordPanelCloseReason = 'explicit' | 'escape' | 'mask' | 'navigate';
export type RecordPanelProps<R extends RecordIdentity> = Omit<RecordDisplayProps<R>, 'onClose'> &
  Readonly<{
    open: boolean;
    onClose: () => void;
    container: RecordPanelContainer;
    returnTrail?: readonly RecordReturnTrailItem[];
    returnFocusRef?: RefObject<HTMLElement | null>;
    fallbackFocusRef?: RefObject<HTMLElement | null>;
    closeGuard?: (reason: RecordPanelCloseReason) => boolean | 'allow' | 'block' | 'confirm';
    render?: (context: { requestClose: (reason?: RecordPanelCloseReason) => void }) => ReactNode;
    splitContent?: ReactNode;
  }>;
const overlay = (container: RecordPanelContainer) =>
  container === 'modal' || container === 'drawer';

/** Controlled presentation only. Callers keep record/draft identity and decide close policy. */
export function RecordPanel<R extends RecordIdentity>({
  open,
  onClose,
  container,
  returnTrail = [],
  returnFocusRef,
  fallbackFocusRef,
  closeGuard,
  render,
  splitContent,
  ...display
}: RecordPanelProps<R>) {
  const { t } = useI18n();
  const id = useId();
  const [renderedContainer, setRenderedContainer] = useState(container);
  const [switching, setSwitching] = useState(false);
  const [closeDecision, setCloseDecision] = useState<RecordPanelCloseReason | null>(null);
  const [closeBlocked, setCloseBlocked] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);
  const [sectionsByRecord, setSectionsByRecord] = useState<Record<string, string>>({});
  const desired = useRef({ open, container });
  desired.current = { open, container };
  const opener = useRef<HTMLElement | null>(null);
  const previousOpen = useRef(false);
  const overlayPresent = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const pendingHeadingFocus = useRef(false);
  const identity = display.record?.id ?? display.recordId ?? '';
  const previousIdentity = useRef(identity);
  const isOverlay = overlay(renderedContainer);
  const visible = open && !switching;
  if (isOverlay && visible) overlayPresent.current = true;
  const level = display.headingLevel ?? 3;
  const Heading = ('h' + level) as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  const canRead = display.record !== null && isReadableSurface(display.state);

  const restoreFocus = () => {
    const target = [returnFocusRef?.current, opener.current, fallbackFocusRef?.current].find(
      candidate =>
        candidate?.isConnected &&
        candidate !== document.body &&
        candidate !== document.documentElement,
    );
    if (target) {
      target.focus();
      return;
    }
    const fallback = document.querySelector<HTMLElement>('main h1, main h2, main, [role="main"]');
    if (!fallback) return;
    const previous = fallback.getAttribute('tabindex');
    fallback.setAttribute('tabindex', '-1');
    fallback.focus();
    fallback.addEventListener(
      'blur',
      () => {
        if (previous === null) fallback.removeAttribute('tabindex');
        else fallback.setAttribute('tabindex', previous);
      },
      { once: true },
    );
  };
  const requestAction = (reason: RecordPanelCloseReason, action: () => void) => {
    const decision = closeGuard?.(reason) ?? 'allow';
    setCloseBlocked(decision === false || decision === 'block');
    if (decision === false || decision === 'block') return;
    if (decision === 'confirm') {
      pendingAction.current = action;
      setCloseDecision(reason);
      return;
    }
    pendingAction.current = null;
    setCloseDecision(null);
    action();
  };
  const requestClose = (reason: RecordPanelCloseReason = 'explicit') =>
    requestAction(reason, onClose);
  useLayoutEffect(() => {
    if (open && !previousOpen.current) {
      opener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      pendingHeadingFocus.current = !isOverlay;
    }
    if (!open && previousOpen.current && !isOverlay) restoreFocus();
    if (!open) {
      setCloseDecision(null);
      setCloseBlocked(false);
    }
    previousOpen.current = open;
    if (container !== renderedContainer) {
      if (isOverlay && overlayPresent.current) setSwitching(true);
      else {
        setRenderedContainer(container);
        setSwitching(false);
        pendingHeadingFocus.current = open && !overlay(container);
      }
    }
    if (identity !== previousIdentity.current) {
      previousIdentity.current = identity;
      pendingAction.current = null;
      setCloseDecision(null);
      setCloseBlocked(false);
      if (open) heading.current?.focus();
    }
    if (visible && !isOverlay && pendingHeadingFocus.current) {
      pendingHeadingFocus.current = false;
      heading.current?.focus();
    }
  }, [open, container, renderedContainer, switching, identity]);

  const afterOpenChange = (shown: boolean) => {
    if (shown) return;
    overlayPresent.current = false;
    const next = desired.current;
    setSwitching(false);
    if (next.container !== renderedContainer) {
      setRenderedContainer(next.container);
      pendingHeadingFocus.current = next.open && !overlay(next.container);
    }
    if (!next.open) restoreFocus();
  };
  const nativeClose = (event?: { type?: string; target?: EventTarget | null }) => {
    const button = event?.target instanceof Element ? event.target.closest('button') : null;
    requestClose(event?.type === 'keydown' ? 'escape' : button ? 'explicit' : 'mask');
  };
  const confirmation = (
    <>
      {closeBlocked && <p role="status">{t('Closing is blocked by the supplied policy.')}</p>}
      {closeDecision && (
        <div className="kit-close-confirmation" role="alert">
          <p>
            {t(
              closeDecision === 'navigate'
                ? 'Unsaved changes remain. Discard them and continue?'
                : 'Unsaved changes remain. Discard them and close?',
            )}
          </p>
          <div className="kit-action-row">
            <GenUXButton
              text={t('Keep editing')}
              onClick={() => {
                pendingAction.current = null;
                setCloseDecision(null);
                heading.current?.focus();
              }}
            />
            <GenUXButton
              fill="text"
              text={t(closeDecision === 'navigate' ? 'Discard and continue' : 'Discard and close')}
              onClick={() => {
                const latest = closeGuard?.(closeDecision);
                if (latest === false || latest === 'block') {
                  setCloseBlocked(true);
                  return;
                }
                const action = pendingAction.current;
                pendingAction.current = null;
                setCloseDecision(null);
                action?.();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
  const body = (
    <div
      className="kit-records kit-record-panel-body"
      data-panel-shell={renderedContainer}
      data-panel-record={identity}
    >
      {canRead && (
        <p className="kit-caption" role="status" aria-live="polite" data-panel-identity="">
          {t('Now inspecting {record}', { record: identity })}
        </p>
      )}
      {canRead && returnTrail.length > 0 && (
        <nav aria-label={t('Record return trail')} className="kit-return-trail">
          <ol>
            {returnTrail.map((item, index) => (
              <li key={item.id + '-' + index}>
                {item.onReturn ? (
                  <GenUXButton
                    fill="text"
                    text={t('Return to {record}', { record: item.label })}
                    onClick={() => requestAction('navigate', item.onReturn!)}
                  />
                ) : (
                  <span>{item.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      {confirmation}
      {render && canRead ? (
        render({ requestClose })
      ) : (
        <RecordDisplay
          {...display}
          headingLevel={level}
          showHeading={false}
          returnContext={
            display.returnContext
              ? {
                  ...display.returnContext,
                  onReturn: () => requestAction('navigate', display.returnContext!.onReturn),
                }
              : undefined
          }
          navigation={
            display.navigation
              ? {
                  ...display.navigation,
                  onPrevious: display.navigation.onPrevious
                    ? () => requestAction('navigate', display.navigation!.onPrevious!)
                    : undefined,
                  onNext: display.navigation.onNext
                    ? () => requestAction('navigate', display.navigation!.onNext!)
                    : undefined,
                }
              : undefined
          }
          onOpenRelation={
            display.onOpenRelation
              ? intent => requestAction('navigate', () => display.onOpenRelation!(intent))
              : undefined
          }
          activeSection={display.activeSection ?? sectionsByRecord[identity]}
          onSectionChange={section => {
            if (display.activeSection === undefined)
              setSectionsByRecord(current => ({ ...current, [identity]: section }));
            display.onSectionChange?.(section);
          }}
          onClose={isOverlay ? undefined : () => requestClose()}
        />
      )}
    </div>
  );
  const panelTitle = (
    <Heading id={id + '-title'} ref={heading} tabIndex={-1} className="kit-panel-heading">
      {t(display.title ?? 'Record details')}
    </Heading>
  );
  if (renderedContainer === 'modal')
    return (
      <Modal
        rootClassName="genux-demo live-preview kit-record-panel-overlay"
        title={panelTitle}
        open={visible}
        onCancel={nativeClose}
        afterOpenChange={afterOpenChange}
        keyboard
        focusable={{ trap: true, focusTriggerAfterClose: false }}
        mask={{ closable: true }}
        closeIcon={<GenUXIcon name="x" />}
        closable={{ 'aria-label': t('Close record') }}
        destroyOnHidden={false}
        footer={null}
        width="min(var(--kit-record-panel-modal-width), calc(100vw - 2 * var(--space-sm)))"
      >
        {body}
      </Modal>
    );
  if (renderedContainer === 'drawer')
    return (
      <Drawer
        rootClassName="genux-demo live-preview kit-record-panel-overlay"
        title={panelTitle}
        open={visible}
        onClose={nativeClose}
        afterOpenChange={afterOpenChange}
        keyboard
        focusable={{ trap: true, focusTriggerAfterClose: false }}
        mask={{ closable: true }}
        closeIcon={<GenUXIcon name="x" />}
        closable={{ 'aria-label': t('Close record') }}
        destroyOnHidden={false}
        placement="right"
        size="min(var(--kit-record-panel-drawer-width), 100vw)"
      >
        {body}
      </Drawer>
    );
  return (
    <section
      className="kit-record-panel kit-disclosure"
      data-panel-container={renderedContainer}
      data-open={visible}
      inert={!visible}
      aria-hidden={!visible}
      aria-labelledby={id + '-title'}
    >
      <div className="kit-disclosure-clip">
        {panelTitle}
        <div className="kit-record-panel-layout" data-panel-container={renderedContainer}>
          {renderedContainer === 'split' && (
            <aside className="kit-record-split-context" aria-label={t('Record context')}>
              {splitContent ?? <p>{t('Record ID: {id}', { id: identity })}</p>}
            </aside>
          )}
          {body}
        </div>
      </div>
    </section>
  );
}

export type RecordTab = Readonly<{ id: string; label: string; pinned?: boolean }>;
export function RecordTabs({
  tabs,
  activeId,
  onActiveIdChange,
  onCloseTab,
  onPinnedChange,
  maxTabs = 6,
  panelId,
}: {
  tabs: readonly RecordTab[];
  activeId: string | null;
  onActiveIdChange: (id: string) => void;
  onCloseTab?: (id: string) => void;
  onPinnedChange?: (id: string, pinned: boolean) => void;
  maxTabs?: number;
  panelId?: string;
}) {
  const { t } = useI18n();
  const bounded = Number.isFinite(maxTabs) ? Math.max(1, Math.min(12, Math.floor(maxTabs))) : 6;
  const shown = tabs.slice(0, bounded);
  const active = tabs.find(tab => tab.id === activeId);
  if (active && !shown.includes(active)) shown[shown.length - 1] = active;
  return (
    <nav className="kit-record-tabs" aria-label={t('Open record tabs')}>
      <div role="tablist" aria-label={t('Inspected records')}>
        {shown.map((tab, index) => (
          <div className="kit-record-tab" key={tab.id}>
            <GenUXButton
              fill={tab.id === activeId ? 'solid' : 'ghost'}
              text={tab.label}
              role="tab"
              data-record-tab={tab.id}
              aria-selected={tab.id === activeId}
              aria-controls={tab.id === activeId ? panelId : undefined}
              tabIndex={
                tab.id === activeId || (!shown.some(item => item.id === activeId) && index === 0)
                  ? 0
                  : -1
              }
              onClick={() => onActiveIdChange(tab.id)}
              onKeyDown={event => {
                let next: number | undefined;
                if (event.key === 'ArrowRight') next = (index + 1) % shown.length;
                if (event.key === 'ArrowLeft') next = (index - 1 + shown.length) % shown.length;
                if (event.key === 'Home') next = 0;
                if (event.key === 'End') next = shown.length - 1;
                if (next === undefined) return;
                event.preventDefault();
                onActiveIdChange(shown[next].id);
                event.currentTarget
                  .closest('[role="tablist"]')
                  ?.querySelectorAll<HTMLElement>('[role="tab"]')
                  [next]?.focus();
              }}
            />
            {onPinnedChange && (
              <GenUXButton
                fill="text"
                text={t(tab.pinned ? 'Unpin {record}' : 'Pin {record}', { record: tab.label })}
                aria-pressed={Boolean(tab.pinned)}
                onClick={() => onPinnedChange(tab.id, !tab.pinned)}
              />
            )}
            {onCloseTab && (
              <GenUXButton
                fill="text"
                text={t('Close {record}', { record: tab.label })}
                disabled={tab.pinned}
                onClick={() => {
                  if (!tab.pinned) onCloseTab(tab.id);
                }}
              />
            )}
          </div>
        ))}
      </div>
      {tabs.length > bounded && (
        <p role="status">
          {t('Showing {count} of {total} open records.', { count: bounded, total: tabs.length })}
        </p>
      )}
    </nav>
  );
}

export function RecordInspector({
  children,
  pinned,
  onPinnedChange,
  width,
  onWidthChange,
  minWidth = 280,
  maxWidth = 720,
}: {
  children: ReactNode;
  pinned: boolean;
  onPinnedChange: (pinned: boolean) => void;
  width: number;
  onWidthChange: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
}) {
  const { t } = useI18n();
  const id = useId();
  const min = Number.isFinite(minWidth) ? Math.max(280, minWidth) : 280;
  const max = Number.isFinite(maxWidth) ? Math.max(min, maxWidth) : 720;
  const actual = Number.isFinite(width) ? Math.min(max, Math.max(min, width)) : min;
  return (
    <aside
      className="kit-record-inspector"
      data-pinned={pinned}
      aria-label={t('Record inspector')}
      style={{ '--kit-inspector-width': actual + 'px' } as CSSProperties}
    >
      <div className="kit-inspector-tools">
        <GenUXButton
          fill="text"
          text={t(pinned ? 'Unpin inspector' : 'Pin inspector')}
          aria-pressed={pinned}
          onClick={() => onPinnedChange(!pinned)}
        />
        <div className="kit-inspector-width">
          <p id={id}>{t('Inspector width')}</p>
          <GenUXSlider
            className="genux-control kit-inspector-resize"
            id={`${id}-control`}
            range={false}
            ariaLabelForHandle={t('Inspector width')}
            min={min}
            max={max}
            step={1}
            value={actual}
            ariaValueTextFormatterForHandle={value => t('{width} pixels', { width: value })}
            onChange={onWidthChange}
          />
        </div>
      </div>
      {children}
    </aside>
  );
}
export default RecordPanel;
