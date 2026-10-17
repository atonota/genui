import { useId, useState } from 'react';
import GenUXAvatar from './GenUXAvatar';
import GenUXButton from './GenUXButton';
import { useI18n } from './useI18n';

export type GenUXAvatarGroupPerson = { id: string; name: string; src?: string };
export type GenUXAvatarGroupProps = { people: GenUXAvatarGroupPerson[]; maxVisible?: number };

/** Overlapping decorative faces beside always-visible names; overflow expands the whole list. */
export default function GenUXAvatarGroup({ people, maxVisible = 3 }: GenUXAvatarGroupProps) {
  const { t } = useI18n();
  const namesId = useId();
  const [expanded, setExpanded] = useState(false);
  const limit = Number.isFinite(maxVisible) ? Math.max(1, Math.floor(maxVisible)) : 3;
  const hidden = Math.max(0, people.length - limit);
  const collapsed = !expanded && hidden > 0;
  const shown = collapsed ? people.slice(0, limit) : people;
  return (
    <div className="genux-avatar-group" data-expanded={expanded ? 'true' : 'false'}>
      {/* The names list carries the meaning, so the overlapping faces stay out of the accessibility tree. */}
      <div className="genux-avatar-group-stack" aria-hidden="true">
        {shown.map(person => (
          <GenUXAvatar key={person.id} name={person.name} src={person.src} />
        ))}
        {collapsed && <span className="genux-avatar-group-more">+{hidden}</span>}
      </div>
      <ul id={namesId} className="genux-avatar-group-names">
        {shown.map(person => (
          <li key={person.id}>{person.name}</li>
        ))}
        {collapsed && (
          <li className="genux-avatar-group-count">
            {t('{count} more people', { count: hidden })}
          </li>
        )}
      </ul>
      {hidden > 0 && (
        <GenUXButton
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
