import type { CSSProperties, RefAttributes } from 'react';
import { Segmented, type SegmentedProps } from 'antd';
import atlas from '../data/atlas.json';
import { useAtlasSize, type AtlasSize } from './AtlasSizeProfile';
import { useAtlasAppearance, atlasLength } from './AtlasAppearance';

export type AtlasSegmentedProps<T extends string | number> = Omit<SegmentedProps<T>, 'size'> &
  RefAttributes<HTMLDivElement> & { size?: AtlasSize };

/** Native single-selection semantics with the shared wrapper and size profile. */
export default function AtlasSegmented<T extends string | number>({
  size,
  className,
  style,
  ...props
}: AtlasSegmentedProps<T>) {
  const inheritedSize = useAtlasSize();
  const appearance = useAtlasAppearance();
  const profile =
    atlas.decisions.buttons.size_variants.find(item => item.value === (size ?? inheritedSize)) ??
    atlas.decisions.buttons.size_variants[1]!;
  return (
    <Segmented<T>
      {...props}
      size={profile.value === 'sm' ? 'small' : profile.value === 'lg' ? 'large' : 'middle'}
      className={[...new Set(['atlas-segmented', ...(className?.split(/\s+/) ?? [])])].join(' ')}
      style={
        {
          '--atlas-segmented-height': atlasLength(profile.height_px, appearance),
          ...style,
        } as CSSProperties
      }
    />
  );
}
