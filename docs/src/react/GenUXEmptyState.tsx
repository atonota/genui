import { Empty } from 'antd';
import GenUXButton from './GenUXButton';
import GenUXIcon from './GenUXIcon';

export type GenUXEmptyStateKind = 'empty' | 'no-match' | 'error';
export type GenUXEmptyStateProps = {
  kind: GenUXEmptyStateKind;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  headingLevel?: 2 | 3 | 4 | 5 | 6;
};

// Decorative pictograms; the heading carries the meaning.
const icons: Record<GenUXEmptyStateKind, string> = {
  empty: 'plus',
  'no-match': 'search',
  error: 'reload',
};

/** Native Empty adapter. Callers supply translated text; the action stays outside the live text. */
export default function GenUXEmptyState({
  kind,
  title,
  description,
  actionLabel,
  onAction,
  headingLevel = 4,
}: GenUXEmptyStateProps) {
  const Heading = ('h' + headingLevel) as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  return (
    <Empty
      className="genux-empty-state"
      image={<GenUXIcon name={icons[kind]} />}
      description={
        <div
          className="genux-empty-state-text"
          data-empty-state={kind}
          role={kind === 'error' ? 'alert' : 'status'}
        >
          <Heading className="genux-empty-state-title">{title}</Heading>
          {description && <p className="genux-empty-state-description">{description}</p>}
        </div>
      }
    >
      {/* Recovery exists only when the caller grants it; no callback is fabricated. */}
      {actionLabel && onAction ? <GenUXButton text={actionLabel} onClick={onAction} /> : null}
    </Empty>
  );
}
