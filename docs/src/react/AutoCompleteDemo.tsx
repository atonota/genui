import { useId, useState } from 'react';
import { Select } from 'antd';
import AtlasProvider from './AtlasProvider';
import AtlasAutoComplete, { type AtlasSuggestion } from './AtlasAutoComplete';
import { TweakerSettings } from './AtlasTweaker';
import { useI18n } from './useI18n';

const knowledge = [
  {
    key: 'button',
    title: 'Button',
    description: 'Choose a clear action and the right emphasis.',
    group: { key: 'components', label: 'Components' },
    meta: 'Actions',
    keywords: ['button', 'action', 'primary', 'buton', 'eylem'],
    href: '/components/button/',
    related: '/components/dropdown/',
    relatedLabel: 'Explore Dropdown',
  },
  {
    key: 'pill',
    title: 'Pill',
    description: 'Label, categorize and select with readable tags.',
    group: { key: 'components', label: 'Components' },
    meta: 'Labels',
    keywords: ['pill', 'tag', 'label', 'etiket'],
    href: '/components/pill/',
    related: '/components/select/',
    relatedLabel: 'Explore Select',
  },
  {
    key: 'getting-started',
    title: 'Getting started',
    description: 'Set up the shared theme and native components.',
    group: { key: 'guides', label: 'Guides' },
    meta: 'Setup',
    keywords: ['getting started', 'guide', 'theme', 'kurulum', 'başlangıç'],
    href: '/getting-started/',
    related: '/tokens/',
    relatedLabel: 'Explore design tokens',
  },
  {
    key: 'color-system',
    title: 'Color system and palette',
    description: 'Tune one composition and compare live component colors.',
    group: { key: 'guides', label: 'Guides' },
    meta: 'Color',
    keywords: ['color system', 'palette', 'renk', 'palet'],
    href: '/color-system/',
    related: '/tokens/',
    relatedLabel: 'Explore design tokens',
  },
  {
    key: 'record-workspace',
    title: 'Record workspace',
    description: 'Move between a collection, record and local draft.',
    group: { key: 'workspace', label: 'Workspace' },
    meta: 'Records',
    keywords: ['workspace', 'record', 'draft', 'çalışma', 'kayıt', 'taslak'],
    href: '/components/record-workspace/',
    related: '/components/record-details/',
    relatedLabel: 'Explore record details',
  },
  {
    key: 'collection-views',
    title: 'Collection views',
    description: 'Find a useful way to browse and compare a collection.',
    group: { key: 'workspace', label: 'Workspace' },
    meta: 'Collections',
    keywords: ['collection', 'list', 'table', 'koleksiyon', 'liste', 'tablo'],
    href: '/components/collection-views/',
    related: '/components/data-table/',
    relatedLabel: 'Explore Data table',
  },
] as const;

type Availability = 'ready' | 'loading' | 'error';
type SuggestionDetail = 'detailed' | 'compact';

function AutoCompleteExamples() {
  const { t } = useI18n();
  const id = useId();
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [recoveryValue, setRecoveryValue] = useState('');
  const [availability, setAvailability] = useState<Availability>('ready');
  const [detail, setDetail] = useState<SuggestionDetail>('detailed');
  const [warningValue, setWarningValue] = useState('');
  const [errorValue, setErrorValue] = useState('team@');
  const selected = knowledge.find(item => item.key === selectedKey);
  const knowledgeItems: AtlasSuggestion[] = knowledge.map(item => ({
    key: item.key,
    value: t(item.title),
    title: t(item.title),
    description: detail === 'detailed' ? t(item.description) : undefined,
    group: { key: item.group.key, label: t(item.group.label) },
    meta: t(item.meta),
    keywords: [...item.keywords, item.title],
  }));
  const companyItems: AtlasSuggestion[] = [
    {
      key: 'atlas-studio',
      value: 'Atlas Studio',
      title: 'Atlas Studio',
      description: t('Design and product team'),
      meta: t('Sample team'),
    },
    {
      key: 'atlas-operations',
      value: 'Atlas Operations',
      title: 'Atlas Operations',
      description: t('Operations and delivery team'),
      meta: t('Sample team'),
    },
    {
      key: 'north-studio',
      value: 'North Studio',
      title: 'North Studio',
      description: t('Research and planning team'),
      meta: t('Sample team'),
    },
  ];
  const localPart = email.trim().split('@')[0] ?? '';
  const emailItems: AtlasSuggestion[] = localPart
    ? ['example.com', 'example.org', 'example.net'].map(domain => ({
        key: domain,
        value: `${localPart}@${domain}`,
        title: `${localPart}@${domain}`,
        description: t('Complete with a sample domain'),
      }))
    : [];

  return (
    <div className="autocomplete-catalog" data-autocomplete-catalog>
      <TweakerSettings title="AutoComplete">
        <label className="playground-control" htmlFor={`${id}-detail`}>
          {t('Suggestion detail')}
          <Select
            id={`${id}-detail`}
            data-autocomplete-detail
            value={detail}
            onChange={setDetail}
            options={[
              { value: 'detailed', label: t('Detailed') },
              { value: 'compact', label: t('Compact') },
            ]}
          />
        </label>
        <label className="playground-control" htmlFor={`${id}-availability`}>
          {t('Suggestion availability')}
          <Select
            id={`${id}-availability`}
            data-autocomplete-availability
            value={availability}
            onChange={setAvailability}
            options={[
              { value: 'ready', label: t('Ready') },
              { value: 'loading', label: t('Loading sample') },
              { value: 'error', label: t('Error sample') },
            ]}
          />
        </label>
      </TweakerSettings>
      <nav className="autocomplete-navigation" aria-label={t('AutoComplete examples')}>
        <a href="#autocomplete-discover">{t('Find with context')}</a>
        <a href="#autocomplete-patterns">{t('Useful completions')}</a>
        <a href="#autocomplete-recovery">{t('Suggestions and recovery')}</a>
        <a href="#autocomplete-availability">{t('Field availability')}</a>
      </nav>

      <section
        id="autocomplete-discover"
        className="autocomplete-section"
        aria-labelledby="autocomplete-discover-title"
      >
        <header>
          <p className="eyebrow">{t('01 · Recognize the right result')}</p>
          <h3 id="autocomplete-discover-title">{t('Find with context')}</h3>
          <p>
            {t(
              'Search components, guides and workspace patterns. Groups and short descriptions make similar results easier to tell apart.',
            )}
          </p>
        </header>
        <div className="autocomplete-discovery-grid" data-autocomplete-primary>
          <div className="autocomplete-primary-field">
            <AtlasAutoComplete
              id={`${id}-knowledge`}
              label={t('Find in the documentation')}
              value={query}
              onChange={value => {
                setQuery(value);
                if (value !== query) setSelectedKey(null);
              }}
              items={knowledgeItems}
              onSelect={item => setSelectedKey(item.key)}
              placeholder={t('Try Button, color or workspace')}
              help={t('Type freely. Choose a suggestion to see its context before opening a page.')}
            />
            <p className="autocomplete-guidance">
              {t('Suggestions come from six local documentation entries.')}
            </p>
          </div>
          <div
            className="autocomplete-context"
            data-autocomplete-context
            data-selected-key={selected?.key ?? ''}
            aria-live="polite"
            aria-atomic="true"
          >
            {selected ? (
              <>
                <p className="eyebrow">{t(selected.group.label)}</p>
                <h4>{t(selected.title)}</h4>
                <p>{t(selected.description)}</p>
                <div className="autocomplete-context-actions">
                  <a href={selected.href}>{t('Open documentation')}</a>
                  <a href={selected.related}>{t(selected.relatedLabel)}</a>
                </div>
              </>
            ) : (
              <>
                <p className="eyebrow">{t('Before you open a page')}</p>
                <h4>{t('A little context, a clearer choice')}</h4>
                <p>
                  {t(
                    'Choose a result to preview its purpose and related documentation. Editing the search clears the previous choice.',
                  )}
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      <section
        id="autocomplete-patterns"
        className="autocomplete-section"
        aria-labelledby="autocomplete-patterns-title"
      >
        <header>
          <p className="eyebrow">{t('02 · Suggest without taking over')}</p>
          <h3 id="autocomplete-patterns-title">{t('Useful completions')}</h3>
          <p>
            {t(
              'Help with a familiar name or a repeated suffix. Suggestions support the entered value; choosing one is always explicit.',
            )}
          </p>
        </header>
        <div className="autocomplete-example-grid">
          <div className="autocomplete-example" data-autocomplete-example="company">
            <h4>{t('Team name')}</h4>
            <AtlasAutoComplete
              id={`${id}-team`}
              label={t('Find or enter a team')}
              value={company}
              onChange={setCompany}
              items={companyItems}
              placeholder={t('Try Atlas or enter your own team')}
              help={t('These are sample teams. A new name remains valid free text.')}
            />
          </div>
          <div className="autocomplete-example" data-autocomplete-example="email">
            <h4>{t('Email completion')}</h4>
            <AtlasAutoComplete
              id={`${id}-email`}
              label={t('Contact email')}
              value={email}
              onChange={setEmail}
              items={emailItems}
              placeholder="name@example.com"
              help={t(
                'Type a name to see sample domains. Your address changes only when you choose one.',
              )}
            />
          </div>
        </div>
      </section>

      <section
        id="autocomplete-recovery"
        className="autocomplete-section"
        aria-labelledby="autocomplete-recovery-title"
      >
        <header>
          <p className="eyebrow">{t('03 · Keep typing through uncertainty')}</p>
          <h3 id="autocomplete-recovery-title">{t('Suggestions and recovery')}</h3>
          <p>
            {t(
              'An empty result is different from suggestions being unavailable. Keep the entered text and explain the next useful action.',
            )}
          </p>
        </header>
        <div
          className="autocomplete-recovery"
          data-autocomplete-recovery
          data-availability={availability}
        >
          <AtlasAutoComplete
            id={`${id}-recovery`}
            label={t('Documentation suggestions')}
            value={recoveryValue}
            onChange={setRecoveryValue}
            items={knowledgeItems}
            placeholder={t('Try a term with no matches')}
            help={t('A missing suggestion never removes your text or prevents a custom value.')}
            availability={availability}
            onRetry={() => setAvailability('ready')}
          />
          <p className="autocomplete-guidance" data-autocomplete-sample-note>
            {availability === 'ready'
              ? t(
                  'This example filters local entries. Loading and error samples are available in Tweaker.',
                )
              : availability === 'loading'
                ? t(
                    'Loading sample is held until you change it in Tweaker. No request or timer is running.',
                  )
                : t(
                    'This is a local error sample. Retry restores the available entries and keeps your text.',
                  )}
          </p>
        </div>
      </section>

      <section
        id="autocomplete-availability"
        className="autocomplete-section"
        aria-labelledby="autocomplete-availability-title"
      >
        <header>
          <p className="eyebrow">{t('04 · Make field states understandable')}</p>
          <h3 id="autocomplete-availability-title">{t('Field availability')}</h3>
          <p>
            {t(
              'Explain the issue beside the field. A warning stays editable; a disabled field keeps its value and its reason visible.',
            )}
          </p>
        </header>
        <div className="autocomplete-example-grid">
          <div className="autocomplete-example" data-autocomplete-example="warning">
            <h4>{t('Review suggested')}</h4>
            <AtlasAutoComplete
              id={`${id}-warning`}
              label={t('Team to review')}
              value={warningValue}
              onChange={setWarningValue}
              items={companyItems}
              status="warning"
              placeholder={t('Enter or choose a team')}
              help={t('A custom team name is allowed. Check the spelling before you continue.')}
            />
          </div>
          <div className="autocomplete-example" data-autocomplete-example="error">
            <h4>{t('Correction needed')}</h4>
            <AtlasAutoComplete
              id={`${id}-error`}
              label={t('Email to correct')}
              value={errorValue}
              onChange={setErrorValue}
              items={[]}
              status={/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(errorValue) ? undefined : 'error'}
              error={
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(errorValue)
                  ? undefined
                  : t('Enter a complete address, such as team@example.com.')
              }
              help={t('This local example checks the address shape; it does not verify delivery.')}
            />
          </div>
          <div className="autocomplete-example" data-autocomplete-example="disabled">
            <h4>{t('Unavailable field')}</h4>
            <AtlasAutoComplete
              id={`${id}-disabled`}
              label={t('Assigned team')}
              value="Atlas Studio"
              onChange={() => {}}
              items={companyItems}
              disabled
              help={t('Team assignment is unavailable in this local example.')}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

export default function AutoCompleteDemo({
  documentation = false,
}: { documentation?: boolean } = {}) {
  return (
    <AtlasProvider appearance={documentation ? 'docs' : 'approved'}>
      <AutoCompleteExamples />
    </AtlasProvider>
  );
}
