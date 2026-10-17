import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ConfigProvider, Drawer } from 'antd';
import GenUXIconButton from './GenUXIconButton';
import ThemeTokenEditors from './ThemeTokenEditors';
import { useI18n } from './useI18n';
import { useGenUXAppearance } from './GenUXAppearance';
import { tweakerTokens } from '../data/tweaker';
import '../styles/tweaker.css';

type TweakerContextValue = {
  target: HTMLDivElement | null;
  open: boolean;
  panelId: string;
  onOpen: (trigger: HTMLElement) => void;
};
const TweakerContext = createContext<TweakerContextValue | null>(null);
export const useHasTweaker = () => useContext(TweakerContext) !== null;
export const useTweakerOpen = () => useContext(TweakerContext)?.open ?? false;

/** The fixed opener and dialog-header shortcut share one settings owner. */
export function TweakerOpenButton({ fixed = false }: { fixed?: boolean }) {
  const context = useContext(TweakerContext);
  const { t } = useI18n();
  const appearance = useGenUXAppearance();
  if (!context || appearance !== 'docs') return null;
  return (
    <GenUXIconButton
      icon="settings"
      size="sm"
      aria-label={t('Open tweaker')}
      title={t('Open tweaker')}
      aria-expanded={context.open}
      aria-haspopup="dialog"
      aria-controls={context.panelId}
      data-tweaker-trigger={fixed ? '' : undefined}
      onClick={event => context.onOpen(event.currentTarget)}
    />
  );
}

/** Register presentation settings without moving their state out of the example. */
export function TweakerSettings({ children, title }: { children: ReactNode; title?: string }) {
  const { t } = useI18n();
  const context = useContext(TweakerContext);
  const appearance = useGenUXAppearance();
  const id = useId();
  // Approved and Storybook consumers retain their original inline DOM.
  if (!context || appearance !== 'docs') return children;
  if (!context.target) return null;
  const target = context.target;
  return createPortal(
    <ConfigProvider
      getPopupContainer={trigger =>
        (trigger?.closest('.genux-tweaker-panel') as HTMLElement | null) ?? target
      }
    >
      <section
        className="genux-tweaker-settings"
        data-tweaker-settings
        aria-labelledby={title ? id : undefined}
      >
        {title && <h3 id={id}>{t(title)}</h3>}
        {children}
      </section>
    </ConfigProvider>,
    target,
  );
}

/** One persistent, initially closed settings surface for each documentation island. */
export default function GenUXTweaker({
  children,
  settings,
}: {
  children: ReactNode;
  settings: ReactNode;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  const panelId = useId();
  const onOpen = useCallback((button: HTMLElement) => {
    const active = document.activeElement;
    // Pointer activation of the fixed opener can occur above an example modal.
    returnFocus.current =
      !button.closest('[role="dialog"]') &&
      active instanceof HTMLElement &&
      active.closest('[role="dialog"]')
        ? active
        : button;
    setOpen(true);
  }, []);
  const context = useMemo(
    () => ({ target, open, panelId, onOpen }),
    [target, open, panelId, onOpen],
  );
  useEffect(() => {
    if (!open) return;
    // A preview overlay may mount later than Tweaker. Native portal registration
    // order then differs from visual order. Handle this top layer before window
    // handlers; Select's own Escape still stops propagation at its input first.
    let compositionEnd = -Infinity;
    const onCompositionEnd = () => {
      compositionEnd = Date.now();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        event.isComposing ||
        event.defaultPrevented ||
        Date.now() - compositionEnd < 200
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('compositionend', onCompositionEnd);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('compositionend', onCompositionEnd);
    };
  }, [open]);
  useEffect(() => {
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (!closed) return;
    // Child native traps have released/reacquired ownership in this commit.
    // Restore before exit motion, while respecting an active example dialog.
    const active = document.activeElement;
    const dialog = active instanceof HTMLElement ? active.closest('[role="dialog"]') : null;
    const otherDialog = dialog && !dialog.closest('.genux-tweaker-panel');
    const preferred = returnFocus.current;
    if (preferred?.isConnected && preferred.closest('.genux-overlay-active')) preferred.focus();
    else if (!otherDialog)
      (preferred?.isConnected ? preferred : trigger.current?.querySelector('button'))?.focus();
  }, [open]);
  return (
    <TweakerContext.Provider value={context}>
      {children}
      <div className="genux-tweaker-trigger" ref={trigger}>
        <TweakerOpenButton fixed />
      </div>
      <Drawer
        rootClassName="genux-demo genux-tweaker-panel"
        title={t('Tweaker')}
        placement="right"
        zIndex={tweakerTokens.layer + 1}
        size="min(var(--genux-tweaker-width), 100vw)"
        open={open}
        onClose={() => setOpen(false)}
        closable={{ 'aria-label': t('Close tweaker') }}
        keyboard={false}
        focusable={{ trap: true, focusTriggerAfterClose: false }}
        destroyOnHidden={false}
        getContainer={false}
        styles={{ root: { position: 'fixed' } }}
      >
        <div id={panelId} className="genux-tweaker-content">
          <p className="genux-tweaker-description">
            {t('Adjust the example. Closing this panel keeps your settings and draft.')}
          </p>
          {settings}
          <div ref={setTarget} className="genux-tweaker-registrations" />
          <ThemeTokenEditors />
        </div>
      </Drawer>
    </TweakerContext.Provider>
  );
}
