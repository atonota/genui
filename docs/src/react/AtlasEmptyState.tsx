import { Empty } from 'antd';
import AtlasButton from './AtlasButton';
import AtlasIcon from './AtlasIcon';

export type AtlasEmptyStateKind = 'empty' | 'no-match' | 'error';
export type AtlasEmptyStateProps = {
  kind: AtlasEmptyStateKind;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  headingLevel?: 2 | 3 | 4 | 5 | 6;
};

// Decorative pictograms; the heading carries the meaning.
const icons: Record<AtlasEmptyStateKind, string> = {
  empty: 'plus',
  'no-match': 'search',
  error: 'reload',
};

/** Native Empty adapter. Callers supply translated text; the action stays outside the live text. */
export default function AtlasEmptyState({
  kind,
  title,
  description,
  actionLabel,
  onAction,
  headingLevel = 4,
}: AtlasEmptyStateProps) {
  const Heading = ('h' + headingLevel) as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  return (
    <Empty
      className="atlas-empty-state"
      image={<AtlasIcon name={icons[kind]} />}
      description={
        <div
          className="atlas-empty-state-text"
          data-empty-state={kind}
          role={kind === 'error' ? 'alert' : 'status'}
        >
          <Heading className="atlas-empty-state-title">{title}</Heading>
          {description && <p className="atlas-empty-state-description">{description}</p>}
        </div>
      }
    >
      {/* Recovery exists only when the caller grants it; no callback is fabricated. */}
      {actionLabel && onAction ? <AtlasButton text={actionLabel} onClick={onAction} /> : null}
    </Empty>
  );
}
