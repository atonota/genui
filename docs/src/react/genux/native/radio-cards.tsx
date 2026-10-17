import { useCallback, useId, type CSSProperties } from 'react';
import { Radio } from 'antd';
import GenUXIcon from '../../GenUXIcon';
import { genuxLength, useGenUXAppearance } from '../../GenUXAppearance';
import { genuxSizeProfiles, useGenUXSize } from '../../GenUXSizeProfile';
import { selectionSizeProfiles } from '../../../data/selection-sizes';
import { useI18n } from '../../useI18n';
import type { NativeAdapterProps } from '../../../genux/native-contract';
import {
  readRadioCards,
  type RadioCardLayout,
  type RadioCardOption,
} from '../../../genux/native/radio-cards';

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
    ? 'genux-selection-choice'
    : 'genux-selection-choice genux-selection-card';

/** AntD keeps its wrapper label closed to props; tag that native label after commit. */
function useChoiceRoot(id: string) {
  return useCallback(
    (handle: NativeChoiceHandle) => {
      const root = (handle?.input ?? handle?.nativeElement)?.closest('label');
      root?.setAttribute('data-choice', id);
      root?.setAttribute('data-genux-choice-card', 'true');
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
      <span className="genux-selection-choice-body">
        {layout === 'icon-cards' && option.icon && (
          <span className="genux-selection-choice-icon" aria-hidden="true">
            <GenUXIcon name={option.icon} />
          </span>
        )}
        {layout === 'image-cards' && option.image && (
          <img
            className="genux-selection-choice-media"
            src={option.image}
            width={320}
            height={180}
            alt=""
            loading="lazy"
            decoding="async"
          />
        )}
        <span id={ids.title} className="genux-selection-choice-title">
          {option.label}
        </span>
        {option.description && (
          <span
            id={ids.description}
            className={
              describedLayouts.includes(layout)
                ? 'genux-selection-choice-description'
                : 'genux-selection-hidden-text'
            }
          >
            {option.description}
          </span>
        )}
        {layout !== 'horizontal' && (
          <span className="genux-selection-choice-badge" aria-hidden="true">
            {badge}
          </span>
        )}
      </span>
    </Radio>
  );
}

export default function GenUXRadioCardsNative({ data, disabled, onChange }: NativeAdapterProps) {
  const { t } = useI18n();
  const groupId = useId();
  const size = useGenUXSize();
  const appearance = useGenUXAppearance();
  const cards = readRadioCards(data);
  const target = genuxSizeProfiles.find(profile => profile.value === size) ?? genuxSizeProfiles[1]!;
  const marker =
    selectionSizeProfiles.find(profile => profile.value === size) ?? selectionSizeProfiles[1];
  const style = {
    '--genux-selection-variant-target': genuxLength(target.height_px, appearance),
    '--genux-selection-variant-marker': `var(--genux-selection-height-${size}, ${genuxLength(marker.height_px, appearance)})`,
    '--genux-selection-variant-radius': `var(--radius-${size}, var(--radius-md))`,
  } as CSSProperties;
  const badge = t('Selected');
  return (
    <div className="genux-selection-variants" data-selection-variants="radio" style={style}>
      <section className="genux-selection-variant" data-selection-variant={cards.layout}>
        <fieldset disabled={disabled || cards.disabled === true}>
          <legend>{cards.label}</legend>
          <div className="genux-selection-options">
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
