import { useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Select, Switch, type InputRef } from 'antd';
import Input from './GenUXInput';
import GenUXProvider from './GenUXProvider';
import GenUXSteps from './GenUXSteps';
import ExamplePreview from './ExamplePreview';
import GenUXButton from './GenUXButton';
import GenUXIcon from './GenUXIcon';
import { TweakerSettings } from './GenUXTweaker';
import { useI18n } from './useI18n';

type Orientation = 'auto' | 'horizontal' | 'vertical';
type MarkerSurface = 'filled' | 'outlined';
type TitlePlacement = 'horizontal' | 'vertical';
type RecoveryState = 'error' | 'process' | 'finish';

function StepsExamples() {
  const { t } = useI18n();
  const id = useId();
  const nameInput = useRef<InputRef>(null);
  const actions = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<'name' | 'completion' | null>(null);
  const [name, setName] = useState('');
  const [setupStep, setSetupStep] = useState(0);
  const [complete, setComplete] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [orientation, setOrientation] = useState<Orientation>('auto');
  const [variant, setVariant] = useState<MarkerSurface>('filled');
  const [titlePlacement, setTitlePlacement] = useState<TitlePlacement>('horizontal');
  const [withIcons, setWithIcons] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryState>('error');
  const [navigationStep, setNavigationStep] = useState(0);
  const setupTitles = [t('Workspace details'), t('Review details'), t('Ready to finish')];
  const setupIcons = ['house', 'search', 'check'];
  const setupItems = setupTitles.map((title, index) => ({
    key: ['details', 'review', 'finish'][index]!,
    title,
    content: [t('Give your workspace a name'), t('Check your local draft'), t('Confirm the setup')][
      index
    ],
    icon: withIcons ? <GenUXIcon name={setupIcons[index]!} /> : undefined,
  }));
  const comparisonItems = [
    { key: 'details', title: t('Details'), content: t('Name and purpose') },
    { key: 'review', title: t('Review'), content: t('Check the details') },
    { key: 'ready', title: t('Ready'), content: t('Confirm your choice') },
  ];
  const iconItems = comparisonItems.map((item, index) => ({
    ...item,
    icon: <GenUXIcon name={setupIcons[index]!} />,
  }));

  useLayoutEffect(() => {
    if (pendingFocus.current === 'name') nameInput.current?.focus();
    if (pendingFocus.current === 'completion') actions.current?.querySelector('button')?.focus();
    pendingFocus.current = null;
  }, [setupStep, complete]);

  function advance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (complete) return;
    if (setupStep === 0 && name.trim().length < 2) {
      setNameError(true);
      nameInput.current?.focus();
      return;
    }
    setNameError(false);
    if (setupStep < 2) setSetupStep(step => step + 1);
    else {
      pendingFocus.current = 'completion';
      setComplete(true);
    }
  }

  function resetSetup() {
    pendingFocus.current = 'name';
    setComplete(false);
    setSetupStep(0);
    setName('');
    setNameError(false);
  }

  return (
    <div className="steps-catalog" data-steps-catalog>
      <TweakerSettings title="Steps">
        <label className="playground-control" htmlFor={`${id}-orientation`}>
          {t('Setup layout')}
          <Select
            id={`${id}-orientation`}
            data-steps-orientation
            value={orientation}
            onChange={setOrientation}
            options={[
              { value: 'auto', label: t('Automatic') },
              { value: 'horizontal', label: t('Horizontal') },
              { value: 'vertical', label: t('Vertical') },
            ]}
          />
        </label>
        <label className="playground-control" htmlFor={`${id}-variant`}>
          {t('Marker surface')}
          <Select
            id={`${id}-variant`}
            data-steps-variant
            value={variant}
            onChange={setVariant}
            options={[
              { value: 'filled', label: t('Filled') },
              { value: 'outlined', label: t('Outlined') },
            ]}
          />
        </label>
        <label className="playground-control" htmlFor={`${id}-title-position`}>
          {t('Title position')}
          <Select
            id={`${id}-title-position`}
            data-steps-title-placement
            value={titlePlacement}
            onChange={setTitlePlacement}
            options={[
              { value: 'horizontal', label: t('Beside the marker') },
              { value: 'vertical', label: t('Below the marker') },
            ]}
          />
        </label>
        <label className="control-row">
          <Switch
            data-steps-icons
            checked={withIcons}
            onChange={setWithIcons}
            aria-label={t('Use Phosphor icons')}
          />
          {t('Use Phosphor icons')}
        </label>
      </TweakerSettings>
      <nav className="steps-navigation" aria-label={t('Steps examples')}>
        <a href="#steps-setup">{t('Guided setup')}</a>
        <a href="#steps-layouts">{t('Layouts and markers')}</a>
        <a href="#steps-recovery">{t('States and recovery')}</a>
        <a href="#steps-navigation">{t('Step navigation')}</a>
      </nav>
      <section id="steps-setup" className="steps-section" aria-labelledby="steps-setup-title">
        <header>
          <p className="eyebrow">{t('01 · One clear next step')}</p>
          <h3 id="steps-setup-title">{t('Guided setup')}</h3>
          <p>{t('Name a workspace, review it and finish. Going back keeps your draft.')}</p>
        </header>
        <ExamplePreview id="steps-guided-setup" title={t('Guided setup')}>
          <div className="steps-stage" data-steps-primary>
            <GenUXSteps
              items={setupItems}
              current={setupStep}
              status={complete ? 'finish' : nameError ? 'error' : 'process'}
              orientation={orientation}
              variant={variant}
              titlePlacement={titlePlacement}
              label={t('Workspace setup progress')}
            />
            <p className="steps-progress" data-steps-setup-status role="status">
              {complete
                ? t('Your local setup is complete')
                : t('Step {step} of {total}: {title}', {
                    step: setupStep + 1,
                    total: setupItems.length,
                    title: setupTitles[setupStep]!,
                  })}
            </p>
            <form className="steps-setup-form" data-steps-setup-form noValidate onSubmit={advance}>
              <div className="steps-field" hidden={setupStep !== 0 || complete}>
                <label htmlFor={`${id}-workspace-name`}>{t('Workspace name')}</label>
                <Input
                  id={`${id}-workspace-name`}
                  ref={nameInput}
                  data-steps-workspace-name
                  value={name}
                  maxLength={60}
                  required
                  status={nameError ? 'error' : undefined}
                  aria-invalid={nameError || undefined}
                  aria-describedby={`${id}-name-help${nameError ? ` ${id}-name-error` : ''}`}
                  placeholder={t('For example, Design studio')}
                  onChange={event => {
                    setName(event.target.value);
                    if (event.target.value.trim().length >= 2) setNameError(false);
                  }}
                />
                <p id={`${id}-name-help`} className="steps-guidance">
                  {t('Use 2–60 characters. This example stays on this page.')}
                </p>
                {nameError && (
                  <p id={`${id}-name-error`} className="steps-error" role="alert">
                    {t('Enter a workspace name with at least 2 characters.')}
                  </p>
                )}
              </div>
              <div className="steps-setup-content" hidden={setupStep === 0 && !complete}>
                <h4>{complete ? t('Your local setup is complete') : setupTitles[setupStep]}</h4>
                <dl className="steps-summary">
                  <div>
                    <dt>{t('Workspace name')}</dt>
                    <dd data-steps-name-summary>{name.trim()}</dd>
                  </div>
                  <div>
                    <dt>{t('Scope')}</dt>
                    <dd>{t('Local example')}</dd>
                  </div>
                </dl>
                <p className="steps-guidance">
                  {complete
                    ? t('Nothing was sent or saved to a server. You can start again.')
                    : setupStep === 1
                      ? t('Check the name before continuing. Back lets you edit it.')
                      : t('Finish confirms this local example. You can still go back.')}
                </p>
              </div>
              <div className="steps-actions" ref={actions}>
                {complete ? (
                  <GenUXButton
                    text={t('Start again')}
                    fill="outline"
                    htmlType="button"
                    onClick={resetSetup}
                  />
                ) : (
                  <>
                    <GenUXButton
                      text={t('Back')}
                      fill="text"
                      htmlType="button"
                      disabled={setupStep === 0}
                      onClick={() => {
                        if (setupStep === 1) pendingFocus.current = 'name';
                        setSetupStep(step => Math.max(0, step - 1));
                      }}
                    />
                    <GenUXButton
                      text={setupStep === 2 ? t('Finish setup') : t('Continue')}
                      htmlType="submit"
                    />
                  </>
                )}
              </div>
            </form>
          </div>
        </ExamplePreview>
      </section>
      <section id="steps-layouts" className="steps-section" aria-labelledby="steps-layouts-title">
        <header>
          <p className="eyebrow">{t('02 · Give the sequence room')}</p>
          <h3 id="steps-layouts-title">{t('Layouts and markers')}</h3>
          <p>
            {t(
              'Numbered or icon markers share the same sequence. Narrow spaces stack the steps; longer checklists can stay vertical.',
            )}
          </p>
        </header>
        <ExamplePreview id="steps-layouts-markers" title={t('Layouts and markers')}>
          <div className="steps-comparison-grid">
            <div className="steps-example" data-steps-example="numbered">
              <h4>{t('Numbered · filled')}</h4>
              <GenUXSteps items={comparisonItems} current={1} label={t('Numbered setup steps')} />
            </div>
            <div className="steps-example" data-steps-example="icons">
              <h4>{t('Phosphor icons · outlined')}</h4>
              <GenUXSteps
                items={iconItems}
                current={1}
                variant="outlined"
                label={t('Icon setup steps')}
              />
            </div>
            <div className="steps-example" data-steps-example="centered">
              <h4>{t('Centered labels')}</h4>
              <GenUXSteps
                items={comparisonItems}
                current={1}
                titlePlacement="vertical"
                variant="outlined"
                label={t('Centered setup steps')}
              />
            </div>
            <div className="steps-example" data-steps-example="vertical">
              <h4>{t('Vertical checklist')}</h4>
              <GenUXSteps
                items={comparisonItems}
                current={1}
                orientation="vertical"
                label={t('Vertical setup steps')}
              />
            </div>
          </div>
        </ExamplePreview>
      </section>
      <section id="steps-recovery" className="steps-section" aria-labelledby="steps-recovery-title">
        <header>
          <p className="eyebrow">{t('03 · Explain what needs attention')}</p>
          <h3 id="steps-recovery-title">{t('States and recovery')}</h3>
          <p>
            {t(
              'A completed step, current review and waiting step show where work stands. An issue names the next useful action.',
            )}
          </p>
        </header>
        <ExamplePreview id="steps-states-recovery" title={t('States and recovery')}>
          <div className="steps-example" data-steps-recovery data-recovery-state={recovery}>
            <GenUXSteps
              current={1}
              status={recovery}
              items={[
                { key: 'details', title: t('Details confirmed'), content: t('Name is available') },
                {
                  key: 'review',
                  title: t('Ownership review'),
                  content:
                    recovery === 'error'
                      ? t('Confirmation is missing')
                      : recovery === 'process'
                        ? t('Review reopened')
                        : t('Review confirmed'),
                },
                { key: 'ready', title: t('Ready'), content: t('Waiting for the next action') },
              ]}
              label={t('Ownership review progress')}
            />
            <div className="steps-recovery-content">
              <h4>
                {recovery === 'error'
                  ? t('Review needs attention')
                  : recovery === 'process'
                    ? t('Review is ready to continue')
                    : t('Review is complete')}
              </h4>
              <p
                className={recovery === 'error' ? 'steps-error' : 'steps-guidance'}
                role={recovery === 'error' ? 'alert' : 'status'}
              >
                {recovery === 'error'
                  ? t('Ownership confirmation is missing. Retry reopens this local review.')
                  : recovery === 'process'
                    ? t(
                        'The review is open. Confirm it when you are ready; no background process is running.',
                      )
                    : t(
                        'The local review is confirmed. The final step still waits for its own action.',
                      )}
              </p>
              <div className="steps-actions">
                {recovery === 'error' ? (
                  <GenUXButton
                    text={t('Retry review')}
                    icon="reload"
                    onClick={() => setRecovery('process')}
                  />
                ) : recovery === 'process' ? (
                  <GenUXButton
                    text={t('Confirm review')}
                    icon="check"
                    onClick={() => setRecovery('finish')}
                  />
                ) : (
                  <GenUXButton
                    text={t('Show the issue again')}
                    fill="text"
                    onClick={() => setRecovery('error')}
                  />
                )}
              </div>
            </div>
          </div>
        </ExamplePreview>
      </section>
      <section
        id="steps-navigation"
        className="steps-section"
        aria-labelledby="steps-navigation-title"
      >
        <header>
          <p className="eyebrow">{t('04 · Revisit without losing context')}</p>
          <h3 id="steps-navigation-title">{t('Step navigation')}</h3>
          <p>
            {t(
              'Use named steps to revisit available information. An unavailable step stays visible and explains its limit.',
            )}
          </p>
        </header>
        <ExamplePreview id="steps-step-navigation" title={t('Step navigation')}>
          <div className="steps-example" data-steps-navigation-preview>
            <GenUXSteps
              type="navigation"
              current={navigationStep}
              onChange={setNavigationStep}
              items={[
                { key: 'overview', title: t('Overview'), content: t('Workspace context') },
                { key: 'activity', title: t('Activity'), content: t('Recent local actions') },
                {
                  key: 'access',
                  title: t('Access'),
                  content: t('Unavailable in this example'),
                  disabled: true,
                },
              ]}
              label={t('Workspace information steps')}
            />
            <div
              className="steps-navigation-content"
              data-steps-navigation-content
              aria-live="polite"
            >
              <h4>{navigationStep === 0 ? t('Workspace overview') : t('Recent activity')}</h4>
              <p>
                {navigationStep === 0
                  ? t('Design studio brings together the team, its plans and review queue.')
                  : t(
                      'The local example includes a named workspace, a review checkpoint and a ready state.',
                    )}
              </p>
            </div>
            <p className="steps-guidance">
              {t('Access settings are unavailable in this local example.')}
            </p>
          </div>
        </ExamplePreview>
      </section>
    </div>
  );
}

export default function StepsDemo({ documentation = false }: { documentation?: boolean } = {}) {
  return (
    <GenUXProvider appearance={documentation ? 'docs' : 'approved'}>
      <StepsExamples />
    </GenUXProvider>
  );
}
