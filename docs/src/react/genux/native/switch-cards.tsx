import { useId, type CSSProperties } from 'react';
import { Switch } from 'antd';
import GenUXIcon from '../../GenUXIcon';
import { genuxLength, useGenUXAppearance } from '../../GenUXAppearance';
import { genuxSizeProfiles, useGenUXSize } from '../../GenUXSizeProfile';
import { selectionSizeProfiles } from '../../../data/selection-sizes';
import { useI18n } from '../../useI18n';
import type { NativeAdapterProps } from '../../../genux/native-contract';
import {
  parseSwitchCards,
  type SwitchCardLayout,
  type SwitchCardOption,
} from '../../../genux/native/switch-cards';

const describedLayouts: readonly SwitchCardLayout[] = ['vertical', 'icon-cards', 'image-cards'];
// Node test bundles have no Vite env; fall back to the site root.
const baseUrl = import.meta.env?.BASE_URL ?? '/';
const publicBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

/** Same markup as the selection-variant SwitchChoice: the label forwards card clicks once. */
function SwitchCard({
  option,
  layout,
  groupId,
  checked,
  disabled,
  badge,
  onToggle,
}: {
  option: SwitchCardOption;
  layout: SwitchCardLayout;
  groupId: string;
  checked: boolean;
  disabled: boolean;
  badge: string;
  onToggle: (id: string, checked: boolean) => void;
}) {
  const size = useGenUXSize();
  const ids = {
    title: `${groupId}-${option.id}-title`,
    description: `${groupId}-${option.id}-description`,
    control: `${groupId}-${option.id}-control`,
  };
  return (
    <label
      htmlFor={ids.control}
      className={
        layout === 'horizontal'
          ? 'genux-selection-choice'
          : 'genux-selection-choice genux-selection-card'
      }
      data-choice={option.id}
      data-genux-choice-card="true"
    >
      <span className="genux-selection-choice-body">
        {layout === 'icon-cards' && option.icon && (
          <span className="genux-selection-choice-icon" aria-hidden="true">
            <GenUXIcon name={option.icon} />
          </span>
        )}
        {layout === 'image-cards' && option.media && (
          <img
            className="genux-selection-choice-media"
            src={`${publicBase}selection/${option.media}.svg`}
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
      <Switch
        id={ids.control}
        checked={checked}
        disabled={disabled || option.disabled === true}
        data-selection-size={size}
        aria-labelledby={ids.title}
        aria-describedby={option.description ? ids.description : undefined}
        onChange={next => onToggle(option.id, next)}
      />
    </label>
  );
}

/** Controlled: each toggle proposes the next selected-ID array; the parent may reject it. */
export default function GenUXSwitchCardsAdapter({ data, disabled, onChange }: NativeAdapterProps) {
  const { t } = useI18n();
  const groupId = useId();
  const helpId = useId();
  const size = useGenUXSize();
  const appearance = useGenUXAppearance();
  const cards = parseSwitchCards(data);
  const layout = cards.layout ?? 'vertical';
  const target = genuxSizeProfiles.find(profile => profile.value === size) ?? genuxSizeProfiles[1]!;
  const marker =
    selectionSizeProfiles.find(profile => profile.value === size) ?? selectionSizeProfiles[1];
  const style = {
    '--genux-selection-variant-target': genuxLength(target.height_px, appearance),
    '--genux-selection-variant-marker': `var(--genux-selection-height-${size}, ${genuxLength(marker.height_px, appearance)})`,
    '--genux-selection-variant-radius': `var(--radius-${size}, var(--radius-md))`,
  } as CSSProperties;
  const toggle = (id: string, checked: boolean) => {
    const option = cards.options.find(item => item.id === id);
    if (disabled || !option || option.disabled) return;
    onChange(
      cards.options
        .filter(item => (item.id === id ? checked : cards.value.includes(item.id)))
        .map(item => item.id),
    );
  };
  return (
    <div className="genux-selection-variants" data-selection-variants="switch" style={style}>
      <section className="genux-selection-variant" data-selection-variant={layout}>
        <fieldset aria-describedby={cards.help ? helpId : undefined}>
          <legend>{cards.label}</legend>
          {cards.help && (
            <p id={helpId} className="genux-selection-variant-help">
              {cards.help}
            </p>
          )}
          <div className="genux-selection-options">
            {cards.options.map(option => (
              <SwitchCard
                key={option.id}
                option={option}
                layout={layout}
                groupId={groupId}
                checked={cards.value.includes(option.id)}
                disabled={disabled}
                badge={t('On')}
                onToggle={toggle}
              />
            ))}
          </div>
        </fieldset>
      </section>
    </div>
  );
}
