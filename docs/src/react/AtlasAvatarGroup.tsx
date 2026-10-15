import { useId, useState } from 'react';
import AtlasAvatar from './AtlasAvatar';
import AtlasButton from './AtlasButton';
import { useI18n } from './useI18n';

export type AtlasAvatarGroupPerson = { id: string; name: string; src?: string };
export type AtlasAvatarGroupProps = { people: AtlasAvatarGroupPerson[]; maxVisible?: number };

/** Overlapping decorative faces beside always-visible names; overflow expands the whole list. */
export default function AtlasAvatarGroup({ people, maxVisible = 3 }: AtlasAvatarGroupProps) {
  const { t } = useI18n();
  const namesId = useId();
  const [expanded, setExpanded] = useState(false);
  const limit = Number.isFinite(maxVisible) ? Math.max(1, Math.floor(maxVisible)) : 3;
  const hidden = Math.max(0, people.length - limit);
  const collapsed = !expanded && hidden > 0;
  const shown = collapsed ? people.slice(0, limit) : people;
  return (
    <div className="atlas-avatar-group" data-expanded={expanded ? 'true' : 'false'}>
      {/* The names list carries the meaning, so the overlapping faces stay out of the accessibility tree. */}
      <div className="atlas-avatar-group-stack" aria-hidden="true">
        {shown.map(person => (
          <AtlasAvatar key={person.id} name={person.name} src={person.src} />
        ))}
        {collapsed && <span className="atlas-avatar-group-more">+{hidden}</span>}
      </div>
      <ul id={namesId} className="atlas-avatar-group-names">
        {shown.map(person => (
          <li key={person.id}>{person.name}</li>
        ))}
        {collapsed && (
          <li className="atlas-avatar-group-count">
            {t('{count} more people', { count: hidden })}
          </li>
        )}
      </ul>
      {hidden > 0 && (
        <AtlasButton
          fill="text"
          text={t('Expand people')}
          aria-expanded={expanded}
          aria-controls={namesId}
          onClick={() => setExpanded(value => !value)}
        />
      )}
    </div>
  );
}
