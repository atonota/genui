import { useMemo, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import { Listy, type ListyProps } from 'antd';
import type { ListyRef } from 'antd/es/listy';
import GenUXListyItem from './GenUXListyItem';
import useListySurface from './useListySurface';

export type GenUXListyEntry = Readonly<{
  key: string;
  label: string;
  description?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  disabled?: boolean;
  /** Controlled state mirrored for styling; hosts own roles, keyboard handling and aria state. */
  selected?: boolean;
  interactive?: boolean;
  /** Plain grouping value a caller's native group key reads. */
  group?: string;
  /** Host attributes and handlers; the label, content and state flags above always win. */
  rowProps?: Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'role'>;
}>;
export type GenUXListyPresentation = 'inset' | 'outlined';
type NativeListyProps = ListyProps<GenUXListyEntry, string>;
// Native classNames are an object or a callback; the callback receives the installed Listy info.
type NativeClassNames = NonNullable<NativeListyProps['classNames']>;
type NativeClassNamesInfo = Parameters<Extract<NativeClassNames, (...args: never[]) => unknown>>;
export type GenUXListyProps = {
  label: string;
  items: readonly GenUXListyEntry[];
  /** Explicit presentation; without it the central Listy surface role applies. */
  presentation?: GenUXListyPresentation;
  className?: string;
  classNames?: NativeListyProps['classNames'];
  styles?: NativeListyProps['styles'];
  height?: number;
  virtual?: boolean;
  sticky?: boolean;
  group?: NativeListyProps['group'];
  onScroll?: NativeListyProps['onScroll'];
  ref?: Ref<ListyRef>;
};

/** Rows a bounded native scroller shows; multiply by useListyRowHeight() for its height. */
export const GENUX_LISTY_VISIBLE_ROWS = 6;

const join = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

/** Native Listy owns rendering, virtualization, grouping and sticky headers; every row composes
    the shared GenUXListyItem. */
export default function GenUXListy({
  label,
  items,
  presentation,
  className,
  classNames,
  styles,
  height,
  virtual = false,
  sticky,
  group,
  onScroll,
  ref,
}: GenUXListyProps) {
  const centralSurface = useListySurface();
  const surface = presentation ?? centralSurface;
  const data = useMemo(() => [...items], [items]);
  return (
    <div
      className="genux-listy-frame"
      role="group"
      aria-label={label}
      data-genux-listy-presentation={surface}
    >
      <Listy<GenUXListyEntry, string>
        ref={ref}
        rootClassName={join('genux-listy', `genux-listy-${surface}`, className)}
        items={data}
        rowKey="key"
        virtual={virtual}
        height={height}
        sticky={sticky}
        group={group}
        onScroll={onScroll}
        classNames={(...info: NativeClassNamesInfo) => {
          // Resolve the caller's object or callback with the native info, then compose slot roles.
          const resolved = typeof classNames === 'function' ? classNames(...info) : classNames;
          return {
            ...resolved,
            item: join('genux-listy-slot', resolved?.item),
            groupHeader: join('genux-listy-group-header', resolved?.groupHeader),
          };
        }}
        styles={styles}
        itemRender={item => (
          <GenUXListyItem
            {...item.rowProps}
            label={item.label}
            description={item.description}
            leading={item.leading}
            trailing={item.trailing}
            disabled={item.disabled}
            selected={item.selected}
            interactive={item.interactive}
          />
        )}
      />
    </div>
  );
}
