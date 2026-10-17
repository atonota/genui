import GenUXEmptyState, { type GenUXEmptyStateKind } from '../../GenUXEmptyState';
import type { NativeAdapterProps } from '../../../genux/native-contract';

export type NativeEmptyStateProps = NativeAdapterProps & { actionAvailable?: boolean };

/** Native EmptyState adapter. Data arrives validated; recovery appears only when the core grants it. */
export default function NativeEmptyState({
  data,
  disabled,
  onAction,
  actionAvailable = false,
}: NativeEmptyStateProps) {
  const actionLabel = typeof data.actionLabel === 'string' ? data.actionLabel : undefined;
  const granted = actionAvailable && !disabled && actionLabel !== undefined;
  return (
    <GenUXEmptyState
      kind={data.kind as GenUXEmptyStateKind}
      title={data.title as string}
      description={typeof data.description === 'string' ? data.description : undefined}
      headingLevel={data.headingLevel as 2 | 3 | 4 | 5 | 6 | undefined}
      actionLabel={granted ? actionLabel : undefined}
      onAction={granted ? onAction : undefined}
    />
  );
}
