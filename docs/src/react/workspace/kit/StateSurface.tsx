import type { ReactNode } from 'react';
import AtlasButton from '../../AtlasButton';
import AtlasEmptyState from '../../AtlasEmptyState';
import { useI18n } from '../../useI18n';
import { isReadableSurface, type SurfaceState } from './contracts';

const labels = {
  loading: 'Loading supplied records',
  empty: 'No records yet',
  'no-match': 'No matching records',
  error: 'The supplied records could not be shown',
  'not-found': 'Record not found',
  denied: 'Access is not available',
  partial: 'Some supplied records are unavailable',
  stale: 'Showing an older supplied snapshot',
  unknown: 'Record state is unknown',
} as const;
export function StateSurface({
  state,
  children,
  headingLevel = 4,
}: {
  state: SurfaceState;
  children?: ReactNode;
  headingLevel?: 2 | 3 | 4 | 5 | 6;
}) {
  const { t } = useI18n();
  if (state.kind === 'ready') return <>{children}</>;
  // Collection gaps use the shared Empty adapter; it owns the single live role and keeps
  // recovery outside that live text. These kinds never expose readable children.
  if (state.kind === 'empty' || state.kind === 'no-match' || state.kind === 'error') {
    return (
      <div className="kit-state-surface" data-surface-state={state.kind}>
        <AtlasEmptyState
          kind={state.kind}
          title={t(labels[state.kind])}
          description={state.message ? t(state.message) : undefined}
          actionLabel={
            state.onRecover
              ? t(
                  state.recoveryLabel ??
                    (state.kind === 'no-match' ? 'Clear filters' : 'Try again'),
                )
              : undefined
          }
          onAction={state.onRecover}
          headingLevel={headingLevel}
        />
      </div>
    );
  }
  const informational = isReadableSurface(state);
  const Heading = ('h' + headingLevel) as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  return (
    <>
      <div
        className="kit-state-surface"
        data-surface-state={state.kind}
        role="status"
        aria-busy={state.kind === 'loading'}
      >
        <Heading>{t(labels[state.kind])}</Heading>
        {state.message && <p>{t(state.message)}</p>}
        {state.onRecover && (
          <AtlasButton text={t(state.recoveryLabel ?? 'Try again')} onClick={state.onRecover} />
        )}
      </div>
      {informational && children}
    </>
  );
}
export default StateSurface;
