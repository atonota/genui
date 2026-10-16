import { useId, useState } from 'react';
import { useI18n } from './useI18n';
import { Checkbox, Collapse, Select, type CollapseProps } from 'antd';
import { toggleCollapseOnSpace } from './keyboard';
import { selectedLabel } from './selectedLabel';
import { TweakerSettings } from './AtlasTweaker';
import ExamplePreview from './ExamplePreview';

type IconPlacement = NonNullable<CollapseProps['expandIconPlacement']>;

export function AccordionExamples() {
  const { t } = useI18n();
  const placementId = useId();
  // Presentation-only preview state; it stays with the example when the Tweaker closes.
  const [iconPlacement, setIconPlacement] = useState<IconPlacement>('start');
  const placementOptions = [
    { value: 'start', label: t('Start') },
    { value: 'end', label: t('End') },
  ];
  const accordionItems: NonNullable<CollapseProps['items']> = [
    {
      key: 'purpose',
      label: t('When to use it?'),
      children: (
        <p>
          {t(
            'Groups related details under a heading. Primary actions and required form fields stay outside collapsed panels.',
          )}
        </p>
      ),
    },
    {
      key: 'keyboard',
      label: t('Keyboard use'),
      children: (
        <p>
          {t(
            'Reach the heading with Tab; toggle the panel with Enter or Space. Controls in open panels keep their normal focus order.',
          )}
        </p>
      ),
    },
    {
      key: 'state',
      label: t('Preserving content state'),
      children: (
        <p>
          {t(
            'Keeping hidden panel content mounted preserves local input. Saving to a server is a separate application responsibility.',
          )}
        </p>
      ),
    },
  ];
  return (
    <>
      <TweakerSettings title="Accordion">
        <div className="form-layout-control">
          <label htmlFor={placementId}>{t('Expand icon placement')}</label>
          <Select<IconPlacement>
            id={placementId}
            value={iconPlacement}
            onChange={setIconPlacement}
            options={placementOptions}
            labelRender={selectedLabel(placementOptions)}
          />
        </div>
      </TweakerSettings>
      <div className="pattern-stack" data-demo="accordion" onKeyDownCapture={toggleCollapseOnSpace}>
        <section className="example-block" aria-labelledby="accordion-single">
          <h3 className="variant-heading" id="accordion-single">
            {t('One open panel')}
          </h3>
          <ExamplePreview id="accordion-one-open-panel" title={t('One open panel')}>
            <Collapse
              accordion
              items={accordionItems}
              defaultActiveKey="purpose"
              destroyOnHidden={false}
              expandIconPlacement={iconPlacement}
            />
          </ExamplePreview>
        </section>
        <section className="example-block" aria-labelledby="accordion-multiple">
          <h3 className="variant-heading" id="accordion-multiple">
            {t('Multiple open panels')}
          </h3>
          <ExamplePreview id="accordion-multiple-open-panels" title={t('Multiple open panels')}>
            <Collapse
              items={accordionItems}
              defaultActiveKey={['purpose', 'keyboard']}
              destroyOnHidden={false}
              expandIconPlacement={iconPlacement}
            />
          </ExamplePreview>
        </section>
        <section className="example-block" aria-labelledby="accordion-plain">
          <h3 className="variant-heading" id="accordion-plain">
            {t('Borderless and transparent')}
          </h3>
          <ExamplePreview id="accordion-borderless" title={t('Borderless and transparent')}>
            <Collapse
              ghost
              bordered={false}
              items={accordionItems.slice(0, 2)}
              expandIconPlacement={iconPlacement}
            />
          </ExamplePreview>
        </section>
        <section className="example-block" aria-labelledby="accordion-disabled">
          <h3 className="variant-heading" id="accordion-disabled">
            {t('Disabled panel')}
          </h3>
          <ExamplePreview id="accordion-disabled-panel" title={t('Disabled panel')}>
            <Collapse
              items={[
                ...accordionItems.slice(0, 1),
                {
                  key: 'unavailable',
                  label: t('Unavailable section'),
                  collapsible: 'disabled',
                  children: <p>{t('This panel is not interactive.')}</p>,
                },
              ]}
              expandIconPlacement={iconPlacement}
            />
          </ExamplePreview>
        </section>
        <section className="example-block" aria-labelledby="accordion-nested">
          <h3 className="variant-heading" id="accordion-nested">
            {t('Nested panels')}
          </h3>
          <ExamplePreview id="accordion-nested-panels" title={t('Nested panels')}>
            <Collapse
              items={[
                {
                  key: 'settings',
                  label: t('Notification settings'),
                  children: (
                    <Collapse
                      bordered={false}
                      items={[
                        {
                          key: 'channels',
                          label: t('Channels'),
                          children: <Checkbox defaultChecked>{t('In-app notifications')}</Checkbox>,
                        },
                      ]}
                      destroyOnHidden={false}
                      expandIconPlacement={iconPlacement}
                    />
                  ),
                },
              ]}
              defaultActiveKey="settings"
              destroyOnHidden={false}
              expandIconPlacement={iconPlacement}
            />
          </ExamplePreview>
        </section>
      </div>
    </>
  );
}
