import { useId, type CSSProperties } from 'react';
import { Switch } from 'antd';
import AtlasIcon from '../../AtlasIcon';
import { atlasLength, useAtlasAppearance } from '../../AtlasAppearance';
import { atlasSizeProfiles, useAtlasSize } from '../../AtlasSizeProfile';
import { selectionSizeProfiles } from '../../../data/selection-sizes';
import { useI18n } from '../../useI18n';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import {
  parseSwitchCards,
  type SwitchCardLayout,
  type SwitchCardOption,
} from '../../../genui/native/switch-cards';

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
  const size = useAtlasSize();
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
          ? 'atlas-selection-choice'
          : 'atlas-selection-choice atlas-selection-card'
      }
      data-choice={option.id}
      data-atlas-choice-card="true"
    >
      <span className="atlas-selection-choice-body">
        {layout === 'icon-cards' && option.icon && (
          <span className="atlas-selection-choice-icon" aria-hidden="true">
            <AtlasIcon name={option.icon} />
          </span>
        )}
        {layout === 'image-cards' && option.media && (
          <img
            className="atlas-selection-choice-media"
            src={`${publicBase}selection/${option.media}.svg`}
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
export default function AtlasSwitchCardsAdapter({ data, disabled, onChange }: NativeAdapterProps) {
  const { t } = useI18n();
  const groupId = useId();
  const helpId = useId();
  const size = useAtlasSize();
  const appearance = useAtlasAppearance();
  const cards = parseSwitchCards(data);
  const layout = cards.layout ?? 'vertical';
  const target = atlasSizeProfiles.find(profile => profile.value === size) ?? atlasSizeProfiles[1]!;
  const marker =
    selectionSizeProfiles.find(profile => profile.value === size) ?? selectionSizeProfiles[1];
  const style = {
    '--atlas-selection-variant-target': atlasLength(target.height_px, appearance),
    '--atlas-selection-variant-marker': `var(--atlas-selection-height-${size}, ${atlasLength(marker.height_px, appearance)})`,
    '--atlas-selection-variant-radius': `var(--radius-${size}, var(--radius-md))`,
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
    <div className="atlas-selection-variants" data-selection-variants="switch" style={style}>
      <section className="atlas-selection-variant" data-selection-variant={layout}>
        <fieldset aria-describedby={cards.help ? helpId : undefined}>
          <legend>{cards.label}</legend>
          {cards.help && (
            <p id={helpId} className="atlas-selection-variant-help">
              {cards.help}
            </p>
          )}
          <div className="atlas-selection-options">
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
