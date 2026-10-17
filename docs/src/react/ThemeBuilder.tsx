import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import {
  Button,
  Checkbox,
  ConfigProvider,
  Input,
  InputNumber,
  Radio,
  Select,
  Slider,
  Switch,
  theme,
} from 'antd';
import GenUXProvider from './GenUXProvider';
import { useI18n } from './useI18n';
import { getThemeSnapshot, subscribeTheme, type ThemeMode } from '../theme';
import { buttonColorPresets } from '../data/button-palette';
import {
  isRadiusTokenId,
  radiusChoice,
  radiusEditValue,
  radiusSelectOptions,
  withGeneralRadius,
} from '../data/radius-options';
import {
  createDefaultRecipe,
  parseRecipe,
  resolveThemeBuilder,
  tokenDefinitions,
  validateRecipe,
  type ThemeRecipe,
  type ThemeTokenDefinition,
} from '../theme-builder/model';
import {
  applyThemeBuilder,
  getServerThemeBuilderSnapshot,
  getThemeBuilderSnapshot,
  resetThemeBuilder,
  subscribeThemeBuilder,
} from '../theme-builder/store';
import { layerOrder, measurementPolicy, stateAxes, surfaceRecipes } from '../theme-builder/states';

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;
const defaultRecipe = createDefaultRecipe();
const serverMode = (): ThemeMode => 'light';
/** The overlay group is registered under its capitalised caption; other groups keep their ids. */
const groupCaption = (group: string): string => (group === 'overlay' ? 'Overlay' : group);

const groupedDefinitions: readonly (readonly [string, readonly ThemeTokenDefinition[]])[] = (() => {
  const groups = new Map<string, ThemeTokenDefinition[]>();
  for (const definition of tokenDefinitions) {
    const group = groups.get(definition.group);
    if (group) group.push(definition);
    else groups.set(definition.group, [definition]);
  }
  return [...groups.entries()];
})();

const primaryDefinition = tokenDefinitions.find(
  definition =>
    definition.kind === 'color' &&
    (definition.id === 'primary' || String(definition.css) === '--primary'),
);

/** Option shapes come from untrusted JSON; normalise without trusting their type. */
function choiceOptions(definition: ThemeTokenDefinition): { value: string; label: string }[] {
  const raw: readonly unknown[] = Array.isArray(definition.options) ? definition.options : [];
  return raw.flatMap(option => {
    if (typeof option === 'string' || typeof option === 'number') {
      return [{ value: String(option), label: String(option) }];
    }
    if (typeof option === 'object' && option !== null && 'value' in option) {
      const value = String((option as { value: unknown }).value);
      const label = 'label' in option ? String((option as { label: unknown }).label) : value;
      return [{ value, label }];
    }
    return [];
  });
}

function geometryEntries(definition: ThemeTokenDefinition): [string, string][] {
  if (!definition.geometry) return [];
  return Object.entries(definition.geometry).map(([key, value]) => [key, String(value)]);
}

export default function ThemeBuilder() {
  const { t } = useI18n();
  const mode = useSyncExternalStore(subscribeTheme, getThemeSnapshot, serverMode);
  const applied = useSyncExternalStore(
    subscribeThemeBuilder,
    getThemeBuilderSnapshot,
    getServerThemeBuilderSnapshot,
  );

  const [draft, setDraft] = useState<ThemeRecipe>(defaultRecipe);
  const [lastValid, setLastValid] = useState<ThemeRecipe>(defaultRecipe);
  const [jsonText, setJsonText] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  const [previewName, setPreviewName] = useState('');
  const [previewChecked, setPreviewChecked] = useState(true);
  const [previewDensity, setPreviewDensity] = useState('comfortable');
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [previewLevel, setPreviewLevel] = useState(40);
  const [previewNotes, setPreviewNotes] = useState('');

  // Synchronise only on external store changes; locale, size and mode keep the draft.
  const seenApplied = useRef<ThemeRecipe | null | undefined>(undefined);
  useEffect(() => {
    if (seenApplied.current === applied) return;
    const first = seenApplied.current === undefined;
    seenApplied.current = applied;
    if (first && applied === null) return;
    const next = applied ?? defaultRecipe;
    setDraft(next);
    setLastValid(next);
  }, [applied]);

  const validation = useMemo(() => validateRecipe(draft), [draft]);
  const previewRecipe = validation.ok ? validation.recipe : lastValid;
  const resolved = useMemo(() => resolveThemeBuilder(previewRecipe, mode), [previewRecipe, mode]);

  // AntD algorithms re-derive seed colors (dark rewrites colorPrimary), so a final
  // step restores the exact resolved seeds over the native map tokens.
  const previewTheme = useMemo(() => {
    const baseAlgorithm = mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm;
    const exactSeed: typeof baseAlgorithm = (seed, mapToken) => ({
      ...(mapToken ?? baseAlgorithm(seed)),
      ...resolved.token,
    });
    const components = resolved.components;
    return {
      cssVar: { key: 'css-var-genux-theme-preview' },
      algorithm: [baseAlgorithm, exactSeed],
      token: resolved.token,
      components: {
        ...components,
        Button: { ...components?.Button, primaryColor: resolved.brandTones.middle.ink },
      },
    };
  }, [mode, resolved]);

  function commitDraft(next: ThemeRecipe) {
    setDraft(next);
    setActionError(null);
    const result = validateRecipe(next);
    if (result.ok) setLastValid(result.recipe);
  }

  // Radius is one general role: any step edits SM, MD and LG in both modes; others edit this mode.
  function updateValue(id: string, value: string | number) {
    if (isRadiusTokenId(id)) {
      commitDraft({
        ...draft,
        light: withGeneralRadius(draft.light, value),
        dark: withGeneralRadius(draft.dark, value),
      });
      return;
    }
    commitDraft({ ...draft, [mode]: { ...draft[mode], [id]: value } });
  }

  // Status and error state hold English keys; they translate at render so a
  // locale change updates the visible message.
  function handleApply() {
    if (!validation.ok) {
      setActionError(validation.error);
      setStatus('');
      return;
    }
    const result = applyThemeBuilder(validation.recipe);
    if (!result.ok) {
      setActionError(result.error);
      setStatus('');
      return;
    }
    setActionError(null);
    setStatus(
      result.persisted
        ? 'Theme applied.'
        : 'Theme applied for this session; browser storage is unavailable.',
    );
  }

  function handleReset() {
    resetThemeBuilder();
    setDraft(defaultRecipe);
    setLastValid(defaultRecipe);
    setActionError(null);
    setStatus('Theme reset to defaults.');
  }

  function handleImport() {
    const result = parseRecipe(jsonText);
    if (!result.ok) {
      setActionError(result.error);
      setStatus('');
      return;
    }
    setDraft(result.recipe);
    setLastValid(result.recipe);
    setActionError(null);
    setStatus('JSON imported into the draft. Select Apply theme to use it.');
  }

  function handleExport() {
    if (!validation.ok) {
      setActionError(validation.error);
      setStatus('');
      return;
    }
    setJsonText(JSON.stringify(validation.recipe, null, 2));
    setActionError(null);
    setStatus('JSON exported.');
  }

  const values = draft[mode];
  const primaryValue = primaryDefinition ? values[primaryDefinition.id] : undefined;
  const selectedPreset = buttonColorPresets.find(
    preset =>
      typeof primaryValue === 'string' && preset.color.toLowerCase() === primaryValue.toLowerCase(),
  );

  const previewStyle: CSSProperties & Record<`--${string}`, string> = {
    ...resolved.variables,
    background: 'var(--panel)',
  };

  function renderEditor(definition: ThemeTokenDefinition) {
    const id = `tb-token-${definition.id}`;
    const descriptionId = `${id}-description`;
    const value = values[definition.id];
    let control;
    if (definition.kind === 'number') {
      control = (
        <InputNumber
          id={id}
          data-theme-token={definition.id}
          aria-describedby={descriptionId}
          value={typeof value === 'number' ? value : null}
          min={definition.min}
          max={definition.max}
          step={definition.step}
          suffix={definition.unit || undefined}
          onChange={next => {
            if (typeof next === 'number' && Number.isFinite(next)) updateValue(definition.id, next);
          }}
        />
      );
    } else if (definition.kind === 'color') {
      const text = typeof value === 'string' ? value : String(value ?? '');
      const invalid = !HEX_PATTERN.test(text);
      control = (
        <span className="theme-builder-color">
          <span
            className="theme-builder-swatch"
            aria-hidden="true"
            style={{ background: invalid ? 'transparent' : text }}
          />
          <Input
            id={id}
            data-theme-token={definition.id}
            aria-describedby={descriptionId}
            aria-invalid={invalid || undefined}
            status={invalid ? 'error' : undefined}
            value={text}
            maxLength={7}
            spellCheck={false}
            autoComplete="off"
            onChange={event => updateValue(definition.id, event.target.value)}
          />
        </span>
      );
    } else {
      // Radius offers the four shared choices plus a retained legacy px while it is current.
      const radius = isRadiusTokenId(definition.id);
      const options = radius
        ? radiusSelectOptions(value).map(option => ({ value: option, label: option }))
        : choiceOptions(definition);
      control = (
        <Select
          id={id}
          data-theme-token={definition.id}
          aria-describedby={descriptionId}
          value={radius ? radiusChoice(value) : value === undefined ? undefined : String(value)}
          options={options.map(option => ({
            value: option.value,
            label: t(option.label),
          }))}
          onChange={(next: string) =>
            updateValue(definition.id, radius ? radiusEditValue(next) : next)
          }
        />
      );
    }
    const geometry = geometryEntries(definition);
    return (
      <div className="theme-token-row" key={definition.id}>
        <label htmlFor={id}>{t(definition.label)}</label>
        {control}
        <p className="theme-builder-hint" id={descriptionId}>
          {t(definition.description)} <code>{String(definition.css)}</code>
        </p>
        {geometry.length > 0 ? (
          <dl className="theme-builder-geometry">
            {geometry.map(([key, entry]) => (
              <div key={key}>
                <dt>{t(key)}</dt>
                <dd>{entry}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    );
  }

  return (
    <GenUXProvider appearance="docs">
      <div className="theme-builder">
        <p className="theme-builder-mode">
          {mode === 'dark' ? t('Editing dark mode') : t('Editing light mode')}
        </p>

        <div className="theme-builder-toolbar">
          <Button type="primary" onClick={handleApply}>
            {t('Apply theme')}
          </Button>
          <Button onClick={handleReset}>{t('Reset theme')}</Button>
          <Button onClick={handleImport}>{t('Import JSON')}</Button>
          <Button onClick={handleExport}>{t('Export JSON')}</Button>
        </div>
        {actionError ? (
          <p role="alert" data-theme-error className="theme-builder-error">
            {t(actionError)}
          </p>
        ) : null}
        <p role="status" className="theme-builder-status">
          {status ? t(status) : null}
        </p>

        <div className="theme-builder-layout">
          <ConfigProvider theme={previewTheme}>
            <section
              className="theme-builder-preview"
              data-theme-preview={mode}
              style={previewStyle}
              aria-label={t('Live preview')}
            >
              <h3>{t('Live preview')}</h3>
              <div className="theme-token-row">
                <label htmlFor="theme-preview-name">{t('Name')}</label>
                <Input
                  id="theme-preview-name"
                  value={previewName}
                  style={{ background: 'var(--field-bg)' }}
                  onChange={event => setPreviewName(event.target.value)}
                />
              </div>
              <div className="theme-builder-toolbar">
                <Button type="primary" data-theme-preview-action>
                  {t('Primary action')}
                </Button>
                <Button>{t('Secondary action')}</Button>
                <Button type="primary" shape="round">
                  {t('Pill')}
                </Button>
              </div>
              <div className="theme-token-row">
                <Checkbox
                  checked={previewChecked}
                  onChange={event => setPreviewChecked(event.target.checked)}
                >
                  {t('Notify me')}
                </Checkbox>
                <span className="theme-builder-value">
                  {previewChecked ? t('Checked') : t('Unchecked')}
                </span>
              </div>
              <div className="theme-token-row">
                <span id="theme-preview-density-label">{t('Density')}</span>
                <Radio.Group
                  aria-labelledby="theme-preview-density-label"
                  value={previewDensity}
                  onChange={event => setPreviewDensity(String(event.target.value))}
                  options={[
                    { value: 'comfortable', label: t('Comfortable') },
                    { value: 'compact', label: t('Compact') },
                  ]}
                />
                <span className="theme-builder-value">
                  {previewDensity === 'compact' ? t('Compact') : t('Comfortable')}
                </span>
              </div>
              <div className="theme-token-row">
                <label htmlFor="theme-preview-switch">{t('Enabled')}</label>
                <Switch
                  id="theme-preview-switch"
                  checked={previewEnabled}
                  onChange={setPreviewEnabled}
                />
                <span className="theme-builder-value">{previewEnabled ? t('On') : t('Off')}</span>
              </div>
              <div className="theme-token-row">
                <span id="theme-preview-level-label">{t('Level')}</span>
                <Slider
                  value={previewLevel}
                  min={0}
                  max={100}
                  ariaLabelledByForHandle="theme-preview-level-label"
                  onChange={(next: number) => setPreviewLevel(next)}
                />
                <span className="theme-builder-value">{previewLevel}</span>
              </div>
              <div className="theme-token-row">
                <label htmlFor="theme-preview-notes">{t('Notes')}</label>
                <Input.TextArea
                  id="theme-preview-notes"
                  value={previewNotes}
                  autoSize={{ minRows: 2, maxRows: 6 }}
                  onChange={event => setPreviewNotes(event.target.value)}
                />
              </div>
            </section>
          </ConfigProvider>

          <section className="theme-builder-controls" aria-label={t('Theme tokens')}>
            {primaryDefinition ? (
              <div className="theme-token-row">
                <label htmlFor="tb-preset">{t('Basic color preset')}</label>
                <Select
                  id="tb-preset"
                  value={selectedPreset?.value}
                  placeholder={t('Choose a preset')}
                  options={buttonColorPresets.map(preset => ({
                    value: preset.value,
                    label: (
                      <span className="theme-builder-preset">
                        <span
                          className="theme-builder-swatch"
                          aria-hidden="true"
                          style={{ background: preset.color }}
                        />
                        {t(preset.label)}
                      </span>
                    ),
                  }))}
                  onChange={(next: string) => {
                    const preset = buttonColorPresets.find(item => item.value === next);
                    if (preset) updateValue(primaryDefinition.id, preset.color);
                  }}
                />
              </div>
            ) : null}

            {groupedDefinitions.map(([group, definitions]) => (
              <fieldset className="theme-builder-group" key={group}>
                <legend>{t(groupCaption(group))}</legend>
                {definitions.map(renderEditor)}
              </fieldset>
            ))}

            {validation.ok ? null : (
              <p className="theme-builder-draft-note">
                {t('Preview uses the last valid theme until the draft is valid.')}{' '}
                {t(validation.error)}
              </p>
            )}

            <div className="theme-builder-json">
              <label htmlFor="theme-json">{t('Theme JSON')}</label>
              <Input.TextArea
                id="theme-json"
                value={jsonText}
                autoSize={{ minRows: 6, maxRows: 16 }}
                spellCheck={false}
                onChange={event => setJsonText(event.target.value)}
              />
            </div>
          </section>
        </div>

        <section className="theme-builder-metadata" aria-label={t('State model')}>
          <h3>{t('State model')}</h3>
          <dl>
            {stateAxes.map(axis => (
              <div key={axis.id}>
                <dt>{t(axis.label)}</dt>
                <dd>
                  {t(axis.description)}{' '}
                  <code>
                    {(axis.values as readonly string[]).map(value => t(value)).join(' · ')}
                  </code>
                </dd>
              </div>
            ))}
          </dl>
          <h4>{t('Measurement policy')}</h4>
          <p>{t('Values show the GenUX defaults, not the current draft.')}</p>
          <dl>
            {measurementPolicy.map(item => (
              <div key={item.label}>
                <dt>{t(item.label)}</dt>
                <dd>
                  <code>{t(item.value)}</code> {t(item.description)}
                </dd>
              </div>
            ))}
          </dl>
          <h4>{t('Layer order')}</h4>
          <ol>
            {layerOrder.map(layer => (
              <li key={layer.id}>
                {t(layer.label)} <code>{layer.value}</code>
              </li>
            ))}
          </ol>
          <h4>{t('Surface recipes')}</h4>
          <dl>
            {surfaceRecipes.map(recipe => (
              <div key={recipe.id}>
                <dt>{t(recipe.label)}</dt>
                <dd>{t(recipe.description)}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </GenUXProvider>
  );
}
