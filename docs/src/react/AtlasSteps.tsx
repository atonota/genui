import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { ConfigProvider, Steps } from 'antd';
import AtlasIcon from './AtlasIcon';
import { atlasLength, useAtlasAppearance } from './AtlasAppearance';
import { useAtlasSize } from './AtlasSizeProfile';
import { selectionSizeProfiles } from '../data/selection-sizes';
import { useI18n } from './useI18n';

export type AtlasStepStatus = 'wait' | 'process' | 'finish' | 'error';
export type AtlasStepItem = Readonly<{
  key: string;
  title: ReactNode;
  content?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  status?: AtlasStepStatus;
}>;
export interface AtlasStepsProps {
  label?: string;
  current: number;
  items: readonly AtlasStepItem[];
  onChange?: (current: number) => void;
  status?: AtlasStepStatus;
  orientation?: 'auto' | 'horizontal' | 'vertical';
  titlePlacement?: 'horizontal' | 'vertical';
  type?: 'default' | 'navigation';
  variant?: 'filled' | 'outlined';
  disabled?: boolean;
}

// Three readable steps need this inline area. Short viewports retain the stacked
// journey when a phone rotates; no device or input capability is inferred.
export const stepsLayout = { minInlineWidth: 640, minViewportHeight: 480 } as const;
const stateLabels = {
  wait: 'Waiting step',
  process: 'Current step',
  finish: 'Finished step',
  error: 'Step needs attention',
} as const;

/** Native AntD Steps with container layout and a pinned6.6.6 accessibility adapter. */
export default function AtlasSteps({
  label,
  current,
  items,
  onChange,
  status = 'process',
  orientation = 'auto',
  titlePlacement = 'horizontal',
  type = 'default',
  variant = 'filled',
  disabled,
}: AtlasStepsProps) {
  const { t } = useI18n();
  const size = useAtlasSize();
  const appearance = useAtlasAppearance();
  const { componentDisabled } = ConfigProvider.useConfig();
  const blocked = disabled ?? componentDisabled ?? false;
  const owner = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ width: 0, viewportHeight: 0 });
  const fits = area.width >= stepsLayout.minInlineWidth;
  const direction =
    orientation === 'vertical' ||
    !fits ||
    (orientation === 'auto' && area.viewportHeight < stepsLayout.minViewportHeight)
      ? 'vertical'
      : 'horizontal';
  const selected = items.length
    ? Math.max(0, Math.min(items.length - 1, Number.isFinite(current) ? Math.floor(current) : 0))
    : -1;
  const marker = selectionSizeProfiles.find(profile => profile.value === size)!.height_px;
  const itemStatus = (item: AtlasStepItem, index: number): AtlasStepStatus =>
    item.status ?? (index < selected ? 'finish' : index === selected ? status : 'wait');

  useEffect(() => {
    const element = owner.current;
    if (!element) return;
    const measure = () => {
      const width = element.getBoundingClientRect().width;
      const viewportHeight = window.innerHeight;
      setArea(previous =>
        previous.width === width && previous.viewportHeight === viewportHeight
          ? previous
          : { width, viewportHeight },
      );
    };
    const observer =
      typeof window.ResizeObserver === 'function' ? new window.ResizeObserver(measure) : null;
    observer?.observe(element);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  useLayoutEffect(() => {
    const focused = document.activeElement as HTMLElement | null;
    if (
      focused?.classList.contains('ant-steps-item') &&
      focused.closest('.atlas-steps') === owner.current
    )
      focused.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  }, [direction]);

  // Native6.6.6 exposes no item/ref render hook. Keep its activation handlers;
  // annotate only this instance, as the existing AtlasSplitter adapter does.
  useLayoutEffect(() => {
    const nodes = owner.current?.querySelectorAll<HTMLElement>(
      ':scope > .ant-steps > .ant-steps-item',
    );
    nodes?.forEach((node, index) => {
      node.querySelector('[data-atlas-step-title]')?.removeAttribute('aria-current');
      if (index === selected) node.setAttribute('aria-current', 'step');
      else node.removeAttribute('aria-current');
      node.setAttribute('data-step-key', items[index].key);
      const unavailable = blocked || !!items[index].disabled;
      if (unavailable) node.setAttribute('aria-disabled', 'true');
      else node.removeAttribute('aria-disabled');
      if (onChange) {
        node.setAttribute('role', 'button');
        node.tabIndex = unavailable ? -1 : 0;
      } else {
        node.removeAttribute('role');
        node.removeAttribute('tabindex');
      }
    });
    const focused = document.activeElement as HTMLElement | null;
    if (
      onChange &&
      focused?.getAttribute('aria-disabled') === 'true' &&
      owner.current?.contains(focused)
    )
      [...(nodes ?? [])].find(node => node.getAttribute('aria-disabled') !== 'true')?.focus();
  }, [items, selected, blocked, onChange]);

  return (
    <div
      ref={owner}
      className="atlas-steps"
      role="group"
      aria-label={label ?? t('Steps')}
      data-steps-orientation={direction}
      data-steps-size={size}
      style={{ '--atlas-steps-icon-size': atlasLength(marker, appearance) } as CSSProperties}
      onKeyDownCapture={event => {
        if (
          !onChange ||
          blocked ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey ||
          event.nativeEvent.isComposing
        )
          return;
        const container = owner.current;
        if (!container) return;
        const target = event.target as HTMLElement;
        const item = target.closest<HTMLElement>('.ant-steps-item');
        if (!item || target.closest('.atlas-steps') !== container) return;
        const nodes = [
          ...container.querySelectorAll<HTMLElement>(':scope > .ant-steps > .ant-steps-item'),
        ].filter(node => node.getAttribute('aria-disabled') !== 'true');
        const index = nodes.indexOf(item);
        if (index < 0) return;
        const nextKey = direction === 'vertical' ? 'ArrowDown' : 'ArrowRight';
        const previousKey = direction === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
        const destination =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? nodes.length - 1
              : event.key === nextKey
                ? Math.min(nodes.length - 1, index + 1)
                : event.key === previousKey
                  ? Math.max(0, index - 1)
                  : null;
        if (destination === null) return;
        event.preventDefault();
        nodes[destination]?.focus();
      }}
    >
      <Steps
        current={selected}
        status={status}
        orientation={direction}
        responsive={false}
        size={size === 'sm' ? 'small' : 'medium'}
        type={type}
        variant={variant}
        titlePlacement={titlePlacement}
        ellipsis={false}
        onChange={
          onChange && !blocked
            ? index => {
                if (!items[index]?.disabled && index !== selected) onChange(index);
              }
            : undefined
        }
        iconRender={(original, info) =>
          info.item.icon ? (
            original
          ) : info.item.status === 'finish' || info.item.status === 'error' ? (
            <info.components.Icon>
              <AtlasIcon name={info.item.status === 'finish' ? 'check' : 'x'} />
            </info.components.Icon>
          ) : (
            original
          )
        }
        items={items.map((item, index) => ({
          ...item,
          disabled: blocked || item.disabled,
          title: (
            <span data-atlas-step-title aria-current={index === selected ? 'step' : undefined}>
              {item.title}
              <span className="atlas-steps-sr-status">
                {' '}
                {t(stateLabels[itemStatus(item, index)])}
              </span>
            </span>
          ),
        }))}
      />
    </div>
  );
}
