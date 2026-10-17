import { useState } from 'react';
import { Select } from 'antd';
import Input from './GenUXInput';
import GenUXProvider from './GenUXProvider';
import GenUXButton from './GenUXButton';
import GenUXPill from './GenUXPill';
import GenUXSplitter from './GenUXSplitter';
import ExamplePreview from './ExamplePreview';
import { TweakerSettings } from './GenUXTweaker';
import { useI18n } from './useI18n';
import { initialRecords, moneyText, STATUS_LABELS } from '../data/workspace';
import { workspacePillColorIndex } from '../data/workspace-pill-colors';

const workspacePages = [
  ['data-table', 'Data table', 'Keep the table and its selected record together.'],
  [
    'collection-views',
    'Collection views',
    'Change the collection view while keeping inspection in context.',
  ],
  ['record-details', 'Record details', 'Browse records beside the same detail surface.'],
  ['record-forms', 'Record forms', 'Edit one draft and review its current values.'],
  ['record-workspace', 'Record workspace', 'Connect the collection, editor and record inspector.'],
] as const;

function SplitterExamples() {
  const { t, locale } = useI18n();
  const [records] = useState(() => initialRecords().slice(0, 4));
  const [activeId, setActiveId] = useState(records[0]!.id);
  const [note, setNote] = useState('');
  const [project, setProject] = useState('GenUX Studio');
  const [description, setDescription] = useState('Prepare the next workspace review.');
  const [orientation, setOrientation] = useState<'auto' | 'vertical'>('auto');
  const record = records.find(item => item.id === activeId)!;
  return (
    <div className="splitter-catalog" data-splitter-catalog>
      <TweakerSettings title="Panel flow">
        <label htmlFor="splitter-flow">{t('Panel flow')}</label>
        <Select
          id="splitter-flow"
          value={orientation}
          onChange={setOrientation}
          options={[
            { value: 'auto', label: t('Adapt to available space') },
            { value: 'vertical', label: t('Always stacked') },
          ]}
        />
      </TweakerSettings>
      <nav className="splitter-navigation" aria-label={t('Splitter examples')}>
        <a href="#splitter-explore">{t('Browse and inspect')}</a>
        <a href="#splitter-compose">{t('Edit and review')}</a>
        <a href="#splitter-workspaces">{t('In Data workspace')}</a>
      </nav>
      <section
        id="splitter-explore"
        className="splitter-section"
        aria-labelledby="splitter-explore-title"
      >
        <header>
          <p className="eyebrow">{t('01 · Browse')}</p>
          <h3 id="splitter-explore-title">{t('Give each task room')}</h3>
          <p>
            {t(
              'Start with stacked panels. When there is enough room, browse and inspect side by side. Your selection and notes stay in place.',
            )}
          </p>
        </header>
        <ExamplePreview id="splitter-browse-inspect" title={t('Browse and inspect')}>
          <GenUXSplitter
            id="splitter-records"
            label={t('Browse and inspect')}
            orientation={orientation}
            initialSizes={[45, 55]}
            panels={[
              {
                id: 'splitter-record-list',
                label: t('Records'),
                children: (
                  <div className="splitter-record-list">
                    <p className="splitter-helper">{t('Choose a record to review its details.')}</p>
                    {records.map(item => (
                      <GenUXButton
                        key={item.id}
                        fill={item.id === activeId ? 'tint' : 'text'}
                        width="full"
                        text={`${item.id} · ${item.customer}`}
                        aria-pressed={item.id === activeId}
                        onClick={() => setActiveId(item.id)}
                      />
                    ))}
                  </div>
                ),
              },
              {
                id: 'splitter-record-detail',
                label: t('Record review'),
                children: (
                  <div className="splitter-review">
                    <div>
                      <p className="splitter-helper">{record.id}</p>
                      <h4>{record.customer}</h4>
                    </div>
                    <GenUXPill colorIndex={workspacePillColorIndex.status[record.status]}>
                      {t(STATUS_LABELS[record.status])}
                    </GenUXPill>
                    <dl className="splitter-facts">
                      <div>
                        <dt>{t('Owner')}</dt>
                        <dd>{record.owner}</dd>
                      </div>
                      <div>
                        <dt>{t('Amount')}</dt>
                        <dd>
                          {record.amount === null
                            ? t('Not set')
                            : moneyText(record.amount, record.currency, locale)}
                        </dd>
                      </div>
                    </dl>
                    <label htmlFor="splitter-review-note">{t('Review note')}</label>
                    <Input.TextArea
                      id="splitter-review-note"
                      value={note}
                      onChange={event => setNote(event.target.value)}
                      rows={3}
                      placeholder={t('Add context for your review')}
                    />
                    <p className="splitter-helper">
                      {t('This local note stays with the example while panels resize.')}
                    </p>
                  </div>
                ),
              },
            ]}
          />
        </ExamplePreview>
        <p className="splitter-keyboard-guide">
          {t(
            'Drag the grip, use the panel buttons, or focus the separator and press arrow keys. Home and End move to the allowed limits.',
          )}
        </p>
      </section>
      <section
        id="splitter-compose"
        className="splitter-section"
        aria-labelledby="splitter-compose-title"
      >
        <header>
          <p className="eyebrow">{t('02 · Compose')}</p>
          <h3 id="splitter-compose-title">{t('One draft, a live review')}</h3>
          <p>
            {t(
              'A vertical split gives the editor and its preview separate space without duplicating fields.',
            )}
          </p>
        </header>
        <ExamplePreview id="splitter-edit-review" title={t('Edit and review')}>
          <GenUXSplitter
            id="splitter-editor"
            label={t('Edit and review')}
            orientation="vertical"
            panels={[
              {
                id: 'splitter-editor-fields',
                label: t('Editor'),
                children: (
                  <div className="splitter-review">
                    <label htmlFor="splitter-project-name">{t('Workspace name')}</label>
                    <Input
                      id="splitter-project-name"
                      value={project}
                      onChange={event => setProject(event.target.value)}
                    />
                    <label htmlFor="splitter-project-description">{t('Description')}</label>
                    <Input.TextArea
                      id="splitter-project-description"
                      value={description}
                      onChange={event => setDescription(event.target.value)}
                      rows={3}
                    />
                  </div>
                ),
              },
              {
                id: 'splitter-editor-review',
                label: t('Live review'),
                children: (
                  <div className="splitter-review" aria-live="polite">
                    <GenUXPill>{t('Draft')}</GenUXPill>
                    <h4>{project || t('Untitled workspace')}</h4>
                    <p className="splitter-draft-copy">{description || t('No description yet.')}</p>
                    <p className="splitter-helper">
                      {t('Preview only. No record is saved or sent.')}
                    </p>
                  </div>
                ),
              },
            ]}
          />
        </ExamplePreview>
      </section>
      <section
        id="splitter-workspaces"
        className="splitter-section"
        aria-labelledby="splitter-workspaces-title"
      >
        <header>
          <p className="eyebrow">{t('03 · Connect')}</p>
          <h3 id="splitter-workspaces-title">{t('In Data workspace')}</h3>
          <p>
            {t(
              'The same panel controls support all five workspace pages. Record state belongs to the page; resizing changes its presentation.',
            )}
          </p>
        </header>
        <ul className="splitter-workspace-links">
          {workspacePages.map(([slug, title, caption]) => (
            <li key={slug}>
              <a href={`/components/${slug}/`}>
                {t(title)} <span aria-hidden="true">→</span>
              </a>
              <p>{t(caption)}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function SplitterDemo({ documentation = false }: { documentation?: boolean } = {}) {
  return (
    <GenUXProvider appearance={documentation ? 'docs' : 'approved'}>
      <SplitterExamples />
    </GenUXProvider>
  );
}
