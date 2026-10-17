import { useI18n } from './useI18n';
import GenUXProvider from './GenUXProvider';
import GenUXButton from './GenUXButton';
import ExamplePreview from './ExamplePreview';
import genux from '../data/genux.json';

export function ButtonDimensions({ headingLevel = 3 }: { headingLevel?: 3 | 4 } = {}) {
  const Heading = headingLevel === 4 ? 'h4' : 'h3';
  const { t } = useI18n();

  return (
    <section className="example-block" aria-labelledby="button-dimensions-heading">
      <Heading id="button-dimensions-heading" className="variant-heading">
        {t('Approved sizes and widths')}
      </Heading>
      <p>
        {t(
          'Three sizes use 48, 56 and 64 px minimum heights. Width is independent of size; full-width buttons fill their container.',
        )}
      </p>
      <ExamplePreview id="button-sizes-example" title={t('Three approved button sizes')}>
        <ul className="genux-button-dimensions" aria-label={t('Three approved button sizes')}>
          {genux.decisions.buttons.size_variants.map(size => (
            <li key={size.value} data-approved-size={size.value}>
              <div className="genux-button-dimension-preview">
                <GenUXButton size={size.value} />
              </div>
              <p>{t(size.label)}</p>
            </li>
          ))}
        </ul>
      </ExamplePreview>
      <ExamplePreview id="button-widths-example" title={t('Three approved button widths')}>
        <ul className="genux-button-dimensions" aria-label={t('Three approved button widths')}>
          {genux.decisions.buttons.width_variants.map(width => (
            <li key={width.value} data-approved-width={width.value}>
              <div className="genux-button-dimension-preview">
                <GenUXButton width={width.value} />
              </div>
              <p>{t(width.label)}</p>
            </li>
          ))}
        </ul>
      </ExamplePreview>
    </section>
  );
}

export default function ApprovedButtonDimensions() {
  return (
    <GenUXProvider>
      <ButtonDimensions />
    </GenUXProvider>
  );
}
