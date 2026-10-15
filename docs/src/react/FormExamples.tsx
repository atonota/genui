import { selectedLabel } from './selectedLabel';
import { useI18n } from './useI18n';
import { useEffect, useId, useState } from 'react';
import { Checkbox, Form, Select, type FormProps } from 'antd';
import Input from './AtlasInput';
import AtlasButton from './AtlasButton';
import { TweakerSettings } from './AtlasTweaker';
import DataEntryCatalog from './DataEntryCatalog';

type FormLayout = NonNullable<FormProps['layout']>;
type ProfileValues = {
  fullName: string;
  email: string;
  team: 'product' | 'design' | 'development';
  updates: boolean;
};

export function FormExamples({ documentation = false }: { documentation?: boolean } = {}) {
  const { t, locale } = useI18n();
  const teamOptions = [
    { value: 'product', label: t('Product') },
    { value: 'design', label: t('Design') },
    { value: 'development', label: t('Development') },
  ];
  const layoutOptions = [
    { value: 'vertical', label: t('Vertical') },
    { value: 'horizontal', label: t('Horizontal') },
    { value: 'inline', label: t('Inline') },
  ];
  const layoutId = useId();
  const [form] = Form.useForm<ProfileValues>();
  useEffect(() => {
    const names = form
      .getFieldsError()
      .filter(field => field.errors.length > 0)
      .map(field => field.name);
    if (names.length) void form.validateFields(names).catch(() => {});
  }, [form, locale]);
  const [layout, setLayout] = useState<FormLayout>('vertical');
  const [disabled, setDisabled] = useState(false);
  const [pendingPreview, setPendingPreview] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const flow = (
    <>
      <TweakerSettings title={t('Form layout')}>
        <div className="control-row">
          <div className="form-layout-control">
            <label htmlFor={layoutId}>{t('Form layout')}</label>
            <Select<FormLayout>
              id={layoutId}
              value={layout}
              onChange={setLayout}
              options={layoutOptions}
              labelRender={selectedLabel(layoutOptions)}
            />
          </div>
          <Checkbox checked={disabled} onChange={event => setDisabled(event.target.checked)}>
            {t('Disable form')}
          </Checkbox>
        </div>
      </TweakerSettings>
      <Form<ProfileValues>
        className={`atlas-form-demo atlas-form-${layout}`}
        name="profile-example"
        form={form}
        noValidate
        layout={layout}
        disabled={disabled}
        labelWrap
        colon={false}
        initialValues={{ updates: false }}
        scrollToFirstError={{ focus: true }}
        {...(layout === 'horizontal'
          ? {
              labelCol: { xs: { span: 24 }, sm: { span: 8 } },
              wrapperCol: { xs: { span: 24 }, sm: { span: 16 } },
            }
          : {})}
        onValuesChange={() => setResult(null)}
        onFinish={values => setResult(values.fullName.trim())}
        preserve
      >
        <fieldset className="atlas-form-section">
          <legend className="atlas-form-section-legend">{t('Profile details')}</legend>
          <Form.Item
            label={t('Full name')}
            name="fullName"
            rules={[
              {
                required: true,
                whitespace: true,
                message: t('Enter your full name.'),
              },
            ]}
          >
            <Input autoComplete="name" placeholder={t('Your full name')} />
          </Form.Item>
          <Form.Item
            label={t('Email')}
            name="email"
            rules={[
              { required: true, message: t('Enter your email address.') },
              { type: 'email', message: t('Provide a valid email address.') },
            ]}
          >
            <Input type="email" autoComplete="email" placeholder={t('name@example.com')} />
          </Form.Item>
        </fieldset>
        <fieldset className="atlas-form-section">
          <legend className="atlas-form-section-legend">{t('Workspace preferences')}</legend>
          <Form.Item
            label={t('Team')}
            name="team"
            rules={[{ required: true, message: t('Choose a team.') }]}
          >
            <Select
              options={teamOptions}
              labelRender={selectedLabel(teamOptions)}
              placeholder={t('Choose a team')}
              allowClear
            />
          </Form.Item>
          <Form.Item name="updates" valuePropName="checked">
            <Checkbox>{t('Follow product updates')}</Checkbox>
          </Form.Item>
        </fieldset>
        <Form.Item>
          <div className="control-row">
            <AtlasButton text={t('Validate')} htmlType="submit" />
            <AtlasButton
              fill="outline"
              text={t('Reset')}
              onClick={() => {
                form.resetFields();
                setResult(null);
              }}
            />
          </div>
        </Form.Item>
      </Form>
      <div className="form-result" role="status" aria-live="polite">
        {result === null
          ? null
          : t('Fields validated for {name}. This is a local example; no data was sent.', {
              name: result,
            })}
      </div>
    </>
  );
  const pendingControls = (
    <div className="control-row">
      <TweakerSettings title={t('Pending-state preview')}>
        <Checkbox
          checked={pendingPreview}
          onChange={event => setPendingPreview(event.target.checked)}
        >
          {t('Show pending state')}
        </Checkbox>
      </TweakerSettings>
      <AtlasButton
        text={pendingPreview ? t('Pending-state example') : t('Disabled example')}
        state={pendingPreview ? 'loading' : 'disabled'}
      />
    </div>
  );
  const pending = (
    <>
      <p>
        {t('This option previews loading only. It starts no network request or save operation.')}
      </p>
      {pendingControls}
    </>
  );
  if (documentation)
    return (
      <div data-demo="forms">
        <DataEntryCatalog
          slug="form"
          title={t('Form')}
          sections={[
            {
              id: 'flow',
              headingId: 'form-layout-title',
              title: t('Form flow'),
              description: t(
                'Enter the related fields, validate them together and reset the local draft when needed.',
              ),
              content: <div className="example-block">{flow}</div>,
            },
            {
              id: 'states',
              headingId: 'form-pending-title',
              title: t('Action states'),
              description: t(
                'This option previews loading only. It starts no network request or save operation.',
              ),
              content: pendingControls,
            },
          ]}
        />
      </div>
    );
  return (
    <div className="pattern-stack" data-demo="forms">
      <section className="example-block" aria-labelledby="form-layout-title">
        <h3 className="variant-heading" id="form-layout-title">
          {t('Layout and validation')}
        </h3>
        {flow}
      </section>
      <section className="example-block" aria-labelledby="form-pending-title">
        <h3 className="variant-heading" id="form-pending-title">
          {t('Pending-state preview')}
        </h3>
        {pending}
      </section>
    </div>
  );
}
