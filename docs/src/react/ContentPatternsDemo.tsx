import { useId, useState } from 'react';
import { Select, Switch } from 'antd';
import AtlasProvider from './AtlasProvider';
import AtlasAvatarGroup from './AtlasAvatarGroup';
import AtlasIconList from './AtlasIconList';
import AtlasQuote from './AtlasQuote';
import { TweakerSettings } from './AtlasTweaker';
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
    <div className="atlas-content-patterns">
      <TweakerSettings title="Content pattern settings">
        <div className="atlas-tweaker-option">
          <label htmlFor={shownId}>{t('People shown')}</label>
          <Select
            id={shownId}
            value={shown}
            options={people.map((_, index) => ({ value: index + 1, label: String(index + 1) }))}
            onChange={(next: number) => setShown(next)}
          />
        </div>
        <div className="atlas-tweaker-option">
          <label htmlFor={descriptionsId}>{t('Show checklist descriptions')}</label>
          <Switch id={descriptionsId} checked={descriptions} onChange={setDescriptions} />
        </div>
      </TweakerSettings>
      <section className="atlas-content-pattern" aria-labelledby={peopleId}>
        <h3 id={peopleId}>{t('People on this project')}</h3>
        <AtlasAvatarGroup people={people.slice(0, shown)} />
      </section>
      <section className="atlas-content-pattern" aria-labelledby={checklistId}>
        <h3 id={checklistId}>{t('Project checklist')}</h3>
        <AtlasIconList
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
      <section className="atlas-content-pattern" aria-labelledby={quoteId}>
        <h3 id={quoteId}>{t('Team quotation')}</h3>
        <AtlasQuote
          quote={t('We start with the task, then choose the simplest useful interface.')}
          attribution={t('Atlas demo team')}
          context={t('Fictional example')}
        />
      </section>
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
    <AtlasProvider appearance={documentation ? 'docs' : undefined}>
      <ContentPatterns />
    </AtlasProvider>
  );
}
