import { useCallback, useId, type CSSProperties } from 'react';
import { Checkbox } from 'antd';
import AtlasIcon from '../../AtlasIcon';
import { atlasLength, useAtlasAppearance } from '../../AtlasAppearance';
import { atlasSizeProfiles, useAtlasSize } from '../../AtlasSizeProfile';
import { selectionSizeProfiles } from '../../../data/selection-sizes';
import {
  readCheckboxCards,
  type CheckboxCardOption,
  type CheckboxCardVariant,
} from '../../../genui/native/checkbox-cards';
import type { NativeAdapterProps } from '../../../genui/native-contract';

/** Structural subset of the AntD Checkbox ref. */
type NativeChoiceHandle = {
  input?: HTMLInputElement | null;
  nativeElement?: HTMLElement | null;
} | null;

const describedVariants: readonly CheckboxCardVariant[] = ['vertical', 'icon-cards', 'image-cards'];
const publicBase = (() => {
  const base = import.meta.env?.BASE_URL ?? '/';
  return base.endsWith('/') ? base : `${base}/`;
})();

/** AntD keeps its wrapper label closed to props; tag that native label after commit. */
function useChoiceRoot(value: string) {
  return useCallback(
    (handle: NativeChoiceHandle) => {
      const root = (handle?.input ?? handle?.nativeElement)?.closest('label');
      root?.setAttribute('data-choice', value);
      root?.setAttribute('data-atlas-choice-card', 'true');
    },
    [value],
  );
}

/** Non-interactive card content; the native checkbox owns name, state and focus. */
function CardChoice({
  option,
  variant,
  groupId,
  checked,
  disabled,
  onToggle,
}: {
  option: CheckboxCardOption;
  variant: CheckboxCardVariant;
  groupId: string;
  checked: boolean;
  disabled: boolean;
  onToggle: (value: string, checked: boolean) => void;
}) {
  const rootRef = useChoiceRoot(option.value);
  const titleId = `${groupId}-${option.value}-title`;
  const descriptionId = `${groupId}-${option.value}-description`;
  const media = option.image ?? (option.scene && `${publicBase}selection/${option.scene}.svg`);
  return (
    <Checkbox
      ref={rootRef}
      className={
        variant === 'horizontal'
          ? 'atlas-selection-choice'
          : 'atlas-selection-choice atlas-selection-card'
      }
      checked={checked}
      disabled={disabled}
      aria-labelledby={titleId}
      aria-describedby={option.description ? descriptionId : undefined}
      onChange={event => onToggle(option.value, event.target.checked)}
    >
      <span className="atlas-selection-choice-body">
        {variant === 'icon-cards' && option.icon && (
          <span className="atlas-selection-choice-icon" aria-hidden="true">
            <AtlasIcon name={option.icon} />
          </span>
        )}
        {variant === 'image-cards' && media && (
          <img
            className="atlas-selection-choice-media"
            src={media}
            width={320}
            height={180}
            alt=""
            loading="lazy"
            decoding="async"
          />
        )}
        <span id={titleId} className="atlas-selection-choice-title">
          {option.label}
        </span>
        {option.description && (
          <span
            id={descriptionId}
            className={
              describedVariants.includes(variant)
                ? 'atlas-selection-choice-description'
                : 'atlas-selection-hidden-text'
            }
          >
            {option.description}
          </span>
        )}
      </span>
    </Checkbox>
  );
}

/** Controlled: every toggle proposes the next member array; the parent may reject it. */
export default function AtlasCheckboxCardsNative({ data, disabled, onChange }: NativeAdapterProps) {
  const cards = readCheckboxCards(data);
  const groupId = useId();
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
  const toggle = (value: string, checked: boolean) => {
    const others = cards.value.filter(item => item !== value);
    onChange(checked ? [...others, value] : others);
  };
  return (
    <div className="atlas-selection-variants" data-selection-variants="checkbox" style={style}>
      <fieldset className="atlas-selection-variant">
        <legend>{cards.label}</legend>
        <div className="atlas-selection-variant-scope" data-selection-variant={cards.variant}>
          <div className="atlas-selection-options">
            {cards.options.map(option => (
              <CardChoice
                key={option.value}
                option={option}
                variant={cards.variant}
                groupId={groupId}
                checked={cards.value.includes(option.value)}
                disabled={disabled || cards.readOnly || option.disabled === true}
                onToggle={toggle}
              />
            ))}
          </div>
        </div>
      </fieldset>
    </div>
  );
}
