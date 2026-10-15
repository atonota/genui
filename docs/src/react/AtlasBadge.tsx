import {
  isValidElement,
  type CSSProperties,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Badge, Tag, theme } from 'antd';
import AtlasIcon from './AtlasIcon';
import { useAtlasSize } from './AtlasSizeProfile';
import {
  badgeHeight,
  badgePaint,
  badgeSeed,
  type BadgeKind,
  type BadgePlacement,
  type BadgeRadius,
  type BadgeSize,
  type BadgeTone,
  type BadgeVariant,
} from '../data/badge-surfaces';

export type AtlasBadgeProps = {
  kind?: BadgeKind;
  variant?: BadgeVariant;
  tone?: BadgeTone;
  size?: BadgeSize;
  /** Accessible text; visible on labels and ribbons unless `hideLabel`. */
  label: string;
  hideLabel?: boolean;
  /** Numbers overflow and hide at 0 unless showZero; non-empty strings and elements show. */
  count?: number | string | ReactElement;
  overflowCount?: number;
  showZero?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Host the badge attaches to. */
  children?: ReactNode;
  placement?: BadgePlacement;
  offset?: [number | string, number | string];
  radius?: BadgeRadius;
  className?: string;
  style?: CSSProperties;
} & (
  | { onClose?: undefined; closeLabel?: never }
  | { onClose: (event: MouseEvent<HTMLElement>) => void; closeLabel: string }
);

const tabbable = `a[href], button:not([disabled]), input:not([disabled]):not([type='hidden']), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])`;
const visuallyHidden: CSSProperties = {
  position: 'absolute',
  inlineSize: 1,
  blockSize: 1,
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
};

/** The next tabbable control after a badge the caller is about to remove. */
function nextTabbable(from: Element) {
  return [...document.querySelectorAll<HTMLElement>(tabbable)].find(
    el =>
      !from.contains(el) &&
      !!(from.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) &&
      el.getClientRects().length > 0,
  );
}

/** Native Badge owns count/dot/ribbon and Tag owns labels and closing; the caller owns visibility. */
export default function AtlasBadge({
  kind = 'label',
  variant = 'soft',
  tone = 'neutral',
  size: explicitSize,
  label,
  hideLabel = false,
  count,
  overflowCount,
  showZero = false,
  leading,
  trailing,
  children,
  placement = 'top-end',
  offset,
  radius,
  className,
  style,
  onClose,
  closeLabel,
}: AtlasBadgeProps) {
  const inheritedSize = useAtlasSize();
  const size = explicitSize ?? inheritedSize;
  const { token } = theme.useToken();
  const seed = badgeSeed(tone, token);
  const paint = badgePaint(seed, variant, token.colorBgContainer);
  const attached = children !== undefined && children !== null && children !== false;
  // Mirrors native hiding: empty and zero counts stay hidden unless showZero.
  const shown =
    kind !== 'count' ||
    (typeof count === 'number'
      ? count > 0 || showZero
      : typeof count === 'string'
        ? count !== '' && (count !== '0' || showZero)
        : count !== undefined && count !== null);
  // Counts announce the full value (41) even when the face shows the overflow (20+);
  // an element count is named by its label alone.
  const spoken =
    kind === 'count' && (typeof count === 'number' || typeof count === 'string')
      ? `${label}: ${count}`
      : label;
  // Native ScrollNumber clones an element count with only its own custom-component class,
  // so classNames.indicator never lands; the span carries atlas-badge-body itself.
  const indicator = isValidElement(count) ? (
    <span className="atlas-badge-body">{count}</span>
  ) : (
    count
  );
  const named = (kind === 'count' || kind === 'dot') && shown;

  const close =
    onClose &&
    ((event: MouseEvent<HTMLElement>) => {
      // Tag never hides itself; removal is the caller's controlled state.
      event.preventDefault();
      const root = event.currentTarget.closest('.atlas-badge');
      const next = root ? nextTabbable(root) : undefined;
      onClose(event);
      requestAnimationFrame(() => {
        if (next?.isConnected && document.activeElement === document.body) next.focus();
      });
    });

  const content = hideLabel ? (
    <span role="img" aria-label={label}>
      {leading}
      {trailing}
    </span>
  ) : (
    <>
      {leading}
      {label}
      {trailing}
    </>
  );

  let body: ReactNode;
  if (kind === 'ribbon')
    body = (
      <Badge.Ribbon text={content} placement={placement.endsWith('start') ? 'start' : 'end'}>
        {children}
      </Badge.Ribbon>
    );
  else if (kind === 'label') {
    const tag = (
      <Tag
        variant={variant === 'soft' ? 'filled' : variant}
        className="atlas-badge-body"
        closable={!!close}
        closeIcon={
          close ? (
            <span className="atlas-badge-close" aria-label={closeLabel}>
              <AtlasIcon name="x" className="atlas-badge-close-icon" />
            </span>
          ) : (
            false
          )
        }
        onClose={close}
      >
        {content}
      </Tag>
    );
    body = attached ? (
      <Badge count={tag} offset={offset} title={false}>
        {children}
      </Badge>
    ) : (
      tag
    );
  } else
    body = (
      <Badge
        count={kind === 'count' ? indicator : null}
        dot={kind === 'dot'}
        overflowCount={overflowCount}
        showZero={showZero}
        offset={offset}
        title={false}
        classNames={kind === 'count' ? { indicator: 'atlas-badge-body' } : undefined}
      >
        {children}
      </Badge>
    );

  const Root = kind === 'ribbon' ? 'div' : 'span';
  return (
    <Root
      {...(named && !attached ? { role: 'img' as const, 'aria-label': spoken } : {})}
      className={['atlas-badge', className].filter(Boolean).join(' ')}
      data-kind={kind}
      data-size={size}
      data-variant={variant}
      data-tone={tone}
      data-placement={placement}
      data-attached={attached ? '' : undefined}
      style={
        {
          '--badge-height': badgeHeight(size),
          '--badge-radius': radius ?? 'var(--radius, 5px)',
          '--badge-font-size': `${Math.max(14, token.fontSize)}px`,
          '--badge-bg': paint.background,
          '--badge-ink': paint.ink,
          '--badge-border': paint.border,
          '--badge-border-width': variant === 'outlined' ? '1px' : '0px',
          '--badge-dot': variant === 'outlined' ? 'transparent' : seed,
          '--badge-corner': variant === 'outlined' ? paint.border : paint.background,
          ...style,
        } as CSSProperties
      }
    >
      {body}
      {named && attached && <span style={visuallyHidden}>{spoken}</span>}
    </Root>
  );
}
