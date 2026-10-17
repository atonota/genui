import { useI18n } from './useI18n';
import GenUXProvider from './GenUXProvider';
import GenUXButton, { type Tone } from './GenUXButton';
import GenUXLayeredButton from './GenUXLayeredButton';
import ExamplePreview from './ExamplePreview';
import genux from '../data/genux.json';
import { buttonColorPresets } from '../data/button-palette';

const decisions = genux.decisions.buttons;

const groups = [
  {
    key: 'fill',
    title: 'Surfaces',
    variants: [...decisions.fill_variants, { value: 'disabled', label: 'Disabled' }],
  },
  { key: 'palette', title: 'Color families', variants: buttonColorPresets },
  { key: 'radius', title: 'Corners', variants: decisions.radius_variants },
  { key: 'tone', title: 'Tones', variants: decisions.tone_variants },
  { key: 'shadow', title: 'Shadows', variants: decisions.shadow_variants },
] as const;

export function ButtonVisualGroup({ axis }: { axis: (typeof groups)[number]['key'] }) {
  const { t } = useI18n();
  const group = groups.find(item => item.key === axis)!;
  const visualSection = (
    <section className="example-block" aria-label={t(group.title)}>
      <h4 className="variant-heading">{t(group.title)}</h4>
      <ul className="genux-button-visuals">
        {group.variants.map(variant => {
          const props =
            group.key === 'palette'
              ? { colorPreset: variant.value }
              : group.key === 'tone'
                ? { tone: variant.value as Tone }
                : group.key === 'fill' && variant.value === 'disabled'
                  ? { state: 'disabled' }
                  : { [group.key]: variant.value };
          return (
            <li
              key={variant.value}
              data-approved-axis={group.key}
              data-approved-value={variant.value}
            >
              {group.key === 'shadow' && variant.value === 'layeredFlat8' ? (
                <GenUXLayeredButton />
              ) : (
                <GenUXButton {...props} />
              )}
              <p>{t(variant.label)}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
  // Each axis keeps its own literal preview id for the build-time source extractor.
  switch (axis) {
    case 'fill':
      return (
        <ExamplePreview id="button-surfaces-example" title={t('Surfaces')}>
          {visualSection}
        </ExamplePreview>
      );
    case 'palette':
      return (
        <ExamplePreview id="button-palette-example" title={t('Color families')}>
          {visualSection}
        </ExamplePreview>
      );
    case 'radius':
      return (
        <ExamplePreview id="button-corners-example" title={t('Corners')}>
          {visualSection}
        </ExamplePreview>
      );
    case 'tone':
      return (
        <ExamplePreview id="button-tones-example" title={t('Tones')}>
          {visualSection}
        </ExamplePreview>
      );
    case 'shadow':
      return (
        <ExamplePreview id="button-shadows-example" title={t('Shadows')}>
          {visualSection}
        </ExamplePreview>
      );
  }
}

export function ButtonVisualDecisions({ feedbackDuration }: { feedbackDuration?: number } = {}) {
  const { t } = useI18n();
  return (
    <section className="example-block" aria-labelledby="button-visuals-heading">
      <h3 id="button-visuals-heading" className="variant-heading">
        {t('Approved appearances')}
      </h3>
      <p>
        {feedbackDuration === undefined
          ? t(
              'Each group changes only its own option. Shared transition duration: {duration}. Color families inherit the active Color system presets with 10% white and 10% black.',
              { duration: t(decisions.duration_variants[0]!.label) },
            )
          : t(
              'Each group changes only its own option. Web Button press and release: {duration} ms. Color families inherit the active Color system presets with 10% white and 10% black.',
              { duration: feedbackDuration },
            )}
      </p>
      {groups.map(group => (
        <ButtonVisualGroup key={group.key} axis={group.key} />
      ))}
    </section>
  );
}

export default function ApprovedButtonVisuals() {
  return (
    <GenUXProvider>
      <ButtonVisualDecisions />
    </GenUXProvider>
  );
}
