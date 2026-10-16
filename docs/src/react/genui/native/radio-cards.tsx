import { useCallback, useId, type CSSProperties } from 'react';
import { Radio } from 'antd';
import AtlasIcon from '../../AtlasIcon';
import { atlasLength, useAtlasAppearance } from '../../AtlasAppearance';
import { atlasSizeProfiles, useAtlasSize } from '../../AtlasSizeProfile';
import { selectionSizeProfiles } from '../../../data/selection-sizes';
import { useI18n } from '../../useI18n';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import {
  readRadioCards,
  type RadioCardLayout,
  type RadioCardOption,
} from '../../../genui/native/radio-cards';

/** Structural subset of the AntD Radio ref. */
type NativeChoiceHandle = {
  input?: HTMLInputElement | null;
  nativeElement?: HTMLElement | null;
} | null;

const describedLayouts: readonly RadioCardLayout[] = ['vertical', 'icon-cards', 'image-cards'];
const choiceIds = (groupId: string, id: string) => ({
  title: `${groupId}-${id}-title`,
  description: `${groupId}-${id}-description`,
});
const choiceClassName = (layout: RadioCardLayout) =>
  layout === 'horizontal'
    ? 'atlas-selection-choice'
    : 'atlas-selection-choice atlas-selection-card';

/** AntD keeps its wrapper label closed to props; tag that native label after commit. */
function useChoiceRoot(id: string) {
  return useCallback(
    (handle: NativeChoiceHandle) => {
      const root = (handle?.input ?? handle?.nativeElement)?.closest('label');
      root?.setAttribute('data-choice', id);
      root?.setAttribute('data-atlas-choice-card', 'true');
    },
    [id],
  );
}

/** Non-interactive card content; the native radio owns name, state and focus. */
function RadioCard({
  option,
  layout,
  groupId,
  checked,
  disabled,
  badge,
  onSelect,
}: {
  option: RadioCardOption;
  layout: RadioCardLayout;
  groupId: string;
  checked: boolean;
  disabled: boolean;
  badge: string;
  onSelect: (id: string) => void;
}) {
  const rootRef = useChoiceRoot(option.id);
  const ids = choiceIds(groupId, option.id);
  return (
    <Radio
      ref={rootRef}
      className={choiceClassName(layout)}
      name={groupId}
      value={option.id}
      checked={checked}
      disabled={disabled || option.disabled === true}
      aria-labelledby={ids.title}
      aria-describedby={option.description ? ids.description : undefined}
      onChange={event => {
        // Controlled: report the member only; the parent decides whether to accept it.
        if (event.target.checked) onSelect(option.id);
      }}
    >
      <span className="atlas-selection-choice-body">
        {layout === 'icon-cards' && option.icon && (
          <span className="atlas-selection-choice-icon" aria-hidden="true">
            <AtlasIcon name={option.icon} />
          </span>
        )}
        {layout === 'image-cards' && option.image && (
          <img
            className="atlas-selection-choice-media"
            src={option.image}
            width={320}
            height={180}
            alt=""
            loading="lazy"
            decoding="async"
          />
        )}
        <span id={ids.title} className="atlas-selection-choice-title">
          {option.label}
        </span>
        {option.description && (
          <span
            id={ids.description}
            className={
              describedLayouts.includes(layout)
                ? 'atlas-selection-choice-description'
                : 'atlas-selection-hidden-text'
            }
          >
            {option.description}
          </span>
        )}
        {layout !== 'horizontal' && (
          <span className="atlas-selection-choice-badge" aria-hidden="true">
            {badge}
          </span>
        )}
      </span>
    </Radio>
  );
}

export default function AtlasRadioCardsNative({ data, disabled, onChange }: NativeAdapterProps) {
  const { t } = useI18n();
  const groupId = useId();
  const size = useAtlasSize();
  const appearance = useAtlasAppearance();
  const cards = readRadioCards(data);
  const target = atlasSizeProfiles.find(profile => profile.value === size) ?? atlasSizeProfiles[1]!;
  const marker =
    selectionSizeProfiles.find(profile => profile.value === size) ?? selectionSizeProfiles[1];
  const style = {
    '--atlas-selection-variant-target': atlasLength(target.height_px, appearance),
    '--atlas-selection-variant-marker': `var(--atlas-selection-height-${size}, ${atlasLength(marker.height_px, appearance)})`,
    '--atlas-selection-variant-radius': `var(--radius-${size}, var(--radius-md))`,
  } as CSSProperties;
  const badge = t('Selected');
  return (
    <div className="atlas-selection-variants" data-selection-variants="radio" style={style}>
      <section className="atlas-selection-variant" data-selection-variant={cards.layout}>
        <fieldset disabled={disabled || cards.disabled === true}>
          <legend>{cards.label}</legend>
          <div className="atlas-selection-options">
            {cards.options.map(option => (
              <RadioCard
                key={option.id}
                option={option}
                layout={cards.layout}
                groupId={groupId}
                checked={cards.value === option.id}
                disabled={disabled || cards.disabled === true}
                badge={badge}
                onSelect={onChange}
              />
            ))}
          </div>
        </fieldset>
      </section>
    </div>
  );
}
