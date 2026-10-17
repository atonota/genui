import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Checkbox, Form, Select, type FormProps } from 'antd';
import Input from '../GenUXInput';
import InputNumber from '../GenUXInputNumber';
import { DateField } from './kit/Fields';
import GenUXProvider from '../GenUXProvider';
import ExamplePreview from '../ExamplePreview';
import GenUXButton from '../GenUXButton';
import GenUXSplitter from '../GenUXSplitter';
import NumberStepper from '../NumberStepper';
import { selectedLabel } from '../selectedLabel';
import { useI18n } from '../useI18n';
import { TweakerSettings } from '../GenUXTweaker';
import WorkspaceFrame, { type WorkspaceProfile } from './WorkspaceFrame';
import {
  initialRecords,
  moneyText,
  dateText,
  type Currency,
  type OrderLine,
} from '../../data/workspace';

type FormMode = 'single' | 'steps' | 'sections' | 'tabs' | 'accordion' | 'document';
type GroupName = 'customer' | 'payment' | 'content';
type FormLine = Omit<OrderLine, 'quantity' | 'unitPrice'> & {
  quantity: string | number | null;
  unitPrice: number | null;
};
type RecordFormValues = {
  customer: string;
  email: string;
  amount: number | null;
  due: string;
  note: string;
  billingMethod: 'card' | 'invoice';
  paymentTerms: string;
  currency: Currency;
  lines: FormLine[];
};
type FieldPath = (string | number)[];
const GROUPS = ['customer', 'payment', 'content'] as const;
const GROUP_LABELS = {
  customer: 'Customer details',
  payment: 'Payment and schedule',
  content: 'Notes and order lines',
} as const;

function initialDraft(): RecordFormValues {
  const record = initialRecords()[0]!;
  return {
    customer: '',
    email: '',
    amount: null,
    due: record.due ?? '',
    note: '',
    billingMethod: 'card',
    paymentTerms: '',
    currency: record.currency,
    lines: record.lines.map(line => ({ ...line, quantity: String(line.quantity) })),
  };
}
function groupForField(path: FieldPath): GroupName {
  if (path[0] === 'customer' || path[0] === 'email') return 'customer';
  if (['amount', 'due', 'billingMethod', 'paymentTerms', 'currency'].includes(String(path[0])))
    return 'payment';
  return 'content';
}
function validISODate(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function validQuantity(value: unknown): value is string | number {
  return (
    value !== '' &&
    (typeof value === 'string' || typeof value === 'number') &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0 &&
    Number.isSafeInteger(Math.round(Number(value) * 100))
  );
}
function validUnitPrice(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    Number.isSafeInteger(Math.round(value * 100))
  );
}
function lineTotalCents(quantity: unknown, unitPrice: unknown): number | null {
  if (!validQuantity(quantity) || !validUnitPrice(unitPrice)) return null;
  const cents = Math.round(Number(quantity) * Math.round(unitPrice * 100));
  return Number.isSafeInteger(cents) ? cents : null;
}
function subtotalCents(lines: readonly FormLine[]): number | null {
  let total = 0;
  for (const line of lines) {
    const cents = lineTotalCents(line.quantity, line.unitPrice);
    if (cents === null || !Number.isSafeInteger(total + cents)) return null;
    total += cents;
  }
  return total;
}

export function RecordFormsExamples() {
  const { t, locale } = useI18n();
  const [form] = Form.useForm<RecordFormValues>();
  const [profile, setProfile] = useState<WorkspaceProfile>('mobile');
  const [mode, setMode] = useState<FormMode>('steps');
  const [activeGroup, setActiveGroup] = useState<GroupName>('customer');
  const [expanded, setExpanded] = useState<readonly GroupName[]>(GROUPS);
  const [readOnly, setReadOnly] = useState(false);
  const [simulateError, setSimulateError] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState<'idle' | 'invalid' | 'simulated-error' | 'saved' | 'reset'>(
    'idle',
  );
  const [preview, setPreview] = useState<RecordFormValues | null>(null);
  const initial = useRef(initialDraft());
  const lineSequence = useRef(1);
  const root = useRef<HTMLDivElement>(null);
  const watched = Form.useWatch([], { form, preserve: true }) as RecordFormValues | undefined;
  const values = watched ?? initial.current;
  const billingMethod = values.billingMethod;
  const totalCents = subtotalCents(values.lines ?? []);
  const currency = values.currency ?? 'USD';
  useEffect(() => {
    const names = form
      .getFieldsError()
      .filter(field => field.errors.length)
      .map(field => field.name);
    if (names.length) void form.validateFields(names).catch(() => {});
  }, [form, locale]);
  useEffect(() => {
    if (form.getFieldError('lines').length) void form.validateFields(['lines']).catch(() => {});
  }, [form, watched?.lines]);

  function currentFocusedGroup(): GroupName | undefined {
    if (typeof document === 'undefined' || !root.current?.contains(document.activeElement)) return;
    return document.activeElement?.closest<HTMLElement>('[data-form-group]')?.dataset.formGroup as
      | GroupName
      | undefined;
  }
  function revealGroup(group: GroupName) {
    setActiveGroup(group);
    setExpanded(previous => (previous.includes(group) ? previous : [...previous, group]));
  }
  function changeMode(next: FormMode) {
    const focused = currentFocusedGroup();
    flushSync(() => {
      setMode(next);
      if (focused) revealGroup(focused);
      if (next === 'accordion') setExpanded(GROUPS);
    });
  }
  function changeProfile(next: WorkspaceProfile) {
    const focused = currentFocusedGroup();
    flushSync(() => {
      setProfile(next);
      setMode(next === 'mobile' ? 'steps' : 'single');
      if (focused) revealGroup(focused);
    });
  }
  function focusFirst(group: GroupName) {
    root.current
      ?.querySelector<HTMLElement>(
        `[data-form-group="${group}"] input:not([type="hidden"]), [data-form-group="${group}"] textarea`,
      )
      ?.focus();
  }
  function focusField(path: FieldPath) {
    form.focusField(path);
    // Composite NumberStepper does not expose a Form ref; its native numeric
    // input has a stable authored id, so focus that input directly.
    if (path[0] === 'lines') {
      if (path.length === 1) {
        const first = form.getFieldsValue().lines?.[0];
        const target = first
          ? document.getElementById(`record-form-line-${first.id}-quantity`)
          : document.getElementById('record-form-add-line');
        target?.focus();
        return;
      }
      const id: unknown = form.getFieldValue(['lines', Number(path[1]), 'id']);
      if (typeof id === 'string') {
        const suffix = path[2] === 'unitPrice' ? 'price' : String(path[2]);
        document.getElementById(`record-form-line-${id}-${suffix}`)?.focus();
      }
    }
  }
  function changeStep(direction: -1 | 1) {
    const next = GROUPS[GROUPS.indexOf(activeGroup) + direction];
    if (!next) return;
    flushSync(() => revealGroup(next));
    focusFirst(next);
  }
  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, group: GroupName) {
    const index = GROUPS.indexOf(group);
    let next: GroupName | undefined;
    if (event.key === 'ArrowRight') next = GROUPS[(index + 1) % GROUPS.length];
    else if (event.key === 'ArrowLeft') next = GROUPS[(index + GROUPS.length - 1) % GROUPS.length];
    else if (event.key === 'Home') next = GROUPS[0];
    else if (event.key === 'End') next = GROUPS[GROUPS.length - 1];
    if (!next) return;
    event.preventDefault();
    flushSync(() => revealGroup(next));
    document.getElementById(`record-form-tab-${next}`)?.focus();
  }
  const handleFailed: NonNullable<FormProps<RecordFormValues>['onFinishFailed']> = info => {
    const first = info.errorFields[0];
    if (!first) return;
    flushSync(() => {
      revealGroup(groupForField(first.name));
      setResult('invalid');
      setPreview(null);
    });
    focusField(first.name);
  };
  function handleFinish(next: RecordFormValues) {
    if (readOnly) return;
    if (simulateError) {
      setResult('simulated-error');
      setPreview(null);
      return;
    }
    setPreview({ ...next, lines: next.lines.map(line => ({ ...line })) });
    setResult('saved');
  }
  function resetDraft() {
    form.setFieldsValue(initialDraft());
    form.setFields(
      form.getFieldsError().map(field => ({
        name: field.name as Parameters<typeof form.setFields>[0][number]['name'],
        errors: [],
        warnings: [],
        touched: false,
      })),
    );
    setDirty(false);
    setPreview(null);
    setResult('reset');
  }
  function markChanged() {
    setDirty(true);
    setResult('idle');
    setPreview(null);
  }
  const modes = [
    { value: 'single', label: t('Single-page form') },
    { value: 'steps', label: t('Multi-step form') },
    { value: 'sections', label: t('Sectioned form') },
    { value: 'tabs', label: t('Tabbed form') },
    { value: 'accordion', label: t('Accordion form') },
    { value: 'document', label: t('Order document with lines') },
  ];
  const methodOptions = [
    { value: 'card', label: t('Card') },
    { value: 'invoice', label: t('Invoice') },
  ];
  const currencyOptions = [
    { value: 'USD', label: 'USD' },
    { value: 'EUR', label: 'EUR' },
  ];
  function section(group: GroupName, children: ReactNode) {
    const visible = !['steps', 'tabs'].includes(mode) || activeGroup === group,
      isExpanded = mode !== 'accordion' || expanded.includes(group);
    return (
      <section
        className="record-form-group"
        data-form-group={group}
        data-visible={visible}
        aria-hidden={!visible}
        inert={!visible}
        role={mode === 'tabs' ? 'tabpanel' : undefined}
        aria-labelledby={
          mode === 'tabs'
            ? `record-form-tab-${group}`
            : mode === 'accordion'
              ? `record-form-heading-${group}`
              : `record-form-legend-${group}`
        }
        id={`record-form-panel-${group}`}
      >
        <div className="record-form-group-shell">
          {mode === 'accordion' ? (
            <h4 className="record-form-heading" id={`record-form-heading-${group}`}>
              <button
                type="button"
                className="record-form-accordion-trigger genux-control"
                aria-expanded={isExpanded}
                aria-controls={`record-form-content-${group}`}
                onClick={event => {
                  if (
                    isExpanded &&
                    event.currentTarget
                      .closest('[data-form-group]')
                      ?.contains(document.activeElement)
                  )
                    event.currentTarget.focus();
                  setExpanded(previous =>
                    previous.includes(group)
                      ? previous.filter(value => value !== group)
                      : [...previous, group],
                  );
                }}
              >
                <span>{t(GROUP_LABELS[group])}</span>
                <span className="record-form-chevron genux-motion-layer" aria-hidden="true">
                  ›
                </span>
              </button>
            </h4>
          ) : null}
          <div
            className="record-form-panel"
            data-open={isExpanded}
            aria-hidden={!isExpanded}
            inert={!isExpanded}
            id={`record-form-content-${group}`}
          >
            <fieldset className="record-form-panel-content record-form-fieldset">
              <legend
                className={
                  mode === 'accordion'
                    ? 'record-form-legend record-form-visually-hidden'
                    : 'record-form-legend'
                }
                id={`record-form-legend-${group}`}
              >
                {t(GROUP_LABELS[group])}
              </legend>
              {children}
            </fieldset>
          </div>
        </div>
      </section>
    );
  }
  return (
    <WorkspaceFrame
      profile={profile}
      onProfileChange={changeProfile}
      title="Record form organizations"
      kind="forms"
    >
      <div ref={root} className="record-form-demo" data-form-mode={mode}>
        <TweakerSettings title="Form organization">
          <div className="record-form-settings">
            <div className="record-form-mode-control">
              <label htmlFor="record-form-mode">{t('Form organization')}</label>
              <Select<FormMode>
                id="record-form-mode"
                value={mode}
                onChange={changeMode}
                options={modes}
                labelRender={selectedLabel(modes)}
              />
            </div>
            <Checkbox
              id="record-form-readonly"
              checked={readOnly}
              onChange={event => setReadOnly(event.target.checked)}
            >
              {t('Read-only example')}
            </Checkbox>
            <Checkbox
              id="record-form-simulate-error"
              checked={simulateError}
              onChange={event => setSimulateError(event.target.checked)}
            >
              {t('Simulate a save error')}
            </Checkbox>
          </div>
        </TweakerSettings>
        <p className="record-form-caption">
          {t(
            'Flow and content organization are separate experiments. The same fields and draft remain mounted in every mode.',
          )}
        </p>
        {readOnly && (
          <p className="record-form-caption">
            {t(
              'Read-only preview: editing and submission are disabled. This does not represent a server permission check.',
            )}
          </p>
        )}
        <p className="record-form-draft-status" role="status">
          {dirty ? t('Unsaved local draft') : t('No unsaved changes')}
        </p>
        <div
          className="record-form-tabs"
          role="tablist"
          aria-label={t('Form sections')}
          hidden={mode !== 'tabs'}
        >
          {GROUPS.map(group => (
            <button
              key={group}
              type="button"
              role="tab"
              className="record-form-tab genux-control"
              id={`record-form-tab-${group}`}
              aria-controls={`record-form-panel-${group}`}
              aria-selected={activeGroup === group}
              tabIndex={activeGroup === group ? 0 : -1}
              onClick={event => {
                event.currentTarget.focus();
                revealGroup(group);
              }}
              onKeyDown={event => handleTabKey(event, group)}
            >
              {t(GROUP_LABELS[group])}
            </button>
          ))}
        </div>
        <p className="record-form-step-status" hidden={mode !== 'steps'}>
          {t('Step {step} of {count}: {section}', {
            step: GROUPS.indexOf(activeGroup) + 1,
            count: GROUPS.length,
            section: t(GROUP_LABELS[activeGroup]),
          })}
        </p>
        <GenUXSplitter
          id="record-form-splitter"
          className="record-form-splitter"
          label={t('Record editor and live draft review')}
          orientation="auto"
          initialSizes={[70, 30]}
          panels={[
            {
              id: 'editor',
              label: t('Record editor'),
              children: (
                <div className="record-form-editor-pane">
                  <Form<RecordFormValues>
                    form={form}
                    name="record-form-example"
                    className="record-form-fields"
                    layout="vertical"
                    noValidate
                    colon={false}
                    labelWrap
                    preserve
                    disabled={readOnly}
                    initialValues={initial.current}
                    onValuesChange={markChanged}
                    onFinish={handleFinish}
                    onFinishFailed={handleFailed}
                    onFocusCapture={event => {
                      const group = event.target.closest<HTMLElement>('[data-form-group]')?.dataset
                        .formGroup as GroupName | undefined;
                      if (group) setActiveGroup(group);
                    }}
                  >
                    {section(
                      'customer',
                      <>
                        <Form.Item
                          name="customer"
                          label={t('Customer')}
                          htmlFor="record-form-customer"
                          rules={[
                            {
                              required: true,
                              whitespace: true,
                              message: t('Enter a customer name.'),
                            },
                          ]}
                        >
                          <Input
                            id="record-form-customer"
                            placeholder={t('Fictional customer name')}
                            autoComplete="organization"
                          />
                        </Form.Item>
                        <Form.Item
                          name="email"
                          label={t('Contact email')}
                          htmlFor="record-form-email"
                          rules={[
                            { required: true, message: t('Enter a contact email.') },
                            { type: 'email', message: t('Provide a valid email address.') },
                          ]}
                        >
                          <Input
                            id="record-form-email"
                            type="email"
                            placeholder={t('name@example.com')}
                            autoComplete="email"
                          />
                        </Form.Item>
                      </>,
                    )}
                    {section(
                      'payment',
                      <>
                        <Form.Item
                          name="amount"
                          label={t('Declared amount')}
                          htmlFor="record-form-amount"
                          extra={t(
                            'Optional: an empty value is unknown; zero is a valid amount. This is separate from the order-line subtotal.',
                          )}
                          rules={[
                            {
                              validator: (_, value: unknown) =>
                                value === null ||
                                value === undefined ||
                                (typeof value === 'number' &&
                                  Number.isFinite(value) &&
                                  value >= 0 &&
                                  Number.isSafeInteger(Math.round(value * 100)))
                                  ? Promise.resolve()
                                  : Promise.reject(
                                      new Error(t('Enter a finite amount of zero or more.')),
                                    ),
                            },
                          ]}
                        >
                          <InputNumber
                            id="record-form-amount"
                            min={0}
                            step={0.01}
                            precision={2}
                            controls={false}
                            placeholder={t('No amount supplied')}
                          />
                        </Form.Item>
                        <Form.Item
                          name="currency"
                          label={t('Currency')}
                          htmlFor="record-form-currency"
                          rules={[{ required: true, message: t('Choose a currency.') }]}
                        >
                          <Select
                            id="record-form-currency"
                            options={currencyOptions}
                            labelRender={selectedLabel(currencyOptions)}
                          />
                        </Form.Item>
                        <Form.Item
                          required
                          name="due"
                          label={t('Due date')}
                          htmlFor="record-form-due"
                          rules={[
                            {
                              validator: (_, value: unknown) =>
                                validISODate(value)
                                  ? Promise.resolve()
                                  : Promise.reject(new Error(t('Enter a valid due date.'))),
                            },
                          ]}
                        >
                          <DateField id="record-form-due" />
                        </Form.Item>
                        <Form.Item
                          name="billingMethod"
                          label={t('Payment method')}
                          htmlFor="record-form-billing-method"
                        >
                          <Select
                            id="record-form-billing-method"
                            options={methodOptions}
                            labelRender={selectedLabel(methodOptions)}
                          />
                        </Form.Item>
                        <div
                          className="record-form-conditional"
                          data-open={billingMethod === 'invoice'}
                          aria-hidden={billingMethod !== 'invoice'}
                          inert={billingMethod !== 'invoice'}
                        >
                          <div className="record-form-conditional-content">
                            <Form.Item
                              name="paymentTerms"
                              label={t('Invoice payment terms')}
                              htmlFor="record-form-payment-terms"
                              dependencies={['billingMethod']}
                              extra={t(
                                'The draft is retained when invoice terms are hidden. Card submissions do not apply these terms.',
                              )}
                              rules={[
                                ({ getFieldValue }) => ({
                                  validator: (_, value: unknown) =>
                                    getFieldValue('billingMethod') !== 'invoice' ||
                                    (typeof value === 'string' && Boolean(value.trim()))
                                      ? Promise.resolve()
                                      : Promise.reject(
                                          new Error(t('Enter payment terms for the invoice.')),
                                        ),
                                }),
                              ]}
                            >
                              <Input
                                id="record-form-payment-terms"
                                placeholder={t('For example, due in 30 days')}
                              />
                            </Form.Item>
                          </div>
                        </div>
                      </>,
                    )}
                    {section(
                      'content',
                      <>
                        <Form.Item name="note" label={t('Notes')} htmlFor="record-form-note">
                          <Input.TextArea
                            id="record-form-note"
                            rows={3}
                            placeholder={t('Optional note')}
                          />
                        </Form.Item>
                        <div
                          className="record-form-lines"
                          aria-labelledby="record-form-lines-heading"
                        >
                          <h4 id="record-form-lines-heading">{t('Order lines')}</h4>
                          <p className="record-form-caption">
                            {t(
                              'Line identities are stable. The subtotal uses rounded integer cents; no tax or accounting rules are applied.',
                            )}
                          </p>
                          <Form.List
                            name="lines"
                            rules={[
                              {
                                validator: (_, lines: FormLine[] | undefined) => {
                                  // Individual field rules report missing/invalid inputs and
                                  // unsafe line products; this rule checks their composed sum.
                                  if (
                                    !lines ||
                                    lines.some(
                                      line =>
                                        lineTotalCents(line.quantity, line.unitPrice) === null,
                                    )
                                  )
                                    return Promise.resolve();
                                  return subtotalCents(lines) !== null
                                    ? Promise.resolve()
                                    : Promise.reject(
                                        new Error(
                                          t(
                                            'The order-line subtotal exceeds the supported numeric range. Reduce the line values.',
                                          ),
                                        ),
                                      );
                                },
                              },
                            ]}
                          >
                            {(lineFields, { add, remove }, { errors: lineErrors }) => (
                              <>
                                {lineFields.map((field, index) => {
                                  const storedId: unknown = form.getFieldValue([
                                    'lines',
                                    field.name,
                                    'id',
                                  ]);
                                  const lineId =
                                    typeof storedId === 'string' ? storedId : `line-${field.key}`;
                                  function removeLine() {
                                    flushSync(() => remove(field.name));
                                    markChanged();
                                    const target =
                                      root.current?.querySelector<HTMLElement>(
                                        '.record-form-line input:not([type="hidden"])',
                                      ) ?? document.getElementById('record-form-add-line');
                                    target?.focus();
                                  }
                                  return (
                                    <fieldset
                                      className="record-form-line"
                                      key={field.key}
                                      data-line-id={lineId}
                                    >
                                      <legend>{t('Line {number}', { number: index + 1 })}</legend>
                                      <Form.Item name={[field.name, 'id']} hidden>
                                        <Input type="hidden" />
                                      </Form.Item>
                                      <Form.Item
                                        name={[field.name, 'product']}
                                        label={t('Product')}
                                        htmlFor={`record-form-line-${lineId}-product`}
                                        rules={[
                                          {
                                            required: true,
                                            whitespace: true,
                                            message: t('Enter a product name.'),
                                          },
                                        ]}
                                      >
                                        <Input id={`record-form-line-${lineId}-product`} />
                                      </Form.Item>
                                      <Form.Item
                                        required
                                        name={[field.name, 'quantity']}
                                        label={t('Quantity')}
                                        htmlFor={`record-form-line-${lineId}-quantity`}
                                        dependencies={[['lines', field.name, 'unitPrice']]}
                                        rules={[
                                          {
                                            validator: (_, value: unknown) =>
                                              validQuantity(value)
                                                ? Promise.resolve()
                                                : Promise.reject(
                                                    new Error(
                                                      t('Enter a finite quantity of zero or more.'),
                                                    ),
                                                  ),
                                          },
                                          ({ getFieldValue }) => ({
                                            validator: (_, value: unknown) => {
                                              const price: unknown = getFieldValue([
                                                'lines',
                                                field.name,
                                                'unitPrice',
                                              ]);
                                              return !validQuantity(value) ||
                                                !validUnitPrice(price) ||
                                                lineTotalCents(value, price) !== null
                                                ? Promise.resolve()
                                                : Promise.reject(
                                                    new Error(
                                                      t(
                                                        'This line total exceeds the supported numeric range. Reduce quantity or unit price.',
                                                      ),
                                                    ),
                                                  );
                                            },
                                          }),
                                        ]}
                                      >
                                        <NumberStepper
                                          id={`record-form-line-${lineId}-quantity`}
                                          min="0"
                                          step="1"
                                          precision={2}
                                          stringMode
                                          onRemove={removeLine}
                                        />
                                      </Form.Item>
                                      <Form.Item
                                        required
                                        name={[field.name, 'unitPrice']}
                                        label={t('Unit price')}
                                        htmlFor={`record-form-line-${lineId}-price`}
                                        dependencies={[['lines', field.name, 'quantity']]}
                                        rules={[
                                          {
                                            validator: (_, value: unknown) =>
                                              validUnitPrice(value)
                                                ? Promise.resolve()
                                                : Promise.reject(
                                                    new Error(
                                                      t(
                                                        'Enter a finite unit price of zero or more.',
                                                      ),
                                                    ),
                                                  ),
                                          },
                                          ({ getFieldValue }) => ({
                                            validator: (_, value: unknown) => {
                                              const quantity: unknown = getFieldValue([
                                                'lines',
                                                field.name,
                                                'quantity',
                                              ]);
                                              return !validUnitPrice(value) ||
                                                !validQuantity(quantity) ||
                                                lineTotalCents(quantity, value) !== null
                                                ? Promise.resolve()
                                                : Promise.reject(
                                                    new Error(
                                                      t(
                                                        'This line total exceeds the supported numeric range. Reduce quantity or unit price.',
                                                      ),
                                                    ),
                                                  );
                                            },
                                          }),
                                        ]}
                                      >
                                        <InputNumber
                                          id={`record-form-line-${lineId}-price`}
                                          min={0}
                                          step={0.01}
                                          precision={2}
                                          controls={false}
                                        />
                                      </Form.Item>
                                      <GenUXButton
                                        htmlType="button"
                                        fill="text"
                                        text={t('Remove line {number}', { number: index + 1 })}
                                        onClick={removeLine}
                                      />
                                    </fieldset>
                                  );
                                })}
                                <GenUXButton
                                  id="record-form-add-line"
                                  htmlType="button"
                                  fill="text"
                                  text={t('Add order line')}
                                  onClick={() => {
                                    const id = `draft-line-${lineSequence.current++}`;
                                    flushSync(() =>
                                      add({ id, product: '', quantity: '1', unitPrice: 0 }),
                                    );
                                    markChanged();
                                    document
                                      .getElementById(`record-form-line-${id}-product`)
                                      ?.focus();
                                  }}
                                />
                                <div
                                  id="record-form-lines-error"
                                  role={lineErrors.length ? 'alert' : undefined}
                                >
                                  <Form.ErrorList errors={lineErrors} />
                                </div>
                              </>
                            )}
                          </Form.List>
                          <p className="record-form-total" id="record-form-total">
                            {t('Order-line subtotal: {amount}', {
                              amount:
                                totalCents === null
                                  ? t('Complete the line values')
                                  : moneyText(totalCents / 100, currency, locale),
                            })}
                          </p>
                        </div>
                      </>,
                    )}
                  </Form>
                  <div className="record-form-actions">
                    <GenUXButton
                      id="record-form-prev"
                      htmlType="button"
                      fill="text"
                      text={t('Previous step')}
                      hidden={mode !== 'steps' || activeGroup === GROUPS[0]}
                      onClick={() => changeStep(-1)}
                    />
                    <GenUXButton
                      id="record-form-next"
                      htmlType="button"
                      text={t('Next step')}
                      hidden={mode !== 'steps' || activeGroup === GROUPS[GROUPS.length - 1]}
                      onClick={() => changeStep(1)}
                    />
                    <GenUXButton
                      id="record-form-submit"
                      htmlType="button"
                      text={t('Validate and preview')}
                      disabled={readOnly}
                      onClick={() => form.submit()}
                    />
                    <GenUXButton
                      id="record-form-reset"
                      htmlType="button"
                      fill="text"
                      text={t('Discard draft and reset')}
                      onClick={resetDraft}
                    />
                  </div>
                </div>
              ),
            },
            {
              id: 'review',
              label: t('Live draft review'),
              children: (
                <div className="record-form-review" data-form-review>
                  <h4>{t('Live draft review')}</h4>
                  <p>
                    {t(
                      'Review updates as you type. Validate the draft to prepare a local preview.',
                    )}
                  </p>
                  <dl className="record-form-preview">
                    <div>
                      <dt>{t('Customer')}</dt>
                      <dd>{values.customer?.trim() || t('Not supplied')}</dd>
                    </div>
                    <div>
                      <dt>{t('Email')}</dt>
                      <dd>{values.email?.trim() || t('Not supplied')}</dd>
                    </div>
                    <div>
                      <dt>{t('Declared amount')}</dt>
                      <dd>
                        {values.amount === null || values.amount === undefined
                          ? t('Not supplied')
                          : moneyText(values.amount, currency, locale)}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('Due date')}</dt>
                      <dd>
                        {values.due
                          ? validISODate(values.due)
                            ? dateText(values.due, locale)
                            : values.due
                          : t('Not supplied')}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('Payment method')}</dt>
                      <dd>{t(billingMethod === 'invoice' ? 'Invoice' : 'Card')}</dd>
                    </div>
                    <div>
                      <dt>{t('Order lines')}</dt>
                      <dd>{values.lines?.length ?? 0}</dd>
                    </div>
                    <div>
                      <dt>{t('Order-line subtotal')}</dt>
                      <dd>
                        {totalCents === null
                          ? t('Complete the line values')
                          : moneyText(totalCents / 100, currency, locale)}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('Notes')}</dt>
                      <dd>{values.note?.trim() || t('Not supplied')}</dd>
                    </div>
                  </dl>
                  <div
                    className="record-form-result"
                    id="record-form-result"
                    role="status"
                    aria-live="polite"
                  >
                    {result === 'invalid' &&
                      t(
                        'Correct the indicated fields. The first error is open and focused; nothing was sent.',
                      )}
                    {result === 'simulated-error' &&
                      t(
                        'Simulated save error. Your draft is retained. Turn off the simulation and retry; no server request was made.',
                      )}
                    {result === 'reset' &&
                      t('The local draft was discarded and the example was reset.')}
                    {result === 'saved' && preview && (
                      <>
                        <p>
                          {t('Validated local preview for {customer}. No server save occurred.', {
                            customer: preview.customer,
                          })}
                        </p>
                        <dl className="record-form-preview">
                          <div>
                            <dt>{t('Declared amount')}</dt>
                            <dd>
                              {preview.amount === null || preview.amount === undefined
                                ? t('Not supplied')
                                : moneyText(preview.amount, preview.currency, locale)}
                            </dd>
                          </div>
                          <div>
                            <dt>{t('Due date')}</dt>
                            <dd>{preview.due}</dd>
                          </div>
                          <div>
                            <dt>{t('Payment method')}</dt>
                            <dd>{t(preview.billingMethod === 'invoice' ? 'Invoice' : 'Card')}</dd>
                          </div>
                          <div>
                            <dt>{t('Invoice payment terms')}</dt>
                            <dd>
                              {preview.billingMethod === 'invoice'
                                ? preview.paymentTerms
                                : t('Not applicable')}
                            </dd>
                          </div>
                          <div>
                            <dt>{t('Order lines')}</dt>
                            <dd>{preview.lines.length}</dd>
                          </div>
                        </dl>
                      </>
                    )}
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div>
    </WorkspaceFrame>
  );
}
export default function RecordFormsDemo({
  documentation = false,
}: { documentation?: boolean } = {}) {
  return (
    <GenUXProvider appearance={documentation ? 'docs' : undefined}>
      <ExamplePreview id="record-forms-workspace" title="Record form organizations">
        <RecordFormsExamples />
      </ExamplePreview>
    </GenUXProvider>
  );
}
