import { useId, useMemo, useState, type CSSProperties } from 'react';
import { Button, Checkbox, ConfigProvider, Select, Switch } from 'antd';
import Input from '../GenUXInput';
import GenUXPill from '../GenUXPill';
import GenUXSlider from '../GenUXSlider';
import GenUXIcon from '../GenUXIcon';
import { useI18n } from '../useI18n';
import { colorPreviewTheme, type ColorPreviewFamily } from '../../data/color-preview';
import type { ColorSelection } from '../../data/color-system';

export default function ColorFamilyPreview({
  family,
  mode,
}: {
  family: ColorPreviewFamily;
  mode: ColorSelection['mode'];
}) {
  const { t } = useI18n();
  const id = useId();
  const [name, setName] = useState('');
  const [team, setTeam] = useState('design');
  const [enabled, setEnabled] = useState(true);
  const [checked, setChecked] = useState(false);
  const [value, setValue] = useState(35);
  const [result, setResult] = useState(false);
  const preview = useMemo(
    () => colorPreviewTheme(family.seedHex, mode, family.variableKey),
    [family.seedHex, family.variableKey, mode],
  );
  const label =
    family.offset === 0 ? t('Selected hue') : t('Hue {hue}°', { hue: family.hue.toFixed(1) });
  const fieldStyle = {
    '--field-bg': family.seedHex,
    '--field-hover-bg': family.seedHex,
    '--ink': family.ink,
    '--control-boundary': family.ink,
    '--focus-color': family.ink,
    '--ant-color-icon': family.ink,
    '--ant-color-icon-hover': family.ink,
    color: family.ink,
  } as CSSProperties;
  const sliderStyle = {
    '--color-family-seed': family.seedHex,
    '--color-family-ink': family.ink,
  } as CSSProperties;
  return (
    <ConfigProvider
      theme={preview.config}
      getPopupContainer={trigger =>
        trigger?.closest<HTMLElement>('[data-color-family-preview]') ??
        trigger?.parentElement ??
        document.body
      }
    >
      <section
        className="color-preview-family"
        data-color-family-preview={family.id}
        data-seed-hex={family.seedHex}
        style={preview.variables as CSSProperties}
        aria-labelledby={`${id}-title`}
      >
        <header>
          <h5 id={`${id}-title`}>{label}</h5>
          <code>{family.seedHex}</code>
        </header>
        <div className="color-family-actions">
          <Button
            type="primary"
            className="genux-button color-preview-button"
            onClick={() => setResult(true)}
          >
            {t('Apply')}
          </Button>
          <Button type="text" onClick={() => setResult(false)}>
            {t('Reset action')}
          </Button>
        </div>
        <div className="genux-pill-list">
          <GenUXPill color={family.seedHex} icon={<GenUXIcon name="check" />}>
            {t('Filled')}
          </GenUXPill>
          <GenUXPill color={family.seedHex} variant="solid">
            {t('Solid')}
          </GenUXPill>
          <GenUXPill color={family.seedHex} variant="outlined">
            {t('Outlined')}
          </GenUXPill>
        </div>
        <div className="color-family-fields">
          <label htmlFor={`${id}-name`}>{t('Name')}</label>
          <Input
            id={`${id}-name`}
            aria-label={t('Name for {color}', { color: label })}
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder={t('Enter a name')}
            style={fieldStyle}
          />
          <label htmlFor={`${id}-team`}>{t('Team')}</label>
          <Select
            id={`${id}-team`}
            aria-label={t('Team for {color}', { color: label })}
            value={team}
            onChange={setTeam}
            style={fieldStyle}
            options={[
              { value: 'design', label: t('Design') },
              { value: 'engineering', label: t('Engineering') },
              { value: 'operations', label: t('Operations') },
            ]}
          />
        </div>
        <div className="color-family-selection">
          <label className="color-preview-switch">
            <Switch
              checked={enabled}
              onChange={setEnabled}
              aria-label={t('Enabled for {color}', { color: label })}
            />
            {t('Enabled')}
          </label>
          <Checkbox checked={checked} onChange={event => setChecked(event.target.checked)}>
            {t('Select')}
          </Checkbox>
        </div>
        <div className="color-family-slider" style={sliderStyle}>
          <p id={`${id}-amount-label`}>
            {t('Preview amount')} · {value}
          </p>
          <GenUXSlider
            value={value}
            onChange={setValue}
            ariaLabelForHandle={t('Amount for {color}', { color: label })}
          />
        </div>
        <p className="color-family-action-result" role="status">
          {result ? t('Applied locally.') : ''}
        </p>
      </section>
    </ConfigProvider>
  );
}
