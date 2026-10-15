import '../../../styles/atlas-avatar.css';
import AtlasAvatar from '../../AtlasAvatar';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { definition } from '../../../genui/native/avatar';

/** Read-only person identity: no controls, so disabled, onChange and onAction stay unused. */
export default function AvatarNative({ data }: NativeAdapterProps) {
  const avatar = definition.parse(data);
  return (
    <AtlasAvatar
      name={String(avatar.name)}
      src={typeof avatar.src === 'string' ? avatar.src : undefined}
      shape={avatar.shape === 'square' ? 'square' : 'circle'}
    />
  );
}
