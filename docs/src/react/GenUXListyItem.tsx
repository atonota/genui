import type { HTMLAttributes, ReactNode } from 'react';
import '../styles/genux-listy.css';

export type GenUXListySurface = 'inset' | 'outlined';

/** Semantic slot classes for the installed AntD Listy; the list owns one functional boundary. */
export function genuxListyClassNames(surface: GenUXListySurface = 'inset') {
  return { root: `genux-listy genux-listy-${surface}`, item: 'genux-listy-slot' };
}

export type GenUXListyItemProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'role'> & {
  label: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  interactive?: boolean;
};

const present = (node: ReactNode) => node != null && node !== false && node !== '';

/**
 * Presentational row shared by AntD Listy and native Cascader options. Hosts own roles,
 * keyboard handling and aria state; the row only mirrors controlled state for styling.
 */
export default function GenUXListyItem({
  label,
  description,
  leading,
  trailing,
  selected = false,
  disabled = false,
  interactive = false,
  className,
  ...rest
}: GenUXListyItemProps) {
  // Leading icons and checkboxes keep the compact row; descriptions add padding and tall media
  // such as an avatar grow the row through its minimum height.
  const rich = present(description);
  return (
    <div
      {...rest}
      className={['genux-listy-item', className].filter(Boolean).join(' ')}
      data-genux-listy-item=""
      data-layout={rich ? 'rich' : 'simple'}
      data-selected={selected || undefined}
      data-disabled={disabled || undefined}
      data-interactive={(interactive && !disabled) || undefined}
    >
      {present(leading) && <span className="genux-listy-leading">{leading}</span>}
      <span className="genux-listy-text">
        <span className="genux-listy-label">{label}</span>
        {present(description) && <span className="genux-listy-description">{description}</span>}
      </span>
      {present(trailing) && <span className="genux-listy-trailing">{trailing}</span>}
    </div>
  );
}
