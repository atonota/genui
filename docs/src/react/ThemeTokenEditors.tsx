import { useId, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ConfigProvider, Select } from 'antd';
import AtlasInput from './AtlasInput';
import AtlasInputNumber from './AtlasInputNumber';
import AtlasButton from './AtlasButton';
import { useI18n } from './useI18n';
import { getThemeSnapshot, subscribeTheme, type ThemeMode } from '../theme';
import {
  createDefaultRecipe,
  tokenDefinitions,
  validateRecipe,
  type ThemeRecipe,
  type ThemeTokenDefinition,
  type ThemeTokenValue,
  type ThemeValues,
} from '../theme-builder/model';
import {
  applyThemeBuilder,
  getServerThemeBuilderSnapshot,
  getThemeBuilderSnapshot,
  resetThemeBuilder,
  subscribeThemeBuilder,
} from '../theme-builder/store';

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;
const SESSION_ONLY = 'Theme applied for this session; browser storage is unavailable.';
const defaultRecipe = createDefaultRecipe();
const serverMode = (): ThemeMode => 'light';
/** Matches the Theme Builder captions: overlay is registered capitalised, other groups by id. */
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

type Family = readonly [string, string, string];
/** Number definitions named <family>-sm/-md/-lg; the model keeps each family ordered. */
const families: ReadonlyMap<string, Family> = (() => {
  const steps = new Map<string, Partial<Record<'sm' | 'md' | 'lg', string>>>();
  for (const definition of tokenDefinitions) {
    const match = /^(.+)-(sm|md|lg)$/.exec(definition.id);
    if (definition.kind !== 'number' || !match) continue;
    const name = match[1]!;
    const step = match[2] as 'sm' | 'md' | 'lg';
    steps.set(name, { ...steps.get(name), [step]: definition.id });
  }
  const byId = new Map<string, Family>();
  for (const { sm, md, lg } of steps.values()) {
    if (!sm || !md || !lg) continue;
    const family: Family = [sm, md, lg];
    for (const id of family) byId.set(id, family);
  }
  return byId;
})();

/** Only the radius group, the user-approved general role, is edited in both modes; every other
 * token edits the displayed mode only and keeps the other mode's custom values. */
const sharedAcrossModes = (definition: ThemeTokenDefinition): boolean =>
  definition.group === 'radius';

function editValues(
  values: ThemeValues,
  id: string,
  value: ThemeTokenValue,
  uniform: boolean,
): ThemeValues {
  const next: ThemeValues = { ...values, [id]: value };
  const family = families.get(id);
  if (!family || typeof value !== 'number') return next;
  const index = family.indexOf(id);
  const isUniform = family.every(member => values[member] === values[family[0]]);
  family.forEach((member, position) => {
    const current = Number(values[member]);
    // A uniform family is one general role and stays uniform; otherwise neighbours move only
    // as far as the sm ≤ md ≤ lg order requires.
    if (
      (uniform && isUniform) ||
      (position < index && current > value) ||
      (position > index && current < value)
    )
      next[member] = value;
  });
  return next;
}

/** Candidate recipes for one edit, most coherent first; model validation picks the first valid. */
function editCandidates(
  recipe: ThemeRecipe,
  mode: ThemeMode,
  definition: ThemeTokenDefinition,
  value: ThemeTokenValue,
): ThemeRecipe[] {
  const modes: readonly ThemeMode[] = sharedAcrossModes(definition) ? ['light', 'dark'] : [mode];
  const edit = (uniform: boolean): ThemeRecipe => ({
    version: recipe.version,
    light: modes.includes('light')
      ? editValues(recipe.light, definition.id, value, uniform)
      : recipe.light,
    dark: modes.includes('dark')
      ? editValues(recipe.dark, definition.id, value, uniform)
      : recipe.dark,
  });
  return families.has(definition.id) ? [edit(true), edit(false)] : [edit(false)];
}

function TokenEditor({
  definition,
  id,
  value,
  onEdit,
}: {
  definition: ThemeTokenDefinition;
  id: string;
  value: ThemeTokenValue | undefined;
  onEdit: (value: ThemeTokenValue) => void;
}) {
  const { t } = useI18n();
  let control: ReactNode;
  if (definition.kind === 'number') {
    control = (
      <AtlasInputNumber
        id={id}
        data-theme-token={definition.id}
        value={typeof value === 'number' ? value : null}
        min={definition.min}
        max={definition.max}
        step={definition.step}
        suffix={definition.unit || undefined}
        onChange={next => {
          if (typeof next === 'number' && Number.isFinite(next)) onEdit(next);
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
        <AtlasInput
          id={id}
          data-theme-token={definition.id}
          aria-invalid={invalid || undefined}
          status={invalid ? 'error' : undefined}
          value={text}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          onChange={event => onEdit(event.target.value)}
        />
      </span>
    );
  } else {
    control = (
      <Select
        id={id}
        data-theme-token={definition.id}
        value={value === undefined ? undefined : String(value)}
        options={(definition.options ?? []).map(option => ({ value: option, label: t(option) }))}
        onChange={(next: string) => onEdit(next)}
      />
    );
  }
  return (
    <div className="atlas-tweaker-token">
      <label htmlFor={id}>{t(definition.label)}</label>
      {control}
    </div>
  );
}

type Draft = Readonly<{ base: ThemeRecipe; recipe: ThemeRecipe; error: string }>;

/** Every central token, editable from any Tweaker through the shared theme store. */
export default function ThemeTokenEditors() {
  const { t } = useI18n();
  const prefix = useId();
  const mode = useSyncExternalStore(subscribeTheme, getThemeSnapshot, serverMode);
  const applied = useSyncExternalStore(
    subscribeThemeBuilder,
    getThemeBuilderSnapshot,
    getServerThemeBuilderSnapshot,
  );
  const current = applied ?? defaultRecipe;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState('');
  // A draft only applies to the store value it was edited from.
  const active = draft?.base === current ? draft : null;
  const recipe = active?.recipe ?? current;
  const values = recipe[mode];

  function edit(definition: ThemeTokenDefinition, value: ThemeTokenValue) {
    const candidates = editCandidates(recipe, mode, definition, value);
    let error = '';
    for (const candidate of candidates) {
      const checked = validateRecipe(candidate);
      if (!checked.ok) {
        error = checked.error;
        continue;
      }
      // The shared store validates again, applies globally and persists in its existing key.
      const result = applyThemeBuilder(checked.recipe);
      if (result.ok) {
        setDraft(null);
        setStatus(result.persisted ? '' : SESSION_ONLY);
        return;
      }
      error = result.error;
      break;
    }
    setDraft({ base: current, recipe: candidates[candidates.length - 1] ?? recipe, error });
    setStatus('');
  }

  function reset() {
    resetThemeBuilder();
    setDraft(null);
    setStatus('Theme reset to defaults.');
  }

  return (
    <ConfigProvider
      getPopupContainer={trigger =>
        (trigger?.closest('.atlas-tweaker-panel') as HTMLElement | null) ?? document.body
      }
    >
      <section
        className="atlas-tweaker-tokens"
        data-theme-token-editors
        aria-labelledby={`${prefix}title`}
      >
        <h3 id={`${prefix}title`}>{t('Theme tokens')}</h3>
        <p className="atlas-tweaker-description">
          {mode === 'dark' ? t('Editing dark mode') : t('Editing light mode')}
        </p>
        <div className="atlas-tweaker-token-actions">
          <AtlasButton htmlType="button" onClick={reset} text={t('Reset theme')} />
        </div>
        {active?.error ? (
          <p role="alert" className="theme-builder-error">
            {t(active.error)}
          </p>
        ) : null}
        <p role="status" className="theme-builder-status">
          {status ? t(status) : null}
        </p>
        {groupedDefinitions.map(([group, definitions]) => (
          <div className="atlas-tweaker-token-group" key={group}>
            <h4>{t(groupCaption(group))}</h4>
            {definitions.map(definition => (
              <TokenEditor
                key={definition.id}
                definition={definition}
                id={`${prefix}token-${definition.id}`}
                value={values[definition.id]}
                onEdit={value => edit(definition, value)}
              />
            ))}
          </div>
        ))}
      </section>
    </ConfigProvider>
  );
}
