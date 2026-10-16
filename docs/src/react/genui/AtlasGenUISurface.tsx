import {
  Component,
  Suspense,
  createContext,
  useContext,
  useId,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Select, Table, type TableColumnsType } from 'antd';
import Input from '../AtlasInput';
import { XCard, registerCatalog, type XAgentCommand_v0_9 } from '@ant-design/x-card';
import { AtlasCard, EntityCard, MetricCard, PurposeCard } from '../cards';
import AtlasButton from '../AtlasButton';
import { useI18n } from '../useI18n';
import type { AtlasCardModel } from '../../data/card-model';
import {
  ATLAS_CARD_CATALOG_ID,
  ATLAS_PUBLIC_CATALOG_ID,
  GENUI_COMPONENT_NAMES,
  GENUI_NATIVE_COMPONENT_NAMES,
  type GenUIComponentName,
  type GenUINativeComponentName,
  type GenUIRuntime,
  type GenUISnapshot,
  type GenUISurface,
  type TaskBlockData,
} from '../../genui/contracts';
import { readPointer } from '../../genui/policy';
import { resolveGenUIPresentation } from '../../genui/adaptive';
import type { AdaptiveResolution } from '../../adaptive/policy';
import { useAdaptive } from '../AdaptiveProvider';
import { NATIVE_ADAPTERS } from './native-catalog';
import NativeStyles from './NativeStyles';

interface Owner {
  runtime: GenUIRuntime;
  surface: GenUISurface;
  snapshot: GenUISnapshot;
  /** Trusted-host adaptive resolution; generated payloads never choose it. */
  resolution: AdaptiveResolution;
}
const SurfaceOwner = createContext<Owner | null>(null);
function useOwner(): Owner {
  const owner = useContext(SurfaceOwner);
  if (!owner) throw new Error('A trusted surface owner is required.');
  return owner;
}
function useDataText() {
  const { snapshot } = useOwner();
  const { t } = useI18n();
  return (value: string | undefined) =>
    value === undefined ? undefined : snapshot.sourceMode === 'recorded' ? t(value) : value;
}
interface NativeProps {
  sourceComponentId: string;
  renderedRevision?: number;
  model?: AtlasCardModel;
  payload?: TaskBlockData;
  text?: string;
  direction?: 'stack' | 'grid';
  children?: ReactNode;
  onAction?: (name: string, context: Record<string, unknown>) => void;
  onDataChange?: (path: string, value: unknown) => void;
}
function RegisteredCard({
  sourceComponentId,
  renderedRevision,
  model,
  onAction,
  onDataChange,
}: NativeProps) {
  const { runtime, surface, snapshot } = useOwner();
  if (!model) return null;
  const waiting = snapshot.status !== 'success' && snapshot.status !== 'idle';
  const displayed = waiting
    ? {
        ...model,
        primaryAction: model.primaryAction
          ? { ...model.primaryAction, disabled: true, reason: 'Wait for a complete valid stream.' }
          : undefined,
        secondaryActions: model.secondaryActions?.map(action => ({
          ...action,
          disabled: true,
          reason: 'Wait for a complete valid stream.',
        })),
      }
    : model;
  const Component =
    model.kind === 'entity' ? EntityCard : model.kind === 'metric' ? MetricCard : PurposeCard;
  return (
    <Component
      model={displayed}
      onAction={action => onAction?.(action.id, { sourceComponentId, renderedRevision })}
      onFieldChange={(key, value) => {
        if (runtime.patchField(surface.id, sourceComponentId, key, value).ok)
          onDataChange?.(`/state/drafts/${sourceComponentId}/${key}`, value);
      }}
      onSelectionChange={selected => {
        runtime.setSelection(surface.id, sourceComponentId, selected);
      }}
      onMove={lane => {
        runtime.moveTask(surface.id, sourceComponentId, lane);
      }}
    />
  );
}
function RegisteredStack({ direction, children }: NativeProps) {
  return (
    <div className="genui-block-stack" data-layout={direction ?? 'stack'}>
      {children}
    </div>
  );
}
function RegisteredText({ text }: NativeProps) {
  const dataText = useDataText();
  return <p className="genui-block-text">{dataText(text)}</p>;
}
function RegisteredTaskSurface({ payload, children }: NativeProps) {
  const dataText = useDataText();
  const { t } = useI18n();
  const { snapshot } = useOwner();
  if (!payload) return null;
  return (
    <AtlasCard
      title={dataText(payload.title)!}
      description={dataText(payload.description)}
      purpose="task-workspace"
      header={
        <p className="genui-scope-label">
          {t(snapshot.audience === 'panel' ? 'Panel scope' : 'Public read-only scope')} ·{' '}
          {dataText(payload.scopeLabel) ?? t('Recorded local data')}
        </p>
      }
      body={<div className="genui-task-content">{children}</div>}
    />
  );
}
function RegisteredCollection({ sourceComponentId, payload }: NativeProps) {
  const dataText = useDataText();
  const { runtime, surface } = useOwner();
  const { locale } = useI18n();
  if (!payload?.rows || !payload.columns) return null;
  const columns: TableColumnsType<NonNullable<TaskBlockData['rows']>[number]> = payload.columns.map(
    column => ({
      key: column.key,
      dataIndex: column.key,
      title: dataText(column.label),
      render: (value: unknown) => {
        if (value === null || value === undefined) return '—';
        if (typeof value === 'number' && column.format === 'currency')
          return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: column.currency ?? 'USD',
          }).format(value);
        if (typeof value === 'number' && column.format === 'number')
          return new Intl.NumberFormat(locale).format(value);
        return String(value);
      },
    }),
  );
  const groups = payload.groupBy
    ? [...new Set(payload.rows.map(row => String(row[payload.groupBy!] ?? '—')))]
    : [null];
  return (
    <section
      className="genui-data-block"
      aria-label={dataText(payload.title)}
      data-adaptive-container=""
      data-adaptive-content="data"
    >
      <h5>{dataText(payload.title)}</h5>
      {groups.map(group => {
        const rows = payload.rows!.filter(
          row => group === null || String(row[payload.groupBy!] ?? '—') === group,
        );
        return (
          <div key={group ?? 'all'}>
            {group && <h6>{group}</h6>}
            <Table
              rowKey="id"
              columns={columns}
              dataSource={rows}
              pagination={false}
              scroll={{ x: 'max-content' }}
              rowSelection={{
                preserveSelectedRowKeys: true,
                selectedRowKeys: [...(payload.selection ?? [])],
                onChange: keys => {
                  const current =
                    runtime.getSnapshot().surfaces.find(item => item.id === surface.id)?.blocks[
                      sourceComponentId
                    ]?.selection ?? [];
                  const groupIds = new Set(rows.map(row => row.id));
                  const selected = [
                    ...current.filter(id => !groupIds.has(id)),
                    ...keys.map(String).filter(id => groupIds.has(id)),
                  ];
                  runtime.chooseValue(surface.id, sourceComponentId, [...new Set(selected)]);
                },
              }}
            />
          </div>
        );
      })}
    </section>
  );
}
function RegisteredChart({ payload }: NativeProps) {
  const dataText = useDataText();
  const { locale } = useI18n();
  if (!payload?.points) return null;
  const max = Math.max(1, ...payload.points.map(point => Math.abs(point.value)));
  return (
    <section className="genui-data-block" aria-label={dataText(payload.title)}>
      <h5>{dataText(payload.title)}</h5>
      <dl className="genui-chart">
        {payload.points.map((point, index) => (
          <div key={`${point.label}-${index}`}>
            <dt>{point.label}</dt>
            <dd>
              <meter min={0} max={max} value={Math.abs(point.value)} aria-label={point.label} />
              <span>
                {new Intl.NumberFormat(locale).format(point.value)} {payload.unit}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
function RegisteredAction({ sourceComponentId, renderedRevision, payload, onAction }: NativeProps) {
  const dataText = useDataText();
  const { snapshot } = useOwner();
  if (!payload?.action) return null;
  const ready = snapshot.status === 'success' || snapshot.status === 'idle';
  return (
    <AtlasButton
      text={dataText(payload.action.label)!}
      fill="tint"
      disabled={!ready || payload.action.disabled}
      onClick={() => onAction?.(payload.action!.id, { sourceComponentId, renderedRevision })}
    />
  );
}
function RegisteredForm({
  sourceComponentId,
  renderedRevision,
  payload,
  onAction,
  onDataChange,
}: NativeProps) {
  const dataText = useDataText();
  const { runtime, surface, snapshot } = useOwner();
  const { t } = useI18n();
  const prefix = useId();
  if (!payload?.fields) return null;
  return (
    <section
      className="genui-data-block"
      aria-label={dataText(payload.title)}
      data-adaptive-container=""
    >
      <h5>{dataText(payload.title)}</h5>
      {payload.fields.map(field => {
        const error =
          dataText(field.error) ??
          (snapshot.error === 'Complete the required fields before continuing.' &&
          field.required &&
          !field.value.trim()
            ? t('This field is required.')
            : undefined);
        const descriptionId = `${prefix}-${field.key}-description`;
        return (
          <label className="genui-field" key={field.key}>
            <span>
              {dataText(field.label)}
              {field.required ? ' *' : ''}
            </span>
            <Input
              value={field.value}
              readOnly={field.readOnly}
              aria-required={field.required}
              aria-invalid={error ? true : undefined}
              status={error ? 'error' : undefined}
              aria-describedby={error || field.readOnly ? descriptionId : undefined}
              onChange={event => {
                const value = event.currentTarget.value;
                if (runtime.patchField(surface.id, sourceComponentId, field.key, value).ok)
                  onDataChange?.(`/state/drafts/${sourceComponentId}/${field.key}`, value);
              }}
            />
            {(error || field.readOnly) && (
              <span id={descriptionId} className={error ? 'genui-field-error' : undefined}>
                {error ?? t('Read-only value. You can select and copy it.')}
              </span>
            )}
          </label>
        );
      })}
      {payload.action && (
        <RegisteredAction
          sourceComponentId={sourceComponentId}
          renderedRevision={renderedRevision}
          payload={{ action: payload.action }}
          onAction={onAction}
        />
      )}
    </section>
  );
}
function RegisteredChoice({ sourceComponentId, payload }: NativeProps) {
  const dataText = useDataText();
  const { runtime, surface } = useOwner();
  if (!payload?.options) return null;
  return (
    <label className="genui-field">
      <span>{dataText(payload.title)}</span>
      <Select
        aria-label={dataText(payload.title)}
        classNames={{ popup: { root: 'atlas-select-popup' } }}
        mode={payload.multiple ? 'multiple' : undefined}
        value={typeof payload.value === 'string' ? payload.value : [...(payload.value ?? [])]}
        options={payload.options.map(option => ({
          value: option.id,
          label: dataText(option.label),
        }))}
        onChange={(value: string | string[]) => {
          runtime.chooseValue(surface.id, sourceComponentId, value);
        }}
      />
    </label>
  );
}
function RegisteredEmpty(props: NativeProps) {
  const dataText = useDataText();
  return (
    <section className="genui-data-block">
      <h5>{dataText(props.payload?.title)}</h5>
      <p>{dataText(props.payload?.description)}</p>
      {props.payload?.action && <RegisteredAction {...props} />}
    </section>
  );
}
// Keeps a failed adapter chunk local to its own control: no retry and no runtime mutation.
class NativeAdapterBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
const actionKey = (surface: GenUISurface) =>
  `${surface.id}-${surface.generation}-${globalThis.crypto.randomUUID()}`;
function RegisteredNative({
  name,
  sourceComponentId,
  renderedRevision,
  payload,
}: NativeProps & { name: GenUINativeComponentName }) {
  const dataText = useDataText();
  const { runtime, surface, snapshot, resolution } = useOwner();
  const { t } = useI18n();
  // Presentation metadata for the registered name only; it never touches data or actions.
  const presentation = useMemo(
    () => resolveGenUIPresentation(name, resolution),
    [name, resolution],
  );
  if (!payload?.native) return null;
  const Adapter = NATIVE_ADAPTERS[name];
  const ready =
    (snapshot.status === 'success' || snapshot.status === 'idle') &&
    typeof renderedRevision === 'number';
  // Overlay layers portal out of the block; containing them would trap fixed descendants.
  const contained = presentation.containerBehavior !== 'overlay-adaptive';
  const action = payload.action;
  // A disabled/readOnly native control also blocks its outer action, and a Button
  // without an available outer action is disabled rather than enabled but inert.
  const actionable =
    ready &&
    payload.native.disabled !== true &&
    payload.native.readOnly !== true &&
    !!action &&
    !action.disabled;
  return (
    <div
      className="genui-data-block"
      role="group"
      aria-label={dataText(payload.title)}
      data-native-component={name}
      data-adaptive-family={presentation.family}
      data-adaptive-target={presentation.targetLayer}
      data-adaptive-placement={presentation.layerPlacement}
      data-adaptive-behavior={presentation.containerBehavior}
      data-adaptive-container={contained ? '' : undefined}
      data-adaptive-content={
        presentation.containerBehavior === 'scroll-region' ? 'data' : undefined
      }
    >
      <NativeAdapterBoundary
        fallback={<p role="alert">{t('This control could not be loaded.')}</p>}
      >
        <Suspense fallback={<p role="status">{t('Loading control…')}</p>}>
          <Adapter
            data={payload.native}
            presentation={presentation}
            disabled={!ready || (name === 'AtlasButton' && !actionable)}
            actionAvailable={actionable}
            onChange={value => {
              // The runtime rejects edits from a stale generation or revision.
              if (typeof renderedRevision === 'number')
                runtime.changeNativeValue(
                  surface.id,
                  sourceComponentId,
                  value,
                  surface.generation,
                  renderedRevision,
                );
            }}
            onAction={() => {
              // Dispatched here, not through XCard, so confirmation adapters see whether
              // the runtime committed it; the runtime reports any rejection itself.
              if (!actionable || !action || typeof renderedRevision !== 'number') return false;
              return runtime.dispatchAction({
                surfaceId: surface.id,
                componentId: sourceComponentId,
                actionId: action.id,
                baseRevision: renderedRevision,
                idempotencyKey: actionKey(surface),
              }).ok;
            }}
          />
        </Suspense>
      </NativeAdapterBoundary>
    </div>
  );
}
const NATIVE_RENDERERS = Object.fromEntries(
  GENUI_NATIVE_COMPONENT_NAMES.map(name => [
    name,
    // XCard's onAction is not forwarded: RegisteredNative dispatches native actions itself.
    function NativeRenderer({ sourceComponentId, renderedRevision, payload }: NativeProps) {
      return (
        <RegisteredNative
          name={name}
          sourceComponentId={sourceComponentId}
          renderedRevision={renderedRevision}
          payload={payload}
        />
      );
    },
  ]),
) as Record<GenUINativeComponentName, (props: NativeProps) => ReactNode>;
const COMPONENTS = Object.freeze({
  AtlasEntityCard: RegisteredCard,
  AtlasMetricCard: RegisteredCard,
  AtlasPurposeCard: RegisteredCard,
  AtlasTaskSurface: RegisteredTaskSurface,
  AtlasCollection: RegisteredCollection,
  AtlasChart: RegisteredChart,
  AtlasForm: RegisteredForm,
  AtlasChoice: RegisteredChoice,
  AtlasAction: RegisteredAction,
  AtlasEmpty: RegisteredEmpty,
  AtlasStack: RegisteredStack,
  AtlasText: RegisteredText,
  ...NATIVE_RENDERERS,
});
const nativeCatalog = (id: string) => ({
  $id: id,
  catalogId: id,
  title: 'Atlas Cards v1',
  components: Object.fromEntries(
    GENUI_COMPONENT_NAMES.map(name => [
      name,
      {
        type: 'object' as const,
        properties: {
          sourceComponentId: { type: 'string' },
          renderedRevision: { type: 'number' },
          model: { type: 'object' },
          payload: { type: 'object' },
          text: { type: 'string' },
          direction: { type: 'string' },
        },
        required: ['sourceComponentId', 'renderedRevision'],
      },
    ]),
  ),
});
registerCatalog(nativeCatalog(ATLAS_CARD_CATALOG_ID));
registerCatalog(nativeCatalog(ATLAS_PUBLIC_CATALOG_ID));

function NativeSurface({ runtime, surface, snapshot, resolution }: Owner) {
  const commands = useMemo((): XAgentCommand_v0_9[] => {
    const texts = Object.fromEntries(
      surface.components
        .filter(node => node.component === 'AtlasText')
        .map(node => [
          node.id,
          typeof node.text === 'object' ? readPointer(surface.data, node.text.path) : node.text,
        ]),
    );
    const components = surface.components.map(node => ({
      id: node.id,
      component: node.component,
      sourceComponentId: node.id,
      renderedRevision: snapshot.revision,
      ...(node.child ? { child: node.child } : {}),
      ...(node.children ? { children: [...node.children] } : {}),
      ...(node.model ? { model: { path: `/state/models/${node.id}` } } : {}),
      ...(node.payload ? { payload: { path: `/state/blocks/${node.id}` } } : {}),
      ...(node.text !== undefined ? { text: { path: `/state/texts/${node.id}` } } : {}),
      ...(node.direction ? { direction: node.direction } : {}),
    }));
    return [
      {
        version: 'v0.9',
        createSurface: {
          surfaceId: surface.id,
          catalogId:
            snapshot.audience === 'panel' ? ATLAS_CARD_CATALOG_ID : ATLAS_PUBLIC_CATALOG_ID,
        },
      },
      { version: 'v0.9', updateComponents: { surfaceId: surface.id, components } },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: surface.id,
          path: '/state',
          value: {
            models: surface.models,
            blocks: surface.blocks,
            texts,
            drafts: surface.draftFields,
          },
        },
      },
    ];
  }, [surface, snapshot.audience, snapshot.revision]);
  const { t } = useI18n();
  if (!surface.components.length)
    return <p role="status">{t('Waiting for complete Card data.')}</p>;
  return (
    <SurfaceOwner.Provider value={{ runtime, surface, snapshot, resolution }}>
      <XCard.Box
        components={COMPONENTS}
        commands={commands}
        onAction={payload => {
          const componentId = payload.context.sourceComponentId;
          const renderedRevision = payload.context.renderedRevision;
          if (typeof componentId !== 'string' || typeof renderedRevision !== 'number') return;
          runtime.dispatchAction({
            surfaceId: payload.surfaceId,
            componentId,
            actionId: payload.name,
            baseRevision: renderedRevision,
            idempotencyKey: actionKey(surface),
          });
        }}
      >
        <XCard.Card id={surface.id} />
      </XCard.Box>
    </SurfaceOwner.Provider>
  );
}
// This surface owns no navigation keys; the shell and registered portal adapters do. Tab opens
// the central ringless focus on every surface, and handled arrows inside the explicit TV
// boundary may open that same ringless focus.
export default function AtlasGenUISurface({ runtime }: { runtime: GenUIRuntime }) {
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  );
  // Trusted host context: the explicit product surface, never a width guess or a payload.
  const { resolution, surface: productSurface } = useAdaptive();
  return (
    <div
      className="atlas-genui-runtime"
      data-genui-scope={snapshot.scopeId}
      data-genui-audience={snapshot.audience}
      data-adaptive-layout={resolution.layout}
      data-adaptive-band={resolution.band}
      data-adaptive-surface={productSurface}
      data-adaptive-input-layers={resolution.inputLayers.join(' ')}
      data-adaptive-short-height={String(resolution.shortHeight)}
    >
      {/* Native control CSS ships only with a rendered surface; React hoists it to <head>. */}
      <NativeStyles />
      {snapshot.surfaces.map(surface => (
        <NativeSurface
          key={`${surface.id}-${surface.generation}`}
          runtime={runtime}
          surface={surface}
          snapshot={snapshot}
          resolution={resolution}
        />
      ))}
    </div>
  );
}
export const atlasGenUIComponentNames: readonly GenUIComponentName[] = GENUI_COMPONENT_NAMES;
