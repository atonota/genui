import { useI18n } from './useI18n';
import { Checkbox, Collapse, type CollapseProps } from 'antd';
import { toggleCollapseOnSpace } from './keyboard';

export function AccordionExamples() {
  const { t } = useI18n();
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
    <div className="pattern-stack" data-demo="accordion" onKeyDownCapture={toggleCollapseOnSpace}>
      <section className="example-block" aria-labelledby="accordion-single">
        <h3 className="variant-heading" id="accordion-single">
          {t('One open panel')}
        </h3>
        <Collapse
          accordion
          items={accordionItems}
          defaultActiveKey="purpose"
          destroyOnHidden={false}
        />
      </section>
      <section className="example-block" aria-labelledby="accordion-multiple">
        <h3 className="variant-heading" id="accordion-multiple">
          {t('Multiple open panels')}
        </h3>
        <Collapse
          items={accordionItems}
          defaultActiveKey={['purpose', 'keyboard']}
          destroyOnHidden={false}
        />
      </section>
      <section className="example-block" aria-labelledby="accordion-plain">
        <h3 className="variant-heading" id="accordion-plain">
          {t('Borderless and transparent')}
        </h3>
        <Collapse
          ghost
          bordered={false}
          items={accordionItems.slice(0, 2)}
          expandIconPlacement="end"
        />
      </section>
      <section className="example-block" aria-labelledby="accordion-disabled">
        <h3 className="variant-heading" id="accordion-disabled">
          {t('Disabled panel')}
        </h3>
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
        />
      </section>
      <section className="example-block" aria-labelledby="accordion-nested">
        <h3 className="variant-heading" id="accordion-nested">
          {t('Nested panels')}
        </h3>
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
                />
              ),
            },
          ]}
          defaultActiveKey="settings"
          destroyOnHidden={false}
        />
      </section>
    </div>
  );
}
