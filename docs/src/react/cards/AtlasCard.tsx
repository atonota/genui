import { createContext, useContext, useId, type CSSProperties, type ReactNode } from 'react';
import { Card } from 'antd';
import type { CardDataState } from '../../data/card-model';
import { useAtlasSize } from '../AtlasSizeProfile';
import { useAtlasAppearance } from '../AtlasAppearance';
import atlas from '../../data/atlas.json';
import { useI18n } from '../useI18n';

const CardParent = createContext(false);

/** Shared corner choices; absent means the general radius role. */
export type CardRadius = '0' | '3' | '5' | 'pill';

export interface CardAppearanceProps {
  radius?: CardRadius;
  outlined?: boolean;
  headingLevel?: 3 | 4 | 5;
}

export interface AtlasCardProps extends CardAppearanceProps {
  title: string;
  eyebrow?: string;
  description?: string;
  header?: ReactNode;
  media?: ReactNode;
  body?: ReactNode;
  footer?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  state?: CardDataState;
  stateMessage?: string;
  selected?: boolean;
  className?: string;
  modelId?: string;
  purpose?: string;
  layout?: 'vertical' | 'horizontal' | 'auto';
  density?: 'compact' | 'comfortable';
}

/** Trusted presentation slots. Untrusted models are normalized before reaching this component. */
export function AtlasCard({
  title,
  eyebrow,
  description,
  header,
  media,
  body,
  footer,
  actions,
  children,
  state = 'ready',
  stateMessage,
  selected = false,
  className,
  modelId,
  purpose,
  layout = 'vertical',
  density = 'comfortable',
  radius,
  outlined = false,
  headingLevel = 4,
}: AtlasCardProps) {
  const nested = useContext(CardParent);
  const size = useAtlasSize();
  const appearance = useAtlasAppearance();
  const titleId = useId();
  const stateId = useId();
  const { t } = useI18n();
  if (nested)
    return (
      <span role="alert" data-card-nested-rejected>
        {t('Cards cannot contain other Cards.')}
      </span>
    );
  const Heading = `h${headingLevel}` as 'h3' | 'h4' | 'h5';
  const messages: Record<Exclude<CardDataState, 'ready'>, string> = {
    loading: 'Loading this card.',
    empty: 'No information is available yet.',
    partial: 'Some information is unavailable.',
    error: 'This information could not be loaded.',
    disabled: 'This card is unavailable.',
  };
  const status = stateMessage ?? (state === 'ready' ? undefined : messages[state]);
  // Explicit corners keep their value; documentation defaults read the general radius role.
  const corner =
    radius === undefined
      ? undefined
      : atlas.decisions.buttons.radius_variants.find(item => item.value === radius);
  const style = corner
    ? ({ '--card-radius': corner.css } as CSSProperties)
    : appearance === 'docs'
      ? ({ '--card-radius': 'var(--radius)' } as CSSProperties)
      : undefined;
  return (
    <CardParent.Provider value>
      <Card
        className={['atlas-card', 'atlas-card-native', className].filter(Boolean).join(' ')}
        role="article"
        aria-labelledby={titleId}
        aria-describedby={status ? stateId : undefined}
        aria-busy={state === 'loading'}
        aria-disabled={state === 'disabled' || undefined}
        variant={outlined ? 'outlined' : 'borderless'}
        size={size === 'sm' ? 'small' : 'medium'}
        style={style}
        data-atlas-card
        data-card-id={modelId}
        data-card-kind={purpose}
        data-card-state={state}
        data-card-profile={size}
        data-card-selected={selected}
        data-card-layout={layout}
        data-card-density={density}
      >
        <header className="atlas-card-heading">
          <div className="atlas-card-name">
            {eyebrow && <p className="atlas-card-eyebrow">{eyebrow}</p>}
            <Heading id={titleId}>{title}</Heading>
          </div>
          {header && <div className="atlas-card-header-slot">{header}</div>}
        </header>
        {media && <div className="atlas-card-media-slot">{media}</div>}
        <div className="atlas-card-content">
          {description && <p className="atlas-card-description">{description}</p>}
          {status && (
            <p
              id={stateId}
              className="atlas-card-state"
              role={state === 'error' ? 'alert' : 'status'}
            >
              {status}
            </p>
          )}
          <div className="atlas-card-skeleton" hidden={state !== 'loading'} aria-hidden="true">
            <span />
            <span />
          </div>
          {body}
          {children}
        </div>
        {(footer || actions) && (
          <footer className="atlas-card-footer">
            {footer}
            {actions && <div className="atlas-card-actions">{actions}</div>}
          </footer>
        )}
      </Card>
    </CardParent.Provider>
  );
}
