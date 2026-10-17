import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Cascader, ConfigProvider } from 'antd';
import type { CascaderProps } from 'antd';
import type { DefaultOptionType } from 'antd/es/cascader';
import GenUXClearIcon from './GenUXClearIcon';
import GenUXListyItem from './GenUXListyItem';
import useListySurface from './useListySurface';
import { normalizeSearch } from '../i18n';
import { useI18n } from './useI18n';
import '../styles/genux-cascader.css';

export type GenUXCascadeOption = Readonly<{
  value: string;
  label: string;
  description?: string;
  keywords?: readonly string[];
  disabled?: boolean;
  children?: readonly GenUXCascadeOption[];
  isLeaf?: boolean;
}>;
type Selection =
  | {
      multiple?: false;
      value: readonly string[];
      onChange: (value: string[]) => void;
      changeOnSelect?: boolean;
      checkedStrategy?: never;
    }
  | {
      multiple: true;
      value: readonly (readonly string[])[];
      onChange: (value: string[][]) => void;
      checkedStrategy?: 'parent' | 'child';
      changeOnSelect?: never;
    };
type Source =
  | { searchable?: true; loadData?: never }
  | { searchable: false; loadData?: (path: string[]) => void };
export type GenUXCascaderProps = Selection &
  Source & {
    id?: string;
    label: string;
    options: readonly GenUXCascadeOption[];
    placeholder?: string;
    help?: string;
    error?: string;
    status?: 'error' | 'warning';
    disabled?: boolean;
    selectionLabel?: 'path' | 'leaf';
  };
export function resolveCascadePath(
  options: readonly GenUXCascadeOption[],
  path: readonly string[],
): GenUXCascadeOption[] {
  const resolved: GenUXCascadeOption[] = [];
  let level = options;
  for (const value of path) {
    const option = level.find(option => option.value === value);
    if (!option) return [];
    resolved.push(option);
    level = option.children ?? [];
  }
  return resolved;
}
type NativeOption = DefaultOptionType & {
  value: string;
  label: string;
  description?: string;
  keywords?: readonly string[];
  children?: NativeOption[];
};

// Native flip and shift against the visible viewport, not the scroll region. The panel
// is bounded to the roomier side of the field, so the side native flipping picks fits.
const placementAlign = {
  overflow: { adjustX: true, adjustY: true, shiftX: true, shiftY: true },
  htmlRegion: 'visible',
  dynamicInset: true,
} as const;
const builtinPlacements: NonNullable<CascaderProps['builtinPlacements']> = {
  bottomLeft: { ...placementAlign, points: ['tl', 'bl'], offset: [0, 4] },
  bottomRight: { ...placementAlign, points: ['tr', 'br'], offset: [0, 4] },
  topLeft: { ...placementAlign, points: ['bl', 'tl'], offset: [0, -4] },
  topRight: { ...placementAlign, points: ['br', 'tr'], offset: [0, -4] },
};

/** Native Cascader owns navigation/check conduction; callers own options and values. */
export default function GenUXCascader(props: GenUXCascaderProps) {
  const generatedId = useId(),
    id = props.id ?? generatedId;
  const { locale, t } = useI18n();
  const listySurface = useListySurface();
  const { componentDisabled } = ConfigProvider.useConfig();
  const blocked = props.disabled ?? componentDisabled ?? false;
  const root = useRef<HTMLDivElement>(null),
    composing = useRef(false);
  const inputMethod = useRef<'pointer' | 'keyboard'>('pointer');
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState('');
  const options = useMemo(() => {
    function prepare(
      items: readonly GenUXCascadeOption[],
      parents: string[] = [],
      parentDisabled = false,
    ): NativeOption[] {
      return items.map(option => {
        const path = [...parents, option.label],
          disabled = parentDisabled || !!option.disabled;
        return {
          ...option,
          disabled,
          title: path.join(' / '),
          'aria-label': [path.join(' / '), option.description, disabled ? t('Unavailable') : '']
            .filter(Boolean)
            .join('. '),
          'aria-disabled': disabled,
          children: option.children ? prepare(option.children, path, disabled) : undefined,
        };
      });
    }
    return prepare(props.options);
  }, [props.options, locale]);

  // Measure the room beside the field inside the visual viewport (virtual keyboard, zoom
  // and scroll included) before paint; CSS bounds the panel to it and scrolls the rest.
  useLayoutEffect(() => {
    const field = root.current;
    if (!field || !open) return;
    const measure = () => {
      const control = field.querySelector<HTMLElement>('.genux-cascader-control');
      if (!control) return;
      const rect = control.getBoundingClientRect(),
        view = window.visualViewport;
      const top = view?.offsetTop ?? 0,
        bottom = top + (view?.height ?? window.innerHeight);
      const room = Math.max(0, rect.top - top, bottom - rect.bottom);
      field.style.setProperty('--cascader-popup-room', `${Math.floor(room)}px`);
    };
    measure();
    const view = window.visualViewport;
    view?.addEventListener('resize', measure);
    view?.addEventListener('scroll', measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { capture: true, passive: true });
    return () => {
      view?.removeEventListener('resize', measure);
      view?.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, { capture: true });
      field.style.removeProperty('--cascader-popup-room');
    };
  }, [open]);

  useEffect(() => {
    const field = root.current;
    if (!field) return;
    let previousColumns = 0;
    const update = () => {
      const input = field.querySelector<HTMLInputElement>('input[role="combobox"]');
      const tree = field.querySelector<HTMLElement>('.genux-cascader-tree');
      if (!input) return;
      const attribute = (element: Element, name: string, value: string) => {
        if (element.getAttribute(name) !== value) element.setAttribute(name, value);
      };
      // Native6.6.6 exposes menu-item roles with dangling listbox IDs. Adapt only
      // semantics to the combobox-supported tree popup; keep native key handling.
      attribute(input, 'aria-haspopup', 'tree');
      if (!tree || !open) {
        input.removeAttribute('aria-activedescendant');
        return;
      }
      attribute(input, 'aria-controls', `${id}-tree`);
      input.removeAttribute('aria-owns');
      const columns = [...tree.querySelectorAll<HTMLElement>('.ant-cascader-menu')];
      let active: HTMLElement | undefined;
      columns.forEach((column, level) => {
        attribute(column, 'role', 'group');
        attribute(column, 'aria-label', `${t('Level')} ${level + 1}`);
        const items = [...column.querySelectorAll<HTMLElement>('.ant-cascader-menu-item')];
        items.forEach((item, index) => {
          attribute(
            item,
            'id',
            `${id}-option-${encodeURIComponent(item.dataset.pathKey ?? `${level}-${index}`)}`,
          );
          attribute(item, 'role', 'treeitem');
          attribute(item, 'aria-level', String(level + 1));
          attribute(item, 'aria-posinset', String(index + 1));
          attribute(item, 'aria-setsize', String(items.length));
          attribute(
            item,
            'aria-disabled',
            String(item.classList.contains('ant-cascader-menu-item-disabled')),
          );
          const isActive = item.classList.contains('ant-cascader-menu-item-active');
          if (isActive) active = item;
          if (item.classList.contains('ant-cascader-menu-item-expand'))
            attribute(item, 'aria-expanded', String(isActive && level < columns.length - 1));
          if (props.multiple) {
            const checked = item.querySelector('.ant-cascader-checkbox');
            attribute(
              item,
              'aria-checked',
              checked?.classList.contains('ant-cascader-checkbox-indeterminate')
                ? 'mixed'
                : String(!!checked?.classList.contains('ant-cascader-checkbox-checked')),
            );
          } else {
            attribute(
              item,
              'aria-selected',
              item.getAttribute('aria-checked') ?? item.getAttribute('aria-selected') ?? 'false',
            );
            item.removeAttribute('aria-checked');
          }
        });
      });
      if (active && !active.classList.contains('ant-cascader-menu-item-disabled'))
        attribute(input, 'aria-activedescendant', active.id);
      else input.removeAttribute('aria-activedescendant');
      const scroll = tree.querySelector<HTMLElement>('.genux-cascader-scroll');
      const visibleColumn =
        inputMethod.current === 'keyboard'
          ? active?.closest<HTMLElement>('.ant-cascader-menu')
          : columns.length > previousColumns
            ? columns.at(-1)
            : undefined;
      if (scroll && visibleColumn) {
        const area = scroll.getBoundingClientRect(),
          target = visibleColumn.getBoundingClientRect();
        if (target.right > area.right) scroll.scrollLeft += target.right - area.right;
        else if (target.left < area.left) scroll.scrollLeft -= area.left - target.left;
      }
      previousColumns = columns.length;
    };
    update();
    const observer = new MutationObserver(update);
    // Native writes aria-checked when a host value changes; re-derive selection from it.
    observer.observe(field, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'class',
        'aria-checked',
        'aria-expanded',
        'aria-haspopup',
        'aria-activedescendant',
      ],
    });
    const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
    resize?.observe(field);
    return () => {
      observer.disconnect();
      resize?.disconnect();
    };
  }, [id, open, props.multiple, locale]);

  const common = {
    id,
    options,
    disabled: blocked,
    status: props.error ? ('error' as const) : props.status,
    placeholder: props.placeholder ?? t('Browse or search a path'),
    'aria-invalid': !!props.error || props.status === 'error' || undefined,
    'aria-describedby':
      [props.help && `${id}-help`, props.error && `${id}-error`, open && `${id}-guidance`]
        .filter(Boolean)
        .join(' ') || undefined,
    variant: 'filled' as const,
    expandTrigger: 'click' as const,
    allowClear: { clearIcon: <GenUXClearIcon />, label: t('Clear value') },
    popupMatchSelectWidth: true,
    builtinPlacements,
    displayRender: (labels: string[]) =>
      props.selectionLabel === 'leaf' ? labels.at(-1) : labels.join(' / '),
    showSearch:
      props.searchable !== false
        ? {
            searchValue: query,
            onSearch: setQuery,
            autoClearSearchValue: true,
            limit: 30,
            filter: (text: string, path: NativeOption[]) => {
              const haystack = normalizeSearch(
                path
                  .flatMap(option => [
                    option.label,
                    option.value,
                    option.description ?? '',
                    ...(option.keywords ?? []),
                  ])
                  .join(' '),
              );
              return normalizeSearch(text)
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .every(token => haystack.includes(token));
            },
            render: (_text: string, path: NativeOption[]) => (
              <span className="genux-cascader-result">
                <span>{path.at(-1)?.label}</span>
                <span className="genux-cascader-trail">
                  {path.map(option => option.label).join(' / ')}
                </span>
                {path.at(-1)?.description && (
                  <span className="genux-cascader-description">{path.at(-1)?.description}</span>
                )}
              </span>
            ),
          }
        : false,
    loadData:
      props.searchable === false && props.loadData
        ? (path: NativeOption[]) => props.loadData?.(path.map(option => option.value))
        : undefined,
    // Rows reuse the presentational Listy item; the native li keeps treeitem semantics.
    optionRender: (option: NativeOption) =>
      typeof option.label !== 'string' ? (
        option.label
      ) : (
        <GenUXListyItem
          label={option.label}
          description={option.description}
          trailing={option.disabled ? t('Unavailable') : undefined}
          disabled={!!option.disabled}
          interactive={false}
        />
      ),
    classNames: {
      root: 'genux-cascader-control',
      // The central Listy surface paints the popup; native menus keep their roles and handlers.
      popup: { root: `genux-select-popup genux-cascader-popup genux-listy-${listySurface}` },
    },
    getPopupContainer: (node: HTMLElement) =>
      node.closest<HTMLElement>('.genux-cascader') ?? document.body,
    onOpenChange: (next: boolean) => {
      setOpen(next);
      if (!next) setQuery('');
    },
    notFoundContent: (
      <span className="genux-cascader-empty">
        {t('No paths match. Try a team, area or shorter phrase.')}
      </span>
    ),
    // Guidance describes the combobox; the tree owns only levels and items.
    popupRender: (menu: ReactElement) => (
      <div className="genux-cascader-panel">
        <div
          id={`${id}-tree`}
          className="genux-cascader-tree"
          role="tree"
          aria-label={props.label}
          aria-multiselectable={props.multiple || undefined}
        >
          <div className="genux-cascader-scroll">{menu}</div>
        </div>
        <p id={`${id}-guidance`} className="genux-cascader-footer">
          {query
            ? t('Results show the complete path. Enter selects; Escape closes.')
            : t(
                'Browse levels with arrow keys. Enter selects; Escape closes. Swipe across levels on touch.',
              )}
        </p>
      </div>
    ),
  };
  return (
    <div
      className="genux-cascader"
      ref={root}
      data-cascader-field
      onPointerDownCapture={() => {
        inputMethod.current = 'pointer';
      }}
      onCompositionStartCapture={() => {
        composing.current = true;
      }}
      onCompositionEndCapture={() => {
        composing.current = false;
      }}
      onKeyDownCapture={event => {
        inputMethod.current = 'keyboard';
        if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229)
          event.stopPropagation();
      }}
    >
      <label htmlFor={id}>{props.label}</label>
      {/* Native single clear may deliver undefined; callers always receive a path array. */}
      {props.multiple ? (
        <Cascader<NativeOption, 'value'>
          {...common}
          multiple
          value={props.value.map(path => [...path])}
          onChange={value => {
            if (!blocked) props.onChange((value ?? []).map(path => [...path]));
          }}
          showCheckedStrategy={
            props.checkedStrategy === 'child' ? Cascader.SHOW_CHILD : Cascader.SHOW_PARENT
          }
          maxTagCount={1}
          maxTagTextLength={18}
        />
      ) : (
        <Cascader<NativeOption, 'value'>
          {...common}
          value={[...props.value]}
          changeOnSelect={props.changeOnSelect}
          onChange={value => {
            if (!blocked) props.onChange([...(value ?? [])]);
          }}
        />
      )}
      {props.help && (
        <p id={`${id}-help`} className="genux-cascader-help">
          {props.help}
        </p>
      )}
      {props.error && (
        <p id={`${id}-error`} className="genux-cascader-error" role="alert">
          {props.error}
        </p>
      )}
    </div>
  );
}
