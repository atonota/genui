import type { NativeAdapterProps } from '../../../genux/native-contract';
import { definition } from '../../../genux/native/avatar-group';
import GenUXAvatarGroup, { type GenUXAvatarGroupPerson } from '../../GenUXAvatarGroup';

/** Read-only adapter: only overflow expansion is local, ephemeral viewing state inside GenUXAvatarGroup. */
export default function AvatarGroupNative({ data }: NativeAdapterProps) {
  const parsed = definition.parse(data);
  const people = (parsed.people as { id: string; name: string; src?: string }[]).map(
    (person): GenUXAvatarGroupPerson =>
      person.src === undefined
        ? { id: person.id, name: person.name }
        : { id: person.id, name: person.name, src: person.src },
  );
  const maxVisible = typeof parsed.maxVisible === 'number' ? parsed.maxVisible : undefined;
  return <GenUXAvatarGroup people={people} maxVisible={maxVisible} />;
}
