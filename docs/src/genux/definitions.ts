import type { GenUXCardModel } from '../data/card-model';
import {
  GENUX_CARD_CATALOG_ID,
  GENUX_COMPONENT_NAMES,
  GENUX_PUBLIC_CATALOG_ID,
  type GenUXComponent,
  type GenUXRuntime,
  type JsonValue,
  type TaskBlockData,
} from './contracts';
import { nativeDefinition } from './native-registry';
import { assertId, assertPlainJSON, validateComponent } from './policy';
import { formerNamespaceName, formerPascalName } from '../storage-migration';

export type QueryToolId = 'orders.delayed' | 'metrics.sales' | 'products.search';
export interface QueryIntent {
  toolId: QueryToolId;
  params: Readonly<Record<string, JsonValue>>;
  targetKey: string;
}
export interface CardDefinition {
  schemaVersion: 1;
  id: string;
  revision: number;
  title: { en: string; tr: string };
  protocolVersion: 'v0.9';
  generationMode: 'static' | 'schema' | 'generated';
  catalogId: string;
  audience: 'panel' | 'frontpage';
  components: readonly GenUXComponent[];
  queries: readonly QueryIntent[];
}
export interface QuerySource {
  audience: 'panel' | 'frontpage';
  mode: 'recorded' | 'host';
  run: (query: QueryIntent, signal?: AbortSignal) => Promise<JsonValue>;
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  if (
    Object.keys(value).some(key => !keys.includes(key)) ||
    keys.some(key => !Object.hasOwn(value, key))
  )
    throw new Error('Definition properties are invalid.');
}
function nonEmpty(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048)
    throw new Error('Definition text is invalid.');
}
export function validateQueryIntent(value: unknown, audience: 'panel' | 'frontpage'): QueryIntent {
  assertPlainJSON(value);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Query intent must be an object.');
  const query = value as unknown as QueryIntent;
  exactKeys(value, ['toolId', 'params', 'targetKey']);
  assertId(query.targetKey);
  if (!query.params || typeof query.params !== 'object' || Array.isArray(query.params))
    throw new Error('Query parameters must be an object.');
  const allowed: Record<QueryToolId, readonly string[]> = {
    'orders.delayed': ['fromDate', 'customer', 'groupBy', 'limit'],
    'metrics.sales': ['period'],
    'products.search': ['query', 'category', 'maxPrice', 'limit'],
  };
  if (
    !Object.hasOwn(allowed, query.toolId) ||
    (audience === 'frontpage' && query.toolId !== 'products.search')
  )
    throw new Error('Query tool is unavailable in this audience.');
  for (const [key, val] of Object.entries(query.params)) {
    if (!allowed[query.toolId].includes(key)) throw new Error('Query parameter is not registered.');
    if (key === 'limit') {
      if (typeof val !== 'number' || !Number.isInteger(val) || val < 1 || val > 50)
        throw new Error('Query limit is invalid.');
    } else if (key === 'maxPrice') {
      if (typeof val !== 'number' || val < 0 || val > 1e9)
        throw new Error('Price filter is invalid.');
    } else nonEmpty(val);
  }
  if (
    query.params.fromDate &&
    (typeof query.params.fromDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(query.params.fromDate) ||
      !Number.isFinite(Date.parse(query.params.fromDate)) ||
      new Date(query.params.fromDate).toISOString().slice(0, 10) !== query.params.fromDate)
  )
    throw new Error('Query date is invalid.');
  if (query.params.groupBy && !['supplier', 'status'].includes(String(query.params.groupBy)))
    throw new Error('Grouping is not registered.');
  return structuredClone(query);
}
export function validateCardDefinition(value: unknown): CardDefinition {
  assertPlainJSON(value);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Card definition must be an object.');
  exactKeys(value, [
    'schemaVersion',
    'id',
    'revision',
    'title',
    'protocolVersion',
    'generationMode',
    'catalogId',
    'audience',
    'components',
    'queries',
  ]);
  const definition = value as unknown as CardDefinition;
  assertId(definition.id);
  if (
    definition.schemaVersion !== 1 ||
    definition.protocolVersion !== 'v0.9' ||
    !Number.isSafeInteger(definition.revision) ||
    definition.revision < 1
  )
    throw new Error('Definition version is unsupported.');
  if (!['static', 'schema', 'generated'].includes(definition.generationMode))
    throw new Error('Definition generation mode is invalid.');
  if (!['panel', 'frontpage'].includes(definition.audience))
    throw new Error('Definition audience is invalid.');
  if (
    definition.catalogId !==
    (definition.audience === 'panel' ? GENUX_CARD_CATALOG_ID : GENUX_PUBLIC_CATALOG_ID)
  )
    throw new Error('Definition catalog is invalid.');
  if (!definition.title || typeof definition.title !== 'object')
    throw new Error('Definition titles are required.');
  exactKeys(definition.title, ['en', 'tr']);
  nonEmpty(definition.title.en);
  nonEmpty(definition.title.tr);
  if (
    !Array.isArray(definition.components) ||
    !definition.components.length ||
    definition.components.length > 80 ||
    !Array.isArray(definition.queries) ||
    !definition.queries.length ||
    definition.queries.length > 4
  )
    throw new Error('Definition component/query limits are invalid.');
  const components = definition.components.map(validateComponent);
  const nodes = new Map(components.map(node => [node.id, node]));
  if (!nodes.has('root')) throw new Error('Definition requires a root component.');
  const active = new Set<string>();
  const seen = new Set<string>();
  const walk = (id: string, insideCard: boolean, depth: number): void => {
    if (depth > 20 || active.has(id)) throw new Error('Definition graph is cyclic or too deep.');
    if (seen.has(id)) throw new Error('Definition components require one parent.');
    const node = nodes.get(id);
    if (!node) throw new Error('Definition component reference is missing.');
    // Code-owned native metadata: a native that renders peer Cards counts as a Card.
    const card =
      ['GenUXEntityCard', 'GenUXMetricCard', 'GenUXPurposeCard', 'GenUXTaskSurface'].includes(
        node.component,
      ) || nativeDefinition(node.component)?.containsCards === true;
    if (card && insideCard) throw new Error('Card inside Card is prohibited.');
    active.add(id);
    seen.add(id);
    for (const child of node.child ? [node.child] : (node.children ?? []))
      walk(child, insideCard || card, depth + 1);
    active.delete(id);
  };
  walk('root', false, 0);
  if (seen.size !== nodes.size) throw new Error('Definition contains unreachable components.');
  const queries = definition.queries.map(query => validateQueryIntent(query, definition.audience));
  if (
    new Set(components.map(node => node.id)).size !== components.length ||
    new Set(queries.map(query => query.targetKey)).size !== queries.length
  )
    throw new Error('Definition identities are duplicated.');
  const bindingKeys = new Set(queries.map(query => query.targetKey));
  for (const node of components) {
    if (node.model && !('path' in node.model))
      throw new Error('Saved definitions contain bindings, never record model values.');
    if (
      node.payload &&
      !('path' in node.payload) &&
      !['GenUXTaskSurface', 'GenUXAction', 'GenUXEmpty'].includes(node.component)
    )
      throw new Error('Saved definitions cannot contain live record payloads.');
    for (const binding of [
      node.model,
      node.payload,
      typeof node.text === 'object' ? node.text : undefined,
    ]) {
      if (
        binding &&
        'path' in binding &&
        ![...bindingKeys].some(key => binding.path === `/state/results/${key}`)
      )
        throw new Error('Definition binding has no registered query source.');
    }
    if (
      definition.audience === 'frontpage' &&
      (node.component === 'GenUXForm' ||
        (node.payload &&
          !('path' in node.payload) &&
          node.payload.action &&
          !['inspect', 'open'].includes(node.payload.action.intent)))
    )
      throw new Error('Public definitions are read-only.');
  }
  return { ...structuredClone(definition), components, queries };
}
/** Re-executes registered queries, without invoking a model or persisting query results. */
export async function renderCardDefinition(
  runtime: GenUXRuntime,
  input: unknown,
  source: QuerySource,
  requestId: string,
  signal?: AbortSignal,
): Promise<void> {
  const definition = validateCardDefinition(input);
  if (
    source.audience !== definition.audience ||
    runtime.getSnapshot().audience !== definition.audience
  )
    throw new Error('Definition cannot elevate host audience.');
  runtime.beginRequest(requestId);
  try {
    const results = await Promise.all(
      definition.queries.map(async query => ({ query, data: await source.run(query, signal) })),
    );
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const commands: unknown[] = [];
    if (runtime.getSnapshot().surfaces.some(surface => surface.id === definition.id))
      commands.push({ version: 'v0.9', deleteSurface: { surfaceId: definition.id } });
    commands.push(
      {
        version: 'v0.9',
        createSurface: { surfaceId: definition.id, catalogId: definition.catalogId },
      },
      {
        version: 'v0.9',
        updateComponents: { surfaceId: definition.id, components: definition.components },
      },
    );
    for (const { query, data } of results) {
      assertPlainJSON(data);
      commands.push({
        version: 'v0.9',
        updateDataModel: {
          surfaceId: definition.id,
          path: `/state/results/${query.targetKey}`,
          value: data,
        },
      });
    }
    const accepted = runtime.applyBatch({ requestId, sequence: 1, commands });
    if (!accepted.ok) throw new Error(accepted.error);
    runtime.finishRequest(requestId, 'success');
  } catch (error) {
    runtime.finishRequest(
      requestId,
      signal?.aborted ? 'aborted' : 'error',
      error instanceof Error ? error.message : 'Definition query failed.',
    );
    throw error;
  }
}
// Definitions saved under the previous namespace differ only in catalog and component metadata,
// mapped through these finite allowlists; every other field keeps its stored value.
const formerCatalogIds: ReadonlyMap<string, string> = new Map(
  [GENUX_CARD_CATALOG_ID, GENUX_PUBLIC_CATALOG_ID].map(
    id =>
      [
        id.replace('local://genux-', `local://${formerNamespaceName('genux-') ?? 'genux-'}`),
        id,
      ] as const,
  ),
);
const formerComponentNames: ReadonlyMap<string, string> = new Map(
  GENUX_COMPONENT_NAMES.flatMap(name => {
    const former = formerPascalName(name);
    return former ? [[former, name] as const] : [];
  }),
);
/** The documentation lab scope, saved under its previous PascalCase spelling before the rename. */
const LAB_DEFINITION_SCOPE = 'GenUXReusableQueryCards';

/** Load-only compatibility: maps previous catalog and component names, then strict validation runs. */
function currentNamespaceDefinition(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const definition = value as Record<string, unknown>;
  const upgraded: Record<string, unknown> = { ...definition };
  const catalogId =
    typeof definition.catalogId === 'string'
      ? formerCatalogIds.get(definition.catalogId)
      : undefined;
  if (catalogId) upgraded.catalogId = catalogId;
  if (Array.isArray(definition.components))
    upgraded.components = definition.components.map((node: unknown) => {
      if (!node || typeof node !== 'object' || Array.isArray(node)) return node;
      const entry = node as Record<string, unknown>;
      const component =
        typeof entry.component === 'string' ? formerComponentNames.get(entry.component) : undefined;
      return component ? { ...entry, component } : entry;
    });
  return upgraded;
}
export function createDefinitionStore({
  audience,
  scopeId,
  storage,
}: {
  audience: 'panel' | 'frontpage';
  scopeId: string;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
}) {
  assertId(scopeId);
  const prefix = `genux-card-definitions-v1-${audience}-`;
  const key = `${prefix}${scopeId}`;
  // Approved previous keys for this audience and scope only; storage is never scanned.
  const formerKeys = [
    formerNamespaceName(key),
    scopeId === LAB_DEFINITION_SCOPE
      ? formerNamespaceName(`${prefix}${formerPascalName(scopeId) ?? scopeId}`)
      : undefined,
  ].filter((name): name is string => name !== undefined);
  let definitions: CardDefinition[] = [];
  let error: string | null = null;
  const parse = (serialized: string, former: boolean): CardDefinition[] => {
    if (serialized.length > 65536) throw new Error('Definition storage limit exceeded.');
    const value: unknown = JSON.parse(serialized);
    if (!Array.isArray(value) || value.length > 12)
      throw new Error('Definition collection is invalid.');
    return value
      .map(item => validateCardDefinition(former ? currentNamespaceDefinition(item) : item))
      .filter(definition => definition.audience === audience);
  };
  const load = () => {
    if (!storage) return;
    try {
      // A canonical value wins even when malformed; previous keys fill only a missing one.
      const serialized = storage.getItem(key);
      if (serialized !== null) {
        if (serialized) definitions = parse(serialized, false);
        return;
      }
      let previous: string | null = null;
      for (const name of formerKeys) {
        previous = storage.getItem(name);
        if (previous !== null) break;
      }
      if (!previous) return;
      // The whole collection validates before the copy; the previous key always stays in place.
      definitions = parse(previous, true);
      const copy = JSON.stringify(definitions);
      try {
        storage.setItem(key, copy);
        if (storage.getItem(key) !== copy) throw new Error('Definition copy did not read back.');
      } catch {
        error = 'Definition kept in memory; browser storage is unavailable.';
      }
    } catch {
      error = 'Stored definitions could not be loaded; local memory remains available.';
    }
  };
  load();
  return {
    list: () => structuredClone(definitions),
    getError: () => error,
    save(input: unknown) {
      const definition = validateCardDefinition(input);
      if (definition.audience !== audience)
        throw new Error('Definition audience does not match the host.');
      const next = [...definitions.filter(item => item.id !== definition.id), definition];
      if (next.length > 12) throw new Error('Local definition limit exceeded.');
      const serialized = JSON.stringify(next);
      if (serialized.length > 65536) throw new Error('Definition storage limit exceeded.');
      definitions = next;
      try {
        storage?.setItem(key, serialized);
        error = null;
      } catch {
        error = 'Definition kept in memory; browser storage is unavailable.';
      }
      return structuredClone(definition);
    },
  };
}
export function recordedQuerySource(audience: 'panel' | 'frontpage' = 'panel'): QuerySource {
  return {
    audience,
    mode: 'recorded',
    async run(input, signal) {
      const query = validateQueryIntent(input, audience);
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      const fold = (value: unknown) =>
        typeof value === 'string' ? value.normalize('NFKC').trim().toLocaleLowerCase('en') : '';
      const limit = typeof query.params.limit === 'number' ? query.params.limit : 50;
      if (query.toolId === 'metrics.sales') {
        const available = !query.params.period || fold(query.params.period) === 'october 2026';
        return {
          id: 'sales',
          kind: 'metric',
          title: 'Recorded monthly sales',
          ...(!available
            ? {
                state: 'empty' as const,
                stateMessage: 'No recorded sales are available for this period.',
              }
            : {}),
          metric: {
            value: available ? 2450000 : null,
            label: 'Sales',
            currency: 'TRY',
            period: available ? 'October 2026' : String(query.params.period),
            ...(available
              ? {
                  delta: 18.4,
                  comparison: 'previous month',
                  meaning: 'positive' as const,
                }
              : {}),
          },
          source: {
            label: 'Recorded dataset',
            sourceId: 'fixture-sales-v1',
            observedAt: '2026-10-14T00:00:00Z',
            mode: 'recorded',
          },
        } satisfies GenUXCardModel as unknown as JsonValue;
      }
      if (query.toolId === 'products.search') {
        const products: TaskBlockData = {
          title: 'Recorded public products',
          columns: [
            { key: 'name', label: 'Name' },
            { key: 'supplier', label: 'Supplier' },
            { key: 'category', label: 'Category' },
            {
              key: 'amount',
              label: 'Price',
              format: 'currency',
              currency: 'TRY',
            },
          ],
          rows: [
            {
              id: 'record-one',
              name: 'Packaging materials',
              supplier: 'Aster Workshop',
              category: 'Packaging',
              amount: 1240,
            },
            {
              id: 'record-two',
              name: 'Office equipment',
              supplier: 'Birch Studio',
              category: 'Office',
              amount: 490,
            },
          ],
          selection: [],
        };
        const text = fold(query.params.query),
          category = fold(query.params.category);
        // Search is a folded substring; categories are exact folded fixture labels.
        products.rows = products
          .rows!.filter(
            row =>
              (!text || fold(`${row.name} ${row.supplier} ${row.category}`).includes(text)) &&
              (!category || fold(row.category) === category) &&
              (typeof query.params.maxPrice !== 'number' ||
                Number(row.amount) <= query.params.maxPrice),
          )
          .slice(0, limit);
        return products as unknown as JsonValue;
      }
      const orders: TaskBlockData = {
        title: 'Recorded delayed orders',
        columns: [
          { key: 'name', label: 'Name' },
          { key: 'supplier', label: 'Supplier' },
          { key: 'customer', label: 'Customer' },
          { key: 'status', label: 'Status' },
          { key: 'orderDate', label: 'Order date' },
          { key: 'dueDate', label: 'Due date' },
          {
            key: 'amount',
            label: 'Amount',
            format: 'currency',
            currency: 'TRY',
          },
        ],
        rows: [
          {
            id: 'record-one',
            name: 'Packaging materials',
            supplier: 'Aster Workshop',
            customer: 'Northwind Studio',
            status: 'Pending approval',
            orderDate: '2026-10-02',
            dueDate: '2026-10-08',
            amount: 1240,
          },
          {
            id: 'record-two',
            name: 'Office equipment',
            supplier: 'Birch Studio',
            customer: 'GenUX Studio',
            status: 'Approved',
            orderDate: '2026-10-05',
            dueDate: '2026-10-12',
            amount: 490,
          },
        ],
        selection: [],
      };
      const customer = fold(query.params.customer);
      // fromDate is inclusive and applies to the displayed order date, not the due date.
      orders.rows = orders
        .rows!.filter(
          row =>
            (!customer || fold(row.customer).includes(customer)) &&
            (typeof query.params.fromDate !== 'string' ||
              String(row.orderDate) >= query.params.fromDate),
        )
        .slice(0, limit);
      if (query.params.groupBy) orders.groupBy = String(query.params.groupBy);
      return orders as unknown as JsonValue;
    },
  };
}

/** A reusable recorded query recipe, intentionally not a snapshot of an edited workspace. */
export function createRecordedQueryDefinition(kind: 'orders' | 'sales'): CardDefinition {
  const sales = kind === 'sales';
  return validateCardDefinition({
    schemaVersion: 1,
    id: sales ? 'saved-sales-query' : 'saved-orders-query',
    revision: 1,
    title: sales
      ? { en: 'Reusable sales metric', tr: 'Yeniden kullanılabilir satış metriği' }
      : {
          en: 'Reusable delayed-orders query',
          tr: 'Yeniden kullanılabilir geciken sipariş sorgusu',
        },
    protocolVersion: 'v0.9',
    generationMode: 'schema',
    catalogId: GENUX_CARD_CATALOG_ID,
    audience: 'panel',
    components: sales
      ? [{ id: 'root', component: 'GenUXMetricCard', model: { path: '/state/results/sales' } }]
      : [
          {
            id: 'root',
            component: 'GenUXTaskSurface',
            payload: {
              title: 'Delayed orders review',
              intent: 'query',
              description:
                'A saved structure and query binding. Record values are refreshed separately.',
            },
            children: ['orders', 'inspect'],
          },
          {
            id: 'orders',
            component: 'GenUXCollection',
            payload: { path: '/state/results/orders' },
          },
          {
            id: 'inspect',
            component: 'GenUXAction',
            payload: {
              action: {
                id: 'inspect-orders',
                label: 'Inspect local query result',
                intent: 'inspect',
              },
            },
          },
        ],
    queries: [
      {
        toolId: sales ? 'metrics.sales' : 'orders.delayed',
        params: sales ? { period: 'October 2026' } : { groupBy: 'supplier', limit: 20 },
        targetKey: sales ? 'sales' : 'orders',
      },
    ],
  });
}
