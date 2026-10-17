import { useI18n } from './useI18n';
import DataEntryCatalog, { DataEntryGrid } from './DataEntryCatalog';
import ExamplePreview from './ExamplePreview';
import { useId, useState } from 'react';
import { Radio, Switch } from 'antd';
import GenUXProvider from './GenUXProvider';
import { TweakerSettings } from './GenUXTweaker';
import GenUXButtonGroup from './GenUXButtonGroup';
import GenUXSelectionVariants from './GenUXSelectionVariants';
const choices = ['Tasarım', 'Mühendislik', 'Operasyon'];
export function WebRadioDemo({ documentation = false }: { documentation?: boolean } = {}) {
  return <RadioDemo clusteredSegments documentation={documentation} />;
}

export default function RadioDemo({
  clusteredSegments = false,
  documentation = false,
}: { clusteredSegments?: boolean; documentation?: boolean } = {}) {
  const { t } = useI18n();
  const previewDisabledId = useId();
  const [previewDisabled, setPreviewDisabled] = useState(false);
  // Controlled values keep each selection while the preview is disabled and enabled again.
  const [team, setTeam] = useState('Tasarım');
  const [view, setView] = useState('Liste');
  const [delivery, setDelivery] = useState('delivery');
  const teamOptions = choices.map(value => ({
    value,
    label: t(
      (
        { Tasarım: 'Design', Mühendislik: 'Engineering', Operasyon: 'Operations' } as Record<
          string,
          string
        >
      )[value]!,
    ),
  }));
  const viewOptions = ['Liste', 'Tablo', 'Takvim'].map(value => ({
    value,
    label: t(
      ({ Liste: 'List', Tablo: 'Table', Takvim: 'Calendar' } as Record<string, string>)[value]!,
    ),
  }));

  const single = (
    <>
      <Radio.Group
        name="team"
        value={team}
        onChange={event => setTeam(event.target.value)}
        disabled={previewDisabled}
        options={teamOptions}
        aria-label={t('Team')}
      />
    </>
  );
  const grouped = (
    <>
      {clusteredSegments ? (
        <GenUXButtonGroup
          name="view"
          radius="pill"
          value={view}
          onChange={setView}
          disabled={previewDisabled}
          options={[viewOptions[0]!, viewOptions[1]!, viewOptions[2]!]}
          aria-label={t('View')}
        />
      ) : (
        <Radio.Group
          name="view"
          optionType="button"
          buttonStyle="solid"
          value={view}
          onChange={event => setView(event.target.value)}
          disabled={previewDisabled}
          options={viewOptions}
          aria-label={t('View')}
        />
      )}
    </>
  );
  const two = (
    <>
      <GenUXButtonGroup
        name="delivery"
        radius="pill"
        value={delivery}
        onChange={setDelivery}
        disabled={previewDisabled}
        options={[
          { value: 'delivery', label: t('Delivery') },
          { value: 'pickup', label: t('Pickup') },
        ]}
        aria-label={t('Delivery method')}
      />
    </>
  );
  const states = (
    <>
      <Radio.Group
        name="locked-team"
        value="Tasarım"
        disabled
        options={teamOptions}
        aria-label={t('Disabled team')}
      />
    </>
  );
  return (
    <GenUXProvider
      appearance={documentation ? 'docs' : undefined}
      sizeFamily={documentation ? 'selection' : 'component'}
    >
      <div className="pattern-stack">
        <TweakerSettings title="Radio preview">
          <label className="control-row" htmlFor={previewDisabledId}>
            <Switch
              id={previewDisabledId}
              checked={previewDisabled}
              onChange={setPreviewDisabled}
            />
            {t('Disable radio preview')}
          </label>
        </TweakerSettings>
        {documentation ? (
          <DataEntryCatalog
            slug="radio"
            title={t('Radio')}
            sections={[
              {
                id: 'single',
                title: t('Single selection'),
                description: t(
                  'Choose one team with classic radio controls. Selecting another option replaces the previous choice.',
                ),
                content: (
                  <ExamplePreview id="radio-single-selection" title={t('Single selection')}>
                    <div className="example-block">{single}</div>
                  </ExamplePreview>
                ),
              },
              {
                id: 'grouped',
                title: t('Grouped choices'),
                description: t(
                  clusteredSegments
                    ? 'Compare three view choices with a two-choice delivery control. Each group keeps one selection.'
                    : 'Choose one view with the grouped radio control.',
                ),
                content: (
                  <DataEntryGrid>
                    <ExamplePreview id="radio-segmented-selection" title={t('Segmented selection')}>
                      <section className="example-block">
                        <h4 className="variant-heading">{t('Segmented selection')}</h4>
                        {grouped}
                      </section>
                    </ExamplePreview>
                    {clusteredSegments && (
                      <ExamplePreview id="radio-two-choices" title={t('Two choices')}>
                        <section className="example-block">
                          <h4 className="variant-heading">{t('Two choices')}</h4>
                          {two}
                        </section>
                      </ExamplePreview>
                    )}
                  </DataEntryGrid>
                ),
              },
              {
                id: 'states',
                title: t('States'),
                description: t(
                  'A disabled group preserves its selected value while blocking changes.',
                ),
                content: (
                  <ExamplePreview id="radio-states" title={t('States')}>
                    <div className="example-block">{states}</div>
                  </ExamplePreview>
                ),
              },
              {
                id: 'selection-variants',
                title: t('Selection layouts and cards'),
                description: t('Choose one workspace.'),
                // Each layout owns its workbench inside GenUXSelectionVariants.
                content: <GenUXSelectionVariants kind="radio" />,
              },
            ]}
          />
        ) : (
          <>
            <section className="example-block">
              <h3 className="variant-heading">{t('Single selection')}</h3>
              {single}
            </section>
            <section className="example-block">
              <h3 className="variant-heading">{t('Segmented selection')}</h3>
              {grouped}
            </section>
            {clusteredSegments && (
              <section className="example-block">
                <h3 className="variant-heading">{t('Two choices')}</h3>
                {two}
              </section>
            )}
            <section className="example-block">
              <h3 className="variant-heading">{t('States')}</h3>
              {states}
            </section>
            <section className="example-block">
              <h3 className="variant-heading">{t('Selection layouts and cards')}</h3>
              <GenUXSelectionVariants kind="radio" />
            </section>
          </>
        )}
      </div>
    </GenUXProvider>
  );
}
