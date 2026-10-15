import { useId } from 'react';
import AtlasProvider from './AtlasProvider';
import AtlasAvatarGroup from './AtlasAvatarGroup';
import AtlasIconList from './AtlasIconList';
import AtlasQuote from './AtlasQuote';
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
  return (
    <div className="atlas-content-patterns">
      <section className="atlas-content-pattern" aria-labelledby={peopleId}>
        <h3 id={peopleId}>{t('People on this project')}</h3>
        <AtlasAvatarGroup people={people} />
      </section>
      <section className="atlas-content-pattern" aria-labelledby={checklistId}>
        <h3 id={checklistId}>{t('Project checklist')}</h3>
        <AtlasIconList
          items={[
            {
              id: 'define',
              title: t('Define the task'),
              description: t('Name who it serves and what a good outcome looks like.'),
              icon: 'arrowRight',
            },
            {
              id: 'review',
              title: t('Review the result'),
              description: t('Compare the outcome with the task before adding more interface.'),
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
