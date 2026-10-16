import {
  Component,
  Suspense,
  lazy,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Select, Switch } from 'antd';
import AtlasProvider from './AtlasProvider';
import ExamplePreview from './ExamplePreview';
import AtlasButton from './AtlasButton';
import { Modal } from './AtlasOverlay';
import { TweakerSettings } from './AtlasTweaker';
import { useAtlasSize } from './AtlasSizeProfile';
import { useI18n } from './useI18n';
import { EntityCard, MetricCard, PurposeCard } from './cards';
import type { CardRadius } from './cards/AtlasCard';
import {
  CARD_PURPOSES,
  type AtlasCardModel,
  type CardDataState,
  type CardPurpose,
} from '../data/card-model';
import { CARD_RECIPES } from '../data/card-recipes';

// Lab-only stylesheets load after the explicit launch, never with the card page head.
const labStylesheets = new Map<string, Promise<void>>();
const loadStylesheet = (href: string) => {
  const cached = labStylesheets.get(href);
  if (cached) return cached;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  const loaded = new Promise<void>((resolve, reject) => {
    link.onload = () => resolve();
    link.onerror = () => {
      labStylesheets.delete(href);
      link.remove();
      reject(new Error(`GenUI lab stylesheet failed to load: ${href}`));
    };
  });
  labStylesheets.set(href, loaded);
  document.head.append(link);
  return loaded;
};
const loadGenUICardLab = async () => {
  const [lab, labStyles, runtimeStyles] = await Promise.all([
    import('./genui/GenUICardLab'),
    import('../styles/genui-card-lab.css?url'),
    import('../styles/genui-runtime.css?url'),
  ]);
  await Promise.all([loadStylesheet(labStyles.default), loadStylesheet(runtimeStyles.default)]);
  return lab;
};
const LazyGenUICardLab = lazy(loadGenUICardLab);
const purposes: Record<CardPurpose, string> = {
  entity: 'Entity',
  metric: 'Metric',
  action: 'Action',
  selection: 'Selection',
  summary: 'Summary',
  status: 'Status',
  task: 'Task',
  product: 'Product',
  profile: 'Profile',
  pricing: 'Pricing',
  content: 'Content',
  media: 'Media',
  form: 'Form',
  notification: 'Notification',
  insight: 'Insight',
  'ai-response': 'AI response',
  workflow: 'Workflow',
  integration: 'Integration',
  activity: 'Activity',
  empty: 'Empty state',
  widget: 'Widget',
  announcement: 'Announcement',
  help: 'Help',
};
const source = {
  label: 'Local documentation fixture',
  sourceId: 'atlas-card-demo',
  observedAt: '2026-10-14T09:00:00Z',
  mode: 'recorded',
} as const;
const entity: AtlasCardModel = {
  id: 'atlas-studio',
  kind: 'entity',
  eyebrow: 'Team workspace',
  title: 'Atlas Studio',
  description: 'A shared place for plans, decisions and the work that follows.',
  status: { label: 'Active', tone: 'success' },
  media: { kind: 'monogram', label: 'AT' },
  facts: [
    { key: 'tasks', label: 'Open tasks', value: 24, format: 'number' },
    { key: 'members', label: 'Team members', value: 8, format: 'number' },
    { key: 'review', label: 'Next review', value: 'Friday' },
  ],
  primaryAction: { id: 'inspect', label: 'View workspace details', intent: 'inspect' },
  source,
  details: {
    heading: 'Workspace overview',
    body: 'Plans, decisions and a shared note for the next team review.',
  },
};
const metric: AtlasCardModel = {
  id: 'open-work',
  kind: 'metric',
  title: 'Open work',
  metric: {
    value: 24,
    label: 'Open tasks',
    period: 'This week',
    delta: -20,
    comparison: 'Compared with last week',
    meaning: 'positive',
  },
  source,
  primaryAction: { id: 'inspect', label: 'Review open work', intent: 'inspect' },
  details: {
    heading: 'Open work',
    body: '24 tasks remain in this local example, 6 fewer than last week.',
  },
};
const selection: AtlasCardModel = {
  id: 'selection-design',
  kind: 'selection',
  title: 'Design review',
  description: 'Include this review in the local workset.',
  selection: { mode: 'multiple', selected: false, group: 'card-review-workset' },
};
const task: AtlasCardModel = {
  id: 'task-review',
  kind: 'task',
  title: 'Prepare the workspace review',
  description: 'Bring the decision record and the latest team note.',
  task: { lane: 'planned', priority: 'normal', completed: 1, total: 3 },
  primaryAction: { id: 'inspect', label: 'View task details', intent: 'inspect' },
};
const form: AtlasCardModel = {
  id: 'form-review',
  kind: 'form',
  title: 'Review draft',
  description: 'Edit a local draft before saving it in this preview.',
  fields: [{ key: 'title', label: 'Review title', value: 'Workspace review', required: true }],
  primaryAction: { id: 'save', label: 'Save draft locally', intent: 'review' },
};
const lanes = ['planned', 'active', 'done'] as const;
const laneLabels = { planned: 'Planned', active: 'In progress', done: 'Done' };
const states: readonly CardDataState[] = [
  'ready',
  'loading',
  'empty',
  'partial',
  'error',
  'disabled',
];
const stateLabels = {
  ready: 'Ready',
  loading: 'Loading',
  empty: 'Empty',
  partial: 'Partial',
  error: 'Error',
  disabled: 'Disabled',
};
const stateMessages = {
  ready: 'The supplied record is ready to review.',
  loading: 'Loading presentation only; no request is running.',
  empty: 'No record is supplied. Start with a local example.',
  partial: 'This snapshot is incomplete. Review the available information.',
  error: 'The local example could not be prepared. Retry the preview.',
  disabled: 'This action is unavailable in the supplied local context.',
};

class LabBoundary extends Component<
  { children: ReactNode; message: string; retryLabel: string; onRetry: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div role="alert">
        <p>{this.props.message}</p>
        <AtlasButton text={this.props.retryLabel} onClick={this.props.onRetry} />
      </div>
    ) : (
      this.props.children
    );
  }
}

function CardExamples({ documentation }: { documentation: boolean }) {
  const { t } = useI18n();
  const id = useId();
  const profile = useAtlasSize();
  // 'inherit' leaves the corner to the general radius role until a local corner is chosen.
  const [radius, setRadius] = useState<CardRadius | 'inherit'>('inherit');
  const [outlined, setOutlined] = useState(false);
  const [showMedia, setShowMedia] = useState(true);
  const [showActions, setShowActions] = useState(true);
  const [previewState, setPreviewState] = useState<CardDataState>('ready');
  const categories = [...new Set(CARD_RECIPES.map(recipe => recipe.category))];
  const [category, setCategory] = useState('all');
  const [purpose, setPurpose] = useState<CardPurpose | 'all'>('all');
  const [recipeId, setRecipeId] = useState(CARD_RECIPES[0].id);
  const [overrides, setOverrides] = useState<Record<string, Partial<AtlasCardModel>>>({});
  const [selected, setSelected] = useState(false);
  const [taskLane, setTaskLane] = useState<(typeof lanes)[number]>('planned');
  const [draft, setDraft] = useState('Workspace review');
  const [savedDraft, setSavedDraft] = useState<string | null>(null);
  const [draftError, setDraftError] = useState(false);
  const [detail, setDetail] = useState<AtlasCardModel | null>(null);
  const [feedback, setFeedback] = useState('Actions update this preview locally.');
  const [labOpen, setLabOpen] = useState(false);
  const [labLoaded, setLabLoaded] = useState(false);
  const [Lab, setLab] = useState(() => LazyGenUICardLab);
  const [labRevision, setLabRevision] = useState(0);
  const board = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const restoreTaskFocus = useRef(false);
  const [dragging, setDragging] = useState(false);
  const filtered = CARD_RECIPES.filter(
    recipe =>
      (category === 'all' || recipe.category === category) &&
      (purpose === 'all' || recipe.model.kind === purpose),
  );
  const chosen = filtered.find(recipe => recipe.id === recipeId) ?? filtered[0];
  const chosenModel = chosen ? { ...chosen.model, ...overrides[chosen.model.id] } : null;
  const changeModel = (model: AtlasCardModel, patch: Partial<AtlasCardModel>) =>
    setOverrides(current => ({ ...current, [model.id]: { ...current[model.id], ...patch } }));
  const inspect = (_action: unknown, model: AtlasCardModel) => {
    setDetail(model);
    setFeedback(t('Opened local details for {title}.', { title: t(model.title) }));
  };
  const currentTask = { ...task, task: { ...task.task!, lane: taskLane } };
  const currentForm = {
    ...form,
    fields: form.fields!.map(field => ({
      ...field,
      value: draft,
      error: draftError ? t('Enter a review title before saving.') : undefined,
    })),
  };
  useLayoutEffect(() => {
    if (!restoreTaskFocus.current) return;
    restoreTaskFocus.current = false;
    board.current?.querySelector<HTMLButtonElement>('[data-task-grip]')?.focus();
  }, [taskLane]);
  const moveTask = (lane: (typeof lanes)[number]) => {
    if (lane === taskLane) return;
    restoreTaskFocus.current = !!board.current?.contains(document.activeElement);
    setTaskLane(lane);
    setFeedback(t('Task moved to {lane}.', { lane: t(laneLabels[lane]) }));
  };
  const stopDrag = (pointerId: number) => {
    if (pointer.current !== pointerId) return;
    pointer.current = null;
    setDragging(false);
  };
  const playground = (
    <div className="card-foundation-grid">
      <div data-card-main>
        <EntityCard
          model={{
            ...entity,
            media: showMedia ? entity.media : undefined,
            primaryAction: showActions ? entity.primaryAction : undefined,
            details: undefined,
          }}
          onAction={inspect}
          radius={radius === 'inherit' ? undefined : radius}
          outlined={outlined}
        />
      </div>
      <MetricCard model={{ ...metric, details: undefined }} onAction={inspect} />
    </div>
  );
  const sections = [
    {
      id: 'foundations',
      title: 'Entity and Metric',
      description:
        'Start with a record people can recognize or a number they can interpret. Entity and Metric establish the baseline. Task workspaces can combine a table, form, chart and several related actions.',
      content: (
        <ExamplePreview id="card-entity-metric" title={t('Entity and Metric')}>
          {playground}
          <p className="card-feedback" role="status" aria-live="polite">
            {feedback}
          </p>
        </ExamplePreview>
      ),
    },
    {
      id: 'catalog',
      title: 'Purpose and domain catalog',
      description:
        'Choose a purpose or a domain, then inspect one recipe. All recipes share the same serializable model and trusted Atlas renderer.',
      content: (
        <ExamplePreview id="card-purpose-catalog" title={t('Purpose and domain catalog')}>
          <div className="card-recipe-pickers">
            <label htmlFor={`${id}-category`}>
              {t('Recipe category')}
              <Select
                id={`${id}-category`}
                aria-label={t('Recipe category')}
                value={category}
                onChange={value => {
                  setCategory(value);
                  setPurpose('all');
                }}
                options={[
                  { value: 'all', label: t('All categories') },
                  ...categories.map(value => ({ value, label: t(value) })),
                ]}
              />
            </label>
            <label htmlFor={`${id}-purpose`}>
              {t('Card purpose')}
              <Select
                id={`${id}-purpose`}
                aria-label={t('Card purpose')}
                value={purpose}
                onChange={value => {
                  setPurpose(value);
                  setCategory('all');
                }}
                options={[
                  { value: 'all', label: t('All purposes') },
                  ...CARD_PURPOSES.map(value => ({ value, label: t(purposes[value]) })),
                ]}
              />
            </label>
            <label htmlFor={`${id}-recipe`}>
              {t('Domain recipe')}
              <Select
                id={`${id}-recipe`}
                aria-label={t('Domain recipe')}
                value={chosen?.id}
                onChange={setRecipeId}
                options={filtered.map(recipe => ({ value: recipe.id, label: t(recipe.label) }))}
              />
            </label>
          </div>
          {chosenModel && chosen && (
            <div className="card-recipe-preview" data-recipe-preview>
              <p className="card-caption">{t(chosen.description)}</p>
              <PurposeCard
                model={chosenModel}
                onAction={inspect}
                onSelectionChange={(value, model) =>
                  changeModel(model, { selection: { ...model.selection!, selected: value } })
                }
                onMove={(lane, model) => changeModel(model, { task: { ...model.task!, lane } })}
                onFieldChange={(key, value, model) =>
                  changeModel(model, {
                    fields: model.fields?.map(field =>
                      field.key === key ? { ...field, value } : field,
                    ),
                  })
                }
              />
            </div>
          )}
        </ExamplePreview>
      ),
    },
    {
      id: 'interactions',
      title: 'Selection, movement and drafts',
      description:
        'The host owns selection, task lanes and field values. Every action has a visible local result; changing appearance preserves those values.',
      content: (
        <div className="card-interaction-stack">
          <ExamplePreview id="card-selection" title={t('Build a workset')}>
            <div className="card-interaction-example">
              <h4>{t('Build a workset')}</h4>
              <PurposeCard
                model={{ ...selection, selection: { ...selection.selection!, selected } }}
                onSelectionChange={setSelected}
              />
              <p role="status" data-selection-result>
                {t('{count} selected in the local workset.', { count: selected ? 1 : 0 })}
              </p>
            </div>
          </ExamplePreview>
          <ExamplePreview id="card-movement" title={t('Move work between lanes')}>
            <div className="card-interaction-example">
              <h4>{t('Move work between lanes')}</h4>
              <p id={`${id}-move-help`}>
                {t('Drag the task handle to a lane, or use the named move buttons on the task.')}
              </p>
              <div className="card-task-board" ref={board} data-dragging={dragging}>
                {lanes.map(lane => (
                  <section key={lane} data-task-lane={lane} aria-label={t(laneLabels[lane])}>
                    <h5>{t(laneLabels[lane])}</h5>
                    {taskLane === lane ? (
                      <div className="card-task-item">
                        <AtlasButton
                          text={t('Drag task')}
                          fill="text"
                          aria-label={t('Drag review task')}
                          aria-describedby={`${id}-move-help`}
                          data-task-grip
                          onClick={() =>
                            setFeedback(t('Use the move buttons to choose a task lane.'))
                          }
                          onPointerDown={event => {
                            if (event.button !== 0 || pointer.current !== null) return;
                            pointer.current = event.pointerId;
                            event.currentTarget.setPointerCapture(event.pointerId);
                            setDragging(true);
                          }}
                          onPointerUp={event => {
                            if (pointer.current !== event.pointerId) return;
                            const target = document
                              .elementFromPoint(event.clientX, event.clientY)
                              ?.closest<HTMLElement>('[data-task-lane]');
                            if (
                              target &&
                              board.current?.contains(target) &&
                              lanes.includes(target.dataset.taskLane as (typeof lanes)[number])
                            )
                              moveTask(target.dataset.taskLane as (typeof lanes)[number]);
                            if (event.currentTarget.hasPointerCapture(event.pointerId))
                              event.currentTarget.releasePointerCapture(event.pointerId);
                            stopDrag(event.pointerId);
                          }}
                          onPointerCancel={event => stopDrag(event.pointerId)}
                          onLostPointerCapture={event => stopDrag(event.pointerId)}
                        />
                        <PurposeCard model={currentTask} onMove={moveTask} onAction={inspect} />
                      </div>
                    ) : (
                      <p className="card-caption">{t('No task in this lane.')}</p>
                    )}
                  </section>
                ))}
              </div>
            </div>
          </ExamplePreview>
          <ExamplePreview id="card-drafts" title={t('Edit before committing')}>
            <div className="card-interaction-example">
              <h4>{t('Edit before committing')}</h4>
              <PurposeCard
                model={currentForm}
                onFieldChange={(_key, value) => {
                  setDraft(value);
                  setDraftError(false);
                }}
                onAction={() => {
                  if (!draft.trim()) {
                    setDraftError(true);
                    return;
                  }
                  setSavedDraft(draft);
                  setDraftError(false);
                }}
              />
              <p role="status" data-form-result>
                {savedDraft === null
                  ? t('The draft stays in this preview until you save it locally.')
                  : t('Saved draft: {draft}', { draft: savedDraft })}
              </p>
            </div>
          </ExamplePreview>
        </div>
      ),
    },
    {
      id: 'states',
      title: 'Data states',
      description:
        'Ready, loading, empty, partial, error and disabled are explicit model states. Compare one state at a time from Tweaker.',
      content: (
        <ExamplePreview id="card-data-states" title={t('Data states')}>
          <div className="card-state-preview">
            <PurposeCard
              model={{
                ...entity,
                id: 'state-preview',
                state: previewState,
                stateMessage: t(stateMessages[previewState]),
                primaryAction:
                  previewState === 'error'
                    ? { id: 'retry', label: 'Retry local preview', intent: 'retry' }
                    : entity.primaryAction,
              }}
              onAction={(action, model) =>
                action.intent === 'retry' ? setPreviewState('ready') : inspect(action, model)
              }
            />
          </div>
        </ExamplePreview>
      ),
    },
    {
      id: 'genui',
      title: 'GenUI lab',
      description:
        'Validated intents can generate any card purpose or a task workspace; generation mode is independent from purpose. Open the lab to load the optional Ant Design X Hybrid UI, X Cards and X SDK examples.',
      content: (
        <ExamplePreview id="card-genui-lab" title={t('GenUI lab')}>
          <div className="card-genui-intro">
            <p>
              {t(
                'The basic catalog renders without loading the GenUI packages. The lab uses explicit local examples and host-controlled actions.',
              )}
            </p>
            <AtlasButton
              text={t(labOpen ? 'Close GenUI lab' : 'Open GenUI lab')}
              aria-expanded={labOpen}
              aria-controls={`${id}-genui-lab`}
              onClick={() => {
                setLabOpen(value => !value);
                setLabLoaded(true);
              }}
            />
          </div>
          <div
            id={`${id}-genui-lab`}
            className="card-genui-disclosure"
            data-open={labOpen}
            inert={!labOpen}
            aria-hidden={!labOpen}
          >
            <div>
              {labLoaded && (
                <LabBoundary
                  key={labRevision}
                  message={t('The GenUI lab could not load. The card catalog remains available.')}
                  retryLabel={t('Retry GenUI lab')}
                  onRetry={() => {
                    setLab(() => lazy(loadGenUICardLab));
                    setLabRevision(value => value + 1);
                  }}
                >
                  <Suspense fallback={<p role="status">{t('Loading the optional GenUI lab…')}</p>}>
                    <Lab />
                  </Suspense>
                </LabBoundary>
              )}
            </div>
          </div>
        </ExamplePreview>
      ),
    },
  ];
  return (
    <div className="card-catalog" data-card-preview data-card-profile={profile}>
      <TweakerSettings title={t('Card')}>
        <section className="example-block">
          <h3 className="variant-heading">{t('Appearance options')}</h3>
          <label className="playground-control" htmlFor={`${id}-surface`}>
            {t('Card surface')}
            <Select
              id={`${id}-surface`}
              value={outlined ? 'outlined' : 'borderless'}
              onChange={value => setOutlined(value === 'outlined')}
              options={[
                { value: 'borderless', label: t('Borderless') },
                { value: 'outlined', label: t('Outlined') },
              ]}
            />
          </label>
          <label className="playground-control" htmlFor={`${id}-radius`}>
            {t('Corner')}
            <Select
              id={`${id}-radius`}
              value={radius}
              onChange={setRadius}
              options={[
                { value: 'inherit', label: t('Use general radius') },
                { value: '0', label: t('Square') },
                { value: '3', label: t('Soft') },
                { value: '5', label: t('Rounded') },
                { value: 'pill', label: t('Pill') },
              ]}
            />
          </label>
          <label className="control-row">
            <Switch
              checked={showMedia}
              onChange={setShowMedia}
              aria-label={t('Show identity media')}
            />
            {t('Show identity media')}
          </label>
          <label className="control-row">
            <Switch
              checked={showActions}
              onChange={setShowActions}
              aria-label={t('Show actions')}
            />
            {t('Show actions')}
          </label>
          <label className="playground-control" htmlFor={`${id}-state`}>
            {t('Data state')}
            <Select
              id={`${id}-state`}
              value={previewState}
              onChange={setPreviewState}
              options={states.map(value => ({ value, label: t(stateLabels[value]) }))}
            />
          </label>
        </section>
      </TweakerSettings>
      {documentation ? (
        <>
          <nav aria-label={t('Card examples')}>
            <ul className="card-navigation">
              {sections.map(section => (
                <li key={section.id}>
                  <a href={`#card-${section.id}`}>{t(section.title)}</a>
                </li>
              ))}
            </ul>
          </nav>
          {sections.map(section => (
            <section
              className="card-section"
              id={`card-${section.id}`}
              key={section.id}
              aria-labelledby={`${id}-${section.id}-title`}
              {...(section.id === 'catalog'
                ? {
                    'data-purpose-count': CARD_PURPOSES.length,
                    'data-recipe-count': CARD_RECIPES.length,
                  }
                : {})}
            >
              <header>
                <h3 id={`${id}-${section.id}-title`}>{t(section.title)}</h3>
                <p>{t(section.description)}</p>
              </header>
              {section.content}
            </section>
          ))}
        </>
      ) : (
        playground
      )}
      <Modal
        open={detail !== null}
        title={detail ? t(detail.details?.heading ?? detail.title) : undefined}
        onCancel={() => setDetail(null)}
        footer={<AtlasButton text={t('Done')} onClick={() => setDetail(null)} />}
      >
        <div className="card-detail-content" data-card-details-id={detail?.id}>
          {detail && (
            <>
              <h4>{t(detail.title)}</h4>
              <p>
                {t(
                  detail.details?.body ??
                    detail.description ??
                    'The supplied model is available for local inspection.',
                )}
              </p>
              <dl className="card-details-facts">
                <div>
                  <dt>{t('Record identity')}</dt>
                  <dd>{detail.id}</dd>
                </div>
                {detail.facts?.map(fact => (
                  <div key={fact.key}>
                    <dt>{t(fact.label)}</dt>
                    <dd>
                      {fact.value === null
                        ? t('Not set')
                        : typeof fact.value === 'boolean'
                          ? t(fact.value ? 'Yes' : 'No')
                          : t(String(fact.value))}
                      {fact.currency ? ` ${fact.currency}` : ''}
                    </dd>
                  </div>
                ))}
                {detail.fields?.map(field => (
                  <div key={field.key}>
                    <dt>{t(field.label)}</dt>
                    <dd>{field.value || t('Not set')}</dd>
                  </div>
                ))}
              </dl>
              <p>{t('These details come from the selected local model.')}</p>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
export default function CardDemo({ documentation = false }: { documentation?: boolean } = {}) {
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined}>
      <CardExamples documentation={documentation} />
    </AtlasProvider>
  );
}
