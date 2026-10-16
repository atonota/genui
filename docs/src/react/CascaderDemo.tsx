import { useId, useMemo, useState } from 'react';
import { Select } from 'antd';
import AtlasProvider from './AtlasProvider';
import AtlasCascader, { resolveCascadePath, type AtlasCascadeOption } from './AtlasCascader';
import { TweakerSettings } from './AtlasTweaker';
import ExamplePreview from './ExamplePreview';
import { useI18n } from './useI18n';

function CascaderExamples() {
  const { locale, t } = useI18n();
  const id = useId();
  const [destination, setDestination] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<string[][]>([['studio', 'design', 'library']]);
  const [compact, setCompact] = useState<string[]>(['studio', 'engineering', 'review']);
  const [branch, setBranch] = useState<string[]>([]);
  const [strategy, setStrategy] = useState<'parent' | 'child'>('parent');
  const [selectionLabel, setSelectionLabel] = useState<'path' | 'leaf'>('path');
  const [loaded, setLoaded] = useState(false);
  const [lazyValue, setLazyValue] = useState<string[]>([]);
  const options = useMemo<AtlasCascadeOption[]>(
    () => [
      {
        value: 'studio',
        label: t('Studio'),
        description: t('Product and delivery'),
        children: [
          {
            value: 'design',
            label: t('Design'),
            description: t('Craft the experience'),
            children: [
              {
                value: 'library',
                label: t('Component library'),
                description: t('Shared patterns and foundations'),
                keywords: ['ui', 'components', 'bileşen'],
              },
              {
                value: 'review',
                label: t('Review'),
                description: t('Review design systems'),
                keywords: ['design', 'tasarım'],
              },
            ],
          },
          {
            value: 'engineering',
            label: t('Engineering'),
            description: t('Build and maintain'),
            children: [
              {
                value: 'platform',
                label: t('Platform'),
                description: t('Services and integrations'),
              },
              {
                value: 'review',
                label: t('Review'),
                description: t('Review release quality'),
                keywords: ['release', 'quality', 'sürüm'],
              },
            ],
          },
          {
            value: 'operations',
            label: t('Operations'),
            description: t('Keep work moving'),
            children: [
              {
                value: 'planning',
                label: t('Planning'),
                description: t('Coordinate upcoming work'),
              },
              { value: 'delivery', label: t('Delivery'), description: t('Track commitments') },
            ],
          },
          {
            value: 'archive',
            label: t('Archive'),
            description: t('Closed for new assignments'),
            disabled: true,
            children: [{ value: 'previous', label: t('Previous work') }],
          },
        ],
      },
    ],
    [locale],
  );
  const lazyOptions: AtlasCascadeOption[] = [
    {
      value: 'collection',
      label: t('Collection'),
      description: t('Open to reveal the local sample'),
      isLeaf: false,
      ...(loaded
        ? {
            children: [
              {
                value: 'records',
                label: t('Records'),
                children: [
                  { value: 'active', label: t('Active records') },
                  { value: 'drafts', label: t('Draft records') },
                ],
              },
            ],
          }
        : {}),
    },
  ];
  const describe = (path: readonly string[]) =>
    resolveCascadePath(options, path)
      .map(option => option.label)
      .join(' / ');
  return (
    <div className="cascader-catalog" data-cascader-catalog>
      <TweakerSettings title="Cascader">
        <label className="playground-control" htmlFor={`${id}-strategy`}>
          {t('Multiple selection summary')}
          <Select
            id={`${id}-strategy`}
            data-cascader-strategy
            value={strategy}
            onChange={setStrategy}
            options={[
              { value: 'parent', label: t('Group completed branches') },
              { value: 'child', label: t('Show individual leaves') },
            ]}
          />
        </label>
        <label className="playground-control" htmlFor={`${id}-display`}>
          {t('Selected path display')}
          <Select
            id={`${id}-display`}
            data-cascader-display
            value={selectionLabel}
            onChange={setSelectionLabel}
            options={[
              { value: 'path', label: t('Complete path') },
              { value: 'leaf', label: t('Final item') },
            ]}
          />
        </label>
      </TweakerSettings>
      <nav className="cascader-navigation" aria-label={t('Cascader examples')}>
        <a href="#cascader-search">{t('Browse or search')}</a>
        <a href="#cascader-multiple">{t('Select several paths')}</a>
        <a href="#cascader-display">{t('Path presentation')}</a>
        <a href="#cascader-states">{t('Availability and guidance')}</a>
        <a href="#cascader-lazy">{t('Reveal on demand')}</a>
      </nav>
      <section
        id="cascader-search"
        className="cascader-section"
        aria-labelledby="cascader-search-title"
        data-cascader-primary
      >
        <header>
          <p className="eyebrow">{t('01 · Find your destination')}</p>
          <h3 id="cascader-search-title">{t('Browse or search')}</h3>
          <p>
            {t(
              'Explore one level at a time, or search across the whole path. Similar names keep their context.',
            )}
          </p>
        </header>
        <ExamplePreview id="cascader-browse-or-search" title={t('Browse or search')}>
          <AtlasCascader
            label={t('Workspace destination')}
            value={destination}
            onChange={setDestination}
            options={options}
            help={t(
              'Try “engineering review”, “library” or a team name. Choose a result to confirm.',
            )}
          />
          <div
            className="cascader-summary"
            data-cascader-selection={destination.join('/')}
            aria-live="polite"
          >
            <p className="eyebrow">{t('Selected destination')}</p>
            <p>
              {destination.length
                ? describe(destination)
                : t('No destination selected. Browsing and searching do not commit a choice.')}
            </p>
          </div>
        </ExamplePreview>
      </section>
      <section
        id="cascader-multiple"
        className="cascader-section"
        aria-labelledby="cascader-multiple-title"
      >
        <header>
          <p className="eyebrow">{t('02 · Keep the selection clear')}</p>
          <h3 id="cascader-multiple-title">{t('Select several paths')}</h3>
          <p>
            {t(
              'Choose individual items or a complete branch. Partial branches remain visible, and the full selection stays readable below.',
            )}
          </p>
        </header>
        <ExamplePreview id="cascader-several-paths" title={t('Select several paths')}>
          <AtlasCascader
            label={t('Assigned areas')}
            multiple
            value={assignments}
            onChange={setAssignments}
            options={options}
            checkedStrategy={strategy}
            help={t('Change the branch summary in Tweaker. Clearing removes the selection.')}
          />
          <div
            className="cascader-summary"
            data-cascader-assignments={JSON.stringify(assignments)}
            aria-live="polite"
          >
            <p className="eyebrow">{t('Selected paths')}</p>
            {assignments.length ? (
              <ul>
                {assignments.map(path => (
                  <li key={JSON.stringify(path)}>{describe(path)}</li>
                ))}
              </ul>
            ) : (
              <p>{t('No areas selected.')}</p>
            )}
          </div>
        </ExamplePreview>
      </section>
      <section
        id="cascader-display"
        className="cascader-section"
        aria-labelledby="cascader-display-title"
      >
        <header>
          <p className="eyebrow">{t('03 · Show the right amount of context')}</p>
          <h3 id="cascader-display-title">{t('Path presentation')}</h3>
          <p>
            {t(
              'Use a compact final label when space is limited. Keep the complete path nearby so identical names remain unambiguous.',
            )}
          </p>
        </header>
        <ExamplePreview id="cascader-path-presentation" title={t('Path presentation')}>
          <div className="cascader-example-grid">
            <div className="cascader-example">
              <AtlasCascader
                label={t('Selected path')}
                options={options}
                value={compact}
                onChange={setCompact}
                selectionLabel={selectionLabel}
                help={t('Switch complete path or final item in Tweaker.')}
              />
              <p className="cascader-path" data-cascader-full-path>
                {compact.length ? describe(compact) : t('No destination selected.')}
              </p>
            </div>
            <div className="cascader-example">
              <AtlasCascader
                label={t('Team or specific area')}
                options={options}
                value={branch}
                onChange={setBranch}
                changeOnSelect
                help={t('A team can be selected without choosing its final item.')}
              />
              <p className="cascader-path">
                {branch.length ? describe(branch) : t('No team selected.')}
              </p>
            </div>
          </div>
        </ExamplePreview>
      </section>
      <section
        id="cascader-states"
        className="cascader-section"
        aria-labelledby="cascader-states-title"
      >
        <header>
          <p className="eyebrow">{t('04 · Explain what is available')}</p>
          <h3 id="cascader-states-title">{t('Availability and guidance')}</h3>
          <p>
            {t(
              'Unavailable branches explain why. Validation points to a clear next step, while a disabled field retains its value.',
            )}
          </p>
        </header>
        <ExamplePreview id="cascader-availability-guidance" title={t('Availability and guidance')}>
          <div className="cascader-example-grid">
            <div data-cascader-example="error">
              <AtlasCascader
                label={t('Required destination')}
                value={branch}
                onChange={setBranch}
                options={options}
                error={!branch.length ? t('Choose a team or area before continuing.') : undefined}
                help={t('This local example clears the error after a choice.')}
                changeOnSelect
              />
            </div>
            <div data-cascader-example="disabled">
              <AtlasCascader
                label={t('Locked destination')}
                value={['studio', 'design', 'library']}
                onChange={() => {}}
                options={options}
                disabled
                help={t('This assignment is locked. Its current path remains visible.')}
              />
            </div>
          </div>
        </ExamplePreview>
      </section>
      <section
        id="cascader-lazy"
        className="cascader-section"
        aria-labelledby="cascader-lazy-title"
      >
        <header>
          <p className="eyebrow">{t('05 · Reveal only when needed')}</p>
          <h3 id="cascader-lazy-title">{t('Reveal on demand')}</h3>
          <p>
            {t(
              'Open Collection to reveal its children. This is a local sample; it makes no network request. Search is unavailable in this mode.',
            )}
          </p>
        </header>
        <ExamplePreview id="cascader-reveal-on-demand" title={t('Reveal on demand')}>
          <AtlasCascader
            label={t('Browse a collection')}
            options={lazyOptions}
            value={lazyValue}
            onChange={setLazyValue}
            searchable={false}
            loadData={() => setLoaded(true)}
            help={
              loaded
                ? t('Local children are available. Continue to a record group.')
                : t('Children have not been revealed yet.')
            }
          />
          <p className="cascader-path" data-cascader-lazy-value={lazyValue.join('/')}>
            {lazyValue.length
              ? resolveCascadePath(lazyOptions, lazyValue)
                  .map(option => option.label)
                  .join(' / ')
              : t('No record group selected.')}
          </p>
        </ExamplePreview>
      </section>
    </div>
  );
}
export default function CascaderDemo({ documentation = false }: { documentation?: boolean }) {
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined}>
      <CascaderExamples />
    </AtlasProvider>
  );
}
