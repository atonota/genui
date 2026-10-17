import { selectedLabel } from './selectedLabel';
import { useI18n } from './useI18n';
import { useEffect, useId, useRef, useState } from 'react';
import { Form, Input, Select, type DrawerProps, type FormInstance } from 'antd';
import { Drawer } from './GenUXOverlay';
import { TweakerSettings } from './GenUXTweaker';
import GenUXButton from './GenUXButton';
import ExamplePreview from './ExamplePreview';

type WorkspaceId = 'genux-studio' | 'harbor-retail';
type SectionId = 'overview' | 'orders' | 'team';
type NoteValues = { note: string };
type DrawerPlacement = NonNullable<DrawerProps['placement']>;
type DrawerValues = { title: string; note?: string };
type Activity =
  | { id: string; kind: 'event'; text: string; time: string; dateTime: string }
  | { id: string; kind: 'note'; text: string };

const drawerSize = 'min(var(--genux-drawer-inline-size), 100vw)';
const drawerBlockSize = 'min(var(--genux-drawer-block-size), 80dvh)';
const drawerFocus = { trap: true, focusTriggerAfterClose: true };

const workspaces: Record<WorkspaceId, { name: string; orders: number; members: number }> = {
  'genux-studio': { name: 'GenUX Studio', orders: 12, members: 8 },
  'harbor-retail': { name: 'Harbor Retail', orders: 31, members: 14 },
};
const sections: { id: SectionId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'orders', label: 'Orders' },
  { id: 'team', label: 'Team' },
];
const lineItems = [
  { id: 'notebook', name: 'Linen notebook', quantity: 2, unit: 18 },
  { id: 'pen', name: 'Brass pen', quantity: 1, unit: 42 },
  { id: 'wrap', name: 'Gift wrap', quantity: 1, unit: 6 },
];
const initialActivity: Activity[] = [
  {
    id: 'placed',
    kind: 'event',
    text: 'Order placed',
    time: '09:12',
    dateTime: '2026-10-14T09:12',
  },
  {
    id: 'paid',
    kind: 'event',
    text: 'Payment captured',
    time: '09:14',
    dateTime: '2026-10-14T09:14',
  },
  {
    id: 'packed',
    kind: 'event',
    text: 'Packed for shipping',
    time: '11:40',
    dateTime: '2026-10-14T11:40',
  },
];

function PlacementFormExample() {
  const { t, locale } = useI18n();
  const placementId = useId();
  const formId = useId();
  const [form] = Form.useForm<DrawerValues>();
  const mountedForm = useRef<FormInstance<DrawerValues> | null>(null);
  useEffect(() => {
    // The closed Drawer mounts its Form lazily; revalidate only connected fields.
    if (!mountedForm.current) return;
    const names = form
      .getFieldsError()
      .filter(field => field.errors.length > 0)
      .map(field => field.name);
    if (names.length) void form.validateFields(names).catch(() => {});
  }, [form, locale]);
  const [placement, setPlacement] = useState<DrawerPlacement>('right');
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const placementOptions = [
    { value: 'right', label: t('Right') },
    { value: 'left', label: t('Left') },
    { value: 'top', label: t('Top') },
    { value: 'bottom', label: t('Bottom') },
  ];
  const side = placement === 'left' || placement === 'right';

  return (
    <section className="example-block" aria-labelledby="drawer-placement-title">
      <h3 className="variant-heading" id="drawer-placement-title">
        {t('Four panel placements')}
      </h3>
      <p>
        {t(
          'Closing and reopening the panel preserves the draft. Escape or the close button closes it and returns focus to the trigger.',
        )}
      </p>
      <ExamplePreview id="drawer-placements" title={t('Four panel placements')}>
        <div className="control-row">
          <TweakerSettings title="Drawer placement">
            <div className="form-layout-control">
              <label htmlFor={placementId}>{t('Placement')}</label>
              <Select<DrawerPlacement>
                id={placementId}
                value={placement}
                onChange={setPlacement}
                options={placementOptions}
                labelRender={selectedLabel(placementOptions)}
              />
            </div>
          </TweakerSettings>
          <GenUXButton text={t('Open panel')} onClick={() => setOpen(true)} />
        </div>
        <div className="form-result" role="status" aria-live="polite">
          {result === null ? null : t('Draft “{title}” validated locally.', { title: result })}
        </div>
      </ExamplePreview>
      <Drawer
        rootClassName="genux-demo genux-drawer-demo genux-drawer-placement"
        title={t('Local draft')}
        open={open}
        placement={placement}
        size={side ? drawerSize : drawerBlockSize}
        onClose={() => setOpen(false)}
        closable={{ 'aria-label': t('Close panel') }}
        keyboard
        focusable={drawerFocus}
        destroyOnHidden={false}
        footer={
          <div className="genux-drawer-actions">
            <GenUXButton fill="outline" text={t('Close')} onClick={() => setOpen(false)} />
            <GenUXButton
              fill="outline"
              text={t('Reset draft')}
              onClick={() => {
                form.resetFields();
                setResult(null);
              }}
            />
            <GenUXButton text={t('Validate locally')} htmlType="submit" form={formId} />
          </div>
        }
      >
        <p className="genux-drawer-muted">
          {t('This form is local and sends no data to a server.')}
        </p>
        <Form<DrawerValues>
          ref={mountedForm}
          className="genux-form-demo"
          id={formId}
          name="genux-drawer-local-draft"
          form={form}
          noValidate
          layout="vertical"
          initialValues={{ title: '', note: '' }}
          scrollToFirstError={{ focus: true }}
          onFinish={values => {
            setResult(values.title.trim());
            setOpen(false);
          }}
          preserve
        >
          <fieldset className="genux-form-section">
            <legend className="genux-form-section-legend">{t('Local draft')}</legend>
            <Form.Item
              label={t('Draft title')}
              name="title"
              rules={[{ required: true, whitespace: true, message: t('Enter a draft title.') }]}
            >
              <Input placeholder={t('Draft name')} />
            </Form.Item>
            <Form.Item label={t('Note')} name="note">
              <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
            </Form.Item>
          </fieldset>
        </Form>
      </Drawer>
    </section>
  );
}

function WorkspaceNavigationExample() {
  const { t, locale } = useI18n();
  const workspaceId = useId();
  const filterId = useId();
  const [open, setOpen] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceId>('genux-studio');
  const [query, setQuery] = useState('');
  const [current, setCurrent] = useState<SectionId>('overview');
  const workspaceOptions = (Object.keys(workspaces) as WorkspaceId[]).map(id => ({
    value: id,
    label: t(workspaces[id].name),
  }));
  const needle = query.trim().toLocaleLowerCase(locale);
  const visible = sections.filter(section =>
    t(section.label).toLocaleLowerCase(locale).includes(needle),
  );
  const active = workspaces[workspace];
  const currentLabel = t(sections.find(section => section.id === current)!.label);

  return (
    <section className="example-block" aria-labelledby="drawer-navigation-title">
      <h3 className="variant-heading" id="drawer-navigation-title">
        {t('Left navigation panel')}
      </h3>
      <p>{t('Switch workspaces and move between sections without leaving the current page.')}</p>
      <ExamplePreview id="drawer-workspace-navigation" title={t('Left navigation panel')}>
        <div className="control-row">
          <GenUXButton text={t('Open workspace navigation')} onClick={() => setOpen(true)} />
        </div>
      </ExamplePreview>
      <Drawer
        rootClassName="genux-demo genux-drawer-demo genux-drawer-navigation"
        title={t('Workspace navigation')}
        open={open}
        placement="left"
        size={drawerSize}
        onClose={() => setOpen(false)}
        closable={{ 'aria-label': t('Close workspace navigation') }}
        keyboard
        focusable={drawerFocus}
        destroyOnHidden={false}
        footer={
          <div className="genux-drawer-actions">
            <a className="genux-drawer-support-link" href="#drawer-guidance">
              {t('Read the drawer guidance')}
            </a>
            <GenUXButton fill="outline" text={t('Close')} onClick={() => setOpen(false)} />
          </div>
        }
      >
        <div className="genux-drawer-field">
          <label htmlFor={workspaceId}>{t('Active workspace')}</label>
          <Select<WorkspaceId>
            id={workspaceId}
            value={workspace}
            onChange={setWorkspace}
            options={workspaceOptions}
            labelRender={selectedLabel(workspaceOptions)}
          />
        </div>
        <p className="genux-drawer-muted">
          {t('{orders} open orders · {members} team members', {
            orders: String(active.orders),
            members: String(active.members),
          })}
        </p>
        <div className="genux-drawer-field">
          <label htmlFor={filterId}>{t('Filter sections')}</label>
          <Input
            id={filterId}
            type="search"
            autoComplete="off"
            allowClear
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </div>
        <p className="genux-drawer-muted" role="status" aria-live="polite">
          {visible.length === 0
            ? t('No sections match “{query}”.', { query: query.trim() })
            : t('Showing {count} of {total} sections', {
                count: String(visible.length),
                total: String(sections.length),
              })}
        </p>
        <nav className="genux-drawer-nav" aria-label={t('Workspace sections')}>
          <ul>
            {visible.map(section => (
              <li key={section.id}>
                <button
                  type="button"
                  aria-current={section.id === current ? 'page' : undefined}
                  onClick={() => setCurrent(section.id)}
                >
                  {t(section.label)}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <p>{t('Current section: {section}', { section: currentLabel })}</p>
      </Drawer>
    </section>
  );
}

function OrderDetailsExample() {
  const { t, locale } = useI18n();
  const formId = useId();
  const [form] = Form.useForm<NoteValues>();
  const mountedForm = useRef<FormInstance<NoteValues> | null>(null);
  useEffect(() => {
    // The closed Drawer mounts its Form lazily; revalidate only connected fields.
    if (!mountedForm.current) return;
    const names = form
      .getFieldsError()
      .filter(field => field.errors.length > 0)
      .map(field => field.name);
    if (names.length) void form.validateFields(names).catch(() => {});
  }, [form, locale]);
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState<Activity[]>(initialActivity);
  const [added, setAdded] = useState(0);
  const localeTag = locale === 'tr' ? 'tr-TR' : 'en-US';
  const money = new Intl.NumberFormat(localeTag, { style: 'currency', currency: 'USD' });
  const placed = new Intl.DateTimeFormat(localeTag, { dateStyle: 'long' }).format(
    new Date(2026, 9, 14),
  );
  const total = lineItems.reduce((sum, item) => sum + item.quantity * item.unit, 0);

  return (
    <section className="example-block" aria-labelledby="drawer-details-title">
      <h3 className="variant-heading" id="drawer-details-title">
        {t('Right detail panel')}
      </h3>
      <p>{t('Review an order, its activity and internal notes beside the list it came from.')}</p>
      <ExamplePreview id="drawer-order-details" title={t('Right detail panel')}>
        <div className="control-row">
          <GenUXButton text={t('Open order details')} onClick={() => setOpen(true)} />
        </div>
      </ExamplePreview>
      <Drawer
        rootClassName="genux-demo genux-drawer-demo genux-drawer-details"
        title={t('Order details')}
        extra={<span className="genux-drawer-header-meta">ORD-1042</span>}
        open={open}
        placement="right"
        size={drawerSize}
        onClose={() => setOpen(false)}
        closable={{ 'aria-label': t('Close order details') }}
        keyboard
        focusable={drawerFocus}
        destroyOnHidden={false}
        footer={
          <div className="genux-drawer-actions">
            <GenUXButton fill="outline" text={t('Close')} onClick={() => setOpen(false)} />
            <GenUXButton text={t('Add note')} htmlType="submit" form={formId} />
          </div>
        }
      >
        <section className="genux-drawer-group" aria-labelledby="drawer-order-summary">
          <h3 id="drawer-order-summary">{t('Summary')}</h3>
          <dl className="genux-drawer-facts">
            <div>
              <dt>{t('Order')}</dt>
              <dd>ORD-1042</dd>
            </div>
            <div>
              <dt>{t('Customer')}</dt>
              <dd>{t('Ada Studio')}</dd>
            </div>
            <div>
              <dt>{t('Status')}</dt>
              <dd>{t('Ready to ship')}</dd>
            </div>
            <div>
              <dt>{t('Placed')}</dt>
              <dd>{placed}</dd>
            </div>
          </dl>
        </section>
        <section className="genux-drawer-group" aria-labelledby="drawer-order-items">
          <h3 id="drawer-order-items">{t('Line items')}</h3>
          <ul className="genux-drawer-items">
            {lineItems.map(item => (
              <li key={item.id}>
                <span>{t(item.name)}</span>
                <span>
                  {t('{quantity} × {price}', {
                    quantity: String(item.quantity),
                    price: money.format(item.unit),
                  })}
                </span>
              </li>
            ))}
            <li className="genux-drawer-total">
              <span>{t('Total')}</span>
              <span>{money.format(total)}</span>
            </li>
          </ul>
        </section>
        <section className="genux-drawer-group" aria-labelledby="drawer-order-activity">
          <h3 id="drawer-order-activity">{t('Activity')}</h3>
          <ol className="genux-drawer-activity" aria-labelledby="drawer-order-activity">
            {activity.map(entry => (
              <li key={entry.id}>
                {entry.kind === 'event' ? (
                  <time dateTime={entry.dateTime}>{entry.time}</time>
                ) : (
                  <span className="genux-drawer-muted">{t('Just now')}</span>
                )}
                <span>
                  {entry.kind === 'event'
                    ? t(entry.text)
                    : t('Internal note: {note}', { note: entry.text })}
                </span>
              </li>
            ))}
          </ol>
        </section>
        <p className="genux-drawer-muted">
          {t('Notes stay in this page and are not sent to a server.')}
        </p>
        <Form<NoteValues>
          ref={mountedForm}
          className="genux-form-demo"
          id={formId}
          name="genux-drawer-order-note"
          form={form}
          noValidate
          layout="vertical"
          initialValues={{ note: '' }}
          scrollToFirstError={{ focus: true }}
          onFinish={values => {
            const note = values.note.trim();
            setActivity(entries => [
              ...entries,
              { id: `note-${entries.length}`, kind: 'note', text: note },
            ]);
            setAdded(count => count + 1);
            form.resetFields();
          }}
          preserve
        >
          <Form.Item
            label={t('Internal note')}
            name="note"
            rules={[{ required: true, whitespace: true, message: t('Enter an internal note.') }]}
          >
            <Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} />
          </Form.Item>
        </Form>
        <p className="genux-drawer-muted" role="status" aria-live="polite">
          {added === 0 ? null : t('Note {count} added to activity.', { count: String(added) })}
        </p>
      </Drawer>
    </section>
  );
}

export function DrawerExamples() {
  const { t } = useI18n();
  return (
    <div className="pattern-stack" data-demo="drawer">
      <p id="drawer-guidance">
        {t(
          'Drawers open from the left or right edge, keep their state when closed, close with Escape or the close button, and return focus to the trigger.',
        )}
      </p>
      <PlacementFormExample />
      <WorkspaceNavigationExample />
      <OrderDetailsExample />
    </div>
  );
}
