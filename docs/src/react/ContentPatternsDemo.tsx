import { useId, useState } from 'react';
import { Select, Switch } from 'antd';
import GenUXProvider from './GenUXProvider';
import GenUXAvatarGroup from './GenUXAvatarGroup';
import GenUXIconList from './GenUXIconList';
import GenUXQuote from './GenUXQuote';
import ExamplePreview from './ExamplePreview';
import { TweakerSettings } from './GenUXTweaker';
import { useI18n } from './useI18n';

const people = [
  { id: 'ada', name: 'Ada Lovelace' },
  { id: 'sam', name: 'Sam Lee' },
  { id: 'priya', name: 'Priya Nair' },
  { id: 'morgan', name: 'Morgan Chen' },
  { id: 'lucas', name: 'Lucas Romero' },
];

function ContentPatterns() {
  const { t } = useI18n();
  const peopleId = useId();
  const checklistId = useId();
  const quoteId = useId();
  const shownId = useId();
  const descriptionsId = useId();
  // Presentation only: the local people and checklist data stay unchanged.
  const [shown, setShown] = useState(people.length);
  const [descriptions, setDescriptions] = useState(true);
  return (
    <div className="genux-content-patterns">
      <TweakerSettings title="Content pattern settings">
        <div className="genux-tweaker-option">
          <label htmlFor={shownId}>{t('People shown')}</label>
          <Select
            id={shownId}
            value={shown}
            options={people.map((_, index) => ({ value: index + 1, label: String(index + 1) }))}
            onChange={(next: number) => setShown(next)}
          />
        </div>
        <div className="genux-tweaker-option">
          <label htmlFor={descriptionsId}>{t('Show checklist descriptions')}</label>
          <Switch id={descriptionsId} checked={descriptions} onChange={setDescriptions} />
        </div>
      </TweakerSettings>
      <ExamplePreview id="content-patterns-people" title={t('People on this project')}>
        <section className="genux-content-pattern" aria-labelledby={peopleId}>
          <h3 id={peopleId}>{t('People on this project')}</h3>
          <GenUXAvatarGroup people={people.slice(0, shown)} />
        </section>
      </ExamplePreview>
      <ExamplePreview id="content-patterns-checklist" title={t('Project checklist')}>
        <section className="genux-content-pattern" aria-labelledby={checklistId}>
          <h3 id={checklistId}>{t('Project checklist')}</h3>
          <GenUXIconList
            items={[
              {
                id: 'define',
                title: t('Define the task'),
                description: descriptions
                  ? t('Name who it serves and what a good outcome looks like.')
                  : undefined,
                icon: 'arrowRight',
              },
              {
                id: 'review',
                title: t('Review the result'),
                description: descriptions
                  ? t('Compare the outcome with the task before adding more interface.')
                  : undefined,
                icon: 'arrowRight',
              },
            ]}
          />
        </section>
      </ExamplePreview>
      <ExamplePreview id="content-patterns-quotation" title={t('Team quotation')}>
        <section className="genux-content-pattern" aria-labelledby={quoteId}>
          <h3 id={quoteId}>{t('Team quotation')}</h3>
          <GenUXQuote
            quote={t('We start with the task, then choose the simplest useful interface.')}
            attribution={t('GenUX demo team')}
            context={t('Fictional example')}
          />
        </section>
      </ExamplePreview>
    </div>
  );
}

/** Icon list, quotation and named avatar group with local data only. */
export default function ContentPatternsDemo({
  documentation = false,
}: {
  documentation?: boolean;
}) {
  return (
    <GenUXProvider appearance={documentation ? 'docs' : undefined}>
      <ContentPatterns />
    </GenUXProvider>
  );
}
