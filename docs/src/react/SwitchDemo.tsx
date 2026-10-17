import { useI18n } from './useI18n';
import { useId, useState } from 'react';
import { Switch } from 'antd';
import GenUXProvider from './GenUXProvider';
import GenUXSelectionVariants from './GenUXSelectionVariants';
import GenUXIcon from './GenUXIcon';
import DataEntryCatalog from './DataEntryCatalog';
import ExamplePreview from './ExamplePreview';
import { TweakerSettings } from './GenUXTweaker';
import { selectionSizeProfiles } from '../data/selection-sizes';

function SwitchContentExamples({ documentation = false }: { documentation?: boolean } = {}) {
  const { t } = useI18n();
  const variants = [
    { id: 'text', title: t('Text'), on: t('On'), off: t('Off') },
    { id: 'number', title: t('Number'), on: '1', off: '0' },
    {
      id: 'icon',
      title: t('Icon'),
      on: <GenUXIcon name="check" />,
      off: <GenUXIcon name="x" />,
    },
    {
      id: 'text-icon',
      title: t('Text and icon'),
      on: (
        <>
          <GenUXIcon name="smiley" />
          {t('Happy')}
        </>
      ),
      off: (
        <>
          <GenUXIcon name="smiley-sad" />
          {t('Sad')}
        </>
      ),
    },
  ];
  const Container = documentation ? 'div' : 'section';
  return (
    <Container className="example-block" data-switch-content-examples>
      {!documentation && <h3 className="variant-heading">{t('Text and icon')}</h3>}
      {!documentation && (
        <p>{t('Each pair starts on and off. Toggle either switch to compare its states.')}</p>
      )}
      <div className="switch-content-grid">
        {variants.map(variant => (
          <div
            key={variant.id}
            className="switch-content-variant"
            role="group"
            aria-labelledby={`switch-content-${variant.id}-title`}
          >
            <h4 className="variant-heading" id={`switch-content-${variant.id}-title`}>
              {variant.title}
            </h4>
            {[true, false].map(initiallyOn => {
              const id = `switch-content-${variant.id}-${initiallyOn ? 'on' : 'off'}`;
              return (
                <label className="control-row" htmlFor={id} key={id}>
                  <Switch
                    id={id}
                    className="genux-switch-with-content"
                    data-switch-content={variant.id}
                    classNames={{ content: 'genux-switch-state-layer' }}
                    aria-labelledby={`switch-content-${variant.id}-title ${id}-label`}
                    defaultChecked={initiallyOn}
                    checkedChildren={
                      <span className="genux-switch-state" aria-hidden="true">
                        {variant.on}
                      </span>
                    }
                    unCheckedChildren={
                      <span className="genux-switch-state" aria-hidden="true">
                        {variant.off}
                      </span>
                    }
                  />
                  <span id={`${id}-label`}>
                    {t(initiallyOn ? 'Initially on' : 'Initially off')}
                  </span>
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </Container>
  );
}

export function WebSwitchDemo({ documentation = false }: { documentation?: boolean } = {}) {
  return <SwitchDemo appearanceControls documentation={documentation} />;
}

export default function SwitchDemo({
  appearanceControls = false,
  documentation = false,
}: { appearanceControls?: boolean; documentation?: boolean } = {}) {
  const { t } = useI18n();
  const [checked, setChecked] = useState(false);
  const previewDisabledId = useId();
  const previewLoadingId = useId();
  // Preview state lives here, so it survives closing the Tweaker and keeps the checked value.
  const [previewDisabled, setPreviewDisabled] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const selectionHeight = (value: string) =>
    String(selectionSizeProfiles.find(profile => profile.value === value)!.height_px);
  const basic = (
    <>
      <label className="control-row" htmlFor="switch-notify">
        <Switch
          id="switch-notify"
          checked={checked}
          onChange={setChecked}
          disabled={previewDisabled}
          loading={previewLoading}
        />
        {t('Notifications {status}', { status: checked ? t('on') : t('off') })}
      </label>
    </>
  );
  const sizes = (
    <>
      <label className="control-row" htmlFor="switch-small">
        <Switch
          id="switch-small"
          size="small"
          data-selection-size={appearanceControls ? 'sm' : undefined}
          defaultChecked
        />
        {appearanceControls
          ? t('Small · {height} px', { height: selectionHeight('sm') })
          : t('Compact')}
      </label>
      <label className="control-row" htmlFor="switch-medium">
        <Switch
          id="switch-medium"
          size="medium"
          data-selection-size={appearanceControls ? 'md' : undefined}
          defaultChecked
        />
        {appearanceControls
          ? t('Medium · {height} px', { height: selectionHeight('md') })
          : t('Normal')}
      </label>
      {appearanceControls && (
        <label className="control-row" htmlFor="switch-large">
          <Switch id="switch-large" size="medium" data-selection-size="lg" defaultChecked />
          {t('Large · {height} px', { height: selectionHeight('lg') })}
        </label>
      )}
    </>
  );
  const states = (
    <>
      <label className="control-row" htmlFor="switch-disabled">
        <Switch id="switch-disabled" disabled />
        {t('Disabled')}
      </label>
      <label className="control-row" htmlFor="switch-loading">
        <Switch id="switch-loading" loading checked />
        {t('Processing preview')}
      </label>
      <label className="control-row" htmlFor="switch-required-on">
        <Switch id="switch-required-on" checked disabled />
        {t('Required on')}
      </label>
    </>
  );
  const allStates = (
    <>
      {sizes}
      {states}
    </>
  );

  return (
    <GenUXProvider
      appearance={documentation ? 'docs' : undefined}
      sizeFamily={documentation ? 'selection' : 'component'}
    >
      <div className="pattern-stack" data-switch-preview={appearanceControls ? '' : undefined}>
        <TweakerSettings title="Switch preview">
          <label className="control-row" htmlFor={previewDisabledId}>
            <Switch
              id={previewDisabledId}
              checked={previewDisabled}
              onChange={setPreviewDisabled}
            />
            {t('Disable switch preview')}
          </label>
          <label className="control-row" htmlFor={previewLoadingId}>
            <Switch id={previewLoadingId} checked={previewLoading} onChange={setPreviewLoading} />
            {t('Loading switch preview')}
          </label>
        </TweakerSettings>
        {documentation ? (
          <DataEntryCatalog
            slug="switch"
            title={t('Switch')}
            sections={[
              {
                id: 'basic',
                title: t('Instant preference'),
                description: t(
                  'Toggle the preference and read its current state next to the control.',
                ),
                content: (
                  <ExamplePreview id="switch-instant-preference" title={t('Instant preference')}>
                    <div className="example-block">{basic}</div>
                  </ExamplePreview>
                ),
              },
              ...(appearanceControls
                ? [
                    {
                      id: 'content',
                      title: t('Text and icon'),
                      description: t(
                        'Each pair starts on and off. Toggle either switch to compare its states.',
                      ),
                      content: (
                        <ExamplePreview id="switch-text-and-icon" title={t('Text and icon')}>
                          <SwitchContentExamples documentation />
                        </ExamplePreview>
                      ),
                    },
                  ]
                : []),
              {
                id: 'sizes',
                title: t('Sizes'),
                description: t(
                  appearanceControls
                    ? 'Compare the shared small, medium and large selection sizes.'
                    : 'Compare compact and normal switch sizes.',
                ),
                content: (
                  <ExamplePreview id="switch-sizes" title={t('Sizes')}>
                    <div className="data-entry-state-grid">{sizes}</div>
                  </ExamplePreview>
                ),
              },
              {
                id: 'states',
                title: t('States'),
                description: t(
                  'Unavailable, Processing and required-on controls keep their distinct meanings.',
                ),
                content: (
                  <ExamplePreview id="switch-states" title={t('States')}>
                    <div className="data-entry-state-grid">{states}</div>
                  </ExamplePreview>
                ),
              },
              {
                id: 'selection-variants',
                title: t('Selection layouts and cards'),
                description: t('Turn each workspace on or off.'),
                // Each layout owns its workbench inside GenUXSelectionVariants.
                content: <GenUXSelectionVariants kind="switch" />,
              },
            ]}
          />
        ) : (
          <>
            <section className="example-block">
              <h3 className="variant-heading">{t('Instant preference')}</h3>
              {basic}
            </section>
            <section className="example-block">
              <h3 className="variant-heading">{t('Sizes and states')}</h3>
              {allStates}
            </section>
            {appearanceControls && <SwitchContentExamples />}
            <section className="example-block">
              <h3 className="variant-heading">{t('Selection layouts and cards')}</h3>
              <GenUXSelectionVariants kind="switch" />
            </section>
          </>
        )}
      </div>
    </GenUXProvider>
  );
}
