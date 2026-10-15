import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { InputNumber, Select, Switch } from 'antd';
import AtlasProvider from './AtlasProvider';
import AtlasBadge from './AtlasBadge';
import AtlasButton from './AtlasButton';
import AtlasAvatar from './AtlasAvatar';
import AtlasIcon from './AtlasIcon';
import Segmented from './AtlasSegmented';
import { TweakerSettings } from './AtlasTweaker';
import { useI18n } from './useI18n';

const variants = ['solid', 'soft', 'outlined'] as const;
const tones = ['neutral', 'brand', 'success', 'warning', 'danger', 'info'] as const;
const placements = ['top-end', 'top-start', 'bottom-end', 'bottom-start'] as const;
const sizes = ['sm', 'md', 'lg'] as const;
type BadgeVariant = (typeof variants)[number];
type BadgeTone = (typeof tones)[number];
type BadgePlacement = (typeof placements)[number];
type PreviewSize = (typeof sizes)[number] | 'profile';

const heights = { sm: 20, md: 26, lg: 32 } as const;
const variantLabels: Record<BadgeVariant, string> = {
  solid: 'Solid',
  soft: 'Soft',
  outlined: 'Outlined',
};
const toneLabels: Record<BadgeTone, string> = {
  neutral: 'Neutral',
  brand: 'Brand',
  success: 'Success',
  warning: 'Warning',
  danger: 'Danger',
  info: 'Info',
};
const placementLabels: Record<BadgePlacement, string> = {
  'top-end': 'Top end',
  'top-start': 'Top start',
  'bottom-end': 'Bottom end',
  'bottom-start': 'Bottom start',
};

/** A named example group; layout comes from the shared AtlasBadge stylesheet. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className="atlas-badge-demo-group" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      <div className="atlas-badge-demo-row">{children}</div>
    </section>
  );
}

/** Stable browser-test hook around one example case. */
function Case({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div className="atlas-badge-demo-case" data-badge-case={id}>
      {children}
    </div>
  );
}

function BadgeExamples() {
  const { t } = useI18n();
  const settingsId = useId();
  const ribbonId = useId();
  const [previewSize, setPreviewSize] = useState<PreviewSize>('profile');
  const [variant, setVariant] = useState<BadgeVariant>('solid');
  const [tone, setTone] = useState<BadgeTone>('brand');
  const [previewCount, setPreviewCount] = useState(8);
  const [showZero, setShowZero] = useState(false);
  const [placement, setPlacement] = useState<BadgePlacement>('top-end');
  const [notifications, setNotifications] = useState(5);
  const [euroVisible, setEuroVisible] = useState(true);
  const euroHost = useRef<HTMLSpanElement>(null);
  const restoreHost = useRef<HTMLSpanElement>(null);
  const focusTarget = useRef<'remove' | 'restore' | null>(null);
  // Removing Euro moves focus to Restore badge; restoring returns it to the remove action.
  useEffect(() => {
    const host =
      focusTarget.current === 'restore'
        ? restoreHost.current
        : focusTarget.current === 'remove'
          ? euroHost.current
          : null;
    focusTarget.current = null;
    host?.querySelector<HTMLElement>('button, [role="button"]')?.focus();
  }, [euroVisible]);
  const size = previewSize === 'profile' ? undefined : previewSize;
  const ids = {
    size: settingsId + '-size',
    variant: settingsId + '-variant',
    tone: settingsId + '-tone',
    count: settingsId + '-count',
    zero: settingsId + '-zero',
    placement: settingsId + '-placement',
  };
  return (
    <div className="atlas-badge-demo" data-demo="badge">
      <TweakerSettings title="Badge playground">
        <div className="atlas-badge-settings">
          <span id={ids.size}>{t('Preview size')}</span>
          <Segmented<PreviewSize>
            aria-labelledby={ids.size}
            block
            value={previewSize}
            onChange={value => setPreviewSize(value)}
            options={[
              { value: 'profile', label: t('Profile') },
              ...sizes.map(value => ({ value, label: value.toUpperCase() })),
            ]}
          />
          <span id={ids.variant}>{t('Variant')}</span>
          <Segmented<BadgeVariant>
            aria-labelledby={ids.variant}
            block
            value={variant}
            onChange={value => setVariant(value)}
            options={variants.map(value => ({ value, label: t(variantLabels[value]) }))}
          />
          <label htmlFor={ids.tone}>{t('Tone')}</label>
          <Select<BadgeTone>
            id={ids.tone}
            value={tone}
            onChange={value => setTone(value)}
            options={tones.map(value => ({ value, label: t(toneLabels[value]) }))}
          />
          <label htmlFor={ids.count}>{t('Count')}</label>
          <InputNumber
            id={ids.count}
            min={0}
            max={999}
            precision={0}
            value={previewCount}
            onChange={value => setPreviewCount(typeof value === 'number' ? value : 0)}
          />
          <label htmlFor={ids.zero}>{t('Show zero')}</label>
          <Switch id={ids.zero} checked={showZero} onChange={setShowZero} />
          <label htmlFor={ids.placement}>{t('Count position')}</label>
          <Select<BadgePlacement>
            id={ids.placement}
            value={placement}
            onChange={value => setPlacement(value)}
            options={placements.map(value => ({ value, label: t(placementLabels[value]) }))}
          />
        </div>
      </TweakerSettings>
      <Group title={t('Badge playground')}>
        <Case id="playground">
          <AtlasBadge kind="label" size={size} variant={variant} tone={tone} label={t('Preview')} />
          <AtlasBadge
            kind="count"
            label={t('Notifications')}
            size={size}
            variant={variant}
            tone={tone}
            count={previewCount}
            showZero={showZero}
            placement={placement}
          >
            <AtlasAvatar name="Deniz Kaya" />
          </AtlasBadge>
        </Case>
      </Group>
      <Group title={t('Badge sizes')}>
        {sizes.map(value => (
          <Case key={value} id={'size-' + value}>
            <AtlasBadge kind="label" size={value} tone="brand" label={t('Live')} />
            <span>{heights[value]} px</span>
          </Case>
        ))}
      </Group>
      <Group title={t('Variants')}>
        {variants.map(value => (
          <Case key={value} id={'variant-' + value}>
            <AtlasBadge kind="label" variant={value} tone="brand" label={t(variantLabels[value])} />
          </Case>
        ))}
        <Case id="icons">
          <AtlasBadge
            kind="label"
            tone="brand"
            leading={<AtlasIcon name="check" />}
            label={t('Live')}
          />
          <AtlasBadge
            kind="label"
            variant="soft"
            tone="info"
            trailing={<AtlasIcon name="settings" />}
            label={t('Export request')}
          />
        </Case>
      </Group>
      <Group title={t('Statuses')}>
        <Case id="status-success">
          <AtlasBadge
            kind="label"
            variant="soft"
            tone="success"
            leading={<AtlasIcon name="check" />}
            label={t('Paid')}
          />
        </Case>
        <Case id="status-warning">
          <AtlasBadge
            kind="label"
            variant="soft"
            tone="warning"
            leading={<AtlasIcon name="minus" />}
            label={t('Refunded')}
          />
        </Case>
        <Case id="status-danger">
          <AtlasBadge
            kind="label"
            variant="soft"
            tone="danger"
            leading={<AtlasIcon name="x" />}
            label={t('Failed')}
          />
        </Case>
      </Group>
      <Group title={t('Counts and dots')}>
        <Case id="count">
          <AtlasBadge kind="count" tone="danger" count={8} label={t('Notifications')} />
          <AtlasBadge kind="count" tone="danger" count={99} label={t('Notifications')} />
        </Case>
        <Case id="count-overflow">
          <AtlasBadge
            kind="count"
            tone="danger"
            count={41}
            overflowCount={20}
            label={t('Notifications')}
          />
        </Case>
        <Case id="count-zero">
          <AtlasBadge kind="count" tone="neutral" count={0} showZero label={t('Notifications')} />
        </Case>
        <Case id="dot">
          {sizes.map(value => (
            <AtlasBadge key={value} kind="dot" size={value} tone="success" label={t('Online')} />
          ))}
          <span>{t('Online')}</span>
        </Case>
        <Case id="icon-only">
          <AtlasBadge kind="label" tone="info" label={t('Euro')} hideLabel leading="€" />
        </Case>
      </Group>
      <Group title={t('Dismissible label')}>
        <Case id="dismissible">
          {euroVisible ? (
            <span ref={euroHost}>
              <AtlasBadge
                kind="label"
                tone="neutral"
                label={t('Euro')}
                closeLabel={t('Remove Euro')}
                onClose={() => {
                  focusTarget.current = 'restore';
                  setEuroVisible(false);
                }}
              />
            </span>
          ) : (
            <span ref={restoreHost}>
              <AtlasButton
                text={t('Restore badge')}
                fill="outline"
                onClick={() => {
                  focusTarget.current = 'remove';
                  setEuroVisible(true);
                }}
              />
            </span>
          )}
        </Case>
      </Group>
      <Group title={t('Notification counter')}>
        <Case id="dynamic-count">
          <AtlasBadge kind="count" tone="danger" count={notifications} label={t('Notifications')}>
            <AtlasButton text={t('Inbox')} fill="outline" />
          </AtlasBadge>
        </Case>
        <AtlasButton
          text={t('Add notification')}
          fill="tint"
          onClick={() => setNotifications(value => value + 1)}
        />
        <AtlasButton
          text={t('Remove notification')}
          fill="outline"
          disabled={notifications === 0}
          onClick={() => setNotifications(value => Math.max(0, value - 1))}
        />
        <AtlasButton
          text={t('Clear notifications')}
          fill="text"
          disabled={notifications === 0}
          onClick={() => setNotifications(0)}
        />
        <p role="status" aria-live="polite">
          {t('Unread notifications')}: {notifications}
        </p>
      </Group>
      <Group title={t('Attached badges')}>
        <Case id="attached-button">
          <AtlasBadge kind="count" tone="danger" count={3} label={t('Notifications')}>
            <AtlasButton text={t('Messages')} />
          </AtlasBadge>
        </Case>
        <Case id="attached-avatar">
          <AtlasBadge kind="count" tone="danger" count={2} label={t('Notifications')}>
            <AtlasAvatar name="Deniz Kaya" />
          </AtlasBadge>
        </Case>
        <Case id="attached-verified">
          <AtlasBadge
            kind="count"
            tone="success"
            count={<AtlasIcon name="check" />}
            label={t('Verified')}
          >
            <AtlasAvatar name="Deniz Kaya" />
          </AtlasBadge>
        </Case>
        <Case id="attached-hot">
          <AtlasBadge kind="count" tone="danger" count="HOT" label={t('Offer')}>
            <AtlasButton text={t('Offers')} />
          </AtlasBadge>
        </Case>
      </Group>
      <Group title={t('Count positions')}>
        {placements.map(value => (
          <Case key={value} id={'placement-' + value}>
            <AtlasBadge
              kind="count"
              tone="danger"
              count={3}
              placement={value}
              label={t('Notifications')}
            >
              <AtlasButton text={t(placementLabels[value])} depth="flat" fill="outline" />
            </AtlasBadge>
          </Case>
        ))}
      </Group>
      <Group title={t('Ribbon')}>
        <Case id="ribbon">
          <AtlasBadge kind="ribbon" tone="brand" label={t('Live')}>
            <section className="atlas-badge-demo-ribbon-host" aria-labelledby={ribbonId}>
              <h4 id={ribbonId}>{t('Release notes')}</h4>
              <p>{t('Ready for review in this local example.')}</p>
            </section>
          </AtlasBadge>
        </Case>
      </Group>
    </div>
  );
}

/** Local Badge examples; the shared profile sizes inherited badges, explicit sizes stay fixed. */
export default function BadgeDemo({ documentation = false }: { documentation?: boolean }) {
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined}>
      <BadgeExamples />
    </AtlasProvider>
  );
}
