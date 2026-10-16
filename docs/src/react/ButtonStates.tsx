import { useI18n } from './useI18n';
import AtlasProvider from './AtlasProvider';
import AtlasButton from './AtlasButton';
import ExamplePreview from './ExamplePreview';
import atlas from '../data/atlas.json';

export function ButtonStates({ headingLevel = 3 }: { headingLevel?: 3 | 4 } = {}) {
  const Heading = headingLevel === 4 ? 'h4' : 'h3';
  const { t } = useI18n();

  return (
    <section className="example-block" aria-labelledby="button-approved-heading">
      <Heading id="button-approved-heading" className="variant-heading">
        {t('Approved states')}
      </Heading>
      <p>
        {t(
          'One Processing state covers work in progress. This preview starts no save or network request.',
        )}
      </p>
      <ExamplePreview id="button-states-example" title={t('Approved states')}>
        <ul className="atlas-button-states" aria-label={t('Approved button states')}>
          {atlas.decisions.buttons.state_variants.map(status => (
            <li key={status.value} data-approved-state={status.value}>
              <AtlasButton state={status.value} />
              <p>{t(status.label)}</p>
            </li>
          ))}
        </ul>
      </ExamplePreview>
    </section>
  );
}

export default function ApprovedButtonStates() {
  return (
    <AtlasProvider>
      <ButtonStates />
    </AtlasProvider>
  );
}
