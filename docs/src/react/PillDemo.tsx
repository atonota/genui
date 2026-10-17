import { selectedLabel } from './selectedLabel';
import { useI18n } from './useI18n';
import { useState, type ReactNode } from 'react';
import { Select, Switch, Button } from 'antd';
import genux from '../data/genux.json';
import GenUXProvider from './GenUXProvider';
import { TweakerSettings } from './GenUXTweaker';
import GenUXPill, { GenUXCheckablePill } from './GenUXPill';
import GenUXIcon from './GenUXIcon';
import PillIcon from './PillIcon';
import PillColorExample from './PillColorExample';
import ExamplePreview from './ExamplePreview';
import { pillColorPresets } from '../data/pill-palette';
import { pillVariants, pillSizes, type PillVariant, type PillSize } from '../data/pill-surfaces';

const statuses = [
  { color: 'success', label: 'Success', icon: 'check-circle' },
  { color: 'processing', label: 'Processing', icon: 'loading' },
  { color: 'warning', label: 'Warning', icon: 'warning-circle' },
  { color: 'error', label: 'Error', icon: 'x-circle' },
  { color: 'default', label: 'Default', icon: 'clock' },
] as const;
function StatusIcon({ name }: { name: string }) {
  return name === 'loading' ? (
    <GenUXIcon name="loading" motion="spin" />
  ) : (
    <PillIcon name={name as 'check-circle' | 'warning-circle' | 'x-circle' | 'clock'} />
  );
}

export default function PillDemo({ documentation = false }: { documentation?: boolean } = {}) {
  const { t } = useI18n();
  // Unset until the user picks a corner, so the general radius role applies.
  const [radiusChoice, setRadius] = useState<string | null>(null);
  const radius = radiusChoice ?? undefined;
  const radiusOptions = [
    { value: 'inherit', label: 'Use general radius' },
    ...genux.decisions.buttons.radius_variants,
  ];
  const [labels, setLabels] = useState(['Mühendislik', 'Operasyon']);
  const [variant, setVariant] = useState<PillVariant>('filled');
  const [color, setColor] = useState('scheme');
  const [icon, setIcon] = useState(true);
  const [closable, setClosable] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(true);
  const [checked, setChecked] = useState(['Design']);
  const [removed, setRemoved] = useState('');
  const basic = (
    <div className="genux-pill-list" data-pill-removable>
      <GenUXPill radius={radius} colorIndex={0}>
        {t('Design')}
      </GenUXPill>
      {labels.map(label => (
        <GenUXPill
          key={label}
          radius={radius}
          colorIndex={label === 'Mühendislik' ? 1 : 2}
          closable
          onClose={() => {
            setLabels(current => current.filter(item => item !== label));
            setRemoved(label === 'Mühendislik' ? 'Engineering' : 'Operations');
          }}
        >
          {t(label === 'Mühendislik' ? 'Engineering' : 'Operations')}
        </GenUXPill>
      ))}
    </div>
  );
  const longText = (
    <div className="genux-pill-list">
      <GenUXPill radius={radius} colorIndex={3} closable>
        {t('Istanbul corporate operations and engineering workspace')}
      </GenUXPill>
      <GenUXPill radius={radius} colorIndex={4} closable disabled>
        {t('Disabled')}
      </GenUXPill>
    </div>
  );
  const settings = (
    <TweakerSettings title={t('Pill')}>
      <section className="example-block">
        <h3 className="variant-heading">{t('Appearance options')}</h3>
        <label className="playground-control" htmlFor="pill-radius">
          {t('Corner')}
          <Select
            id="pill-radius"
            labelRender={selectedLabel(radiusOptions, t)}
            value={radiusChoice ?? 'inherit'}
            onChange={value => setRadius(value === 'inherit' ? null : value)}
            options={radiusOptions.map(option => ({
              ...option,
              label: t(option.label),
            }))}
          />
        </label>
        {documentation && (
          <>
            <label className="playground-control" htmlFor="pill-variant">
              {t('Surface')}
              <Select
                id="pill-variant"
                value={variant}
                onChange={setVariant}
                options={pillVariants.map(value => ({ value, label: t(value) }))}
              />
            </label>
            <label className="playground-control" htmlFor="pill-color">
              {t('Color family')}
              <Select
                id="pill-color"
                value={color}
                onChange={setColor}
                options={[
                  { value: 'scheme', label: t('Current color scheme') },
                  ...pillColorPresets.map(p => ({ value: p.value, label: t(p.label) })),
                  ...statuses.map(s => ({ value: s.color, label: t(s.label) })),
                ]}
              />
            </label>
            <label className="control-row">
              <Switch checked={icon} onChange={setIcon} aria-label={t('Show icon')} />
              {t('Show icon')}
            </label>
            <label className="control-row">
              <Switch checked={closable} onChange={setClosable} aria-label={t('Removable tag')} />
              {t('Removable tag')}
            </label>
            <label className="control-row">
              <Switch checked={disabled} onChange={setDisabled} aria-label={t('Disabled')} />
              {t('Disabled')}
            </label>
          </>
        )}
      </section>
    </TweakerSettings>
  );
  const sections: { id: string; title: string; description: string; content: ReactNode }[] = [
    {
      id: 'playground',
      title: t('Playground'),
      description: t(
        'A filled surface inherits the current color scheme. Explore all properties in Tweaker.',
      ),
      content: (
        <ExamplePreview id="pill-playground" title={t('Playground')}>
          <div className="pill-playground">
            <div className="genux-pill-list">
              {previewVisible ? (
                <GenUXPill
                  variant={variant}
                  radius={radius}
                  color={statuses.some(s => s.color === color) ? color : undefined}
                  colorIndex={
                    pillColorPresets.findIndex(p => p.value === color) >= 0
                      ? pillColorPresets.findIndex(p => p.value === color)
                      : undefined
                  }
                  icon={icon ? <GenUXIcon name="check" /> : undefined}
                  closable={closable}
                  disabled={disabled}
                  onClose={() => setPreviewVisible(false)}
                >
                  {t('Workspace label')}
                </GenUXPill>
              ) : (
                <Button type="text" onClick={() => setPreviewVisible(true)}>
                  {t('Restore preview')}
                </Button>
              )}
            </div>
            <p>
              {t('Filled is the default. Solid adds emphasis; outlined keeps the surface light.')}
            </p>
          </div>
        </ExamplePreview>
      ),
    },
    {
      id: 'surfaces',
      title: t('Surfaces and status'),
      description: t(
        'One component, three surfaces. Meaning stays visible through a label and an icon.',
      ),
      content: (
        <ExamplePreview id="pill-surfaces-status" title={t('Surfaces and status')}>
          <div className="pill-surface-grid">
            {pillVariants.map(surface => (
              <div className="example-block" key={surface}>
                <h4>{t(surface)}</h4>
                <div className="genux-pill-list">
                  <GenUXPill variant={surface} radius={radius}>
                    {t('Current color scheme')}
                  </GenUXPill>
                </div>
                <div className="genux-pill-list" data-pill-status={surface}>
                  {statuses.map(status => (
                    <GenUXPill
                      key={status.color}
                      color={status.color}
                      variant={surface}
                      radius={radius}
                      icon={<StatusIcon name={status.icon} />}
                    >
                      {t(status.label)}
                    </GenUXPill>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ExamplePreview>
      ),
    },
    {
      id: 'colors',
      title: t('Color families'),
      description: t(
        '17 shared chromatic families across all three surfaces. Filled colors retain 75% white and 5% black.',
      ),
      content: (
        <ExamplePreview id="pill-color-families" title={t('Color families')}>
          <div className="pill-preset-stack">
            {pillVariants.map(surface => (
              <div className="example-block" key={surface}>
                <h4>
                  {surface === 'filled' ? t('Color sequence · 75% white / 5% black') : t(surface)}
                </h4>
                <div
                  className="genux-pill-list"
                  data-pill-palette={surface === 'filled' ? '' : undefined}
                  data-pill-presets={surface}
                >
                  {pillColorPresets.map((preset, index) => (
                    <GenUXPill
                      key={preset.value}
                      variant={surface}
                      radius={radius}
                      colorIndex={index}
                    >
                      {t(preset.label)}
                    </GenUXPill>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ExamplePreview>
      ),
    },
    {
      id: 'icons',
      title: t('Icons and custom styling'),
      description: t(
        'Use a leading icon, a custom mark or semantic styles while retaining the same master component.',
      ),
      content: (
        <div className="pill-surface-grid" data-pill-icons>
          <ExamplePreview id="pill-icons" title={t('With icon')}>
            <div className="example-block">
              <h4>{t('With icon')}</h4>
              <div className="genux-pill-list">
                {(
                  [
                    { name: 'twitter-logo', label: 'Twitter', color: 10 },
                    { name: 'youtube-logo', label: 'YouTube', color: 0 },
                    { name: 'facebook-logo', label: 'Facebook', color: 11 },
                    { name: 'linkedin-logo', label: 'LinkedIn', color: 9 },
                  ] as const
                ).map(item => (
                  <GenUXPill
                    key={item.name}
                    radius={radius}
                    colorIndex={item.color}
                    icon={<PillIcon name={item.name} />}
                  >
                    {item.label}
                  </GenUXPill>
                ))}
              </div>
              <div className="genux-pill-list">
                <GenUXPill radius={radius} colorIndex={7} icon={<GenUXIcon name="check" />}>
                  {t('Published')}
                </GenUXPill>
                <GenUXPill radius={radius} colorIndex={10} icon={<GenUXIcon name="download" />}>
                  {t('Download')}
                </GenUXPill>
                <GenUXPill radius={radius} colorIndex={14} icon={<GenUXIcon name="lock-simple" />}>
                  {t('Private')}
                </GenUXPill>
              </div>
            </div>
          </ExamplePreview>
          <ExamplePreview id="pill-custom-icons" title={t('Alternative and custom icons')}>
            <div className="example-block">
              <h4>{t('Alternative and custom icons')}</h4>
              <div className="genux-pill-list">
                <GenUXPill
                  radius={radius}
                  colorIndex={12}
                  icon={<GenUXIcon library="antd" name="settings" />}
                >
                  {t('Settings')}
                </GenUXPill>
                <GenUXPill
                  radius={radius}
                  colorIndex={4}
                  icon={
                    <span className="pill-custom-mark" aria-hidden="true">
                      A
                    </span>
                  }
                >
                  {t('Custom mark')}
                </GenUXPill>
                <GenUXPill
                  radius={radius}
                  colorIndex={16}
                  icon={<PillIcon name="heart" />}
                  closable
                >
                  {t('Favorite')}
                </GenUXPill>
              </div>
            </div>
          </ExamplePreview>
          <ExamplePreview id="pill-semantic-styling" title={t('Semantic styling')}>
            <div className="example-block">
              <h4>{t('Semantic styling')}</h4>
              <div className="pill-semantic-group">
                <GenUXPill
                  radius={radius}
                  colorIndex={9}
                  icon={<GenUXIcon name="settings" />}
                  styles={{ content: { fontStyle: 'italic' } }}
                >
                  {t('Object styles')}
                </GenUXPill>
                <GenUXPill
                  radius={radius}
                  colorIndex={14}
                  icon={<GenUXIcon name="check" />}
                  styles={({ props }) => ({
                    content: { fontStyle: props.variant === 'filled' ? 'italic' : 'normal' },
                  })}
                >
                  {t('Function styles')}
                </GenUXPill>
              </div>
            </div>
          </ExamplePreview>
        </div>
      ),
    },
    {
      id: 'interaction',
      title: t('Selection and removal'),
      description: t(
        'Select a label with Space or a click. Remove a label with its separate, named close action.',
      ),
      content: (
        <div className="pill-surface-grid">
          <ExamplePreview id="pill-checkable" title={t('Checkable tags with icon')}>
            <div className="example-block" data-pill-checkable>
              <h4>{t('Checkable tags with icon')}</h4>
              <div className="genux-pill-list">
                {['Design', 'Engineering', 'Operations'].map((label, index) => (
                  <GenUXCheckablePill
                    key={label}
                    radius={radius}
                    colorIndex={index * 5}
                    variant={variant}
                    icon={<GenUXIcon name={checked.includes(label) ? 'check' : 'plus'} />}
                    checked={checked.includes(label)}
                    onChange={active =>
                      setChecked(current =>
                        active ? [...current, label] : current.filter(v => v !== label),
                      )
                    }
                  >
                    {t(label)}
                  </GenUXCheckablePill>
                ))}
                <GenUXCheckablePill
                  aria-label={t('Favorite')}
                  radius={radius}
                  colorIndex={3}
                  variant={variant}
                  icon={<PillIcon name="star" />}
                  checked={checked.includes('Favorite')}
                  onChange={active =>
                    setChecked(current =>
                      active
                        ? [...current, 'Favorite']
                        : current.filter(value => value !== 'Favorite'),
                    )
                  }
                />
                <GenUXCheckablePill
                  radius={radius}
                  checked
                  disabled
                  icon={<GenUXIcon name="lock-simple" />}
                >
                  {t('Disabled')}
                </GenUXCheckablePill>
              </div>
              <p role="status">{t('{count} labels selected', { count: checked.length })}</p>
            </div>
          </ExamplePreview>
          <ExamplePreview id="pill-closable" title={t('Basic and removable')}>
            <div className="example-block" data-pill-closable>
              <h4>{t('Basic and removable')}</h4>
              {basic}
              <p role="status">
                {removed
                  ? t('{label} removed', { label: t(removed) })
                  : t('Remove a tag to try the close action.')}
              </p>
            </div>
          </ExamplePreview>
          <ExamplePreview id="pill-long-text" title={t('Long text and disabled')}>
            <div className="example-block">
              <h4>{t('Long text and disabled')}</h4>
              {longText}
            </div>
          </ExamplePreview>
          <ExamplePreview id="pill-color-family" title={t('Color family')}>
            <PillColorExample radius={radius} variant={variant} />
          </ExamplePreview>
        </div>
      ),
    },
    {
      id: 'combinations',
      title: t('Cross combinations'),
      description: t('Compare size, surface, corner, icon and availability together.'),
      content: (
        <ExamplePreview id="pill-cross-combinations" title={t('Cross combinations')}>
          <div className="pill-surface-grid">
            {(Object.keys(pillSizes) as PillSize[]).map(size => (
              <div className="example-block" key={size}>
                <h4>
                  {t(size)} · {pillSizes[size]} px
                </h4>
                <div className="genux-pill-list">
                  {pillVariants.map((surface, index) => (
                    <GenUXPill
                      key={surface}
                      size={size}
                      variant={surface}
                      colorIndex={index * 6}
                      radius={index === 2 ? 'pill' : radius}
                      icon={index > 0 ? <GenUXIcon name="check" /> : undefined}
                      closable={index === 1}
                    >
                      {t(surface)}
                    </GenUXPill>
                  ))}
                  <GenUXPill size={size} radius={radius} disabled>
                    {t('Disabled')}
                  </GenUXPill>
                </div>
              </div>
            ))}
          </div>
        </ExamplePreview>
      ),
    },
  ];
  return (
    <GenUXProvider
      appearance={documentation ? 'docs' : undefined}
      sizeFamily={documentation ? 'pill' : 'component'}
    >
      <div className={documentation ? 'pill-catalog' : 'pattern-stack'} data-pill-preview>
        {settings}
        {documentation ? (
          <>
            <nav aria-label={t('Pill example sections')}>
              <ol className="pill-navigation">
                {sections.map(section => (
                  <li key={section.id}>
                    <a href={`#pill-examples-${section.id}`}>{section.title}</a>
                  </li>
                ))}
              </ol>
            </nav>
            {sections.map(section => (
              <section
                className="pill-section"
                key={section.id}
                id={`pill-examples-${section.id}`}
                aria-labelledby={`pill-${section.id}-title`}
              >
                <header>
                  <h3 id={`pill-${section.id}-title`}>{section.title}</h3>
                  <p>{section.description}</p>
                </header>
                {section.content}
              </section>
            ))}
          </>
        ) : (
          <>
            <section className="example-block">
              <h3 className="variant-heading">{t('Basic and removable')}</h3>
              {basic}
            </section>
            <section className="example-block">
              <h3 className="variant-heading">{t('Long text and disabled')}</h3>
              {longText}
            </section>
          </>
        )}
      </div>
    </GenUXProvider>
  );
}
