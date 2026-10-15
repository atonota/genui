import { selectedLabel } from './selectedLabel';
import { useI18n } from './useI18n';
import { useState } from 'react';
import { Select, type SelectProps } from 'antd';
import Input from './AtlasInput';
import AtlasProvider from './AtlasProvider';
import { TweakerSettings } from './AtlasTweaker';
import AtlasButton, {
  buttonStates,
  type ButtonDepth,
  type Tone,
  type IconLibrary,
} from './AtlasButton';
import { ButtonStates } from './ButtonStates';
import { ButtonDimensions } from './ButtonDimensions';
import AtlasIconButton from './AtlasIconButton';
import AtlasButtonGroup from './AtlasButtonGroup';
import { type AtlasSize } from './AtlasSizeProfile';
import { buttonColorPresets } from '../data/button-palette';
import { ButtonVisualDecisions, ButtonVisualGroup } from './ButtonVisualDecisions';
import atlas from '../data/atlas.json';
import motionTokens from '../data/motion.json';

const popup = { popup: { root: 'atlas-select-popup' } };
const decisions = atlas.decisions.buttons;
const depthOptions = [
  { value: '3d', label: '3D' },
  { value: 'flat', label: 'Flat' },
];

export function WebButtonDemo({ documentation = false }: { documentation?: boolean } = {}) {
  return <ButtonDemo appearanceControls webFeedback documentation={documentation} />;
}

export default function ButtonDemo({
  appearanceControls = false,
  webFeedback = false,
  documentation = false,
}: { appearanceControls?: boolean; webFeedback?: boolean; documentation?: boolean } = {}) {
  const { t } = useI18n();
  const stateOptions = [
    { label: t('Approved'), options: decisions.state_variants },
    { label: t('Experiments'), options: atlas.experiments.state_variants },
  ];
  // Both playgrounds share the 24 Color system presets; legacy palettes stay internal.
  const paletteOptions: SelectProps['options'] = [
    ...(documentation ? [{ value: 'documentation', label: t('Documentation default') }] : []),
    { label: t('Color system presets'), options: [...buttonColorPresets] },
  ];
  const shadowOptions = [
    { label: t('Approved'), options: decisions.shadow_variants },
    { label: t('Experiments'), options: atlas.experiments.shadow_variants },
  ];

  const [draftText, setText] = useState<string | null>(null);
  const text = draftText ?? t('Continue');
  // Unset until the user picks a corner, so the general radius role from Tweaker applies.
  const [radiusChoice, setRadius] = useState<string | null>(null);
  const radius = radiusChoice ?? undefined;
  const [sizeChoice, setSize] = useState<string | null>(null);
  // Leave the prop absent until explicitly overridden so the inner Provider's
  // shared size control can update every child without remounting this demo.
  const size = sizeChoice === null ? undefined : (sizeChoice as AtlasSize);
  const [width, setWidth] = useState('content');
  // Standalone starts on the shared red preset, the closest match to the former coral default.
  const standalonePreset = 'red';
  const [paletteChoice, setPaletteChoice] = useState<string>(() =>
    documentation ? 'documentation' : standalonePreset,
  );
  const visiblePaletteChoice =
    !documentation && paletteChoice === 'documentation' ? standalonePreset : paletteChoice;
  const colorPreset = visiblePaletteChoice === 'documentation' ? undefined : visiblePaletteChoice;
  const [doubleChoice, setDoubleChoice] = useState('light');
  const [tripleChoice, setTripleChoice] = useState('list');
  const [searchActivated, setSearchActivated] = useState(false);
  const [tone, setTone] = useState<Tone>('middle');
  const [border, setBorder] = useState('none');
  const [shadow, setShadow] = useState('none');
  const [depth, setDepth] = useState<ButtonDepth>('3d');
  const [state, setState] = useState('default');
  const [library, setLibrary] = useState<IconLibrary>('phosphor');
  const [icon, setIcon] = useState('none');
  const [position, setPosition] = useState('left');
  const [motion, setMotion] = useState('static');
  const [fill, setFill] = useState('solid');
  const [duration, setDuration] = useState('deliberate');
  const status = buttonStates.find(item => item.value === state)!;
  const localOptions = (items: SelectProps['options']): SelectProps['options'] =>
    items?.map(item => ({
      ...item,
      label: typeof item.label === 'string' ? t(item.label) : item.label,
      ...(Array.isArray(item.options) ? { options: localOptions(item.options) } : {}),
    }));
  const control = (
    id: string,
    label: string,
    value: string,
    values: SelectProps['options'],
    change: (value: string) => void,
  ) => (
    <div className="playground-control">
      <label htmlFor={id}>{label}</label>
      <Select
        id={id}
        value={value}
        options={localOptions(values)}
        labelRender={selectedLabel(values, t)}
        onChange={change}
        classNames={popup}
      />
    </div>
  );
  const ActionHeading = documentation ? 'h4' : 'h3';
  const ChoiceHeading = documentation ? 'h5' : 'h4';
  const catalogSections = [
    ['button-playground', 'Playground'],
    ['button-actions', 'Action patterns'],
    ['button-surfaces-states', 'Surfaces and states'],
    ['button-size-shape', 'Size and shape'],
    ['button-color-depth', 'Color and depth'],
  ] as const;
  const iconCorners = (
    <ul className="atlas-button-visuals" data-icon-radius-examples>
      {decisions.radius_variants.map(corner => (
        <li key={corner.value} data-icon-radius={corner.value}>
          <div className="control-row">
            <AtlasIconButton
              icon="download"
              aria-label={t('Download · {corner}', { corner: t(corner.label) })}
              radius={corner.value}
              size={size}
            />
            <AtlasButton text={t('Download')} icon="download" radius={corner.value} size={size} />
          </div>
          <p>{t(corner.label)}</p>
        </li>
      ))}
    </ul>
  );
  const iconDescription = (
    <p>
      {t(
        documentation
          ? 'Size, corner and state options are shared with Tweaker. Each icon button has an accessible action name; these examples do not modify data.'
          : 'Size, corner and state options are shared with the playground below. Each icon button has an accessible action name; these examples do not modify data.',
      )}
    </p>
  );
  const iconAppearance = {
    radius,
    size,
    colorPreset,
    tone,
    border,
    shadow,
    state,
    motion,
    fill,
    duration,
  };
  const iconExamples = (
    <section className="example-block" data-icon-button-examples>
      <ActionHeading className="variant-heading">{t('Icon-only actions')}</ActionHeading>
      {!documentation && iconDescription}
      <div className="control-row">
        <AtlasIconButton {...iconAppearance} icon="minus" aria-label={t('Decrease')} />
        <AtlasIconButton {...iconAppearance} icon="plus" aria-label={t('Increase')} />
        <AtlasIconButton {...iconAppearance} icon="trash" aria-label={t('Remove')} />
      </div>
      {documentation && iconDescription}
      {!documentation && iconCorners}
    </section>
  );
  const doubleExample = (
    <>
      <ChoiceHeading className="variant-heading">{t('Double button')}</ChoiceHeading>
      <AtlasButtonGroup
        aria-label={t('Double button example')}
        value={doubleChoice}
        onChange={setDoubleChoice}
        size={size}
        options={[
          { value: 'light', label: t('Light') },
          { value: 'dark', label: t('Dark') },
        ]}
      />
    </>
  );
  const tripleExample = (
    <>
      <ChoiceHeading className="variant-heading">{t('Triple button')}</ChoiceHeading>
      <AtlasButtonGroup
        aria-label={t('Triple button example')}
        value={tripleChoice}
        onChange={setTripleChoice}
        size={size}
        options={[
          { value: 'list', label: t('List') },
          { value: 'table', label: t('Table') },
          { value: 'calendar', label: t('Calendar') },
        ]}
      />
    </>
  );
  const groupExamples = (
    <section className="example-block" data-button-group-examples>
      <ActionHeading className="variant-heading">{t('Grouped choices')}</ActionHeading>
      <p>
        {t(
          'Two or three equal-width choices share one wrapper. One choice is always selected; use the arrow keys to change it.',
        )}
      </p>
      {documentation ? (
        <div className="button-catalog-columns">
          <div className="example-block">{doubleExample}</div>
          <div className="example-block">{tripleExample}</div>
        </div>
      ) : (
        <>
          {doubleExample}
          {tripleExample}
        </>
      )}
    </section>
  );
  const depthExamples = (
    <div className="button-catalog-columns">
      <section className="example-block" data-button-depth-example="3d">
        <h4 className="variant-heading">{t('3D')}</h4>
        <div className="control-row">
          <AtlasButton text={t('Continue')} size={size} depth="3d" />
        </div>
        <p>
          {t(
            'At rest the face sits on a lower lip. Pressing covers the lower lip and reveals a lip at the top; text and hit area stay fixed.',
          )}
        </p>
      </section>
      <section className="example-block" data-button-depth-example="flat">
        <h4 className="variant-heading">{t('Flat')}</h4>
        <div className="control-row">
          <AtlasButton text={t('Continue')} size={size} depth="flat" />
        </div>
        <p>
          {t(
            'No lip, extrusion or shadow at rest or while pressed. Sizes, colors and states are the same as 3D.',
          )}
        </p>
      </section>
    </div>
  );
  const primarySearch = (
    <>
      <AtlasIconButton
        icon="search"
        aria-label={t('Search · primary icon')}
        size={size}
        onClick={() => setSearchActivated(true)}
      />
      <AtlasButton
        icon="search"
        text={t('Search')}
        size={size}
        onClick={() => setSearchActivated(true)}
      />
    </>
  );
  const secondarySearch = (
    <>
      <AtlasIconButton
        icon="search"
        aria-label={t('Search · secondary icon')}
        size={size}
        fill="outline"
        onClick={() => setSearchActivated(true)}
      />
      <AtlasButton
        icon="search"
        text={t('Search')}
        size={size}
        fill="outline"
        onClick={() => setSearchActivated(true)}
      />
    </>
  );
  const searchExamples = (
    <section className="example-block" data-search-button-examples>
      <ActionHeading className="variant-heading">{t('Search actions')}</ActionHeading>
      {documentation ? (
        <div className="example-block">
          <div className="control-row">{primarySearch}</div>
          <div className="control-row">{secondarySearch}</div>
        </div>
      ) : (
        <div className="control-row">
          {primarySearch}
          {secondarySearch}
        </div>
      )}
      <p role="status">
        {searchActivated
          ? t('Search preview activated. No request was sent.')
          : t('Primary and secondary search actions, with an icon alone or an icon and text.')}
      </p>
    </section>
  );
  const playground = (
    <div className="button-playground">
      <div className="playground-preview">
        <AtlasButton
          {...{
            text,
            radius,
            size,
            width,
            colorPreset,
            tone,
            border,
            shadow,
            depth,
            state,
            library,
            icon,
            position,
            motion,
            fill,
            duration,
          }}
        />
      </div>
      <TweakerSettings title={t('Button')}>
        <div className="playground-controls">
          {appearanceControls &&
            control('button-fill', t('Surface · approved'), fill, decisions.fill_variants, setFill)}
          {appearanceControls &&
            control(
              'button-duration',
              t(
                webFeedback
                  ? 'Base transition duration · approved'
                  : 'Transition duration · approved',
              ),
              duration,
              decisions.duration_variants,
              setDuration,
            )}
          <label htmlFor="button-label">
            {t('Text')}
            <Input id="button-label" value={text} onChange={event => setText(event.target.value)} />
          </label>
          {control(
            'button-radius',
            t('Corner · approved'),
            radiusChoice ?? 'inherit',
            [{ value: 'inherit', label: t('Use general radius') }, ...decisions.radius_variants],
            value => setRadius(value === 'inherit' ? null : value),
          )}
          {control(
            'button-size',
            t('Size · approved'),
            sizeChoice ?? 'inherit',
            [{ value: 'inherit', label: t('Shared component size') }, ...decisions.size_variants],
            value => setSize(value === 'inherit' ? null : value),
          )}
          {control(
            'button-width',
            t('Width · approved'),
            width,
            decisions.width_variants,
            setWidth,
          )}
          {control(
            'button-border',
            t('Border · approved'),
            border,
            decisions.border_variants,
            setBorder,
          )}
          {control(
            'button-palette',
            t('Color system preset'),
            visiblePaletteChoice,
            paletteOptions,
            value => {
              if (
                (documentation && value === 'documentation') ||
                buttonColorPresets.some(item => item.value === value)
              )
                setPaletteChoice(value);
            },
          )}
          {control('button-tone', t('Tone · approved'), tone, decisions.tone_variants, value =>
            setTone(value as Tone),
          )}
          {control(
            'button-state',
            t('State · approved / experimental'),
            state,
            stateOptions,
            setState,
          )}
          {control('button-depth', t('Depth'), depth, depthOptions, value =>
            setDepth(value === 'flat' ? 'flat' : '3d'),
          )}
          {control(
            'button-shadow',
            t('Shadow · approved / experimental'),
            shadow,
            shadowOptions,
            setShadow,
          )}
          {control(
            'button-icon-library',
            t('Icon library · experimental'),
            library,
            atlas.experiments.icon_options.library,
            value => setLibrary(value as IconLibrary),
          )}
          {control(
            'button-icon',
            t('Icon · experimental'),
            icon,
            atlas.experiments.icon_options.name,
            setIcon,
          )}
          {control(
            'button-icon-position',
            t('Icon position · experimental'),
            position,
            atlas.experiments.icon_options.position,
            setPosition,
          )}
          {control(
            'button-icon-motion',
            t('Icon motion · experimental'),
            motion,
            atlas.experiments.icon_options.motion,
            setMotion,
          )}
        </div>
      </TweakerSettings>
      <p>
        {t(
          'Resting opacity is 0.9; hover is 1.0. 3D: pressing covers the lower 4 px layer and reveals 2 px at the top. Flat: no lip or shadow at rest or while pressed. Text and hit area stay fixed.',
        )}
      </p>
      <p>
        {t(
          'Color presets use the 24 Color system colors. Hue colors mix 80% pure hue with 10% white and 10% black; grays and blacks keep 80% of their own white and black before the same 10% white and 10% black are added.',
        )}
      </p>
      <p className="form-result" role="status">
        {t(status.label)}: {t(status.description)}
      </p>
    </div>
  );
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined}>
      {documentation ? (
        <div className="button-catalog" data-button-catalog>
          <nav aria-label={t('Button example sections')}>
            <ul className="button-catalog-nav">
              {catalogSections.map(([id, title]) => (
                <li key={id}>
                  <a href={'#' + id}>{t(title)}</a>
                </li>
              ))}
            </ul>
          </nav>
          <section
            id="button-playground"
            className="button-catalog-section"
            aria-labelledby="button-playground-title"
          >
            <header>
              <h3 id="button-playground-title">{t('Playground')}</h3>
              <p>{t("Use Tweaker to change the preview's text, appearance and size.")}</p>
            </header>
            {playground}
          </section>
          <section
            id="button-actions"
            className="button-catalog-section"
            aria-labelledby="button-actions-title"
          >
            <header>
              <h3 id="button-actions-title">{t('Action patterns')}</h3>
              <p>{t('Choose a single action, search action or a grouped choice.')}</p>
            </header>
            <div className="button-catalog-columns">
              {iconExamples}
              {searchExamples}
            </div>
            {groupExamples}
          </section>
          <section
            id="button-surfaces-states"
            className="button-catalog-section"
            aria-labelledby="button-surfaces-states-title"
          >
            <header>
              <h3 id="button-surfaces-states-title">{t('Surfaces and states')}</h3>
              <p>{t('Compare visual emphasis and interaction states before choosing a style.')}</p>
            </header>
            <div className="button-catalog-columns">
              <ButtonVisualGroup axis="fill" />
              <ButtonStates headingLevel={4} />
            </div>
          </section>
          <section
            id="button-size-shape"
            className="button-catalog-section"
            aria-labelledby="button-size-shape-title"
          >
            <header>
              <h3 id="button-size-shape-title">{t('Size and shape')}</h3>
              <p>{t('Compare the shared sizes, widths and corners with text and icon actions.')}</p>
            </header>
            <ButtonDimensions headingLevel={4} />
            <div className="button-catalog-columns">
              <ButtonVisualGroup axis="radius" />
              <section className="example-block" aria-label={t('Icon corners')}>
                <h4 className="variant-heading">{t('Icon corners')}</h4>
                {iconCorners}
              </section>
            </div>
          </section>
          <section
            id="button-color-depth"
            className="button-catalog-section"
            aria-labelledby="button-color-depth-title"
          >
            <header>
              <h3 id="button-color-depth-title">{t('Color and depth')}</h3>
              <p>
                {t(
                  'Color families follow the shared palette. Compare tones and shadows separately.',
                )}
              </p>
            </header>
            <ButtonVisualGroup axis="palette" />
            <div className="button-catalog-columns">
              <ButtonVisualGroup axis="tone" />
              <ButtonVisualGroup axis="shadow" />
            </div>
            {depthExamples}
          </section>
        </div>
      ) : (
        <div className="pattern-stack">
          <ButtonStates />
          <ButtonDimensions />
          {appearanceControls && (
            <ButtonVisualDecisions
              feedbackDuration={
                webFeedback ? motionTokens.durationMs['button-feedback'] : undefined
              }
            />
          )}
          {appearanceControls && iconExamples}
          {appearanceControls && groupExamples}
          {appearanceControls && searchExamples}
          {playground}
        </div>
      )}
    </AtlasProvider>
  );
}
