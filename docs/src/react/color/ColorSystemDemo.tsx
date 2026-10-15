import {
  useEffect,
  useId,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Button, Checkbox, ConfigProvider, Radio, Select, Switch, theme } from 'antd';
import Input from '../AtlasInput';
import InputNumber from '../AtlasInputNumber';
import Segmented from '../AtlasSegmented';
import AtlasProvider from '../AtlasProvider';
import AtlasButton from '../AtlasButton';
import AtlasSlider from '../AtlasSlider';
import AtlasPill from '../AtlasPill';
import ColorFamilyPreview from './ColorFamilyPreview';
import { colorPreviewFamilies, colorPreviewTheme } from '../../data/color-preview';
import { useI18n } from '../useI18n';
import { beginThemePaint } from '../../theme';
import {
  COLOR_PRESETS,
  COLOR_SPECTRUM_SEGMENTS,
  COLOR_TOKEN_NAMES,
  DEFAULT_COLOR_SELECTION,
  MAX_COLOR_SETTINGS_BYTES,
  applyColorPreset,
  contrastInk,
  contrastRatio,
  convertColorSelection,
  exportColorSelection,
  generateColorPalette,
  hueWindowSegments,
  hwbToHex,
  importColorSelection,
  normalizeHue,
  presetStatus,
  resetColorSelection,
  setColorChannel,
  setFineHue,
  setFineOffset,
  setMainHue,
  setPreviewTheme,
  setSelectionMethod,
  validateColorSelection,
  type ColorSelection,
} from '../../data/color-system';

const STORAGE_KEY = 'hwb-ant-controller-v1';
const SAVED_KEY = 'hwb-ant-controller-saved-v1';
type Notice = { message: string; error?: boolean } | null;
type ExportKind = 'react' | 'palette' | 'json' | 'css';
const css = (variables: Record<string, string | number>): CSSProperties =>
  variables as CSSProperties;

function getColorPopupContainer(trigger?: HTMLElement): HTMLElement {
  return (
    (trigger?.closest('.color-seed-preview') as HTMLElement | null | undefined) ??
    trigger?.parentElement ??
    document.body
  );
}

function Spectrum({ colors }: { colors: string[] }) {
  return (
    <div
      className="color-spectrum"
      aria-hidden="true"
      style={css({ '--color-spectrum-segments': colors.length })}
    >
      {colors.map((color, index) => (
        <span key={index} style={css({ '--spectrum-color': color })} />
      ))}
    </div>
  );
}

function ColorChannel({
  id,
  label,
  value,
  min = 0,
  max,
  step,
  colors,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: number;
  min?: number;
  max: number;
  step: number;
  colors: string[];
  onChange: (value: number) => void;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="color-channel">
      <div className="color-channel-heading">
        <label id={`${id}-label`} htmlFor={`${id}-number`}>
          {label}
        </label>
        <InputNumber
          id={`${id}-number`}
          aria-labelledby={`${id}-label`}
          min={min}
          max={max}
          step={step}
          value={value}
          controls={false}
          onChange={next => {
            if (typeof next === 'number' && Number.isFinite(next) && next >= min && next <= max)
              onChange(next);
          }}
        />
      </div>
      <div className="color-channel-rail">
        <Spectrum colors={colors} />
        <AtlasSlider
          min={min}
          max={max}
          step={step}
          value={value}
          ariaLabelForHandle={label}
          tooltip={{ formatter: next => `${next ?? value}` }}
          onChange={onChange}
        />
      </div>
      <div className="color-channel-scale" aria-hidden="true">
        <span>{min}</span>
        <span>{max}</span>
      </div>
      {children}
      <span className="color-channel-help">
        {t('Use the slider, arrow keys or numeric field.')}
      </span>
    </div>
  );
}

function FineHueNumber({
  id,
  labelledBy,
  value,
  selectionKey,
  onCommit,
  onDraftChange,
}: {
  id: string;
  labelledBy: string;
  value: number;
  selectionKey: ColorSelection;
  onCommit: (value: number) => void;
  onDraftChange: () => void;
}) {
  const [draft, setDraft] = useState<{ origin: ColorSelection; value: number | null }>({
    origin: selectionKey,
    value,
  });
  const draftRef = useRef(draft);
  const dirty = useRef(false);
  useEffect(() => {
    const next = { origin: selectionKey, value };
    draftRef.current = next;
    dirty.current = false;
    setDraft(next);
  }, [value, selectionKey]);
  const commit = () => {
    if (!dirty.current) return;
    dirty.current = false;
    const next = draftRef.current;
    setDraft({ origin: selectionKey, value });
    if (
      next.origin === selectionKey &&
      typeof next.value === 'number' &&
      Number.isFinite(next.value) &&
      next.value >= 0 &&
      next.value <= 360
    )
      onCommit(next.value);
  };
  return (
    <InputNumber
      id={id}
      aria-labelledby={labelledBy}
      min={0}
      max={360}
      step={0.1}
      value={dirty.current && draft.origin === selectionKey ? draft.value : value}
      controls={false}
      changeOnBlur={false}
      onChange={next => {
        onDraftChange();
        const nextDraft = { origin: selectionKey, value: next };
        draftRef.current = nextDraft;
        dirty.current = true;
        setDraft(nextDraft);
      }}
      onPressEnter={commit}
      onBlur={commit}
    />
  );
}

function SeedPreview({ selection }: { selection: ColorSelection }) {
  const { t } = useI18n();
  const { token } = theme.useToken();
  const [name, setName] = useState('');
  const [team, setTeam] = useState('design');
  const [notifications, setNotifications] = useState(true);
  const [result, setResult] = useState(false);
  const [checked, setChecked] = useState(false);
  const [priority, setPriority] = useState('standard');
  const [amount, setAmount] = useState(40);
  const id = useId();
  const whiteContrast = contrastRatio('#FFFFFF', token.colorPrimary);
  return (
    <section className="color-preview-content" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{t('Live component preview')}</h3>
      <p>{t('Preview values stay in place when the seed or preview theme changes.')}</p>
      <div className="color-preview-fields">
        <label htmlFor={`${id}-name`}>
          {t('Workspace name')}
          <Input
            id={`${id}-name`}
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder={t('Enter a workspace name')}
          />
        </label>
        <label htmlFor={`${id}-team`}>
          {t('Team')}
          <Select
            id={`${id}-team`}
            value={team}
            onChange={setTeam}
            options={[
              { value: 'design', label: t('Design') },
              { value: 'engineering', label: t('Engineering') },
              { value: 'operations', label: t('Operations') },
            ]}
            getPopupContainer={getColorPopupContainer}
          />
        </label>
        <label className="color-preview-switch" htmlFor={`${id}-notify`}>
          <Switch id={`${id}-notify`} checked={notifications} onChange={setNotifications} />
          {t('Notifications')}
        </label>
        <Button
          type="primary"
          className="atlas-button color-preview-button"
          onClick={() => setResult(true)}
        >
          {t('Preview action')}
        </Button>
      </div>
      <div className="color-selected-extras">
        <div className="atlas-pill-list">
          <AtlasPill
            styles={{
              root: { backgroundColor: token.colorPrimary, color: contrastInk(token.colorPrimary) },
            }}
          >
            {t('Selected color')}
          </AtlasPill>
          <AtlasPill color="success">{t('Success')}</AtlasPill>
        </div>
        <Checkbox checked={checked} onChange={event => setChecked(event.target.checked)}>
          {t('Include archived')}
        </Checkbox>
        <Radio.Group
          aria-label={t('Preview priority')}
          value={priority}
          onChange={event => setPriority(event.target.value)}
          options={[
            { value: 'standard', label: t('Standard') },
            { value: 'priority', label: t('Priority') },
          ]}
        />
        <div>
          <p>
            {t('Preview amount')} · {amount}
          </p>
          <AtlasSlider
            value={amount}
            onChange={setAmount}
            ariaLabelForHandle={t('Preview amount')}
          />
        </div>
      </div>
      <p className="color-preview-action-result" role="status">
        {result
          ? t('The preview action ran locally. No data was sent.')
          : t('Try the controls with the selected color.')}
      </p>
      <dl className="color-token-list">
        {COLOR_TOKEN_NAMES.map(key => (
          <div key={key}>
            <dt>
              <code>{key}</code>
            </dt>
            <dd>
              <code>{token[key]}</code>
            </dd>
          </div>
        ))}
      </dl>
      <p className="color-contrast" data-contrast-low={whiteContrast < 4.5}>
        {t('White text / actual primary: {ratio}:1.', { ratio: whiteContrast.toFixed(2) })}{' '}
        {whiteContrast < 4.5
          ? t('Below 4.5:1 for normal text. The chosen seed is retained.')
          : t('This pair reaches 4.5:1 for normal text.')}
      </p>
      <p className="color-caption">
        {t(
          'This contrast result covers this color pair only; it does not certify the whole interface.',
        )}
      </p>
      <span className="color-caption">
        {t('Preview theme: {mode}', { mode: t(selection.mode === 'light' ? 'Light' : 'Dark') })}
      </span>
    </section>
  );
}

function ColorFamilyGallery({ selection }: { selection: ColorSelection }) {
  const { t } = useI18n();
  const id = useId();
  const families = colorPreviewFamilies(selection);
  return (
    <section className="color-family-gallery" aria-labelledby={`${id}-families-title`}>
      <header>
        <h4 id={`${id}-families-title`}>{t('Same settings, six colors')}</h4>
        <p>
          {t(
            'Whiteness, blackness and hue move every sample together. Each field keeps its own value.',
          )}
        </p>
      </header>
      {new Set(families.map(family => family.seedHex)).size === 1 && (
        <p>{t('With no pure hue left, all six samples share the same neutral color.')}</p>
      )}
      <div className="color-family-grid">
        {families.map(family => (
          <ColorFamilyPreview key={family.id} family={family} mode={selection.mode} />
        ))}
      </div>
    </section>
  );
}

function ColorSystemWorkbench() {
  const { t } = useI18n();
  const id = useId();
  const [selection, setSelection] = useState<ColorSelection>(DEFAULT_COLOR_SELECTION);
  const [saved, setSaved] = useState<ColorSelection[]>([]);
  const [storageProblem, setStorageProblem] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [kind, setKind] = useState<ExportKind>('react');
  const fileRef = useRef<HTMLInputElement>(null);
  const presetsRef = useRef<HTMLDivElement>(null);
  const savedListRef = useRef<HTMLUListElement>(null);
  const removedSelectionFocus = useRef<number | null>(null);
  const importGeneration = useRef(0);
  const converted = convertColorSelection(selection);
  // Mode and seed changes can reverse the readable ink. Cover every palette
  // commit, including saved/restored/imported selections, before the next paint.
  useLayoutEffect(beginThemePaint, [selection.mode, converted.seedHex]);
  const source = presetStatus(selection);
  const preview = useMemo(
    () => colorPreviewTheme(converted.seedHex, selection.mode, 'css-var-atlas-color-preview'),
    [converted.seedHex, selection.mode],
  );
  const computedRoles = preview.roles;
  const actualRoles = computedRoles;
  const palette = generateColorPalette(converted.seedHex, selection.mode);
  const nestedTheme = preview.config;
  const previewStyle = css(preview.variables);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setSelection(validateColorSelection(JSON.parse(stored)));
      const previous = window.localStorage.getItem(SAVED_KEY);
      if (previous) {
        const parsed: unknown = JSON.parse(previous);
        if (!Array.isArray(parsed) || parsed.length > 20)
          throw new TypeError('Invalid saved selections.');
        setSaved(parsed.map(validateColorSelection));
      }
    } catch {
      setStorageProblem(true);
    }
    return () => {
      importGeneration.current += 1;
    };
  }, []);

  useLayoutEffect(() => {
    const index = removedSelectionFocus.current;
    if (index === null) return;
    removedSelectionFocus.current = null;
    const loadButtons =
      savedListRef.current?.querySelectorAll<HTMLButtonElement>('[data-saved-load]');
    const target =
      loadButtons?.[Math.min(index, loadButtons.length - 1)] ??
      document.getElementById(`${id}-save-selection`);
    target?.focus();
  }, [saved, id]);

  const update = (next: ColorSelection) => {
    importGeneration.current += 1;
    setSelection(next);
    setNotice(null);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setStorageProblem(true);
    }
  };
  const persistSaved = (next: ColorSelection[]) => {
    setSaved(next);
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    } catch {
      setStorageProblem(true);
    }
  };
  const save = () => {
    persistSaved([selection, ...saved].slice(0, 20));
    setNotice({ message: 'Selection saved. Up to 20 selections are retained.' });
  };
  const removeSelection = (index: number) => {
    removedSelectionFocus.current = index;
    persistSaved(saved.filter((_, savedIndex) => savedIndex !== index));
  };
  const onPresetKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const input = event.target as HTMLElement;
    if (!(input instanceof HTMLInputElement) || input.type !== 'radio') return;
    const inputs = Array.from(
      presetsRef.current?.querySelectorAll<HTMLInputElement>('input[type="radio"]') ?? [],
    );
    const current = inputs.indexOf(input);
    let next: number;
    if (current < 0) return;
    const grid = presetsRef.current?.querySelector('.color-presets');
    const rows = Math.max(
      1,
      Number(grid && getComputedStyle(grid).getPropertyValue('--color-preset-rows')) || 13,
    );
    const columnStep = getComputedStyle(input).direction === 'rtl' ? -rows : rows;
    if (event.key === 'ArrowDown')
      next = current % rows < rows - 1 ? Math.min(current + 1, inputs.length - 1) : current;
    else if (event.key === 'ArrowUp') next = current % rows > 0 ? current - 1 : current;
    else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      const candidate = current + (event.key === 'ArrowRight' ? columnStep : -columnStep);
      next = candidate >= 0 && candidate < inputs.length ? candidate : current;
    } else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = COLOR_PRESETS.length - 1;
    else return;
    event.preventDefault();
    const preset = COLOR_PRESETS[next];
    if (preset) {
      update(applyColorPreset(selection, preset.id));
      inputs[next]?.focus();
    }
  };
  const exportObject = exportColorSelection(selection, actualRoles);
  const output =
    kind === 'json'
      ? JSON.stringify(exportObject, null, 2)
      : kind === 'css'
        ? `:root {\n  --color-seed: ${converted.seedHex};\n${COLOR_TOKEN_NAMES.map(key => `  --${key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())}: ${actualRoles[key]};`).join('\n')}\n}`
        : kind === 'palette'
          ? `import { generate } from '@ant-design/colors';\n\nconst palette = generate('${converted.seedHex}'${selection.mode === 'dark' ? ", { theme: 'dark', backgroundColor: '#141414' }" : ''});\n// ${JSON.stringify(palette)}`
          : `import { ConfigProvider, Button, theme } from 'antd';\n\n<ConfigProvider theme={{\n  algorithm: theme.${selection.mode === 'dark' ? 'darkAlgorithm' : 'defaultAlgorithm'},\n  token: { colorPrimary: '${converted.seedHex}' },\n}}>\n  <Button type="primary">Continue</Button>\n</ConfigProvider>`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setNotice({ message: 'Output copied.' });
    } catch {
      setNotice({
        message: 'Clipboard access is unavailable. Select and copy the output below.',
        error: true,
      });
    }
  };
  const download = () => {
    try {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'atlas-color-selection.json';
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice({ message: 'The JSON download was prepared.' });
    } catch {
      setNotice({
        message: 'The download could not be prepared. Copy the JSON output instead.',
        error: true,
      });
    }
  };
  const importFile = async (file: File | undefined) => {
    const generation = ++importGeneration.current;
    if (!file) return;
    if (file.size > MAX_COLOR_SETTINGS_BYTES) {
      setNotice({ message: 'Choose a settings file no larger than 1 MiB.', error: true });
      return;
    }
    try {
      const next = importColorSelection(await file.text());
      if (generation !== importGeneration.current) return;
      update(next);
      setNotice({
        message: 'Settings imported. Derived colors were recalculated from the validated inputs.',
      });
    } catch {
      if (generation !== importGeneration.current) return;
      setNotice({
        message: 'The settings file is invalid or unsupported. The current selection is unchanged.',
        error: true,
      });
    }
  };
  const mainSpectrum = Array.from({ length: COLOR_SPECTRUM_SEGMENTS }, (_, index) =>
    hwbToHex((index * 360) / (COLOR_SPECTRUM_SEGMENTS - 1), 0, 0),
  );
  const fineSpectrum = Array.from({ length: COLOR_SPECTRUM_SEGMENTS }, (_, index) =>
    hwbToHex(
      normalizeHue(selection.anchor - 36 + (index * 72) / (COLOR_SPECTRUM_SEGMENTS - 1)),
      0,
      0,
    ),
  );
  const channelSpectrum = (channel: 'w' | 'b') =>
    Array.from({ length: COLOR_SPECTRUM_SEGMENTS }, (_, index) =>
      hwbToHex(
        converted.h,
        channel === 'w' ? (index * 100) / (COLOR_SPECTRUM_SEGMENTS - 1) : selection.w,
        channel === 'b' ? (index * 100) / (COLOR_SPECTRUM_SEGMENTS - 1) : selection.b,
      ),
    );
  const hueEnd = Number(converted.pureShare.toFixed(6));
  const whiteEnd = Number((converted.pureShare + converted.effectiveW).toFixed(6));
  const compositionBoundaries = [
    { id: 'start', position: 0, visible: true },
    { id: 'hue-end', position: hueEnd, visible: hueEnd > 0 && hueEnd < 100 },
    {
      id: 'white-end',
      position: whiteEnd,
      visible: whiteEnd > 0 && whiteEnd < 100 && whiteEnd !== hueEnd,
    },
    { id: 'end', position: 100, visible: true },
  ];

  return (
    <div
      className="color-system-lab"
      style={css({
        '--color-live-primary': converted.seedHex,
        '--color-live-ink': contrastInk(converted.seedHex),
      })}
      data-color-system=""
      data-selection-method={selection.selectionMode}
    >
      <div className="color-workbench-heading">
        <h2>{t('Choose a color')}</h2>
        <AtlasButton
          fill="text"
          text={t('Reset color')}
          onClick={() => update(resetColorSelection(selection))}
        />
      </div>
      <div className="color-workbench-grid">
        <section className="color-controls" aria-label={t('Color selection controls')}>
          <Segmented
            className="atlas-segmented color-method color-selection-method"
            block
            name={`${id}-method`}
            value={selection.selectionMode}
            options={[
              { value: 'presets', label: t('Color presets') },
              { value: 'detailed', label: t('Detailed selection') },
            ]}
            onChange={value =>
              update(setSelectionMethod(selection, value as ColorSelection['selectionMode']))
            }
            aria-label={t('Selection method')}
            tabIndex={-1}
          />
          <div
            className="color-method-panel"
            data-open={selection.selectionMode === 'detailed'}
            inert={selection.selectionMode !== 'detailed'}
            aria-hidden={selection.selectionMode !== 'detailed'}
          >
            <div className="color-method-clip">
              <div className="color-hue-controls">
                <ColorChannel
                  id={`${id}-main`}
                  label={t('Main hue · degrees')}
                  value={selection.anchor}
                  max={360}
                  step={1}
                  colors={mainSpectrum}
                  onChange={value => update(setMainHue(selection, value))}
                >
                  <div className="color-hue-window" aria-hidden="true">
                    {hueWindowSegments(selection.anchor).map((segment, index) => (
                      <span
                        className="atlas-motion-layer"
                        key={index}
                        style={css({
                          '--window-left': `${segment.left}%`,
                          '--window-width': `${segment.width}%`,
                        })}
                      />
                    ))}
                  </div>
                </ColorChannel>
                <div className="color-channel">
                  <div className="color-channel-heading">
                    <label id={`${id}-fine-label`} htmlFor={`${id}-fine-number`}>
                      {t('Fine hue · degrees')}
                    </label>
                    <FineHueNumber
                      id={`${id}-fine-number`}
                      labelledBy={`${id}-fine-label`}
                      value={converted.h}
                      selectionKey={selection}
                      onDraftChange={() => {
                        importGeneration.current += 1;
                      }}
                      onCommit={value => {
                        const result = setFineHue(selection, value);
                        update(result.state);
                        if (result.recentered)
                          setNotice({
                            message: 'The fine hue window was recentered around the entered value.',
                          });
                      }}
                    />
                  </div>
                  <div className="color-channel-rail">
                    <Spectrum colors={fineSpectrum} />
                    <AtlasSlider
                      min={-36}
                      max={36}
                      step={0.1}
                      value={selection.offset}
                      ariaLabelForHandle={t('Fine hue offset')}
                      onChange={value => update(setFineOffset(selection, value))}
                      tooltip={{
                        formatter: value =>
                          `${normalizeHue(selection.anchor + (value ?? selection.offset)).toFixed(1)}°`,
                      }}
                    />
                  </div>
                  <div className="color-channel-scale" aria-hidden="true">
                    <span>{normalizeHue(selection.anchor - 36).toFixed(1)}°</span>
                    <span>{normalizeHue(selection.anchor + 36).toFixed(1)}°</span>
                  </div>
                  <div className="color-channel-footer">
                    <span className="color-caption">{t('72° window · 5× magnification')}</span>
                    <AtlasButton
                      fill="text"
                      text={t('Center fine hue')}
                      onClick={() => update(setFineOffset(selection, 0))}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            className="color-method-panel"
            data-open={selection.selectionMode === 'presets'}
            inert={selection.selectionMode !== 'presets'}
            aria-hidden={selection.selectionMode !== 'presets'}
          >
            <div className="color-method-clip">
              <div
                className="color-presets-viewport"
                ref={presetsRef}
                onKeyDown={onPresetKeyDown}
                role="region"
                aria-label={t('Color presets')}
                tabIndex={0}
              >
                <Radio.Group
                  className="color-presets"
                  name={`${id}-preset`}
                  aria-label={t('Color presets')}
                  value={selection.presetId}
                  onChange={event =>
                    update(applyColorPreset(selection, String(event.target.value)))
                  }
                >
                  {COLOR_PRESETS.map(preset => (
                    <Radio
                      key={preset.id}
                      value={preset.id}
                      className="color-preset"
                      style={css({
                        '--preset-color': preset.hex,
                        '--preset-ink': contrastInk(preset.hex),
                      })}
                    >
                      <span>
                        {preset.name.split('-').map((part, index) => (
                          <span key={index}>
                            {index > 0 && (
                              <>
                                -<wbr />
                              </>
                            )}
                            {part}
                          </span>
                        ))}
                      </span>
                    </Radio>
                  ))}
                </Radio.Group>
              </div>
            </div>
          </div>
          <div
            className="color-group"
            role="group"
            aria-labelledby={`${id}-whiteness-group`}
            aria-describedby={`${id}-whiteness-group-help`}
            data-color-group="whiteness"
          >
            <h3 id={`${id}-whiteness-group`}>{t('Whiteness')}</h3>
            <p id={`${id}-whiteness-group-help`} className="color-group-help">
              {t('A setting you change: how much white is mixed into the hue.')}
            </p>
            <ColorChannel
              id={`${id}-white`}
              label={t('Whiteness · percent')}
              value={selection.w}
              max={100}
              step={0.1}
              colors={channelSpectrum('w')}
              onChange={value => update(setColorChannel(selection, 'w', value))}
            />
          </div>
          <div
            className="color-group"
            role="group"
            aria-labelledby={`${id}-blackness-group`}
            aria-describedby={`${id}-blackness-group-help`}
            data-color-group="blackness"
          >
            <h3 id={`${id}-blackness-group`}>{t('Blackness')}</h3>
            <p id={`${id}-blackness-group-help`} className="color-group-help">
              {t('A setting you change: how much black is mixed into the hue.')}
            </p>
            <ColorChannel
              id={`${id}-black`}
              label={t('Blackness · percent')}
              value={selection.b}
              max={100}
              step={0.1}
              colors={channelSpectrum('b')}
              onChange={value => update(setColorChannel(selection, 'b', value))}
            />
          </div>
          <div
            className="color-group color-composition"
            role="group"
            aria-labelledby={`${id}-composition-group`}
            aria-describedby={`${id}-composition-group-help`}
            data-color-group="composition"
          >
            <h3 id={`${id}-composition-group`}>{t('Effective composition')}</h3>
            <p id={`${id}-composition-group-help`} className="color-group-help">
              {t(
                'A calculated result: the shares that actually reach the color. It cannot be edited here.',
              )}
            </p>
            <div className="color-composition-visual" aria-hidden="true">
              {compositionBoundaries.map(boundary => (
                <span
                  key={boundary.id}
                  className="color-composition-marker atlas-motion-layer"
                  data-boundary={boundary.id}
                  data-position={boundary.position}
                  data-visible={boundary.visible}
                  data-edge={
                    boundary.position === 0
                      ? 'start'
                      : boundary.position === 100
                        ? 'end'
                        : 'interior'
                  }
                  style={css({ '--composition-position': `${boundary.position}%` })}
                >
                  <svg
                    viewBox="0 0 12 8"
                    width="12"
                    height="8"
                    fill="currentColor"
                    focusable="false"
                  >
                    <path d="M1 1h10L6 7Z" />
                  </svg>
                </span>
              ))}
              <div className="color-composition-strip">
                <span
                  className="atlas-motion-layer"
                  style={css({
                    '--composition-share': `${converted.pureShare}%`,
                    '--composition-color': hwbToHex(converted.h, 0, 0),
                  })}
                />
                <span
                  className="atlas-motion-layer"
                  style={css({
                    '--composition-share': `${converted.effectiveW}%`,
                    '--composition-color': '#FFFFFF',
                  })}
                />
                <span
                  className="atlas-motion-layer"
                  style={css({
                    '--composition-share': `${converted.effectiveB}%`,
                    '--composition-color': '#000000',
                  })}
                />
              </div>
            </div>
            <p>
              {t('Pure hue {pure}% · white {white}% · black {black}%.', {
                pure: converted.pureShare.toFixed(1),
                white: converted.effectiveW.toFixed(1),
                black: converted.effectiveB.toFixed(1),
              })}
            </p>
            {converted.achromatic && (
              <p className="color-state-note">
                {t(
                  converted.normalized
                    ? 'Whiteness and blackness exceed 100% together. Effective shares are normalized; your inputs are retained. Hue has no effect on this gray.'
                    : 'Whiteness and blackness total 100%. No pure hue remains; changing hue does not change this gray.',
                )}
              </p>
            )}
            {source.origin && (
              <p className="color-caption">
                {t(
                  source.modified
                    ? 'Source preset: {name}, customized.'
                    : 'Source preset: {name}, exact match.',
                  { name: source.origin.name },
                )}
              </p>
            )}
          </div>
        </section>
        <div className="color-results">
          <section className="color-conversion" aria-labelledby={`${id}-conversion`}>
            <h3 id={`${id}-conversion`}>{t('One selected color, one Ant Design seed')}</h3>
            <div
              className="color-seed-surface"
              style={css({
                '--seed-color': converted.rawHex,
                '--seed-ink': contrastInk(converted.rawHex),
              })}
            >
              <code>{converted.rawHex}</code>
              <span>{converted.hwb}</span>
            </div>
            <dl className="color-conversion-values">
              <div>
                <dt>{t('Selected HEX')}</dt>
                <dd>
                  <code data-color-hex="">{converted.rawHex}</code>
                </dd>
              </div>
              <div>
                <dt>{t('Ant Design seed')}</dt>
                <dd>
                  <code data-color-seed="">{converted.seedHex}</code>
                </dd>
              </div>
              <div>
                <dt>{t('Actual theme primary')}</dt>
                <dd>
                  <code data-color-primary="">{actualRoles.colorPrimary}</code>
                </dd>
              </div>
            </dl>
            <p className="color-caption">
              {t(
                'The selected HEX is sent directly to Ant Design. No palette mapping or 216-color quantization is applied.',
              )}
            </p>
          </section>
          <section className="color-palette" aria-labelledby={`${id}-palette`}>
            <div className="color-section-heading">
              <h3 id={`${id}-palette`}>{t('Ant Design color palette')}</h3>
              <Segmented
                className="atlas-segmented"
                name={`${id}-theme`}
                aria-label={t('Preview theme')}
                tabIndex={-1}
                value={selection.mode}
                options={[
                  { value: 'light', label: t('Light') },
                  { value: 'dark', label: t('Dark') },
                ]}
                onChange={value =>
                  update(setPreviewTheme(selection, value as ColorSelection['mode']))
                }
              />
            </div>
            <p className="color-caption">
              {t('Ten official generated tones. Dark palette background: #141414.')}
            </p>
            <ol className="color-palette-grid">
              {palette.map((color, index) => (
                <li
                  key={index}
                  style={css({ '--swatch-color': color, '--swatch-ink': contrastInk(color) })}
                >
                  <span>{index + 1}</span>
                  <code>{color.toUpperCase()}</code>
                </li>
              ))}
            </ol>
          </section>
          <div
            className="color-seed-preview"
            data-preview-theme={selection.mode}
            style={previewStyle}
          >
            <ConfigProvider theme={nestedTheme} getPopupContainer={getColorPopupContainer}>
              <SeedPreview selection={selection} />
            </ConfigProvider>
          </div>
        </div>
      </div>
      <div
        className="color-seed-preview color-family-preview-surface"
        data-preview-theme={selection.mode}
        style={previewStyle}
      >
        <ColorFamilyGallery selection={selection} />
      </div>
      <section className="color-export" aria-labelledby={`${id}-export`}>
        <div className="color-section-heading">
          <h2 id={`${id}-export`}>{t('Use this color system')}</h2>
          <Segmented
            className="atlas-segmented"
            name={`${id}-export-kind`}
            aria-label={t('Output format')}
            tabIndex={-1}
            value={kind}
            options={[
              { value: 'react', label: 'React' },
              { value: 'palette', label: t('Palette') },
              { value: 'json', label: 'JSON' },
              { value: 'css', label: 'CSS' },
            ]}
            onChange={value => setKind(value as ExportKind)}
          />
        </div>
        <div className="color-actions">
          <AtlasButton text={t('Copy output')} onClick={() => void copy()} />
          <AtlasButton fill="text" text={t('Download JSON')} onClick={download} />
          <AtlasButton
            fill="text"
            text={t('Import JSON')}
            onClick={() => fileRef.current?.click()}
          />
          <AtlasButton
            id={`${id}-save-selection`}
            fill="text"
            text={t('Save selection')}
            onClick={save}
          />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="color-file-input"
          aria-label={t('Import color settings')}
          tabIndex={-1}
          onChange={event => {
            void importFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <p className="color-caption">
          {t(
            'JSON schemas 1–4 are accepted, up to 1 MiB. Only validated settings are applied; derived colors are recalculated.',
          )}
        </p>
        {storageProblem && (
          <p className="color-state-note" role="status">
            {t(
              'Local storage is unavailable or contains invalid settings. Work continues in this session; export JSON for a portable copy.',
            )}
          </p>
        )}
        <p className="color-feedback" role={notice?.error ? 'alert' : 'status'}>
          {notice ? t(notice.message) : ''}
        </p>
        <pre className="color-code" tabIndex={0} aria-label={t('Copyable color system output')}>
          <code>{output}</code>
        </pre>
      </section>
      <section className="color-saved" aria-labelledby={`${id}-saved`}>
        <h2 id={`${id}-saved`}>{t('Saved color selections')}</h2>
        <p className="color-caption">
          {t(
            'Selections are stored in this browser origin. JSON is the portable backup; other browsers or file locations may use different storage.',
          )}
        </p>
        {saved.length ? (
          <ul className="color-saved-list" ref={savedListRef}>
            {saved.map((item, index) => {
              const convertedItem = convertColorSelection(item);
              return (
                <li key={index}>
                  <span
                    className="color-saved-swatch"
                    aria-hidden="true"
                    style={css({ '--swatch-color': convertedItem.seedHex })}
                  />
                  <code>{convertedItem.seedHex}</code>
                  <span>{convertedItem.hwb}</span>
                  <AtlasButton
                    data-saved-load=""
                    fill="text"
                    text={t('Load selection {number}', { number: index + 1 })}
                    onClick={() => {
                      update(item);
                      setNotice({ message: 'Saved selection loaded.' });
                    }}
                  />
                  <AtlasButton
                    fill="text"
                    text={t('Remove selection {number}', { number: index + 1 })}
                    onClick={() => removeSelection(index)}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <p>{t('No saved selections yet.')}</p>
        )}
      </section>
    </div>
  );
}

export default function ColorSystemDemo({
  documentation = false,
}: { documentation?: boolean } = {}) {
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined}>
      <ColorSystemWorkbench />
    </AtlasProvider>
  );
}
