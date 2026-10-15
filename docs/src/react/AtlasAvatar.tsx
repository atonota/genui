import { useState, type CSSProperties } from 'react';
import { Avatar } from 'antd';
import { useI18n } from './useI18n';
import { atlasLength, useAtlasAppearance } from './AtlasAppearance';
import { atlasSizeProfiles, useAtlasSize, type AtlasSize } from './AtlasSizeProfile';

export type AtlasAvatarProps = {
  name: string;
  src?: string;
  size?: AtlasSize;
  shape?: 'circle' | 'square';
  /** Hides the avatar from assistive technology when the same name is visible beside it. */
  decorative?: boolean;
};

const words = (name: string) => name.trim().split(/\s+/u).filter(Boolean);

/** Up to two initials from the first and last words; Array.from keeps code points intact. */
export function avatarInitials(name: string): string {
  const parts = words(name);
  if (parts.length === 0) return '?';
  const first = Array.from(parts[0]!)[0] ?? '';
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1]!)[0] ?? '') : '';
  return Array.from((first + last).toLocaleUpperCase())
    .slice(0, 2)
    .join('');
}

/** Person image with an initials fallback; standalone it is one named image, decorative it is hidden. */
export default function AtlasAvatar({
  name,
  src,
  size,
  shape = 'circle',
  decorative = false,
}: AtlasAvatarProps) {
  const { t } = useI18n();
  const appearance = useAtlasAppearance();
  const inheritedSize = useAtlasSize();
  const source = src?.trim() ? src : undefined;
  const [requested, setRequested] = useState(source);
  const [failed, setFailed] = useState(false);
  // A new source clears the previous failure; the keyed native Avatar retries the image.
  if (requested !== source) {
    setRequested(source);
    setFailed(false);
  }
  const parts = words(name);
  const label = parts.length > 0 ? parts.join(' ') : t('Unknown person');
  const dimensions =
    atlasSizeProfiles.find(item => item.value === (size ?? inheritedSize)) ?? atlasSizeProfiles[1]!;
  return (
    <span
      className="atlas-avatar"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      data-size={dimensions.value}
      data-avatar-shape={shape}
      data-avatar-image={source === undefined ? 'none' : failed ? 'fallback' : 'image'}
      style={
        { '--atlas-avatar-size': atlasLength(dimensions.height_px, appearance) } as CSSProperties
      }
    >
      <Avatar
        key={source ?? 'initials'}
        className="atlas-avatar-face"
        shape={shape}
        src={source}
        alt=""
        draggable={false}
        aria-hidden="true"
        onError={() => {
          setFailed(true);
          // true lets the native Avatar replace the broken image with the initials.
          return true;
        }}
      >
        {avatarInitials(name)}
      </Avatar>
    </span>
  );
}
