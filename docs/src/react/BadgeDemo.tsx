import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { InputNumber, Select, Switch } from 'antd';
import GenUXProvider from './GenUXProvider';
import GenUXBadge from './GenUXBadge';
import GenUXButton from './GenUXButton';
import GenUXAvatar from './GenUXAvatar';
import GenUXIcon from './GenUXIcon';
import ExamplePreview from './ExamplePreview';
import Segmented from './GenUXSegmented';
import { TweakerSettings } from './GenUXTweaker';
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

/** A named example group; each call site wraps its row in its own literal ExamplePreview. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className="genux-badge-demo-group" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      {children}
    </section>
  );
}

/** One row of example cases; layout comes from the shared GenUXBadge stylesheet. */
function Row({ children }: { children: ReactNode }) {
  return <div className="genux-badge-demo-row">{children}</div>;
}

/** Stable browser-test hook around one example case. */
function Case({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div className="genux-badge-demo-case" data-badge-case={id}>
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
    <div className="genux-badge-demo" data-demo="badge">
      <TweakerSettings title="Badge playground">
        <div className="genux-badge-settings">
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
        <ExamplePreview id="badge-playground" title={t('Badge playground')}>
          <Row>
            <Case id="playground">
              <GenUXBadge
                kind="label"
                size={size}
                variant={variant}
                tone={tone}
                label={t('Preview')}
              />
              <GenUXBadge
                kind="count"
                label={t('Notifications')}
                size={size}
                variant={variant}
                tone={tone}
                count={previewCount}
                showZero={showZero}
                placement={placement}
              >
                <GenUXAvatar name="Deniz Kaya" />
              </GenUXBadge>
            </Case>
          </Row>
        </ExamplePreview>
      </Group>
      <Group title={t('Badge sizes')}>
        <ExamplePreview id="badge-sizes" title={t('Badge sizes')}>
          <Row>
            {sizes.map(value => (
              <Case key={value} id={'size-' + value}>
                <GenUXBadge kind="label" size={value} tone="brand" label={t('Live')} />
                <span>{heights[value]} px</span>
              </Case>
            ))}
          </Row>
        </ExamplePreview>
      </Group>
      <Group title={t('Variants')}>
        <ExamplePreview id="badge-variants" title={t('Variants')}>
          <Row>
            {variants.map(value => (
              <Case key={value} id={'variant-' + value}>
                <GenUXBadge
                  kind="label"
                  variant={value}
                  tone="brand"
                  label={t(variantLabels[value])}
                />
              </Case>
            ))}
            <Case id="icons">
              <GenUXBadge
                kind="label"
                tone="brand"
                leading={<GenUXIcon name="check" />}
                label={t('Live')}
              />
              <GenUXBadge
                kind="label"
                variant="soft"
                tone="info"
                trailing={<GenUXIcon name="settings" />}
                label={t('Export request')}
              />
            </Case>
          </Row>
        </ExamplePreview>
      </Group>
      <Group title={t('Statuses')}>
        <ExamplePreview id="badge-statuses" title={t('Statuses')}>
          <Row>
            <Case id="status-success">
              <GenUXBadge
                kind="label"
                variant="soft"
                tone="success"
                leading={<GenUXIcon name="check" />}
                label={t('Paid')}
              />
            </Case>
            <Case id="status-warning">
              <GenUXBadge
                kind="label"
                variant="soft"
                tone="warning"
                leading={<GenUXIcon name="minus" />}
                label={t('Refunded')}
              />
            </Case>
            <Case id="status-danger">
              <GenUXBadge
                kind="label"
                variant="soft"
                tone="danger"
                leading={<GenUXIcon name="x" />}
                label={t('Failed')}
              />
            </Case>
          </Row>
        </ExamplePreview>
      </Group>
      <Group title={t('Counts and dots')}>
        <ExamplePreview id="badge-counts" title={t('Counts and dots')}>
          <Row>
            <Case id="count">
              <GenUXBadge kind="count" tone="danger" count={8} label={t('Notifications')} />
              <GenUXBadge kind="count" tone="danger" count={99} label={t('Notifications')} />
            </Case>
            <Case id="count-overflow">
              <GenUXBadge
                kind="count"
                tone="danger"
                count={41}
                overflowCount={20}
                label={t('Notifications')}
              />
            </Case>
            <Case id="count-zero">
              <GenUXBadge
                kind="count"
                tone="neutral"
                count={0}
                showZero
                label={t('Notifications')}
              />
            </Case>
            <Case id="dot">
              {sizes.map(value => (
                <GenUXBadge
                  key={value}
                  kind="dot"
                  size={value}
                  tone="success"
                  label={t('Online')}
                />
              ))}
              <span>{t('Online')}</span>
            </Case>
            <Case id="icon-only">
              <GenUXBadge kind="label" tone="info" label={t('Euro')} hideLabel leading="€" />
            </Case>
          </Row>
        </ExamplePreview>
      </Group>
      <Group title={t('Dismissible label')}>
        <ExamplePreview id="badge-dismissible" title={t('Dismissible label')}>
          <Row>
            <Case id="dismissible">
              {euroVisible ? (
                <span ref={euroHost}>
                  <GenUXBadge
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
                  <GenUXButton
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
          </Row>
        </ExamplePreview>
      </Group>
      <Group title={t('Notification counter')}>
        <ExamplePreview id="badge-notification-counter" title={t('Notification counter')}>
          <Row>
            <Case id="dynamic-count">
              <GenUXBadge
                kind="count"
                tone="danger"
                count={notifications}
                label={t('Notifications')}
              >
                <GenUXButton text={t('Inbox')} fill="outline" />
              </GenUXBadge>
            </Case>
            <GenUXButton
              text={t('Add notification')}
              fill="tint"
              onClick={() => setNotifications(value => value + 1)}
            />
            <GenUXButton
              text={t('Remove notification')}
              fill="outline"
              disabled={notifications === 0}
              onClick={() => setNotifications(value => Math.max(0, value - 1))}
            />
            <GenUXButton
              text={t('Clear notifications')}
              fill="text"
              disabled={notifications === 0}
              onClick={() => setNotifications(0)}
            />
            <p role="status" aria-live="polite">
              {t('Unread notifications')}: {notifications}
            </p>
          </Row>
        </ExamplePreview>
      </Group>
      <Group title={t('Attached badges')}>
        <ExamplePreview id="badge-attached" title={t('Attached badges')}>
          <Row>
            <Case id="attached-button">
              <GenUXBadge kind="count" tone="danger" count={3} label={t('Notifications')}>
                <GenUXButton text={t('Messages')} />
              </GenUXBadge>
            </Case>
            <Case id="attached-avatar">
              <GenUXBadge kind="count" tone="danger" count={2} label={t('Notifications')}>
                <GenUXAvatar name="Deniz Kaya" />
              </GenUXBadge>
            </Case>
            <Case id="attached-verified">
              <GenUXBadge
                kind="count"
                tone="success"
                count={<GenUXIcon name="check" />}
                label={t('Verified')}
              >
                <GenUXAvatar name="Deniz Kaya" />
              </GenUXBadge>
            </Case>
            <Case id="attached-hot">
              <GenUXBadge kind="count" tone="danger" count="HOT" label={t('Offer')}>
                <GenUXButton text={t('Offers')} />
              </GenUXBadge>
            </Case>
          </Row>
        </ExamplePreview>
      </Group>
      <Group title={t('Count positions')}>
        <ExamplePreview id="badge-count-positions" title={t('Count positions')}>
          <Row>
            {placements.map(value => (
              <Case key={value} id={'placement-' + value}>
                <GenUXBadge
                  kind="count"
                  tone="danger"
                  count={3}
                  placement={value}
                  label={t('Notifications')}
                >
                  <GenUXButton text={t(placementLabels[value])} depth="flat" fill="outline" />
                </GenUXBadge>
              </Case>
            ))}
          </Row>
        </ExamplePreview>
      </Group>
      <Group title={t('Ribbon')}>
        <ExamplePreview id="badge-ribbon" title={t('Ribbon')}>
          <Row>
            <Case id="ribbon">
              <GenUXBadge kind="ribbon" tone="brand" label={t('Live')}>
                <section className="genux-badge-demo-ribbon-host" aria-labelledby={ribbonId}>
                  <h4 id={ribbonId}>{t('Release notes')}</h4>
                  <p>{t('Ready for review in this local example.')}</p>
                </section>
              </GenUXBadge>
            </Case>
          </Row>
        </ExamplePreview>
      </Group>
    </div>
  );
}

/** Local Badge examples; the shared profile sizes inherited badges, explicit sizes stay fixed. */
export default function BadgeDemo({ documentation = false }: { documentation?: boolean }) {
  return (
    <GenUXProvider appearance={documentation ? 'docs' : undefined}>
      <BadgeExamples />
    </GenUXProvider>
  );
}
