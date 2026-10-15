import { useMemo, useState, useSyncExternalStore } from 'react';
import type { GenUIRuntime } from '../../genui/contracts';
import {
  getSelectionContext,
  isSelectionContextCurrent,
  type HybridSelectionContext,
} from '../../genui/hybrid-context';
import AtlasButton from '../AtlasButton';
import { useI18n } from '../useI18n';

const resultMessages = {
  prepared: 'Selected records prepared as local context. No request was sent.',
  stale: 'The selection changed. Check the current selection, then prepare again.',
} as const;

/** Prepares the current selection as context only; it never sends, runs or clears anything. */
export default function HybridQuickBar({
  runtime,
  onPrepare,
}: {
  runtime: GenUIRuntime;
  onPrepare: (context: HybridSelectionContext) => void;
}) {
  const { t } = useI18n();
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  );
  const context = useMemo(() => getSelectionContext(snapshot), [snapshot]);
  const count = context?.selections.reduce((sum, item) => sum + item.recordIds.length, 0) ?? 0;
  const [result, setResult] = useState<{
    kind: keyof typeof resultMessages;
    revision: number;
  } | null>(null);
  const prepare = () => {
    // Re-read the runtime: the rendered selection may already be stale or hidden.
    const current = runtime.getSnapshot();
    if (!context || !isSelectionContextCurrent(current, context)) {
      setResult({ kind: 'stale', revision: current.revision });
      return;
    }
    onPrepare(getSelectionContext(current)!);
    setResult({ kind: 'prepared', revision: current.revision });
  };
  // A result describes one revision; a later selection change retires it.
  const shown = result && result.revision === snapshot.revision ? result.kind : null;
  return (
    <section aria-label={t('Selected record context')} data-hybrid-quick-bar>
      <dl className="genui-scope">
        <div>
          <dt>{t('Scope')}</dt>
          <dd data-hybrid-scope>{snapshot.scopeId}</dd>
        </div>
        <div>
          <dt>{t('Selected records')}</dt>
          <dd data-hybrid-selection-count>{count}</dd>
        </div>
        <div>
          <dt>{t('Current revision')}</dt>
          <dd>{snapshot.revision}</dd>
        </div>
        <div>
          <dt>{t('Source')}</dt>
          <dd>{t('Recorded local fixture · no model or server')}</dd>
        </div>
      </dl>
      <div className="genui-actions">
        <AtlasButton
          fill="outline"
          disabled={!context}
          onClick={prepare}
          text={t('Prepare selected records')}
        />
      </div>
      <p className="genui-hint">
        {t('Prepares the selected records as local context only. Nothing is sent or run.')}
      </p>
      <p role="status" aria-live="polite" data-hybrid-prepare-result={shown ?? undefined}>
        {shown ? t(resultMessages[shown]) : null}
      </p>
    </section>
  );
}
