import { useId, useState } from 'react';
import { Switch } from 'antd';
import InputNumber from './AtlasInputNumber';
import AtlasProvider from './AtlasProvider';
import { TweakerSettings } from './AtlasTweaker';
import AtlasSlider from './AtlasSlider';
import DataEntryCatalog, { DataEntryGrid } from './DataEntryCatalog';
import { useI18n } from './useI18n';

export default function SliderDemo({ documentation = false }: { documentation?: boolean } = {}) {
  const { locale, t } = useI18n();
  const id = useId();
  const [linear, setLinear] = useState(36);
  const [range, setRange] = useState<number[]>([24, 76]);
  const [integer, setInteger] = useState(11);
  const [decimal, setDecimal] = useState(0.47);
  const [vertical, setVertical] = useState(30);
  const [verticalRange, setVerticalRange] = useState<number[]>([20, 64]);
  const [temperature, setTemperature] = useState(37);
  const [reversedValue, setReversedValue] = useState(52);
  const [reversedRange, setReversedRange] = useState<number[]>([36, 68]);
  const [disabled, setDisabled] = useState(true);
  const [stateValue, setStateValue] = useState(44);
  const [stateRange, setStateRange] = useState<number[]>([25, 70]);
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const formatValue = (value: number) => number.format(value);
  const formatTooltip = (value?: number) => (value === undefined ? '' : formatValue(value));
  const formatTemperature = (value: number) =>
    t('{value} degrees Celsius', { value: formatValue(value) });
  const currentValue = (value: number) =>
    t('Current value: {value}', { value: formatValue(value) });
  const currentRange = (value: number[]) =>
    t('Current range: {start}–{end}', {
      start: formatValue(value[0]!),
      end: formatValue(value[1]!),
    });

  const ExampleHeading = documentation ? 'h4' : 'h3';
  const linearExample = (
    <section
      className="example-block"
      data-slider-example="linear"
      aria-labelledby={`${id}-linear-heading`}
    >
      <ExampleHeading className="variant-heading" id={`${id}-linear-heading`}>
        {t('Linear slider')}
      </ExampleHeading>
      <div className="slider-demo-field">
        <span id={`${id}-linear-label`}>{t('Linear value')}</span>
        <AtlasSlider
          id={`${id}-linear`}
          value={linear}
          onChange={setLinear}
          ariaLabelledByForHandle={`${id}-linear-label`}
          ariaValueTextFormatterForHandle={formatValue}
          tooltip={{ formatter: formatTooltip }}
        />
        <output htmlFor={`${id}-linear`}>{currentValue(linear)}</output>
      </div>
    </section>
  );
  const rangeExample = (
    <section
      className="example-block"
      data-slider-example="range"
      aria-labelledby={`${id}-range-heading`}
    >
      <ExampleHeading className="variant-heading" id={`${id}-range-heading`}>
        {t('Range slider')}
      </ExampleHeading>
      <div className="slider-demo-field">
        {documentation && <span>{t('Range')}</span>}
        <AtlasSlider
          id={`${id}-range`}
          range
          value={range}
          onChange={setRange}
          ariaLabelForHandle={[t('Range start'), t('Range end')]}
          ariaValueTextFormatterForHandle={[formatValue, formatValue]}
          tooltip={{ formatter: formatTooltip }}
        />
        <output htmlFor={`${id}-range`}>{currentRange(range)}</output>
      </div>
    </section>
  );
  const numberExample = (
    <section
      className="example-block"
      data-slider-example="number"
      aria-labelledby={`${id}-number-heading`}
    >
      <ExampleHeading className="variant-heading" id={`${id}-number-heading`}>
        {t('Slider with number input')}
      </ExampleHeading>
      <p>{t('Numeric fields and sliders share the same value.')}</p>
      <p>{t('Off-step numbers stay as drafts until Enter or blur applies the precision.')}</p>
      <div className="slider-demo-field">
        <label htmlFor={`${id}-integer-input`} id={`${id}-integer-label`}>
          {t('Integer value')}
        </label>
        <div className="slider-demo-number-row">
          <AtlasSlider
            id={`${id}-integer`}
            min={1}
            max={20}
            value={integer}
            onChange={setInteger}
            ariaLabelledByForHandle={`${id}-integer-label`}
            ariaValueTextFormatterForHandle={formatValue}
            tooltip={{ formatter: formatTooltip }}
          />
          <InputNumber
            id={`${id}-integer-input`}
            min={1}
            max={20}
            step={1}
            precision={0}
            value={integer}
            onChange={value => {
              if (value !== null && Number.isInteger(value))
                setInteger(Math.min(20, Math.max(1, value)));
            }}
          />
        </div>
        <output htmlFor={`${id}-integer ${id}-integer-input`}>{currentValue(integer)}</output>
      </div>
      <div className="slider-demo-field">
        <label htmlFor={`${id}-decimal-input`} id={`${id}-decimal-label`}>
          {t('Decimal value')}
        </label>
        <div className="slider-demo-number-row">
          <AtlasSlider
            id={`${id}-decimal`}
            min={0}
            max={1}
            step={0.01}
            value={decimal}
            onChange={setDecimal}
            ariaLabelledByForHandle={`${id}-decimal-label`}
            ariaValueTextFormatterForHandle={formatValue}
            tooltip={{ formatter: formatTooltip }}
          />
          <InputNumber
            id={`${id}-decimal-input`}
            min={0}
            max={1}
            step={0.01}
            precision={2}
            decimalSeparator={number.format(0.1).replace(/\d/g, '')}
            value={decimal}
            onChange={value => {
              if (value !== null && Number.isFinite(value) && value === Number(value.toFixed(2)))
                setDecimal(Math.min(1, Math.max(0, value)));
            }}
          />
        </div>
        <output htmlFor={`${id}-decimal ${id}-decimal-input`}>{currentValue(decimal)}</output>
      </div>
    </section>
  );
  const verticalExample = (
    <section
      className="example-block"
      data-slider-example="vertical"
      aria-labelledby={`${id}-vertical-heading`}
    >
      <ExampleHeading className="variant-heading" id={`${id}-vertical-heading`}>
        {t('Vertical sliders')}
      </ExampleHeading>
      <p>{t('Vertical controls use the same values, targets and keyboard contract.')}</p>
      <div className="slider-demo-vertical-grid">
        <div className="slider-demo-field">
          <span id={`${id}-vertical-label`}>{t('Vertical value')}</span>
          <div className="slider-demo-vertical-frame">
            <AtlasSlider
              id={`${id}-vertical`}
              orientation="vertical"
              value={vertical}
              onChange={setVertical}
              ariaLabelledByForHandle={`${id}-vertical-label`}
              ariaValueTextFormatterForHandle={formatValue}
              tooltip={{ formatter: formatTooltip }}
            />
          </div>
          <output htmlFor={`${id}-vertical`}>{currentValue(vertical)}</output>
        </div>
        <div className="slider-demo-field">
          <span>{t('Range slider')}</span>
          <div className="slider-demo-vertical-frame">
            <AtlasSlider
              id={`${id}-vertical-range`}
              orientation="vertical"
              range
              value={verticalRange}
              onChange={setVerticalRange}
              ariaLabelForHandle={[t('Vertical range start'), t('Vertical range end')]}
              ariaValueTextFormatterForHandle={[formatValue, formatValue]}
              tooltip={{ formatter: formatTooltip }}
            />
          </div>
          <output htmlFor={`${id}-vertical-range`}>{currentRange(verticalRange)}</output>
        </div>
        <div className="slider-demo-field">
          <span id={`${id}-temperature-label`}>{t('Marked temperature')}</span>
          <div className="slider-demo-vertical-frame">
            <AtlasSlider
              id={`${id}-temperature`}
              orientation="vertical"
              min={0}
              max={100}
              marks={{
                0: t('{value} °C', { value: formatValue(0) }),
                26: t('{value} °C', { value: formatValue(26) }),
                37: t('{value} °C', { value: formatValue(37) }),
                100: t('{value} °C', { value: formatValue(100) }),
              }}
              step={null}
              value={temperature}
              onChange={setTemperature}
              ariaLabelledByForHandle={`${id}-temperature-label`}
              ariaValueTextFormatterForHandle={formatTemperature}
              tooltip={{
                formatter: value => (value === undefined ? '' : formatTemperature(value)),
              }}
            />
          </div>
          <output htmlFor={`${id}-temperature`}>{formatTemperature(temperature)}</output>
        </div>
      </div>
    </section>
  );
  const reverseExample = (
    <section
      className="example-block"
      data-slider-example="reverse"
      aria-labelledby={`${id}-reverse-heading`}
    >
      <ExampleHeading className="variant-heading" id={`${id}-reverse-heading`}>
        {t('Linear reverse')}
      </ExampleHeading>
      <p>{t('Reversed sliders use the same value model.')}</p>
      <div className="slider-demo-field">
        <AtlasSlider
          id={`${id}-reverse`}
          reverse
          value={reversedValue}
          onChange={setReversedValue}
          ariaLabelForHandle={t('Reversed value')}
          ariaValueTextFormatterForHandle={formatValue}
          tooltip={{ formatter: formatTooltip }}
        />
        <output htmlFor={`${id}-reverse`}>{currentValue(reversedValue)}</output>
      </div>
      <div className="slider-demo-field">
        <AtlasSlider
          id={`${id}-reverse-range`}
          range
          reverse
          value={reversedRange}
          onChange={setReversedRange}
          ariaLabelForHandle={[t('Reversed range start'), t('Reversed range end')]}
          ariaValueTextFormatterForHandle={[formatValue, formatValue]}
          tooltip={{ formatter: formatTooltip }}
        />
        <output htmlFor={`${id}-reverse-range`}>{currentRange(reversedRange)}</output>
      </div>
    </section>
  );
  const statesExample = (
    <section
      className="example-block"
      data-slider-example="states"
      aria-labelledby={`${id}-states-heading`}
    >
      <ExampleHeading className="variant-heading" id={`${id}-states-heading`}>
        {t('Slider states')}
      </ExampleHeading>
      <TweakerSettings title={t('Slider states')}>
        <label className="control-row" htmlFor={`${id}-disabled-switch`}>
          <Switch id={`${id}-disabled-switch`} checked={disabled} onChange={setDisabled} />
          {t('Disable sliders')}
        </label>
      </TweakerSettings>
      <p>{t('Disabled controls retain their values.')}</p>
      <div className="slider-demo-field">
        <AtlasSlider
          id={`${id}-state`}
          disabled={disabled}
          value={stateValue}
          onChange={setStateValue}
          ariaLabelForHandle={t('Disabled value')}
          ariaValueTextFormatterForHandle={formatValue}
          tooltip={{ formatter: formatTooltip }}
        />
        <output htmlFor={`${id}-state`}>{currentValue(stateValue)}</output>
      </div>
      <div className="slider-demo-field">
        <AtlasSlider
          id={`${id}-state-range`}
          range
          disabled={disabled}
          value={stateRange}
          onChange={setStateRange}
          ariaLabelForHandle={[t('Disabled range start'), t('Disabled range end')]}
          ariaValueTextFormatterForHandle={[formatValue, formatValue]}
          tooltip={{ formatter: formatTooltip }}
        />
        <output htmlFor={`${id}-state-range`}>{currentRange(stateRange)}</output>
      </div>
    </section>
  );
  return (
    <AtlasProvider
      appearance={documentation ? 'docs' : undefined}
      sizeFamily={documentation ? 'selection' : 'component'}
    >
      {documentation ? (
        <div className="slider-demo">
          <DataEntryCatalog
            slug="slider"
            title={t('Slider')}
            sections={[
              {
                id: 'basics',
                title: t('Basic controls'),
                description: t(
                  'Adjust one value or choose an interval. Arrow keys change values; Home and End reach the bounds.',
                ),
                content: (
                  <DataEntryGrid>
                    {linearExample}
                    {rangeExample}
                  </DataEntryGrid>
                ),
              },
              {
                id: 'numeric',
                title: t('Number entry'),
                description: t('Use the number fields when an exact integer or decimal matters.'),
                content: numberExample,
              },
              {
                id: 'direction',
                title: t('Direction and marks'),
                description: t(
                  'Compare vertical, marked and reversed controls while keeping the same value model.',
                ),
                content: (
                  <div className="pattern-stack">
                    {verticalExample}
                    {reverseExample}
                  </div>
                ),
              },
              {
                id: 'states',
                title: t('States'),
                description: t(
                  'Review unavailable single-value and range controls. Their current values remain visible.',
                ),
                content: statesExample,
              },
            ]}
          />
        </div>
      ) : (
        <div className="pattern-stack slider-demo">
          <p>{t('Use arrow keys to adjust, Home and End to reach the bounds.')}</p>
          {linearExample}
          {rangeExample}

          {numberExample}

          {verticalExample}

          {reverseExample}

          {statesExample}
        </div>
      )}
    </AtlasProvider>
  );
}
