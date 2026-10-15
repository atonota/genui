import AtlasIcon, { type AtlasIconName } from './AtlasIcon';

export type AtlasIconListItem = {
  id: string;
  title: string;
  description?: string;
  icon?: AtlasIconName;
};

/** Native list; icons are decorative and the visible title carries the meaning. */
export default function AtlasIconList({ items }: { items: AtlasIconListItem[] }) {
  return (
    <ul className="atlas-icon-list">
      {items.map(item => (
        <li key={item.id} className="atlas-icon-list-item">
          <span className="atlas-icon-list-marker" aria-hidden="true">
            {item.icon && <AtlasIcon name={item.icon} />}
          </span>
          <span className="atlas-icon-list-text">
            <span className="atlas-icon-list-title">{item.title}</span>
            {item.description && (
              <span className="atlas-icon-list-description">{item.description}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
