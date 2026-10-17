import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Splitter, type SplitterRef } from 'antd';
import GenUXButton from './GenUXButton';
import { useGenUXSize } from './GenUXSizeProfile';
import { genuxLength, useGenUXAppearance } from './GenUXAppearance';
import {
  splitterDirection,
  splitterKeyRatio,
  splitterLayout,
  splitterLimits,
  splitterSizes,
  type SplitterOrientation,
} from '../data/splitter';
import { useI18n } from './useI18n';

export type GenUXSplitterPanel = Readonly<{
  id: string;
  label: string;
  children: ReactNode;
  /** Percentage bounds. Panes remain visible; collapsing is a separate pattern. */
  min?: number;
  max?: number;
}>;

export type GenUXSplitterProps = Readonly<{
  id: string;
  label: string;
  panels: readonly [GenUXSplitterPanel, GenUXSplitterPanel];
  orientation?: SplitterOrientation;
  initialSizes?: readonly [number, number];
  /** Controlled sizes. When set, interactions only propose values via onSizesChange. */
  sizes?: readonly [number, number];
  onSizesChange?: (sizes: readonly [number, number]) => void;
  className?: string;
}>;

type ActiveDrag = {
  pointerId: number;
  handle: HTMLElement;
  coordinate: number;
  ratio: number;
  extent: number;
  reverse: boolean;
};

/** Native AntD layout with an accessible, stable two-pane interaction adapter. */
export default function GenUXSplitter({
  id,
  label,
  panels,
  orientation = 'auto',
  initialSizes,
  sizes: controlledSizes,
  onSizesChange,
  className = '',
}: GenUXSplitterProps) {
  const { t, locale } = useI18n();
  const appearance = useGenUXAppearance();
  const profile = useGenUXSize();
  const native = useRef<SplitterRef>(null);
  const owner = useRef<HTMLDivElement>(null);
  const drag = useRef<ActiveDrag | null>(null);
  const limits = splitterLimits(panels);
  const controlled = controlledSizes !== undefined;
  const [ratio, setRatio] = useState(() => splitterSizes(initialSizes, limits)[0]);
  const [area, setArea] = useState({ width: 0, height: 0, viewportHeight: 0 });
  const [resizing, setResizing] = useState(false);
  const sizes = splitterSizes(controlledSizes ?? [ratio, 100 - ratio], limits);
  const direction = splitterDirection(orientation, area);
  const firstLabel = t(panels[0].label);
  const secondLabel = t(panels[1].label);
  const firstId = `${id}-${panels[0].id}`;
  const secondId = `${id}-${panels[1].id}`;
  const style = {
    // The handle shares the island's regular control height (central 48/56/64 roles).
    '--splitter-handle-size': 'var(--genux-component-height)',
    '--splitter-stack-height': genuxLength(splitterLayout.narrowHeight, appearance),
    '--splitter-wide-height': genuxLength(splitterLayout.wideHeight, appearance),
    '--splitter-coarse-target': genuxLength(splitterLayout.pointerCoarseTarget, appearance),
  } as CSSProperties;

  useEffect(() => {
    const element = owner.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      const next = { width: rect.width, height: rect.height, viewportHeight: window.innerHeight };
      setArea(current =>
        current.width === next.width &&
        current.height === next.height &&
        current.viewportHeight === next.viewportHeight
          ? current
          : next,
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

  // AntD 6.6.6 does not expose dragger attributes or a keyboard contract. Adapt
  // the native separator rather than adding a second, competing focus target.
  useLayoutEffect(() => {
    const container = native.current?.nativeElement;
    const scrollOwners = container?.querySelectorAll<HTMLElement>(':scope > .ant-splitter-panel');
    scrollOwners?.forEach((element, index) => {
      element.id = index === 0 ? firstId : secondId;
      element.tabIndex = 0;
      element.setAttribute('role', 'region');
      element.setAttribute('aria-label', index === 0 ? firstLabel : secondLabel);
    });
    const handle = container?.querySelector<HTMLElement>(
      ':scope > .ant-splitter-bar > [role="separator"]',
    );
    if (!handle) return;
    handle.tabIndex = 0;
    handle.setAttribute(
      'aria-label',
      t('Resize {first} and {second}', { first: firstLabel, second: secondLabel }),
    );
    handle.setAttribute('aria-controls', `${firstId} ${secondId}`);
    handle.setAttribute('aria-describedby', `${id}-resize-help`);
    handle.setAttribute('aria-valuemin', String(limits.min));
    handle.setAttribute('aria-valuemax', String(limits.max));
    handle.setAttribute('aria-disabled', String(limits.min === limits.max));
    handle.setAttribute('aria-valuenow', String(sizes[0]));
    handle.setAttribute(
      'aria-valuetext',
      t('{panel} size: {percent}%', { panel: firstLabel, percent: Math.round(sizes[0]) }),
    );
  }, [
    direction,
    firstId,
    secondId,
    firstLabel,
    secondLabel,
    id,
    limits.min,
    limits.max,
    sizes[0],
    locale,
  ]);

  useLayoutEffect(() => {
    // A shorter responsive layout can leave the unchanged active control above
    // the page viewport. Reconcile visibility without moving focus or its caret.
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !owner.current?.contains(active)) return;
    const rect = active.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft ?? 0;
    const top = viewport?.offsetTop ?? 0;
    const right = left + (viewport?.width ?? window.innerWidth);
    const bottom = top + (viewport?.height ?? window.innerHeight);
    if (rect.left < left || rect.right > right || rect.top < top || rect.bottom > bottom)
      active.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  }, [direction, profile, area.width, area.height, area.viewportHeight]);

  useEffect(() => {
    // Changing the available layout cancels a gesture, preserving the last ratio.
    const active = drag.current;
    if (active?.handle.hasPointerCapture?.(active.pointerId))
      active.handle.releasePointerCapture(active.pointerId);
    drag.current = null;
    setResizing(false);
    return () => {
      const pending = drag.current;
      if (pending?.handle.hasPointerCapture?.(pending.pointerId))
        pending.handle.releasePointerCapture(pending.pointerId);
      drag.current = null;
    };
  }, [direction]);

  const separator = (target: EventTarget | null) => {
    const handle =
      target instanceof Element ? target.closest<HTMLElement>('[role="separator"]') : null;
    return handle?.closest('[data-genux-splitter]') === owner.current ? handle : null;
  };
  const finishDrag = () => {
    const active = drag.current;
    drag.current = null;
    if (active?.handle.hasPointerCapture?.(active.pointerId))
      active.handle.releasePointerCapture(active.pointerId);
    setResizing(false);
  };
  const isRtl = () => !!owner.current && window.getComputedStyle(owner.current).direction === 'rtl';
  // Every interaction proposes a bounded first-pane size through this one path.
  // A controlled owner decides whether the candidate becomes the rendered value.
  const commit = (next: number) => {
    const candidate = splitterSizes([next, 100 - next], limits);
    if (candidate[0] === sizes[0]) return;
    if (!controlled) setRatio(candidate[0]);
    onSizesChange?.([candidate[0], candidate[1]] as const);
  };

  return (
    <div
      ref={owner}
      id={id}
      className={`genux-splitter ${className}`.trim()}
      role="group"
      aria-labelledby={`${id}-label`}
      data-genux-splitter={id}
      data-splitter-orientation={direction}
      data-splitter-ratio={sizes[0]}
      data-splitter-resizing={resizing ? 'true' : undefined}
      data-splitter-profile={profile}
      style={style}
      onKeyDown={event => {
        if (
          !separator(event.target) ||
          limits.min === limits.max ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey
        )
          return;
        const next = splitterKeyRatio(
          event.key,
          direction,
          sizes[0],
          limits,
          event.shiftKey,
          isRtl(),
        );
        if (next === null) return;
        event.preventDefault();
        commit(next);
      }}
      onMouseDownCapture={event => {
        if (separator(event.target)) event.stopPropagation();
      }}
      onTouchStartCapture={event => {
        if (separator(event.target)) event.stopPropagation();
      }}
      onPointerDownCapture={event => {
        const handle = separator(event.target);
        if (
          !handle ||
          limits.min === limits.max ||
          drag.current ||
          event.button !== 0 ||
          !event.isPrimary
        )
          return;
        const rect = native.current?.nativeElement.getBoundingClientRect();
        if (!rect) return;
        const handleRect = handle.getBoundingClientRect();
        const extent =
          direction === 'horizontal'
            ? rect.width - handleRect.width
            : rect.height - handleRect.height;
        if (!(extent > 0)) return;
        event.preventDefault();
        handle.focus({ preventScroll: true });
        handle.setPointerCapture(event.pointerId);
        drag.current = {
          pointerId: event.pointerId,
          handle,
          coordinate: direction === 'horizontal' ? event.clientX : event.clientY,
          ratio: sizes[0],
          extent,
          reverse: direction === 'horizontal' && isRtl(),
        };
        setResizing(true);
      }}
      onPointerMove={event => {
        const active = drag.current;
        if (!active || active.pointerId !== event.pointerId) return;
        const coordinate = direction === 'horizontal' ? event.clientX : event.clientY;
        const offset =
          ((coordinate - active.coordinate) / active.extent) * (active.reverse ? -100 : 100);
        commit(Math.min(limits.max, Math.max(limits.min, active.ratio + offset)));
      }}
      onPointerUp={event => {
        if (drag.current?.pointerId === event.pointerId) finishDrag();
      }}
      onPointerCancel={event => {
        if (drag.current?.pointerId === event.pointerId) finishDrag();
      }}
      onLostPointerCapture={event => {
        if (drag.current?.pointerId === event.pointerId) finishDrag();
      }}
    >
      <header className="genux-splitter-header">
        <span id={`${id}-label`} className="genux-splitter-label">
          {t(label)}
        </span>
        <span
          className="genux-splitter-summary"
          role="status"
          aria-live={resizing ? 'off' : 'polite'}
          aria-atomic="true"
        >
          {t('{panel} size: {percent}%', { panel: firstLabel, percent: Math.round(sizes[0]) })}
          {' · '}
          {t('{panel} size: {percent}%', { panel: secondLabel, percent: Math.round(sizes[1]) })}
        </span>
      </header>
      <Splitter
        ref={native}
        orientation={direction}
        className="genux-splitter-native"
        classNames={{ dragger: 'genux-control' }}
        draggerIcon={
          <span className="genux-splitter-grip" aria-hidden="true">
            <span />
          </span>
        }
        onResize={next => commit(splitterSizes(next, limits)[0])}
        destroyOnHidden={false}
      >
        {panels.map((panel, index) => (
          <Splitter.Panel
            key={panel.id}
            size={`${sizes[index]}%`}
            min={`${index === 0 ? limits.min : 100 - limits.max}%`}
            max={`${index === 0 ? limits.max : 100 - limits.min}%`}
          >
            <div id={`${id}-${panel.id}-content`} className="genux-splitter-pane">
              {panel.children}
            </div>
          </Splitter.Panel>
        ))}
      </Splitter>
      <div className="genux-splitter-actions">
        <GenUXButton
          fill="text"
          text={t('More space for {panel}', { panel: firstLabel })}
          disabled={sizes[0] >= limits.max}
          onClick={() => commit(Math.min(limits.max, sizes[0] + 10))}
        />
        <GenUXButton
          fill="text"
          text={t('Balance panels')}
          disabled={sizes[0] === splitterSizes([50, 50], limits)[0]}
          onClick={() => commit(splitterSizes([50, 50], limits)[0])}
        />
        <GenUXButton
          fill="text"
          text={t('More space for {panel}', { panel: secondLabel })}
          disabled={sizes[0] <= limits.min}
          onClick={() => commit(Math.max(limits.min, sizes[0] - 10))}
        />
      </div>
      <p id={`${id}-resize-help`} className="genux-splitter-help">
        {direction === 'horizontal'
          ? t('Drag the divider or use Left and Right arrows. Home and End reach the size limits.')
          : t('Drag the divider or use Up and Down arrows. Home and End reach the size limits.')}
      </p>
    </div>
  );
}
