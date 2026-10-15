import { useCallback, useId, useRef, useState, type CSSProperties } from 'react';
import { Checkbox, Radio, Switch, type GetRef } from 'antd';
import AtlasButton from './AtlasButton';
import AtlasIcon from './AtlasIcon';
import { atlasLength, useAtlasAppearance } from './AtlasAppearance';
import { atlasSizeProfiles, useAtlasSize } from './AtlasSizeProfile';
import { selectionSizeProfiles } from '../data/selection-sizes';
import { useI18n } from './useI18n';
import '../styles/atlas-selection-variants.css';

export type SelectionKind = 'radio' | 'checkbox' | 'switch';

/** English canonical copy; every string is a useI18n key. */
export const selectionKindIntros = {
  radio:
    'Radio buttons allow exactly one choice. Selecting an option clears the previous one, and the arrow keys move the choice within a group.',
  checkbox:
    'Checkboxes allow multiple choices. Each option can be selected or cleared without changing the others.',
  switch:
    'Switches turn independent settings on or off immediately. Each switch keeps its own state.',
} as const;

export const selectionVariants = [
  {
    value: 'horizontal',
    title: 'Horizontal',
    help: 'Classic inline options that wrap onto the next line on narrow screens.',
  },
  {
    value: 'vertical',
    title: 'Vertical',
    help: 'A stacked list where each option explains what it includes.',
  },
  {
    value: 'boxes',
    title: 'Boxes',
    help: 'Compact rectangular choices with a larger click area.',
  },
  {
    value: 'icon-cards',
    title: 'Icon cards',
    help: 'Cards with an icon, a short explanation and the control at the bottom.',
  },
  {
    value: 'image-cards',
    title: 'Image cards',
    help: 'Cards with a decorative scene above the title and explanation.',
  },
] as const;

/** The last choice is always unavailable; icons and images stay decorative. */
export const selectionChoices = [
  {
    value: 'starter',
    label: 'Starter',
    description: 'One workspace for personal projects and early drafts.',
    icon: 'house',
    scene: 'forest',
  },
  {
    value: 'team',
    label: 'Team',
    description: 'Shared workspaces with roles and comments for up to 20 people.',
    icon: 'sun',
    scene: 'coast',
  },
  {
    value: 'enterprise',
    label: 'Enterprise',
    description: 'Single sign-on, audit history and dedicated support.',
    icon: 'settings',
    scene: 'city',
  },
  {
    value: 'unavailable',
    label: 'Unavailable',
    description: 'Not offered for this account; shown disabled for comparison.',
    icon: 'lock-simple',
    scene: 'forest',
  },
] as const;

/** Complete key list for the shared dictionary. */
export const selectionVariantMessages: readonly string[] = [
  ...Object.values(selectionKindIntros),
  ...selectionVariants.flatMap(variant => [variant.title, variant.help]),
  ...selectionChoices.flatMap(choice => [choice.label, choice.description]),
];

/** Summary, bulk and badge copy; translations live in locales/<lang>/ux-selection.json. */
export const selectionUxCopy = {
  demoNote:
    'These are demonstration choices. Selecting them does not buy, change or cancel a subscription.',
  selectAvailable: 'Select available options',
  clearSelection: 'Clear selection',
  checkedCount: '{count} of {total} selected',
  radioSelected: 'Selected: {label}',
  switchesOn: 'On: {labels}',
  switchesOff: 'All settings are off',
  selectedBadge: 'Selected',
  onBadge: 'On',
  preview: 'Preview',
  previewEmpty: 'No example features are on.',
} as const;

export const selectionUxMessages: readonly string[] = Object.values(selectionUxCopy);

type SelectionVariant = (typeof selectionVariants)[number];
type SelectionLayout = SelectionVariant['value'];
type SelectionChoice = (typeof selectionChoices)[number];
type ChoiceValue = SelectionChoice['value'];
type ChoiceProps = {
  choice: SelectionChoice;
  layout: SelectionLayout;
  groupId: string;
  checked: boolean;
  badge: string;
};
type ToggleChoice = (value: ChoiceValue, checked: boolean) => void;
/** Structural subset of the AntD Radio/Checkbox ref. */
type NativeChoiceHandle = {
  input?: HTMLInputElement | null;
  nativeElement?: HTMLElement | null;
} | null;

const initialChoice: ChoiceValue = 'starter';
const describedLayouts: readonly SelectionLayout[] = ['vertical', 'icon-cards', 'image-cards'];
const availableChoices: readonly SelectionChoice[] = selectionChoices.filter(
  choice => choice.value !== 'unavailable',
);
const availableValues: readonly ChoiceValue[] = availableChoices.map(choice => choice.value);
const publicBase = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

const choiceIds = (groupId: string, value: ChoiceValue) => ({
  title: `${groupId}-${value}-title`,
  description: `${groupId}-${value}-description`,
  control: `${groupId}-${value}-control`,
});
const choiceClassName = (layout: SelectionLayout) =>
  layout === 'horizontal'
    ? 'atlas-selection-choice'
    : 'atlas-selection-choice atlas-selection-card';
const fill = (template: string, values: Record<string, string>) =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.split(`{${key}}`).join(value),
    template,
  );

/** AntD keeps its wrapper label closed to props; tag that native label after commit. */
function useChoiceRoot(value: ChoiceValue) {
  return useCallback(
    (handle: NativeChoiceHandle) => {
      const root = (handle?.input ?? handle?.nativeElement)?.closest('label');
      root?.setAttribute('data-choice', value);
      root?.setAttribute('data-atlas-choice-card', 'true');
    },
    [value],
  );
}

/** Non-interactive card content; the native control owns name, state and focus.
    The badge is a visual non-color cue only; the control name stays the title. */
function ChoiceContent({ choice, layout, groupId, badge }: Omit<ChoiceProps, 'checked'>) {
  const { t } = useI18n();
  const ids = choiceIds(groupId, choice.value);
  return (
    <span className="atlas-selection-choice-body">
      {layout === 'icon-cards' && (
        <span className="atlas-selection-choice-icon" aria-hidden="true">
          <AtlasIcon name={choice.icon} />
        </span>
      )}
      {layout === 'image-cards' && (
        <img
          className="atlas-selection-choice-media"
          src={`${publicBase}selection/${choice.scene}.svg`}
          width={320}
          height={180}
          alt=""
          loading="lazy"
          decoding="async"
        />
      )}
      <span id={ids.title} className="atlas-selection-choice-title">
        {t(choice.label)}
      </span>
      <span
        id={ids.description}
        className={
          describedLayouts.includes(layout)
            ? 'atlas-selection-choice-description'
            : 'atlas-selection-hidden-text'
        }
      >
        {t(choice.description)}
      </span>
      {layout !== 'horizontal' && (
        <span className="atlas-selection-choice-badge" aria-hidden="true">
          {badge}
        </span>
      )}
    </span>
  );
}

function RadioChoice({
  choice,
  layout,
  groupId,
  checked,
  badge,
  onSelect,
}: ChoiceProps & { onSelect: (value: ChoiceValue) => void }) {
  const rootRef = useChoiceRoot(choice.value);
  const ids = choiceIds(groupId, choice.value);
  return (
    <Radio
      ref={rootRef}
      className={choiceClassName(layout)}
      name={groupId}
      value={choice.value}
      checked={checked}
      disabled={choice.value === 'unavailable'}
      aria-labelledby={ids.title}
      aria-describedby={ids.description}
      onChange={event => {
        if (event.target.checked) onSelect(choice.value);
      }}
    >
      <ChoiceContent choice={choice} layout={layout} groupId={groupId} badge={badge} />
    </Radio>
  );
}

function CheckboxChoice({
  choice,
  layout,
  groupId,
  checked,
  badge,
  onToggle,
}: ChoiceProps & { onToggle: ToggleChoice }) {
  const rootRef = useChoiceRoot(choice.value);
  const ids = choiceIds(groupId, choice.value);
  return (
    <Checkbox
      ref={rootRef}
      className={choiceClassName(layout)}
      checked={checked}
      disabled={choice.value === 'unavailable'}
      aria-labelledby={ids.title}
      aria-describedby={ids.description}
      onChange={event => onToggle(choice.value, event.target.checked)}
    >
      <ChoiceContent choice={choice} layout={layout} groupId={groupId} badge={badge} />
    </Checkbox>
  );
}

/** A button is labelable: the label forwards card clicks to the native Switch once. */
function SwitchChoice({
  choice,
  layout,
  groupId,
  checked,
  badge,
  onToggle,
}: ChoiceProps & { onToggle: ToggleChoice }) {
  const size = useAtlasSize();
  const ids = choiceIds(groupId, choice.value);
  return (
    <label
      htmlFor={ids.control}
      className={choiceClassName(layout)}
      data-choice={choice.value}
      data-atlas-choice-card="true"
    >
      <ChoiceContent choice={choice} layout={layout} groupId={groupId} badge={badge} />
      <Switch
        id={ids.control}
        checked={checked}
        disabled={choice.value === 'unavailable'}
        data-selection-size={size}
        aria-labelledby={ids.title}
        aria-describedby={ids.description}
        onChange={next => onToggle(choice.value, next)}
      />
    </label>
  );
}

/** Native parent checkbox over the available choices plus an explicit clear action. */
function CheckboxBulk({
  enabledCount,
  onSetAll,
}: {
  enabledCount: number;
  onSetAll: (checked: boolean) => void;
}) {
  const { t } = useI18n();
  const parentRef = useRef<GetRef<typeof Checkbox>>(null);
  const allSelected = enabledCount === availableChoices.length;
  const partial = enabledCount > 0 && !allSelected;
  return (
    <div className="atlas-selection-bulk">
      <Checkbox
        ref={parentRef}
        className="atlas-selection-bulk-choice"
        checked={allSelected}
        indeterminate={partial}
        aria-checked={partial ? 'mixed' : allSelected}
        data-selection-bulk="true"
        onChange={event => onSetAll(event.target.checked)}
      >
        {t(selectionUxCopy.selectAvailable)}
      </Checkbox>
      <AtlasButton
        text={t(selectionUxCopy.clearSelection)}
        fill="outline"
        data-selection-clear="true"
        disabled={enabledCount === 0}
        onClick={() => {
          onSetAll(false);
          // The button disables itself; keep keyboard focus inside the group.
          parentRef.current?.focus();
        }}
      />
    </div>
  );
}

/** Each presentation owns its state: Radio is exclusive, Checkbox and Switch independent. */
function SelectionOptions({
  kind,
  layout,
  statusId,
}: {
  kind: SelectionKind;
  layout: SelectionLayout;
  statusId: string;
}) {
  const { t } = useI18n();
  const groupId = useId();
  const [selected, setSelected] = useState<ChoiceValue>(initialChoice);
  const [enabled, setEnabled] = useState<readonly ChoiceValue[]>([initialChoice]);
  const toggle: ToggleChoice = (value, checked) =>
    setEnabled(current => [...current.filter(item => item !== value), ...(checked ? [value] : [])]);
  const setAll = (checked: boolean) => setEnabled(checked ? availableValues : []);
  const enabledChoices = availableChoices.filter(choice => enabled.includes(choice.value));
  const badge = t(kind === 'switch' ? selectionUxCopy.onBadge : selectionUxCopy.selectedBadge);
  const selectedChoice = selectionChoices.find(choice => choice.value === selected);
  const summary =
    kind === 'radio'
      ? fill(t(selectionUxCopy.radioSelected), {
          label: selectedChoice ? t(selectedChoice.label) : '',
        })
      : kind === 'checkbox'
        ? fill(t(selectionUxCopy.checkedCount), {
            count: String(enabledChoices.length),
            total: String(availableChoices.length),
          })
        : enabledChoices.length === 0
          ? t(selectionUxCopy.switchesOff)
          : fill(t(selectionUxCopy.switchesOn), {
              labels: enabledChoices.map(choice => t(choice.label)).join(', '),
            });
  const choices = (
    <>
      <div className="atlas-selection-options">
        {selectionChoices.map(choice => {
          const shared = { choice, layout, groupId, badge };
          if (kind === 'radio') {
            return (
              <RadioChoice
                key={choice.value}
                {...shared}
                checked={selected === choice.value}
                onSelect={setSelected}
              />
            );
          }
          const Choice = kind === 'checkbox' ? CheckboxChoice : SwitchChoice;
          return (
            <Choice
              key={choice.value}
              {...shared}
              checked={enabled.includes(choice.value)}
              onToggle={toggle}
            />
          );
        })}
      </div>
      <p
        id={statusId}
        className="atlas-selection-summary"
        role="status"
        aria-live="polite"
        data-selection-summary={kind}
      >
        {summary}
      </p>
    </>
  );
  return (
    <>
      {kind === 'checkbox' && (
        <CheckboxBulk enabledCount={enabledChoices.length} onSetAll={setAll} />
      )}
      {kind === 'checkbox' ? (
        // The layout scope holds only the choices and their summary; the bulk
        // toolbar shares the fieldset but stays outside it.
        <div className="atlas-selection-variant-scope" data-selection-variant={layout}>
          {choices}
        </div>
      ) : (
        choices
      )}
      {kind === 'switch' && (
        <div className="atlas-selection-preview" data-selection-preview="true">
          <p className="atlas-selection-preview-title">{t(selectionUxCopy.preview)}</p>
          {enabledChoices.length === 0 ? (
            <p className="atlas-selection-preview-empty">{t(selectionUxCopy.previewEmpty)}</p>
          ) : (
            <ul className="atlas-selection-preview-list">
              {enabledChoices.map(choice => (
                <li key={choice.value} data-preview-choice={choice.value}>
                  <span className="atlas-selection-preview-label">{t(choice.label)}</span>{' '}
                  <span className="atlas-selection-preview-description">
                    {t(choice.description)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

function SelectionVariantGroup({
  kind,
  variant,
}: {
  kind: SelectionKind;
  variant: SelectionVariant;
}) {
  const { t } = useI18n();
  const helpId = useId();
  const statusId = useId();
  return (
    <section
      className="atlas-selection-variant"
      data-selection-variant={kind === 'checkbox' ? undefined : variant.value}
    >
      <fieldset aria-describedby={`${helpId} ${statusId}`}>
        <legend>
          <h4>{t(variant.title)}</h4>
        </legend>
        <p id={helpId} className="atlas-selection-variant-help">
          {t(variant.help)}
        </p>
        <SelectionOptions kind={kind} layout={variant.value} statusId={statusId} />
      </fieldset>
    </section>
  );
}

export default function AtlasSelectionVariants({ kind }: { kind: SelectionKind }) {
  const { t } = useI18n();
  const size = useAtlasSize();
  const appearance = useAtlasAppearance();
  const target = atlasSizeProfiles.find(profile => profile.value === size) ?? atlasSizeProfiles[1]!;
  const marker =
    selectionSizeProfiles.find(profile => profile.value === size) ?? selectionSizeProfiles[1];
  const style = {
    '--atlas-selection-variant-target': atlasLength(target.height_px, appearance),
    '--atlas-selection-variant-marker': `var(--atlas-selection-height-${size}, ${atlasLength(marker.height_px, appearance)})`,
    '--atlas-selection-variant-radius': `var(--radius-${size}, var(--radius-md))`,
  } as CSSProperties;
  return (
    <div className="atlas-selection-variants" data-selection-variants={kind} style={style}>
      <p className="atlas-selection-variants-intro">{t(selectionKindIntros[kind])}</p>
      <p className="atlas-selection-variants-note">{t(selectionUxCopy.demoNote)}</p>
      {selectionVariants.map(variant => (
        <SelectionVariantGroup key={`${kind}-${variant.value}`} kind={kind} variant={variant} />
      ))}
    </div>
  );
}
