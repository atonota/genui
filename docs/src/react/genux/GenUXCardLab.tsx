import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
} from 'react';
import { Select } from 'antd';
import Bubble from '@ant-design/x/es/bubble';
import type { BubbleItemType, RoleType } from '@ant-design/x/es/bubble/interface';
import Prompts from '@ant-design/x/es/prompts';
import Sender from '@ant-design/x/es/sender';
import type { SenderProps, SenderRef } from '@ant-design/x/es/sender/interface';
import XProvider from '@ant-design/x/es/x-provider';
import Input from '../GenUXInput';
import { useXChat, useXConversations } from '@ant-design/x-sdk';
import { createGenUXRuntime } from '../../genux/runtime';
import {
  createDefinitionStore,
  createRecordedQueryDefinition,
  recordedQuerySource,
  renderCardDefinition,
  type CardDefinition,
} from '../../genux/definitions';
import type { GenUXAction, GenUXRuntime, GenUXSnapshot } from '../../genux/contracts';
import {
  createActionAuthorization,
  createAuthorizedActionHandler,
  type TrustedReviewBinding,
} from '../../genux/actions/authorization';
import type { HybridSelectionContext } from '../../genux/hybrid-context';
import {
  GenUXChatProvider,
  createGenUXTransport,
  type GenUXChatMessage,
  type GenUXTransport,
  type RecordedScenario,
  type GenUXRequestInput,
  type GenUXStreamChunk,
} from '../../genux/sdk';
import GenUXButton from '../GenUXButton';
import { useI18n } from '../useI18n';
import GenUXSurface from './GenUXSurface';
import HybridQuickBar from './HybridQuickBar';
import type HybridActionReviewView from './HybridActionReview';
// Lab-only styles are linked by the CardDemo launch loader, not imported as side effects.

interface SessionOwner {
  key: string;
  number: number;
  runtime: GenUXRuntime;
  transport: GenUXTransport;
  provider: GenUXChatProvider;
  clearMessages: () => void;
}
const scenarioLabels: Record<RecordedScenario, string> = {
  overview: 'Workspace cards',
  refresh: 'Update one metric',
  slow: 'Slow update · keep editing',
  recreate: 'Delete and recreate surface',
  failure: 'Recorded request failure',
  malformed: 'Malformed command frame',
  timeout: 'Recorded timeout',
  json: 'Recorded JSON response',
  'task-workspace': 'Orders · query to review',
};
const statusLabels = {
  idle: 'Ready for a recorded request',
  receiving: 'Receiving recorded stream',
  success: 'Recorded stream complete',
  error: 'Recorded request failed',
  aborted: 'Recorded request cancelled',
} as const;

type HybridMode = 'do' | 'balanced' | 'chat';
/** Presentation profiles only; switching never sends, cancels or restores a request. */
const hybridModes: readonly { value: HybridMode; label: string }[] = [
  { value: 'do', label: 'Do' },
  { value: 'balanced', label: 'Do + Chat' },
  { value: 'chat', label: 'Chat' },
];
const hybridUISource = 'https://x.ant.design/docs/spec/hybrid-ui-design-cn/';
const prepareOrderReviewIntent =
  'Prepare an order review: show recorded orders, group them by customer and draft a review note.';
const bubbleRoles: RoleType = {
  ai: { placement: 'start', classNames: { content: 'genux-bubble-content' } },
  user: {
    placement: 'end',
    classNames: { content: 'genux-bubble-content genux-bubble-content-user' },
  },
};
/** Sender has no id prop, so its help text id reaches the input adapter by context. */
const HybridIntentHelp = createContext<string | undefined>(undefined);

/** Stable Sender input: native props and the React 19 ref pass through to the GenUX field. */
function HybridSenderInput(props: ComponentProps<typeof Input.TextArea>) {
  const { t } = useI18n();
  const describedBy = useContext(HybridIntentHelp);
  return (
    <Input.TextArea
      {...props}
      aria-label={t('Recorded request intent')}
      aria-describedby={describedBy}
      maxLength={4096}
    />
  );
}
const hybridSenderComponents: SenderProps['components'] = { input: HybridSenderInput };
const selectedRecordsIntent =
  'Review selected records: {records}. Scope {scope}, revision {revision}.';
const reviewResultMessages = {
  authorized:
    'Reviewed action authorized for this local session only. Nothing was sent or committed.',
  denied: 'The reviewed action was not authorized. Nothing was sent or committed.',
} as const;
/** Trusted local allowlist; a reviewed approval never authorizes a writing intent here. */
const localReviewIntents: ReadonlySet<string> = new Set(['inspect', 'open', 'review']);
type ReviewDescriptor = Pick<
  GenUXAction,
  'surfaceId' | 'componentId' | 'actionId' | 'baseRevision'
>;
type ReviewProps = ComponentProps<typeof HybridActionReviewView>;

/** First available registered review action on a complete published snapshot. */
function findReviewDescriptor(snapshot: GenUXSnapshot): ReviewDescriptor | null {
  if (snapshot.status !== 'success') return null;
  for (const surface of snapshot.surfaces) {
    const fields = [...Object.values(surface.models), ...Object.values(surface.blocks)].flatMap(
      item => item.fields ?? [],
    );
    if (fields.some(field => field.error || (field.required && !field.value.trim()))) continue;
    for (const node of surface.components) {
      const model = Object.hasOwn(surface.models, node.id) ? surface.models[node.id] : undefined;
      const block = Object.hasOwn(surface.blocks, node.id) ? surface.blocks[node.id] : undefined;
      const action = (
        model ? [model.primaryAction, ...(model.secondaryActions ?? [])] : [block?.action]
      ).find(item => item?.intent === 'review');
      if (
        action &&
        !action.disabled &&
        block?.native?.disabled !== true &&
        block?.native?.readOnly !== true &&
        !['loading', 'disabled', 'error'].includes(model?.state ?? 'ready')
      )
        return {
          surfaceId: surface.id,
          componentId: node.id,
          actionId: action.id,
          baseRevision: snapshot.revision,
        };
    }
  }
  return null;
}

/** A failed chunk load keeps the session usable: report it and close locally. */
function HybridActionReviewUnavailable({ onCancel }: ReviewProps) {
  const { t } = useI18n();
  return (
    <div role="alert">
      <p>{t('This control could not be loaded.')}</p>
      <GenUXButton fill="text" text={t('Close')} onClick={onCancel} />
    </div>
  );
}
/** Loaded only after the explicit Inspect local changes trigger. */
const HybridActionReview = lazy(() =>
  import('./HybridActionReview').catch(() => ({ default: HybridActionReviewUnavailable })),
);

function ReusableQueryLab() {
  const { t, locale } = useI18n();
  const id = useId();
  const [kind, setKind] = useState<'orders' | 'sales'>('orders');
  const [store, setStore] = useState<ReturnType<typeof createDefinitionStore> | null>(null);
  const [definitions, setDefinitions] = useState<CardDefinition[]>([]);
  const [selected, setSelected] = useState<string>();
  const [message, setMessage] = useState(
    'Save a query definition, then run its registered query again.',
  );
  const [memoryOnly, setMemoryOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  const [runtime, setRuntime] = useState(() =>
    createGenUXRuntime({ scopeId: `definitions-${globalThis.crypto.randomUUID()}` }),
  );
  useEffect(() => {
    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      setMemoryOnly(true);
    }
    const local = createDefinitionStore({
      audience: 'panel',
      scopeId: 'GenUXReusableQueryCards',
      storage,
    });
    setStore(local);
    setDefinitions(local.list());
    setSelected(local.list()[0]?.id);
    if (local.getError()) setMessage(local.getError()!);
    return () => {
      const active = request.current;
      request.current = null;
      active?.abort();
    };
  }, []);
  const save = () => {
    if (!store) return;
    try {
      const definition = store.save(createRecordedQueryDefinition(kind));
      setDefinitions(store.list());
      setSelected(definition.id);
      setMessage(
        store.getError() ??
          'Query definition saved locally. Record results and current drafts were not stored.',
      );
    } catch {
      setMessage('The query definition could not be saved.');
    }
  };
  const render = async () => {
    const definition = definitions.find(item => item.id === selected);
    if (!definition) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const target = runtime.getSnapshot().surfaces.some(surface => surface.id === definition.id)
        ? runtime
        : createGenUXRuntime({ scopeId: `definitions-${globalThis.crypto.randomUUID()}` });
      await renderCardDefinition(
        target,
        definition,
        recordedQuerySource(),
        `definition-${globalThis.crypto.randomUUID()}`,
        controller.signal,
      );
      if (request.current === controller) {
        setRuntime(target);
        setMessage(
          'Saved query definition rendered with fresh recorded results. No model request was made.',
        );
      }
    } catch {
      if (request.current === controller)
        setMessage(
          'The saved query could not be rendered. The previous valid view remains available.',
        );
    } finally {
      if (request.current === controller) setLoading(false);
    }
  };
  return (
    <section className="genux-query-lab" aria-labelledby={`${id}-title`} data-genux-query-lab>
      <header className="genux-lab-intro">
        <h4 id={`${id}-title`}>{t('Reusable query Card')}</h4>
        <p>
          {t(
            'Save the chosen query Card structure and its registered query binding. This is separate from the current stream, selected records and review draft.',
          )}
        </p>
      </header>
      <div className="genux-query-controls">
        <label htmlFor={`${id}-kind`}>{t('Query definition to save')}</label>
        <Select
          id={`${id}-kind`}
          aria-label={t('Query definition to save')}
          value={kind}
          onChange={setKind}
          options={[
            { value: 'orders', label: t('Delayed orders query') },
            { value: 'sales', label: t('Monthly sales query') },
          ]}
        />
        <GenUXButton
          fill="outline"
          disabled={!store}
          text={t('Save query definition')}
          onClick={save}
        />
        <label htmlFor={`${id}-saved`}>{t('Saved query Card')}</label>
        <Select
          id={`${id}-saved`}
          aria-label={t('Saved query Card')}
          value={selected}
          onChange={setSelected}
          disabled={!definitions.length || loading}
          placeholder={t('No saved query Cards yet')}
          options={definitions.map(definition => ({
            value: definition.id,
            label: definition.title[locale],
          }))}
        />
        <GenUXButton
          fill="solid"
          disabled={!selected || loading}
          text={t('Render saved query')}
          onClick={render}
        />
      </div>
      <p role="status" aria-live="polite">
        {t(message)}
      </p>
      {memoryOnly && (
        <p>{t('Browser storage is unavailable. Definitions remain in memory for this page.')}</p>
      )}
      <GenUXSurface runtime={runtime} />
    </section>
  );
}

function SessionLab({ owner, active }: { owner: SessionOwner; active: boolean }) {
  const { t } = useI18n();
  const id = useId();
  const [scenario, setScenario] = useState<RecordedScenario>('overview');
  const [intent, setIntent] = useState(
    'Show orders, group by customer, and prepare a review draft.',
  );
  const [showEvidence, setShowEvidence] = useState(false);
  const [mode, setMode] = useState<HybridMode>('balanced');
  const sender = useRef<SenderRef>(null);
  const [review, setReview] = useState<ReviewDescriptor | null>(null);
  const [reviewResult, setReviewResult] = useState<{
    kind: keyof typeof reviewResultMessages;
    revision: number;
  } | null>(null);
  const host = useSyncExternalStore(
    owner.transport.subscribe,
    owner.transport.getSnapshot,
    owner.transport.getSnapshot,
  );
  const snapshot = useSyncExternalStore(
    owner.runtime.subscribe,
    owner.runtime.getSnapshot,
    owner.runtime.getSnapshot,
  );
  const reviewTarget = useMemo(() => findReviewDescriptor(snapshot), [snapshot]);
  const chat = useXChat<GenUXChatMessage, GenUXChatMessage, GenUXRequestInput, GenUXStreamChunk>({
    provider: owner.provider,
    conversationKey: owner.key,
    requestPlaceholder: { role: 'assistant', label: 'Recorded stream pending.', frames: 0 },
    requestFallback: {
      role: 'assistant',
      label: 'Recorded request stopped. Last valid cards are kept.',
      frames: 0,
    },
  });
  const chatRef = useRef(chat);
  chatRef.current = chat;
  useEffect(() => {
    if (!active) {
      owner.transport.cancel();
      setReview(null);
    }
  }, [active, owner]);
  useEffect(() => {
    owner.clearMessages = () => {
      chatRef.current.setMessages([]);
    };
    return () => {
      owner.transport.dispose();
      // Await native abort callbacks before clearing the reusable upstream key.
      void Promise.resolve(owner.provider.request.asyncHandler).finally(() =>
        owner.clearMessages(),
      );
    };
  }, [owner]);
  useEffect(() => {
    if (chat.messages.length > 24) chat.setMessages(chat.messages.slice(-24));
  }, [chat.messages, chat.setMessages]);
  if (!active) return null;
  const busy = host.status === 'receiving';
  const lastAssistant = [...chat.messages]
    .reverse()
    .find(item => item.message.role === 'assistant');
  const run = (reload = false) => {
    const input = owner.transport.prepare(scenario, intent);
    if (reload && lastAssistant) chat.onReload(lastAssistant.id, input);
    else chat.onRequest(input);
  };
  const requesting = busy || chat.isDefaultMessagesRequesting;
  // Native Enter submit dispatches the same run as the GenUX action.
  const submit = () => {
    if (!requesting) run();
  };
  // Prepares the scenario and intent only; running stays an explicit action.
  const prepareOrderReview = () => {
    setScenario('task-workspace');
    setIntent(t(prepareOrderReviewIntent));
    sender.current?.focus();
  };
  // Prepares a request from the selected records only; running stays an explicit action.
  const prepareSelection = (context: HybridSelectionContext) => {
    setScenario('task-workspace');
    setIntent(
      t(selectedRecordsIntent, {
        records: context.selections.flatMap(item => item.recordIds).join(', '),
        scope: context.scopeId,
        revision: context.revision,
      }),
    );
    sender.current?.focus();
  };
  const openReview = () => {
    if (!reviewTarget || busy) return;
    setReviewResult(null);
    setReview(reviewTarget);
  };
  const closeReview = () => setReview(null);
  // Authorizes the exact human-approved binding for a local status only: no dispatch, send or commit.
  const approveReview = (binding: TrustedReviewBinding) => {
    const current = owner.runtime.getSnapshot();
    const surface = current.surfaces.find(item => item.id === binding.surfaceId);
    const model = !surface
      ? undefined
      : Object.hasOwn(surface.models, binding.componentId)
        ? surface.models[binding.componentId]
        : Object.hasOwn(surface.blocks, binding.componentId)
          ? surface.blocks[binding.componentId]
          : undefined;
    const result = { authorized: false };
    if (model)
      try {
        createAuthorizedActionHandler({
          authorization: createActionAuthorization({
            runtime: owner.runtime,
            authorize: context => localReviewIntents.has(context.intent),
            requiresReview: () => true,
            getReview: () => binding,
          }),
          execute: () => {
            result.authorized = true;
          },
        })(
          {
            surfaceId: binding.surfaceId,
            componentId: binding.componentId,
            actionId: binding.actionId,
            baseRevision: current.revision,
            idempotencyKey: `review-${globalThis.crypto.randomUUID()}`,
          },
          model,
        );
      } catch {
        result.authorized = false;
      }
    setReviewResult({
      kind: result.authorized ? 'authorized' : 'denied',
      revision: current.revision,
    });
    setReview(null);
  };
  // A result describes one revision; a later change retires it.
  const shownReview =
    reviewResult && reviewResult.revision === snapshot.revision ? reviewResult.kind : null;
  const bubbleItems: BubbleItemType[] = chat.messages.map(item => ({
    key: item.id,
    role: item.message.role === 'user' ? 'user' : 'ai',
    content: t(item.message.label),
    status: item.status,
    footer: <code>{item.status}</code>,
  }));
  return (
    <div className="genux-session" data-genux-session={owner.key} data-hybrid-mode={mode}>
      <div className="genux-hybrid-bar">
        <dl className="genux-scope">
          <div>
            <dt>{t('Scope')}</dt>
            <dd>{t('Local demo workspace')}</dd>
          </div>
          <div>
            <dt>{t('Session')}</dt>
            <dd>{t('Session {number}', { number: owner.number })}</dd>
          </div>
          <div>
            <dt>{t('Source')}</dt>
            <dd>{t('Recorded local fixture · no model or server')}</dd>
          </div>
          <div>
            <dt>{t('Request identifier')}</dt>
            <dd>{host.requestId ?? t('No request yet')}</dd>
          </div>
          <div>
            <dt>{t('Current revision')}</dt>
            <dd>{snapshot.revision}</dd>
          </div>
        </dl>
        <div className="genux-actions" role="group" aria-label={t('Hybrid UI mode')}>
          {hybridModes.map(item => (
            <GenUXButton
              key={item.value}
              fill={mode === item.value ? 'solid' : 'outline'}
              aria-pressed={mode === item.value}
              onClick={() => setMode(item.value)}
              text={t(item.label)}
            />
          ))}
        </div>
      </div>
      <div className="genux-hybrid-layout">
        <section className="genux-hybrid-chat" aria-label={t('Conversation')}>
          <Prompts
            className="genux-prompts"
            classNames={{ item: 'genux-prompt-item' }}
            title={t('Suggested local request')}
            items={[
              {
                key: 'prepare-order-review',
                label: (
                  <GenUXButton
                    fill="outline"
                    disabled={requesting}
                    onClick={prepareOrderReview}
                    text={t('Prepare order review')}
                  />
                ),
              },
            ]}
          />
          <Bubble.List
            className="genux-bubble-list"
            items={bubbleItems}
            role={bubbleRoles}
            styles={{ scroll: { maxBlockSize: 'var(--genux-conversation-block)' } }}
          />
          {!bubbleItems.length && (
            <p className="genux-hint">
              {t('No SDK messages yet. Run the recorded stream to add the first one.')}
            </p>
          )}
          <div className="genux-run-strip">
            <span className="genux-field-label">{t('Recorded request intent')}</span>
            <HybridIntentHelp.Provider value={`${id}-intent-help`}>
              <Sender
                ref={sender}
                className="genux-sender"
                classNames={{ content: 'genux-sender-content' }}
                components={hybridSenderComponents}
                value={intent}
                loading={busy}
                suffix={false}
                onChange={value => setIntent(value)}
                onSubmit={submit}
                onCancel={() => owner.transport.cancel()}
              />
            </HybridIntentHelp.Provider>
            <p id={`${id}-intent-help`}>
              {t(
                'This text is recorded with the request. The selected scenario determines the response; no language model interprets it.',
              )}{' '}
              {t('Enter runs the recorded stream; Shift+Enter adds a new line.')}
            </p>
            <label htmlFor={`${id}-scenario`}>{t('Recorded scenario')}</label>
            <Select
              id={`${id}-scenario`}
              aria-label={t('Recorded scenario')}
              value={scenario}
              disabled={busy}
              onChange={setScenario}
              options={Object.entries(scenarioLabels).map(([value, label]) => ({
                value,
                label: t(label),
              }))}
            />
            <div className="genux-actions">
              <GenUXButton
                fill="solid"
                disabled={requesting}
                onClick={() => run()}
                text={t('Run recorded stream')}
              />
              <GenUXButton
                fill="outline"
                disabled={!busy}
                onClick={() => owner.transport.cancel()}
                text={t('Cancel request')}
              />
              <GenUXButton
                fill="text"
                disabled={busy || host.status === 'idle'}
                onClick={() => run()}
                text={t('Retry locally')}
              />
              <GenUXButton
                fill="text"
                disabled={busy || !lastAssistant}
                onClick={() => run(true)}
                text={t('Reload response')}
              />
            </div>
          </div>
        </section>
        <section className="genux-hybrid-canvas" aria-label={t('Work canvas')}>
          <p className="genux-hint">
            {t('The latest valid cards stay on this canvas while a recorded request runs.')}
          </p>
          <div
            className="genux-run-result"
            role="status"
            aria-live="polite"
            data-genux-run-status={host.status}
          >
            <p>{t(statusLabels[host.status])}</p>
            <p>
              {t('{received} frames received · {accepted} accepted', {
                received: host.receivedFrames,
                accepted: host.acceptedFrames,
              })}
            </p>
            {snapshot.actionResult && <p>{t(snapshot.actionResult)}</p>}
          </div>
          {host.error && (
            <p role="alert" data-genux-transport-error>
              {t(host.error)}
            </p>
          )}
          {snapshot.error && snapshot.error !== host.error && (
            <p role="alert" data-genux-local-error>
              {t(snapshot.error)}
            </p>
          )}
          <HybridQuickBar runtime={owner.runtime} onPrepare={prepareSelection} />
          <GenUXSurface runtime={owner.runtime} />
          <div className="genux-actions">
            <GenUXButton
              fill="outline"
              disabled={busy || !reviewTarget}
              onClick={openReview}
              text={t('Inspect local changes')}
            />
          </div>
          <p className="genux-hint">
            {t(
              'Opens a before and after review of the current Card. Approval stays in this local session; nothing is sent or committed.',
            )}
          </p>
          <p role="status" aria-live="polite" data-genux-review-result={shownReview ?? undefined}>
            {shownReview ? t(reviewResultMessages[shownReview]) : null}
          </p>
          {review && (
            <Suspense fallback={<p role="status">{t('Loading control…')}</p>}>
              <HybridActionReview
                runtime={owner.runtime}
                descriptor={review}
                onApprove={approveReview}
                onCancel={closeReview}
              />
            </Suspense>
          )}
          <div className="genux-history">
            <label htmlFor={`${id}-revision`}>{t('Local revision')}</label>
            <Select
              id={`${id}-revision`}
              aria-label={t('Local revision')}
              disabled={busy || !snapshot.history.length}
              value={snapshot.history.includes(snapshot.revision) ? snapshot.revision : undefined}
              placeholder={t('Choose a local revision')}
              onChange={(revision: number) => owner.runtime.restoreRevision(revision)}
              options={snapshot.history.map(value => ({
                value,
                label: t('Revision {revision}', { revision: value }),
              }))}
            />
            <p>
              {t('Restore changes only this local session. It does not undo a server operation.')}
            </p>
          </div>
        </section>
      </div>
      <div className="genux-evidence">
        <GenUXButton
          fill="text"
          text={t('Request evidence and local history')}
          aria-controls={`${id}-evidence`}
          aria-expanded={showEvidence}
          onClick={() => setShowEvidence(value => !value)}
        />
        <div
          id={`${id}-evidence`}
          className="genux-evidence-panel"
          data-open={showEvidence}
          aria-hidden={!showEvidence}
          inert={!showEvidence}
        >
          <div className="genux-evidence-content">
            <dl>
              <div>
                <dt>{t('Transport')}</dt>
                <dd>{t('Recorded local Response / ReadableStream')}</dd>
              </div>
              <div>
                <dt>{t('Request identifier')}</dt>
                <dd>{host.requestId ?? t('No request yet')}</dd>
              </div>
              <div>
                <dt>{t('Current revision')}</dt>
                <dd>{snapshot.revision}</dd>
              </div>
              <div>
                <dt>{t('Native SDK messages')}</dt>
                <dd>{chat.messages.length}</dd>
              </div>
            </dl>
            <ol className="genux-message-list" aria-label={t('Recent native SDK messages')}>
              {chat.messages.slice(-4).map(item => (
                <li key={item.id}>
                  <span>{t(item.message.label)}</span>
                  <code>{item.status}</code>
                </li>
              ))}
            </ol>
            <ol className="genux-event-list" aria-label={t('Local runtime events')}>
              {snapshot.events.slice(-8).map(event => (
                <li key={event.id}>
                  <span>{t(event.message)}</span>
                  <code>
                    {event.kind} · {event.revision}
                  </code>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClientLab() {
  const { t } = useI18n();
  const nameId = useId();
  const [scope] = useState(() => `genux-lab-${globalThis.crypto.randomUUID()}`);
  const [removing, setRemoving] = useState(false);
  const generations = useRef([0, 1, 0, 0, 0]);
  const makeOwner = (number: number, generation: number): SessionOwner => {
    const key = `${scope}-session-${number}`;
    const scopeId = `${key}-g${generation}`;
    const runtime = createGenUXRuntime({ scopeId });
    const transport = createGenUXTransport({ scopeId, runtime });
    return {
      key,
      number,
      runtime,
      transport,
      provider: new GenUXChatProvider(transport),
      clearMessages() {},
    };
  };
  const [owners, setOwners] = useState<SessionOwner[]>(() => [makeOwner(1, 1)]);
  const sessions = useXConversations({
    defaultConversations: [{ key: owners[0]!.key }],
    defaultActiveConversationKey: owners[0]!.key,
  });
  const activate = (key: string) => {
    owners.find(owner => owner.key === sessions.activeConversationKey)?.transport.cancel();
    sessions.setActiveConversationKey(key);
  };
  const addSession = () => {
    const slot = [1, 2, 3, 4].find(number => !owners.some(owner => owner.number === number));
    if (!slot) return;
    const owner = makeOwner(slot, ++generations.current[slot]!);
    setOwners(current => [...current, owner]);
    sessions.addConversation({ key: owner.key });
    activate(owner.key);
  };
  const removeSession = async () => {
    const current = owners.find(owner => owner.key === sessions.activeConversationKey);
    if (!current) return;
    setRemoving(true);
    current.transport.cancel();
    await current.provider.request.asyncHandler;
    current.clearMessages();
    sessions.removeConversation(current.key);
    setOwners(values => values.filter(owner => owner.key !== current.key));
    sessions.setActiveConversationKey(owners.find(owner => owner.key !== current.key)?.key ?? '');
    setRemoving(false);
  };
  const currentConversation = sessions.getConversation(sessions.activeConversationKey);
  return (
    <div className="genux-lab" data-genux-lab>
      <header className="genux-lab-intro">
        <h4>{t('Cards from a recorded stream')}</h4>
        <p>
          {t(
            'A real Ant Design X SDK pipeline renders validated GenUX cards. This demonstration uses local recorded data; no model or server is connected.',
          )}
        </p>
        <p>{t('Try Slow update, edit the review note, then watch only the metric change.')}</p>
        <p>
          {t(
            'Hybrid UI combines direct work on cards with a conversation. Do leads with quick commands and the card canvas, Do + Chat links both panes, and Chat leads with the conversation while the canvas stays available. Changing the mode never sends, cancels or restores a request.',
          )}{' '}
          <a href={hybridUISource}>{t('Ant Design X Hybrid UI guidance')}</a>
        </p>
      </header>
      <div className="genux-session-strip">
        <nav aria-label={t('Local card sessions')}>
          {sessions.conversations.map(session => {
            const owner = owners.find(item => item.key === session.key);
            return owner ? (
              <GenUXButton
                key={session.key}
                fill={session.key === sessions.activeConversationKey ? 'solid' : 'text'}
                aria-current={session.key === sessions.activeConversationKey ? 'true' : undefined}
                onClick={() => activate(session.key)}
                text={
                  typeof session.label === 'string' && session.label.trim()
                    ? session.label
                    : t('Session {number}', { number: owner.number })
                }
              />
            ) : null;
          })}
        </nav>
        <div className="genux-actions">
          <GenUXButton
            fill="outline"
            disabled={removing || owners.length >= 4}
            onClick={addSession}
            text={t('Add session')}
          />
          <GenUXButton
            fill="text"
            disabled={removing || !owners.length}
            onClick={removeSession}
            text={t('Remove active session')}
          />
        </div>
      </div>
      {currentConversation && (
        <div className="genux-session-name">
          <label htmlFor={nameId}>{t('Session name')}</label>
          <Input
            id={nameId}
            value={typeof currentConversation.label === 'string' ? currentConversation.label : ''}
            maxLength={60}
            placeholder={t('Name this local session')}
            onChange={event =>
              sessions.setConversation(currentConversation.key, {
                ...currentConversation,
                label: event.currentTarget.value,
              })
            }
          />
        </div>
      )}
      {!owners.length && <p>{t('Add a session to explore recorded cards.')}</p>}
      {owners.map(owner => (
        <SessionLab
          key={`${owner.key}:${generations.current[owner.number]}`}
          owner={owner}
          active={owner.key === sessions.activeConversationKey}
        />
      ))}
      <ReusableQueryLab />
      <p className="genux-local-note">
        {t(
          'Up to four local sessions and 24 SDK messages per session. Removing a session clears its messages; upstream SDK store keys are reused rather than claimed to be fully reclaimed.',
        )}
      </p>
    </div>
  );
}

/** SDK hooks have process-global stores: keep them out of shared server rendering. */
export default function GenUXCardLab() {
  const { t } = useI18n();
  const [client, setClient] = useState(false);
  useEffect(() => setClient(true), []);
  // XProvider adds X component config and inherits the surrounding GenUX AntD theme.
  return client ? (
    <XProvider>
      <ClientLab />
    </XProvider>
  ) : (
    <p>{t('The recorded card lab becomes available after the page loads.')}</p>
  );
}
