import { useI18n } from './useI18n';
import { useState } from 'react';
import { Switch } from 'antd';
import AtlasProvider from './AtlasProvider';
import AtlasSelectionVariants from './AtlasSelectionVariants';
import AtlasIcon from './AtlasIcon';
import DataEntryCatalog from './DataEntryCatalog';

function SwitchContentExamples({ documentation = false }: { documentation?: boolean } = {}) {
  const { t } = useI18n();
  const variants = [
    { id: 'text', title: t('Text'), on: t('On'), off: t('Off') },
    { id: 'number', title: t('Number'), on: '1', off: '0' },
    {
      id: 'icon',
      title: t('Icon'),
      on: <AtlasIcon name="check" />,
      off: <AtlasIcon name="x" />,
    },
    {
      id: 'text-icon',
      title: t('Text and icon'),
      on: (
        <>
          <AtlasIcon name="smiley" />
          {t('Happy')}
        </>
      ),
      off: (
        <>
          <AtlasIcon name="smiley-sad" />
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
                    className="atlas-switch-with-content"
                    data-switch-content={variant.id}
                    classNames={{ content: 'atlas-switch-state-layer' }}
                    aria-labelledby={`switch-content-${variant.id}-title ${id}-label`}
                    defaultChecked={initiallyOn}
                    checkedChildren={
                      <span className="atlas-switch-state" aria-hidden="true">
                        {variant.on}
                      </span>
                    }
                    unCheckedChildren={
                      <span className="atlas-switch-state" aria-hidden="true">
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
  const basic = (
    <>
      <label className="control-row" htmlFor="switch-notify">
        <Switch id="switch-notify" checked={checked} onChange={setChecked} />
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
        {t(appearanceControls ? 'Small · 32 px' : 'Compact')}
      </label>
      <label className="control-row" htmlFor="switch-medium">
        <Switch
          id="switch-medium"
          size="medium"
          data-selection-size={appearanceControls ? 'md' : undefined}
          defaultChecked
        />
        {t(appearanceControls ? 'Medium · 40 px' : 'Normal')}
      </label>
      {appearanceControls && (
        <label className="control-row" htmlFor="switch-large">
          <Switch id="switch-large" size="medium" data-selection-size="lg" defaultChecked />
          {t('Large · 50 px')}
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
    <AtlasProvider
      appearance={documentation ? 'docs' : undefined}
      sizeFamily={documentation ? 'selection' : 'component'}
    >
      <div className="pattern-stack" data-switch-preview={appearanceControls ? '' : undefined}>
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
                content: <div className="example-block">{basic}</div>,
              },
              ...(appearanceControls
                ? [
                    {
                      id: 'content',
                      title: t('Text and icon'),
                      description: t(
                        'Each pair starts on and off. Toggle either switch to compare its states.',
                      ),
                      content: <SwitchContentExamples documentation />,
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
                content: <div className="data-entry-state-grid">{sizes}</div>,
              },
              {
                id: 'states',
                title: t('States'),
                description: t(
                  'Unavailable, Processing and required-on controls keep their distinct meanings.',
                ),
                content: <div className="data-entry-state-grid">{states}</div>,
              },
              {
                id: 'selection-variants',
                title: t('Selection layouts and cards'),
                description: t('Turn each workspace on or off.'),
                content: <AtlasSelectionVariants kind="switch" />,
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
              <AtlasSelectionVariants kind="switch" />
            </section>
          </>
        )}
      </div>
    </AtlasProvider>
  );
}
