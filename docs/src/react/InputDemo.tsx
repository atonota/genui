import { useState, type ReactNode } from 'react';
import { Form, Select, Switch } from 'antd';
import { useI18n } from './useI18n';
import GenUXProvider from './GenUXProvider';
import { TweakerSettings } from './GenUXTweaker';
import Input from './GenUXInput';
import InputNumber from './GenUXInputNumber';
import NumberStepper from './NumberStepper';
import GenUXIcon from './GenUXIcon';
import GenUXClearIcon from './GenUXClearIcon';
import DataEntryCatalog, { DataEntryGrid } from './DataEntryCatalog';
import ExamplePreview from './ExamplePreview';

// Local sample check only; the field keeps native email semantics.
const EMAIL_PATTERN = /^[^@ ]+@[^@ ]+[.][^@ ]+$/;

export function WebInputDemo({ documentation = false }: { documentation?: boolean } = {}) {
  return <InputDemo numberMode="spinner" documentation={documentation} />;
}

/** Workspace form and state examples built on the GenUX input facades. */
export default function InputDemo({
  numberMode = 'input',
  documentation = false,
}: { numberMode?: 'input' | 'spinner'; documentation?: boolean } = {}) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState<string>();
  const [website, setWebsite] = useState('');
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [budget, setBudget] = useState<number | string | null>(1);
  const [budgetStatus, setBudgetStatus] = useState('');
  const emailInvalid = email !== '' && !EMAIL_PATTERN.test(email);
  // Example-local Tweaker options; state stays here so closing the panel keeps form values.
  const [clearable, setClearable] = useState(true);
  const [showCount, setShowCount] = useState(false);
  const clear = clearable ? { clearIcon: <GenUXClearIcon /> } : false;
  const block = documentation ? 'example-block' : undefined;

  const field = (id: string, label: string, control: ReactNode, after?: ReactNode) => (
    <div className={block}>
      <label htmlFor={id}>{label}</label>
      {control}
      {after}
    </div>
  );

  const budgetField =
    numberMode === 'spinner' ? (
      <>
        <NumberStepper
          id="input-number"
          aria-label={t('Budget')}
          value={budget}
          min={1}
          onChange={next => {
            setBudget(next);
            setBudgetStatus('');
          }}
          onRemove={() => {
            setBudget(null);
            setBudgetStatus('Budget cleared.');
          }}
        />
        <p role="status">{budgetStatus ? t(budgetStatus) : ''}</p>
      </>
    ) : (
      <InputNumber id="input-number" aria-label={t('Budget')} defaultValue={1} min={0} />
    );

  const workspace = (
    <Form
      layout="vertical"
      requiredMark={false}
      className={documentation ? 'data-entry-grid' : undefined}
    >
      <Form.Item label={t('Workspace name')} htmlFor="input-filled">
        <Input
          id="input-filled"
          autoComplete="organization"
          placeholder={t('Istanbul workspace')}
          allowClear={clear}
          value={name}
          onChange={event => setName(event.target.value)}
        />
      </Form.Item>
      <Form.Item
        label={t('Email')}
        htmlFor="input-email"
        validateStatus={emailInvalid ? 'error' : undefined}
        help={emailInvalid ? t('Enter a valid email address.') : undefined}
      >
        <Input
          id="input-email"
          type="email"
          autoComplete="email"
          placeholder={t('example@company.com')}
          aria-invalid={emailInvalid || undefined}
          value={email}
          onChange={event => setEmail(event.target.value)}
        />
      </Form.Item>
      <Form.Item label={t('Department')} htmlFor="input-department">
        <Select
          id="input-department"
          placeholder={t('Choose a department')}
          allowClear={clear}
          value={department}
          onChange={setDepartment}
          options={[
            { value: 'operations', label: t('Operations') },
            { value: 'finance', label: t('Finance') },
            { value: 'design', label: t('Design') },
          ]}
        />
      </Form.Item>
      <Form.Item label={t('Website')} htmlFor="input-website">
        <Input
          id="input-website"
          inputMode="url"
          autoComplete="url"
          prefix="https://"
          placeholder={t('company.example')}
          allowClear={clear}
          value={website}
          onChange={event => setWebsite(event.target.value)}
        />
      </Form.Item>
      <Form.Item label={t('Budget')} htmlFor="input-number">
        {budgetField}
      </Form.Item>
      <Form.Item label={t('Password')} htmlFor="input-password">
        <Input.Password
          id="input-password"
          autoComplete="new-password"
          aria-label={t('Password')}
          placeholder={t('Your password')}
        />
      </Form.Item>
      <Form.Item label={t('Note')} htmlFor="input-note">
        <Input.TextArea
          id="input-note"
          autoSize={{ minRows: 3, maxRows: 6 }}
          showCount={showCount}
          placeholder={t('Add a short description')}
          value={note}
          onChange={event => setNote(event.target.value)}
        />
      </Form.Item>
    </Form>
  );

  const search = field(
    'input-search',
    t('Search'),
    <Input.Search
      id="input-search"
      aria-label={t('Search')}
      placeholder={t('Search term')}
      onSearch={setQuery}
    />,
    <p role="status">{query ? t('Local search preview: {query}', { query }) : ''}</p>,
  );

  const validation = (
    <Form layout="vertical" className={documentation ? 'data-entry-grid' : undefined}>
      <Form.Item
        label={t('Invalid value')}
        validateStatus="error"
        help={t('Enter a valid email address.')}
        name="error"
      >
        <Input aria-invalid placeholder={t('example@company.com')} />
      </Form.Item>
      <Form.Item
        label={t('Needs review')}
        validateStatus="warning"
        help={t('Check this field.')}
        name="warning"
      >
        <Input />
      </Form.Item>
    </Form>
  );

  const readonly = field(
    'input-readonly',
    t('Read-only'),
    <Input
      id="input-readonly"
      readOnly
      value={t('Istanbul')}
      aria-describedby="input-readonly-help"
      suffix={
        <span className="genux-readonly-indicator">
          <GenUXIcon name="lock-simple" />
        </span>
      }
    />,
    <p id="input-readonly-help" className="genux-readonly-help">
      {t('Read-only. You can select and copy this value.')}
    </p>,
  );

  const readonlyNumber = field(
    'input-readonly-number',
    t('Read-only quantity'),
    <NumberStepper
      id="input-readonly-number"
      aria-label={t('Read-only quantity')}
      readOnly
      value={42}
      min={0}
    />,
  );

  const disabled = field(
    'input-disabled',
    t('Disabled'),
    <Input id="input-disabled" disabled value={t('This field is disabled')} />,
  );

  const inputSettings = (
    <TweakerSettings title={t('Input')}>
      <div className="playground-controls">
        <div className="playground-control">
          <label htmlFor="input-tweaker-clearable">{t('Clearable fields')}</label>
          <Switch
            id="input-tweaker-clearable"
            checked={clearable}
            onChange={checked => setClearable(checked)}
          />
        </div>
        <div className="playground-control">
          <label htmlFor="input-tweaker-count">{t('Show character count')}</label>
          <Switch
            id="input-tweaker-count"
            checked={showCount}
            onChange={checked => setShowCount(checked)}
          />
        </div>
      </div>
      <p>{t('These options change only this example.')}</p>
    </TweakerSettings>
  );

  return (
    <GenUXProvider appearance={documentation ? 'docs' : undefined}>
      {inputSettings}
      {documentation ? (
        <DataEntryCatalog
          slug="input"
          title={t('Input')}
          sections={[
            {
              id: 'text',
              title: t('Text entry'),
              description: t(
                'A workspace form combines names, contact details, a department, a website, a budget, a password and a note on one shared field surface.',
              ),
              content: (
                <ExamplePreview id="input-text-entry" title={t('Text entry')}>
                  {workspace}
                </ExamplePreview>
              ),
            },
            {
              id: 'special',
              title: t('Special fields'),
              description: t('Search runs locally and reports its result next to the field.'),
              content: (
                <ExamplePreview id="input-special-fields" title={t('Special fields')}>
                  <DataEntryGrid>{search}</DataEntryGrid>
                </ExamplePreview>
              ),
            },
            {
              id: 'validation',
              title: t('Validation'),
              description: t('Errors and warnings keep their explanations next to the field.'),
              content: (
                <ExamplePreview id="input-validation-states" title={t('Validation')}>
                  {validation}
                </ExamplePreview>
              ),
            },
            {
              id: 'availability',
              title: t('Availability'),
              description: t(
                'Read-only values remain selectable. Disabled fields and actions remain unavailable.',
              ),
              content: (
                <ExamplePreview id="input-availability-states" title={t('Availability')}>
                  <DataEntryGrid>
                    {readonly}
                    {readonlyNumber}
                    {disabled}
                  </DataEntryGrid>
                </ExamplePreview>
              ),
            },
          ]}
        />
      ) : (
        <div className="pattern-stack">
          <section className="example-block">
            <h3 className="variant-heading">{t('Workspace form')}</h3>
            {workspace}
          </section>
          <section className="example-block">
            <h3 className="variant-heading">{t('Special fields')}</h3>
            {search}
          </section>
          <section className="example-block">
            <h3 className="variant-heading">{t('States')}</h3>
            {validation}
            {readonly}
            {readonlyNumber}
            {disabled}
          </section>
        </div>
      )}
    </GenUXProvider>
  );
}
