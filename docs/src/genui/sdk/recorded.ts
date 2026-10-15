import type { AtlasCardModel } from '../../data/card-model';
import { ATLAS_CARD_CATALOG_ID } from '../contracts';

export const RECORDED_SCENARIOS = [
  'overview',
  'refresh',
  'slow',
  'recreate',
  'failure',
  'malformed',
  'timeout',
  'json',
  'task-workspace',
] as const;
export type RecordedScenario = (typeof RECORDED_SCENARIOS)[number];
export interface GenUIRequestInput {
  scenario: RecordedScenario;
  requestId: string;
  hasSurface: boolean;
  resetSurface?: boolean;
  intent?: string;
}
export interface GenUIEnvelope {
  sequence: number;
  commands: readonly unknown[];
}
const surfaceId = 'studio';
const source = {
  label: 'Recorded workspace fixture',
  sourceId: 'atlas-local-fixture-v1',
  observedAt: '2026-10-14T08:00:00Z',
  mode: 'recorded' as const,
};
const entity: AtlasCardModel = {
  id: 'studio-entity',
  kind: 'entity',
  title: 'Atlas Studio',
  description: 'A local workspace for a team review.',
  media: { kind: 'monogram', label: 'AT' },
  status: { label: 'Ready for review', tone: 'success' },
  facts: [
    { key: 'members', label: 'Team members', value: 8 },
    { key: 'tasks', label: 'Open tasks', value: 24 },
  ],
  primaryAction: { id: 'review-studio', label: 'Review workspace', intent: 'review' },
  source,
};
const metric = (value = 24): AtlasCardModel => ({
  id: 'studio-metric',
  kind: 'metric',
  title: 'Open tasks',
  metric: {
    value,
    label: 'Open tasks',
    period: 'Recorded review',
    delta: -3,
    comparison: 'Previous review',
    meaning: 'positive',
  },
  source,
});
const form: AtlasCardModel = {
  id: 'studio-note',
  kind: 'form',
  title: 'Review note',
  description: 'Keep your draft while the recorded metric changes.',
  fields: [
    { key: 'note', label: 'Workspace note', value: 'Prepare the next review.', required: true },
  ],
  primaryAction: { id: 'review-note', label: 'Review local note', intent: 'review' },
  source,
};
const initialCommands = () => [
  { version: 'v0.9', createSurface: { surfaceId, catalogId: ATLAS_CARD_CATALOG_ID } },
  {
    version: 'v0.9',
    updateComponents: {
      surfaceId,
      components: [
        {
          id: 'root',
          component: 'AtlasStack',
          direction: 'grid',
          children: ['entity', 'metric', 'note'],
        },
        { id: 'entity', component: 'AtlasEntityCard', model: { path: '/state/entity' } },
        { id: 'metric', component: 'AtlasMetricCard', model: { path: '/state/metric' } },
        { id: 'note', component: 'AtlasPurposeCard', model: { path: '/state/note' } },
      ],
    },
  },
  {
    version: 'v0.9',
    updateDataModel: { surfaceId, path: '/state', value: { entity, metric: metric(), note: form } },
  },
];
const refreshCommands = () => [
  { version: 'v0.9', updateDataModel: { surfaceId, path: '/state/metric', value: metric(21) } },
];

const taskRows = [
  {
    id: 'order-one',
    reference: 'SO-1041',
    customer: 'Aster Workshop',
    status: 'Ready',
    amount: 1240,
  },
  { id: 'order-two', reference: 'SO-1042', customer: 'Birch Studio', status: 'Draft', amount: 780 },
  {
    id: 'order-three',
    reference: 'SO-1043',
    customer: 'Aster Workshop',
    status: 'Ready',
    amount: 2350,
  },
  {
    id: 'order-four',
    reference: 'SO-1044',
    customer: 'Cedar Office',
    status: 'Review',
    amount: 490,
  },
];
const taskOrders = (grouped = false, revised = false) => ({
  title: 'Recorded orders',
  columns: [
    { key: 'reference', label: 'Order' },
    { key: 'customer', label: 'Customer' },
    { key: 'status', label: 'Status' },
    { key: 'amount', label: 'Amount', format: 'currency', currency: 'USD' },
  ],
  rows: taskRows.map(row => (row.id === 'order-four' && revised ? { ...row, amount: 520 } : row)),
  selection: [],
  ...(grouped ? { groupBy: 'customer' } : {}),
});
const taskSurface = (intent: 'query' | 'analyze' | 'draft' | 'review') => ({
  title: 'Order review workspace',
  intent,
  description: 'Query, group, draft and review inside one Card.',
  scopeLabel: 'Recorded orders · local session',
});
const taskChart = (revised = false) => ({
  title: 'Recorded totals by customer',
  points: [
    { label: 'Aster Workshop', value: 3590 },
    { label: 'Birch Studio', value: 780 },
    { label: 'Cedar Office', value: revised ? 520 : 490 },
  ],
  unit: 'USD',
});
const taskRoot = (children: string[]) => ({
  id: 'root',
  component: 'AtlasTaskSurface',
  payload: { path: '/state/task' },
  children,
});
const taskPatch = (key: string, value: unknown) => ({
  version: 'v0.9',
  updateDataModel: { surfaceId, path: `/state/${key}`, value },
});
const taskGraph = (components: unknown[]) => ({
  version: 'v0.9',
  updateComponents: { surfaceId, components },
});

/** Five actual protocol transactions, with stable table/form identities across updates. */
function taskFrames(input: GenUIRequestInput): GenUIEnvelope[] {
  const main = ['orders', 'chart', 'stage'];
  const draft = ['grouping', 'orders', 'chart', 'draft', 'review', 'stage'];
  return [
    {
      sequence: 1,
      commands: [
        ...(input.resetSurface ? [{ version: 'v0.9', deleteSurface: { surfaceId } }] : []),
        ...(!input.hasSurface
          ? [{ version: 'v0.9', createSurface: { surfaceId, catalogId: ATLAS_CARD_CATALOG_ID } }]
          : []),
        taskGraph([
          taskRoot(main),
          { id: 'orders', component: 'AtlasCollection', payload: { path: '/state/orders' } },
          { id: 'chart', component: 'AtlasChart', payload: { path: '/state/chart' } },
          { id: 'stage', component: 'AtlasText', text: { path: '/state/stage' } },
        ]),
        taskPatch('task', taskSurface('query')),
        taskPatch('orders', taskOrders()),
        taskPatch('chart', taskChart()),
        taskPatch('stage', 'Recorded step 1: four orders are available for review.'),
      ],
    },
    {
      sequence: 2,
      commands: [
        taskGraph([
          taskRoot(['grouping', ...main]),
          { id: 'grouping', component: 'AtlasChoice', payload: { path: '/state/grouping' } },
        ]),
        taskPatch('grouping', {
          title: 'Review focus',
          options: [
            { id: 'all', label: 'All customers' },
            { id: 'selected', label: 'Selected orders' },
          ],
          value: 'all',
        }),
        taskPatch('task', taskSurface('analyze')),
        taskPatch('orders', taskOrders(true)),
        taskPatch(
          'stage',
          'Recorded step 2: orders are grouped by customer. Your selection stays with the same rows.',
        ),
      ],
    },
    {
      sequence: 3,
      commands: [
        taskGraph([
          taskRoot(draft),
          { id: 'draft', component: 'AtlasForm', payload: { path: '/state/draft' } },
          { id: 'review', component: 'AtlasAction', payload: { path: '/state/review' } },
        ]),
        taskPatch('task', taskSurface('draft')),
        taskPatch('draft', {
          title: 'Order review draft',
          fields: [
            {
              key: 'note',
              label: 'Order review note',
              value: 'Review the selected orders before sending.',
              required: true,
            },
          ],
        }),
        taskPatch('review', {
          action: { id: 'review-orders', label: 'Review local order draft', intent: 'review' },
        }),
        taskPatch(
          'stage',
          'Recorded step 3: edit your review draft while the remaining frames arrive.',
        ),
      ],
    },
    {
      sequence: 4,
      commands: [
        taskPatch('task', taskSurface('review')),
        taskPatch(
          'stage',
          'Recorded step 4: the review action waits for the complete valid stream.',
        ),
      ],
    },
    {
      sequence: 5,
      commands: [
        taskPatch('orders', taskOrders(true, true)),
        taskPatch('chart', taskChart(true)),
        taskPatch(
          'stage',
          'Recorded step 5: one amount changed. Your selected orders and draft remain local.',
        ),
      ],
    },
  ];
}

/** Actual local Response/ReadableStream fixture; it never calls fetch/network. */
export async function recordedGenUIFetch(_url: string, options: RequestInit): Promise<Response> {
  const input = JSON.parse(String(options.body)) as GenUIRequestInput;
  if (!RECORDED_SCENARIOS.includes(input.scenario)) throw new Error('Unknown recorded scenario.');
  if (options.signal?.aborted) throw options.signal.reason;
  if (input.scenario === 'failure')
    return new Response('Recorded request failure.', { status: 503 });
  const first: GenUIEnvelope = {
    sequence: 1,
    commands:
      input.hasSurface && input.scenario !== 'recreate'
        ? input.scenario === 'slow'
          ? [
              {
                version: 'v0.9',
                updateDataModel: { surfaceId, path: '/state/metric', value: metric(24) },
              },
            ]
          : refreshCommands()
        : initialCommands(),
  };
  if (input.scenario === 'recreate')
    first.commands = [
      ...(input.hasSurface || input.resetSurface
        ? [{ version: 'v0.9', deleteSurface: { surfaceId } }]
        : []),
      ...initialCommands(),
    ];
  else if (input.resetSurface)
    first.commands = [{ version: 'v0.9', deleteSurface: { surfaceId } }, ...first.commands];
  if (input.scenario === 'json')
    return new Response(JSON.stringify(first), { headers: { 'Content-Type': 'application/json' } });
  const records =
    input.scenario === 'task-workspace'
      ? taskFrames(input).map(frame => `data: ${JSON.stringify(frame)}\r\n\r\n`)
      : input.scenario === 'malformed'
        ? ['data: {"sequence":1,"commands":INVALID}\r\n\r\n']
        : [
            `: recorded local stream\r\ndata: ${JSON.stringify(first)}\r\n\r\n`,
            ...(input.scenario === 'slow'
              ? [`data: ${JSON.stringify({ sequence: 2, commands: refreshCommands() })}\n\n`]
              : []),
          ];
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let abortListener: (() => void) | undefined;
  const cleanup = () => {
    stopped = true;
    clearTimeout(timer);
    if (abortListener) options.signal?.removeEventListener('abort', abortListener);
  };
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let index = 0;
      abortListener = () => {
        if (!stopped) {
          cleanup();
          controller.error(
            options.signal?.reason ?? new DOMException('Recorded request cancelled.', 'AbortError'),
          );
        }
      };
      options.signal?.addEventListener('abort', abortListener, { once: true });
      const pump = () => {
        if (stopped) return;
        if (index < records.length) {
          const encoded = encoder.encode(records[index++]);
          // Fragment real bytes, including UTF-8 sequences; native XStream decodes them.
          const boundary = Math.max(1, Math.floor(encoded.length / 3));
          for (let start = 0; start < encoded.length; start += boundary)
            controller.enqueue(encoded.slice(start, start + boundary));
          timer = setTimeout(pump, ['slow', 'task-workspace'].includes(input.scenario) ? 1200 : 20);
        } else if (input.scenario !== 'timeout') {
          cleanup();
          controller.close();
        }
      };
      pump();
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
}
