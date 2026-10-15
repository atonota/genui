import { selectedLabel } from './selectedLabel';
import { useI18n } from './useI18n';
import DataEntryCatalog from './DataEntryCatalog';
import { useState, type CSSProperties } from 'react';
import { Checkbox, Select } from 'antd';
import AtlasProvider from './AtlasProvider';
import AtlasSelectionVariants from './AtlasSelectionVariants';
import { TweakerSettings } from './AtlasTweaker';
import atlas from '../data/atlas.json';
const choices = ['Tasarım', 'Mühendislik', 'Operasyon'];
const buttonOptions = atlas.decisions.buttons;

export function WebCheckboxDemo({ documentation = false }: { documentation?: boolean } = {}) {
  return <CheckboxDemo appearanceControls documentation={documentation} />;
}

export default function CheckboxDemo({
  appearanceControls = false,
  documentation = false,
}: { appearanceControls?: boolean; documentation?: boolean } = {}) {
  const { t } = useI18n();
  const [value, setValue] = useState(['Tasarım']);
  const [radius, setRadius] = useState('5');
  const selectedRadius =
    buttonOptions.radius_variants.find(item => item.value === radius) ??
    buttonOptions.radius_variants.find(item => item.value === '5')!;
  const style = {
    '--checkbox-radius': selectedRadius.css,
  } as CSSProperties;
  const selection = (
    <>
      <Checkbox
        checked={value.length === choices.length}
        indeterminate={value.length > 0 && value.length < choices.length}
        onChange={event => setValue(event.target.checked ? choices : [])}
      >
        {t('Select all')}
      </Checkbox>
      <Checkbox.Group
        options={choices.map(value => ({
          value,
          label: t(
            (
              {
                Tasarım: 'Design',
                Mühendislik: 'Engineering',
                Operasyon: 'Operations',
              } as Record<string, string>
            )[value]!,
          ),
        }))}
        value={value}
        onChange={values => setValue(values)}
      />
      <p role="status">{t('{count} teams selected.', { count: value.length })}</p>
    </>
  );
  const states = (
    <>
      <Checkbox defaultChecked>{t('Checked')}</Checkbox>
      <Checkbox>{t('Unchecked')}</Checkbox>
      <Checkbox disabled>{t('Disabled')}</Checkbox>
      <Checkbox disabled checked>
        {t('Checked and disabled')}
      </Checkbox>
    </>
  );
  return (
    <AtlasProvider
      appearance={documentation ? 'docs' : undefined}
      sizeFamily={documentation ? 'selection' : 'component'}
    >
      <div
        className="pattern-stack"
        data-checkbox-preview={appearanceControls ? '' : undefined}
        style={appearanceControls ? style : undefined}
      >
        {appearanceControls && (
          <TweakerSettings title={t('Checkbox')}>
            <section className="example-block">
              <h3 className="variant-heading">{t('Appearance options')}</h3>
              <div className="playground-controls">
                <label htmlFor="checkbox-radius">
                  {t('Corner')}
                  <Select
                    id="checkbox-radius"
                    labelRender={selectedLabel(buttonOptions.radius_variants, t)}
                    value={radius}
                    onChange={setRadius}
                    options={buttonOptions.radius_variants.map(option => ({
                      ...option,
                      label: t(option.label),
                    }))}
                  />
                </label>
              </div>
            </section>
          </TweakerSettings>
        )}
        {documentation ? (
          <DataEntryCatalog
            slug="checkbox"
            title={t('Checkbox')}
            sections={[
              {
                id: 'selection',
                title: t('Group selection'),
                description: t(
                  'Select teams independently, or use Select all to compare checked and partial selection.',
                ),
                content: <div className="example-block">{selection}</div>,
              },
              {
                id: 'states',
                title: t('States'),
                description: t(
                  'Compare checked, unchecked and unavailable options without changing the group above.',
                ),
                content: <div className="data-entry-state-grid">{states}</div>,
              },
              {
                id: 'selection-variants',
                title: t('Selection layouts and cards'),
                description: t('Choose any workspaces.'),
                content: <AtlasSelectionVariants kind="checkbox" />,
              },
            ]}
          />
        ) : (
          <>
            <section className="example-block">
              <h3 className="variant-heading">{t('Group and partial selection')}</h3>
              {selection}
            </section>
            <section className="example-block">
              <h3 className="variant-heading">{t('States')}</h3>
              {states}
            </section>
            <section className="example-block">
              <h3 className="variant-heading">{t('Selection layouts and cards')}</h3>
              <AtlasSelectionVariants kind="checkbox" />
            </section>
          </>
        )}
      </div>
    </AtlasProvider>
  );
}
