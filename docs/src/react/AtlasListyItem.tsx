import type { HTMLAttributes, ReactNode } from 'react';
import '../styles/atlas-listy.css';

export type AtlasListySurface = 'inset' | 'outlined';

/** Semantic slot classes for the installed AntD Listy; the list owns one functional boundary. */
export function atlasListyClassNames(surface: AtlasListySurface = 'inset') {
  return { root: `atlas-listy atlas-listy-${surface}`, item: 'atlas-listy-slot' };
}

export type AtlasListyItemProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'role'> & {
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
export default function AtlasListyItem({
  label,
  description,
  leading,
  trailing,
  selected = false,
  disabled = false,
  interactive = false,
  className,
  ...rest
}: AtlasListyItemProps) {
  const rich = present(description) || present(leading);
  return (
    <div
      {...rest}
      className={['atlas-listy-item', className].filter(Boolean).join(' ')}
      data-atlas-listy-item=""
      data-layout={rich ? 'rich' : 'simple'}
      data-selected={selected || undefined}
      data-disabled={disabled || undefined}
      data-interactive={(interactive && !disabled) || undefined}
    >
      {present(leading) && <span className="atlas-listy-leading">{leading}</span>}
      <span className="atlas-listy-text">
        <span className="atlas-listy-label">{label}</span>
        {present(description) && <span className="atlas-listy-description">{description}</span>}
      </span>
      {present(trailing) && <span className="atlas-listy-trailing">{trailing}</span>}
    </div>
  );
}
