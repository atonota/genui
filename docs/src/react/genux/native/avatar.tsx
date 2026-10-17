import GenUXAvatar from '../../GenUXAvatar';
import type { NativeAdapterProps } from '../../../genux/native-contract';
import { definition } from '../../../genux/native/avatar';

/** Read-only person identity: no controls, so disabled, onChange and onAction stay unused. */
export default function AvatarNative({ data }: NativeAdapterProps) {
  const avatar = definition.parse(data);
  return (
    <GenUXAvatar
      name={String(avatar.name)}
      src={typeof avatar.src === 'string' ? avatar.src : undefined}
      shape={avatar.shape === 'square' ? 'square' : 'circle'}
    />
  );
}
