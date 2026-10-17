import GenUXIcon, { type GenUXIconName } from './GenUXIcon';

export type GenUXIconListItem = {
  id: string;
  title: string;
  description?: string;
  icon?: GenUXIconName;
};

/** Native list; icons are decorative and the visible title carries the meaning. */
export default function GenUXIconList({ items }: { items: GenUXIconListItem[] }) {
  return (
    <ul className="genux-icon-list">
      {items.map(item => (
        <li key={item.id} className="genux-icon-list-item">
          <span className="genux-icon-list-marker" aria-hidden="true">
            {item.icon && <GenUXIcon name={item.icon} />}
          </span>
          <span className="genux-icon-list-text">
            <span className="genux-icon-list-title">{item.title}</span>
            {item.description && (
              <span className="genux-icon-list-description">{item.description}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
