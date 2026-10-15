import '../../../styles/atlas-avatar.css';
import '../../../styles/atlas-content-patterns.css';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { definition } from '../../../genui/native/avatar-group';
import AtlasAvatarGroup, { type AtlasAvatarGroupPerson } from '../../AtlasAvatarGroup';

/** Read-only adapter: only overflow expansion is local, ephemeral viewing state inside AtlasAvatarGroup. */
export default function AvatarGroupNative({ data }: NativeAdapterProps) {
  const parsed = definition.parse(data);
  const people = (parsed.people as { id: string; name: string; src?: string }[]).map(
    (person): AtlasAvatarGroupPerson =>
      person.src === undefined
        ? { id: person.id, name: person.name }
        : { id: person.id, name: person.name, src: person.src },
  );
  const maxVisible = typeof parsed.maxVisible === 'number' ? parsed.maxVisible : undefined;
  return <AtlasAvatarGroup people={people} maxVisible={maxVisible} />;
}
