import type { ReactNode } from 'react';
import { Listy, type ListyProps } from 'antd';
import AtlasListyItem from './AtlasListyItem';

export type AtlasListyEntry = Readonly<{
  key: string;
  label: string;
  description?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  disabled?: boolean;
}>;
export type AtlasListyPresentation = 'inset' | 'outlined';
export type AtlasListyProps = {
  label: string;
  items: readonly AtlasListyEntry[];
  presentation?: AtlasListyPresentation;
  className?: string;
  classNames?: ListyProps<AtlasListyEntry, string>['classNames'];
  styles?: ListyProps<AtlasListyEntry, string>['styles'];
};

/** Native Listy owns rendering; every row composes the shared AtlasListyItem. */
export default function AtlasListy({
  label,
  items,
  presentation = 'inset',
  className,
  classNames,
  styles,
}: AtlasListyProps) {
  return (
    <div
      className="atlas-listy-frame"
      role="group"
      aria-label={label}
      data-atlas-listy-presentation={presentation}
    >
      <Listy<AtlasListyEntry, string>
        rootClassName={['atlas-listy', `atlas-listy-${presentation}`, className]
          .filter(Boolean)
          .join(' ')}
        items={[...items]}
        rowKey="key"
        virtual={false}
        classNames={classNames}
        styles={styles}
        itemRender={item => (
          <AtlasListyItem
            label={item.label}
            description={item.description}
            leading={item.leading}
            trailing={item.trailing}
            disabled={item.disabled}
          />
        )}
      />
    </div>
  );
}
