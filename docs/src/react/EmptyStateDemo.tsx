import { useEffect, useId, useRef, useState } from 'react';
import { Switch } from 'antd';
import GenUXProvider from './GenUXProvider';
import GenUXEmptyState from './GenUXEmptyState';
import { TweakerSettings } from './GenUXTweaker';
import GenUXInput from './GenUXInput';
import ExamplePreview from './ExamplePreview';
import { useI18n } from './useI18n';
import RecordCollection from './workspace/kit/RecordCollection';
import type { FieldDefinition, ProjectionState, QueryState } from './workspace/kit/contracts';

// Local example data only; nothing is fetched or persisted.
const exampleRecord = 'GenUX research brief';

type ExampleRecord = { id: string; title: string };

const exampleFields: readonly FieldDefinition<ExampleRecord>[] = [
  { key: 'title', label: 'Title', kind: 'text', getValue: record => record.title },
];

const emptyQuery: QueryState = { search: '', filters: [], sort: [] };

// The action that triggered a result unmounts, so focus moves to the result text.
function useFocusWhen(active: boolean) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (active) ref.current?.focus();
  }, [active]);
  return ref;
}

function FirstUseExample() {
  const { t } = useI18n();
  const headingId = useId();
  const [created, setCreated] = useState(false);
  const [query, setQuery] = useState<QueryState>(emptyQuery);
  const [projection, setProjection] = useState<ProjectionState>(['title']);
  const [checkedIds, setCheckedIds] = useState<readonly string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const resultRef = useFocusWhen(created);
  // The record exists only after the caller's create action; nothing is fetched or saved.
  const records: ExampleRecord[] = created
    ? [{ id: 'genux-research-brief', title: t(exampleRecord) }]
    : [];
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="variant-heading">
        {t('First-use collection')}
      </h3>
      <ExamplePreview id="empty-state-first-use" title={t('First-use collection')}>
        {created && (
          <p ref={resultRef} className="genux-empty-state-result" tabIndex={-1}>
            {t('First local record created')}
          </p>
        )}
        <RecordCollection
          title="First-use records"
          records={records}
          fields={exampleFields}
          query={query}
          onQueryChange={setQuery}
          activeId={activeId}
          onActiveIdChange={setActiveId}
          checkedIds={checkedIds}
          onCheckedIdsChange={setCheckedIds}
          projection={projection}
          onProjectionChange={setProjection}
          view="list"
          state={
            created
              ? undefined
              : {
                  kind: 'empty',
                  message: 'Create your first record to start organizing this collection.',
                  recoveryLabel: 'Create first record',
                  onRecover: () => setCreated(true),
                }
          }
        />
      </ExamplePreview>
    </section>
  );
}

function FilteredExample({ showDescription }: { showDescription: boolean }) {
  const { t } = useI18n();
  const headingId = useId();
  const inputId = useId();
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLocaleLowerCase();
  const matches = [t(exampleRecord)].filter(record =>
    record.toLocaleLowerCase().includes(normalized),
  );
  const clear = () => {
    setQuery('');
    // Keep the filter reachable once its recovery action disappears.
    document.getElementById(inputId)?.focus();
  };
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="variant-heading">
        {t('Filtered collection')}
      </h3>
      <ExamplePreview id="empty-state-filtered" title={t('Filtered collection')}>
        <div className="form-layout-control">
          <label htmlFor={inputId}>{t('Search example records')}</label>
          <GenUXInput id={inputId} value={query} onChange={event => setQuery(event.target.value)} />
        </div>
        {matches.length > 0 ? (
          <ul>
            {matches.map(record => (
              <li key={record}>{record}</li>
            ))}
          </ul>
        ) : (
          <GenUXEmptyState
            kind="no-match"
            title={t('No matching records')}
            description={
              showDescription
                ? t('Change your search or clear it to see the available records.')
                : undefined
            }
            actionLabel={t('Clear search')}
            onAction={clear}
          />
        )}
      </ExamplePreview>
    </section>
  );
}

function UnavailableExample({ showDescription }: { showDescription: boolean }) {
  const { t } = useI18n();
  const headingId = useId();
  const [restored, setRestored] = useState(false);
  const resultRef = useFocusWhen(restored);
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="variant-heading">
        {t('Unavailable collection')}
      </h3>
      <ExamplePreview id="empty-state-unavailable" title={t('Unavailable collection')}>
        {restored ? (
          <>
            <p ref={resultRef} className="genux-empty-state-result" tabIndex={-1}>
              {t('Local records restored')}
            </p>
            <ul>
              <li>{t(exampleRecord)}</li>
            </ul>
          </>
        ) : (
          <GenUXEmptyState
            kind="error"
            title={t('The supplied records could not be shown')}
            description={
              showDescription
                ? t('This local example can restore its supplied records.')
                : undefined
            }
            actionLabel={t('Try again')}
            onAction={() => setRestored(true)}
          />
        )}
      </ExamplePreview>
    </section>
  );
}

// Rendered inside the provider so translation stays within its context.
function LocalExamplesNote() {
  const { t } = useI18n();
  return <p>{t('Local examples only. Nothing is saved to a server.')}</p>;
}

function EmptyStateExamples() {
  const { t } = useI18n();
  const descriptionsId = useId();
  // Presentation only; create, search and retry stay inside the local preview.
  const [showDescriptions, setShowDescriptions] = useState(true);
  return (
    <div className="genux-content-examples">
      <LocalExamplesNote />
      <FirstUseExample />
      <FilteredExample showDescription={showDescriptions} />
      <UnavailableExample showDescription={showDescriptions} />
      <TweakerSettings title="Empty state">
        <div className="genux-tweaker-token">
          <label htmlFor={descriptionsId}>{t('Show descriptions')}</label>
          <Switch
            id={descriptionsId}
            checked={showDescriptions}
            onChange={checked => setShowDescriptions(checked)}
          />
        </div>
      </TweakerSettings>
    </div>
  );
}

export default function EmptyStateDemo({
  documentation = false,
}: { documentation?: boolean } = {}) {
  return (
    <GenUXProvider appearance={documentation ? 'docs' : undefined}>
      <EmptyStateExamples />
    </GenUXProvider>
  );
}
