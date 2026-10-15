import type { ReactNode } from 'react';
import type { SelectProps } from 'antd';

/** Resolve presentation from current options without rewriting selected values or user tags. */
export function selectedLabel(
  options: SelectProps['options'],
  translate: (message: string) => string = message => message,
): NonNullable<SelectProps['labelRender']> {
  const find = (items: SelectProps['options'], value: unknown): ReactNode => {
    for (const option of items ?? []) {
      if (Array.isArray(option.options)) {
        const label = find(option.options, value);
        if (label !== undefined) return label;
      } else if (option.value === value) {
        return typeof option.label === 'string' ? translate(option.label) : option.label;
      }
    }
    return undefined;
  };
  return ({ value, label }) => find(options, value) ?? label;
}
