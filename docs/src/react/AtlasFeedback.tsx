import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Key,
  type ReactNode,
} from 'react';
import {
  Alert,
  Popconfirm,
  message,
  notification,
  type GetRef,
  type ModalProps,
  type PopconfirmProps,
} from 'antd';
import AtlasIcon from './AtlasIcon';
import { Modal } from './AtlasOverlay';
import { useI18n } from './useI18n';
import { layerOrder } from '../theme-builder/states';
import { AtlasPopupScopeContext, type AtlasPopupScope } from './AtlasPortalScope';

export type AtlasFeedbackStatus = 'info' | 'success' | 'warning' | 'error';

// Phosphor core 2.1.1, regular weight; the existing /licenses/ page carries its MIT notice.
// https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/regular/info.svg
// https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/regular/check-circle.svg
// https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/regular/warning.svg
// https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/regular/x-circle.svg
const statusIcons: Record<AtlasFeedbackStatus, { name: string; d: string }> = {
  info: {
    name: 'info',
    d: 'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z',
  },
  success: {
    name: 'check-circle',
    d: 'M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z',
  },
  warning: {
    name: 'warning',
    d: 'M236.8,188.09,149.35,36.22h0a24.76,24.76,0,0,0-42.7,0L19.2,188.09a23.51,23.51,0,0,0,0,23.72A24.35,24.35,0,0,0,40.55,224h174.9a24.35,24.35,0,0,0,21.33-12.19A23.51,23.51,0,0,0,236.8,188.09ZM222.93,203.8a8.5,8.5,0,0,1-7.48,4.2H40.55a8.5,8.5,0,0,1-7.48-4.2,7.59,7.59,0,0,1,0-7.72L120.52,44.21a8.75,8.75,0,0,1,15,0l87.45,151.87A7.59,7.59,0,0,1,222.93,203.8ZM120,144V104a8,8,0,0,1,16,0v40a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,180Z',
  },
  error: {
    name: 'x-circle',
    d: 'M165.66,101.66,139.31,128l26.35,26.34a8,8,0,0,1-11.32,11.32L128,139.31l-26.34,26.35a8,8,0,0,1-11.32-11.32L116.69,128,90.34,101.66a8,8,0,0,1,11.32-11.32L128,116.69l26.34-26.35a8,8,0,0,1,11.32,11.32ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z',
  },
};

function StatusIcon({ status }: { status: AtlasFeedbackStatus }) {
  const icon = statusIcons[status];
  return (
    <svg
      className="atlas-icon atlas-feedback-icon"
      viewBox="0 0 256 256"
      fill="currentColor"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
      data-icon-library="phosphor"
      data-icon-name={icon.name}
      data-status={status}
    >
      <path d={icon.d} />
    </svg>
  );
}

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

// Native queues keep their own lifecycle; only the visible stack is limited.
const feedbackQueueLimit = 3;

// Layer order comes from the central Theme Builder metadata, never a local number.
type LayerId = (typeof layerOrder)[number]['id'];
const layers = Object.fromEntries(layerOrder.map(({ id, value }) => [id, value])) as Record<
  LayerId,
  number
>;
const scopeStyle = { '--feedback-layer': layers.toast } as CSSProperties;

type FeedbackLayer = Readonly<{ getContainer: () => HTMLElement; scope: AtlasPopupScope | null }>;
const FeedbackContainer = createContext<FeedbackLayer | undefined>(undefined);

/**
 * Internal default container of Modal and Popconfirm. The feedback layer serves only the popup
 * scope it renders in; under a nearer Shell scope it may lie outside that Shell's surface, so
 * the default falls back to the Shell's ConfigProvider body portal. Explicit containers win.
 */
function useFeedbackContainer(): (() => HTMLElement) | undefined {
  const layer = useContext(FeedbackContainer);
  const scope = useContext(AtlasPopupScopeContext);
  return layer && layer.scope === scope ? layer.getContainer : undefined;
}

/**
 * Stable portal target inside the themed AtlasProvider wrapper, so Modal and
 * Popconfirm keep provider variables across theme changes. Render it outside
 * Cards: their container queries create a containing block for fixed layers.
 * It also carries the central toast layer for toast and notification holders.
 */
export function AtlasFeedbackScope({ children }: { children: ReactNode }) {
  const layer = useRef<HTMLDivElement>(null);
  const getContainer = useCallback(() => layer.current ?? document.body, []);
  const scope = useContext(AtlasPopupScopeContext);
  const value = useMemo(() => ({ getContainer, scope }), [getContainer, scope]);
  return (
    <FeedbackContainer.Provider value={value}>
      <div className="atlas-feedback-scope" style={scopeStyle}>
        {children}
        <div ref={layer} className="atlas-feedback-portal" data-feedback-portal />
      </div>
    </FeedbackContainer.Provider>
  );
}

const toastPlacements = {
  'top-center': { transitionName: 'atlas-toast-from-top', side: 'top', entry: 'top' },
  'top-right-top': { transitionName: 'atlas-toast-from-top', side: 'topRight', entry: 'top' },
  'top-right-right': {
    transitionName: 'atlas-toast-from-right',
    side: 'topRight',
    entry: 'right',
  },
} as const;

/** top-center and top-right-top enter from above; top-right-right enters from the side. */
export type AtlasToastPlacement = keyof typeof toastPlacements;
export const atlasToastPlacements = Object.keys(toastPlacements) as AtlasToastPlacement[];

export interface AtlasToastOptions {
  /** Plain text: shown in the toast and announced once by the native notice. */
  content: string;
  placement?: AtlasToastPlacement;
  status?: AtlasFeedbackStatus;
  /** Seconds, native message semantics. */
  duration?: number;
  /** Native message keys are strings or numbers only. */
  key?: string | number;
}

export interface AtlasToastApi {
  /** Opening in one placement closes the other placements; each queue keeps three. */
  open: (options: AtlasToastOptions) => void;
  /** Closes one key in every placement, or all toasts without a key. */
  destroy: (key?: Key) => void;
}

function useToastQueue(placement: AtlasToastPlacement) {
  const region = useRef<HTMLDivElement>(null);
  // A stable config keeps the native api stable across the opener's re-renders.
  const config = useMemo(
    () => ({
      top: 0,
      maxCount: feedbackQueueLimit,
      transitionName: toastPlacements[placement].transitionName,
      getContainer: () => region.current ?? document.body,
    }),
    [placement],
  );
  const [api, holder] = message.useMessage(config);
  return { placement, region, api, holder };
}

/**
 * Native message queues, one per placement. Render the returned holder once,
 * inside AtlasFeedbackScope and outside Cards; it owns the fixed regions and
 * the native context holders. The native notice is the single announcement.
 */
export function useAtlasToast() {
  const center = useToastQueue('top-center');
  const rightTop = useToastQueue('top-right-top');
  const rightRight = useToastQueue('top-right-right');
  const api = useMemo<AtlasToastApi>(() => {
    const queues = {
      'top-center': center.api,
      'top-right-top': rightTop.api,
      'top-right-right': rightRight.api,
    };
    return {
      open({ content, placement = 'top-center', status = 'success', duration, key }) {
        for (const [other, queue] of Object.entries(queues)) {
          if (other !== placement) queue.destroy();
        }
        const { side, entry } = toastPlacements[placement];
        queues[placement].open({
          content: (
            <span className="atlas-toast-text" data-toast-placement={side} data-toast-entry={entry}>
              {content}
            </span>
          ),
          key,
          duration,
          type: status,
          icon: <StatusIcon status={status} />,
          className: `atlas-toast atlas-toast-${placement}`,
          classNames: { wrapper: 'atlas-toast-content' },
        });
      },
      destroy(key) {
        for (const queue of Object.values(queues)) queue.destroy(key);
      },
    };
  }, [center.api, rightTop.api, rightRight.api]);
  // Close toasts only on unmount; a state update in the opener must not destroy them.
  const latestApi = useRef(api);
  latestApi.current = api;
  useEffect(() => () => latestApi.current.destroy(), []);
  const holder = (
    <div className="atlas-feedback-layer" data-feedback-layer="toast">
      {[center, rightTop, rightRight].map(queue => (
        <div
          key={queue.placement}
          ref={queue.region}
          className="atlas-toast-region"
          data-toast-placement={queue.placement}
        />
      ))}
      {center.holder}
      {rightTop.holder}
      {rightRight.holder}
    </div>
  );
  return [api, holder] as const;
}

export interface AtlasNotificationOptions {
  title: ReactNode;
  description?: ReactNode;
  /** Action buttons; notifications with actions stay until closed unless duration is set. */
  actions?: ReactNode;
  status?: AtlasFeedbackStatus;
  key?: Key;
  duration?: number | false;
  onClose?: () => void;
}

export interface AtlasNotificationApi {
  open: (options: AtlasNotificationOptions) => void;
  destroy: (key?: Key) => void;
}

/** Native notification queue (top right, three visible, role status). Render the holder once. */
export function useAtlasNotification() {
  const { t } = useI18n();
  const region = useRef<HTMLDivElement>(null);
  const config = useMemo(
    () => ({
      placement: 'topRight' as const,
      maxCount: feedbackQueueLimit,
      getContainer: () => region.current ?? document.body,
    }),
    [],
  );
  const [native, contextHolder] = notification.useNotification(config);
  const closeLabel = t('Close notification');
  const api = useMemo<AtlasNotificationApi>(
    () => ({
      open({ title, description, actions, status = 'info', key, duration, onClose }) {
        native.open({
          key,
          title,
          description,
          actions,
          onClose,
          type: status,
          role: 'status',
          icon: <StatusIcon status={status} />,
          duration: duration ?? (actions ? false : undefined),
          className: 'atlas-notification',
          closable: { closeIcon: <AtlasIcon name="x" />, 'aria-label': closeLabel },
        });
      },
      destroy: key => native.destroy(key),
    }),
    [native, closeLabel],
  );
  const latestNative = useRef(native);
  latestNative.current = native;
  useEffect(() => () => latestNative.current.destroy(), []);
  const holder = (
    <div
      ref={region}
      className="atlas-feedback-layer atlas-notification-region"
      data-feedback-layer="notification"
    >
      {contextHolder}
    </div>
  );
  return [api, holder] as const;
}

export interface AtlasAlertProps {
  /** Semantic tone; the text and the Phosphor icon carry it, never color alone. */
  status?: AtlasFeedbackStatus;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Shows the native close button, which removes the alert. */
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
  id?: string;
}

/** Persistent inline message on native Alert; only errors interrupt as role alert. */
export function AtlasAlert({
  status = 'info',
  title,
  description,
  action,
  dismissible = false,
  onDismiss,
  className,
  id,
}: AtlasAlertProps) {
  const { t } = useI18n();
  return (
    <Alert
      id={id}
      type={status}
      title={title}
      description={description}
      action={action}
      showIcon
      icon={<StatusIcon status={status} />}
      role={status === 'error' ? 'alert' : 'status'}
      className={cx('atlas-alert', `atlas-alert-${status}`, className)}
      closable={
        dismissible
          ? {
              closeIcon: <AtlasIcon name="x" />,
              'aria-label': t('Dismiss alert'),
              onClose: () => onDismiss?.(),
            }
          : false
      }
    />
  );
}

export type AtlasModalProps = ModalProps;

/**
 * Native controlled Modal: Escape and close call onCancel, focus returns to the
 * trigger. The central modal layer applies unless zIndex is set explicitly.
 */
export function AtlasModal({
  rootClassName,
  closable,
  getContainer,
  zIndex,
  ...props
}: AtlasModalProps) {
  const { t } = useI18n();
  const container = useFeedbackContainer();
  return (
    <Modal
      {...props}
      zIndex={zIndex ?? layers.modal}
      rootClassName={cx('atlas-feedback-modal', rootClassName)}
      getContainer={getContainer ?? container}
      closable={closable ?? { closeIcon: <AtlasIcon name="x" />, 'aria-label': t('Close dialog') }}
    />
  );
}

type PopconfirmRef = GetRef<typeof Popconfirm>;

export type AtlasPopconfirmProps = Omit<PopconfirmProps, 'icon'> & {
  status?: AtlasFeedbackStatus;
};

/**
 * Native contextual Popconfirm. Escape cancels: it closes, calls onCancel and
 * returns focus to the trigger, also when focus is inside the popup. The central
 * popconfirm layer applies unless zIndex is set explicitly.
 */
export function AtlasPopconfirm({
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  onCancel,
  okText,
  cancelText,
  rootClassName,
  getPopupContainer,
  zIndex,
  status = 'warning',
  children,
  ...props
}: AtlasPopconfirmProps) {
  const { t } = useI18n();
  const container = useFeedbackContainer();
  const trigger = useRef<PopconfirmRef>(null);
  const [localOpen, setLocalOpen] = useState(defaultOpen ?? false);
  const open = controlledOpen ?? localOpen;
  const changeOpen = (next: boolean) => {
    if (controlledOpen === undefined) setLocalOpen(next);
    onOpenChange?.(next);
  };
  const latest = useRef({ changeOpen, onCancel });
  latest.current = { changeOpen, onCancel };
  useEffect(() => {
    if (!open) return;
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      latest.current.changeOpen(false);
      latest.current.onCancel?.();
      trigger.current?.nativeElement?.focus();
    };
    document.addEventListener('keydown', cancelOnEscape);
    return () => document.removeEventListener('keydown', cancelOnEscape);
  }, [open]);
  return (
    <Popconfirm
      {...props}
      ref={trigger}
      open={open}
      onOpenChange={changeOpen}
      onCancel={onCancel}
      zIndex={zIndex ?? layers.popconfirm}
      okText={okText ?? t('Confirm')}
      cancelText={cancelText ?? t('Cancel')}
      icon={<StatusIcon status={status} />}
      rootClassName={cx('atlas-popconfirm', rootClassName)}
      getPopupContainer={getPopupContainer ?? container}
    >
      {children}
    </Popconfirm>
  );
}
