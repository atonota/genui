import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import {
  Col,
  Descriptions,
  Grid,
  Layout,
  List,
  Row,
  Segmented,
  Select,
  Switch,
  Table,
  theme,
} from 'antd';
import GenUXProvider from './GenUXProvider';
import GenUXButton from './GenUXButton';
import GenUXInput from './GenUXInput';
import GenUXCascader, { resolveCascadePath, type GenUXCascadeOption } from './GenUXCascader';
import AdaptiveShell from './AdaptiveShell';
import AdaptiveSider from './AdaptiveSider';
import { AdaptiveContext, useAdaptive, type AdaptiveContextValue } from './AdaptiveProvider';
import { PreviewProvider, type PreviewContextValue } from './PreviewContext';
import { EntityCard } from './cards';
import { useI18n } from './useI18n';
import type { GenUXCardModel } from '../data/card-model';
import type { ThemeMode } from '../theme';
import {
  adaptivePolicy,
  resolveAdaptive,
  type AdaptiveEnvironment,
  type AdaptiveOptions,
  type AdaptiveResolution,
  type InputLayer,
  type LayoutProfile,
  type ProductSurface,
} from '../adaptive/policy';
import {
  ADAPTIVE_COMPONENT_COVERAGE,
  DOC_SLUG_COVERAGE,
  EVIDENCE_STATUSES,
  type EvidenceStatus,
} from '../adaptive/component-coverage';

type Translate = ReturnType<typeof useI18n>['t'];

// The recorded GenUX lab and its stylesheets load only after the explicit button click.
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
      reject(new Error(`GenUX lab stylesheet failed to load: ${href}`));
    };
  });
  labStylesheets.set(href, loaded);
  document.head.append(link);
  return loaded;
};
const loadGenUXCardLab = async () => {
  const [lab, labStyles, runtimeStyles] = await Promise.all([
    import('./genux/GenUXCardLab'),
    import('../styles/genux-card-lab.css?url'),
    import('../styles/genux-runtime.css?url'),
  ]);
  await Promise.all([loadStylesheet(labStyles.default), loadStylesheet(runtimeStyles.default)]);
  return lab;
};
type LabStatus = 'idle' | 'loading' | 'ready' | 'error';
const labStatusLabels: Record<LabStatus, string> = {
  idle: 'Not requested',
  loading: 'Loading',
  ready: 'Loaded',
  error: 'Failed to load',
};
/** Reports ready only after the module and both stylesheets resolve; a rejection reports error. */
const trackedGenUXCardLab = (report: (status: LabStatus) => void) =>
  lazy(() =>
    loadGenUXCardLab().then(
      lab => {
        report('ready');
        return lab;
      },
      (error: unknown) => {
        report('error');
        throw error;
      },
    ),
  );

// Simulation measurement choices, not CSS breakpoints; policy thresholds stay unchanged.
const simulatedHeights = [
  320, 360, 375, 390, 430, 480, 568, 600, 667, 720, 768, 800, 844, 900, 932, 960, 1024, 1080, 1440,
  2160, 2880, 4320,
] as const;
// 932 exists only for the 430 by 932 phone orientation scenario; it is not a breakpoint.
const simulatedWidths = [...new Set<number>([...adaptivePolicy.verificationWidths, 932])].sort(
  (a, b) => a - b,
);
const cardWidths = [240, 288, 320, 480, 640, 960] as const;
const lockable: readonly LayoutProfile[] = ['phone', 'tablet', 'laptop', 'desktop', 'wide'];
const profileLabels: Record<LayoutProfile, string> = {
  phone: 'Phone',
  tablet: 'Tablet',
  laptop: 'Laptop',
  desktop: 'Desktop',
  wide: 'Wide',
  'living-room': 'Living room',
};
const inputLabels: Record<AdaptiveEnvironment['activeInput'], string> = {
  unknown: 'Unknown',
  mouse: 'Mouse',
  touch: 'Touch',
  pen: 'Pen',
  keyboard: 'Keyboard',
  remote: 'Remote',
};
const layerLabels: Record<InputLayer, string> = {
  coarse: 'Coarse',
  precision: 'Precision',
  spatial: 'Spatial',
};
const surfaceLabels: Record<ProductSurface, string> = {
  web: 'Web',
  'living-room': 'Living room (TV)',
};

const categories: readonly GenUXCascadeOption[] = [
  {
    value: 'operations',
    label: 'Operations',
    children: [
      {
        value: 'logistics',
        label: 'Logistics',
        children: [
          { value: 'inbound', label: 'Inbound receiving' },
          { value: 'returns', label: 'Returns handling' },
        ],
      },
      {
        value: 'facilities',
        label: 'Facilities',
        children: [{ value: 'maintenance', label: 'Maintenance requests' }],
      },
    ],
  },
  {
    value: 'finance',
    label: 'Finance',
    children: [
      {
        value: 'payables',
        label: 'Accounts payable',
        children: [{ value: 'invoices', label: 'Supplier invoices' }],
      },
      { value: 'budget', label: 'Budget planning' },
    ],
  },
  {
    value: 'people',
    label: 'People',
    children: [
      { value: 'onboarding', label: 'Onboarding' },
      { value: 'training', label: 'Training plans' },
    ],
  },
];

const galleryCard: GenUXCardModel = {
  id: 'adaptive-card',
  kind: 'entity',
  eyebrow: 'Team workspace',
  title: 'Supplier onboarding',
  description: 'Contracts, contacts and the next review in one record.',
  status: { label: 'Active', tone: 'success' },
  media: { kind: 'monogram', label: 'SO' },
  facts: [
    { key: 'tasks', label: 'Open tasks', value: 12, format: 'number' },
    { key: 'review', label: 'Next review', value: 'Friday' },
  ],
};

type RecordRow = {
  readonly key: string;
  readonly name: string;
  readonly owner: string;
  readonly status: string;
  readonly updated: string;
  readonly note: string;
};
const records: readonly RecordRow[] = [
  {
    key: 'invoices',
    name: 'Supplier invoices',
    owner: 'Finance team',
    status: 'In review',
    updated: '2026-10-14',
    note: 'Waiting for the second approval before payment.',
  },
  {
    key: 'returns',
    name: 'Returns handling',
    owner: 'Logistics team',
    status: 'Draft',
    updated: '2026-10-12',
    note: 'Update the label template for the new carrier.',
  },
  {
    key: 'onboarding',
    name: 'Onboarding checklist',
    owner: 'People team',
    status: 'Approved',
    updated: '2026-10-09',
    note: 'Ready for the November starters.',
  },
];

type CoverageEntry = { readonly id: string; readonly status: EvidenceStatus };
const evidenceLabels: Record<EvidenceStatus, string> = {
  'implementation-pending': 'Implementation pending',
  'implemented-unverified': 'Implemented, unverified',
  verified: 'Verified',
};
/** Reads each contract's own evidenceStatus; nothing here can promote an entry to verified. */
function componentCoverageEntries(): CoverageEntry[] {
  return Object.entries(ADAPTIVE_COMPONENT_COVERAGE).map(([id, contract]) => ({
    id,
    status: contract.evidenceStatus,
  }));
}
/** A GenUX slug inherits its component's evidence; a doc-only slug carries its own contract. */
function slugCoverageEntries(): CoverageEntry[] {
  return Object.entries(DOC_SLUG_COVERAGE).map(([id, entry]) => ({
    id,
    status:
      entry.kind === 'genux'
        ? ADAPTIVE_COMPONENT_COVERAGE[entry.component].evidenceStatus
        : entry.contract.evidenceStatus,
  }));
}

type LabSettings = {
  readonly mode: 'actual' | 'simulation';
  readonly surface: ProductSurface;
  readonly width: number;
  readonly height: number;
  readonly coarse: boolean;
  readonly fine: boolean;
  readonly locked: LayoutProfile | 'auto';
};
const initialSettings: LabSettings = {
  mode: 'actual',
  surface: 'web',
  width: adaptivePolicy.widths.base,
  height: adaptivePolicy.shortHeight,
  coarse: true,
  fine: false,
  locked: 'auto',
};

/** Simulation replaces only the signals the user chose; every other signal stays actual. */
function labEnvironment(actual: AdaptiveEnvironment, settings: LabSettings): AdaptiveEnvironment {
  if (settings.mode === 'actual') return actual;
  return {
    ...actual,
    width: settings.width,
    height: settings.height,
    visualWidth: settings.width,
    visualHeight: settings.height,
    coarse: settings.coarse,
    fine: settings.fine,
    hover: settings.fine,
    anyHover: settings.fine,
  };
}

/** Explicit lab surface and lock; a simulated lock stays a manual choice, never a journey. */
function labOptions(surface: ProductSurface, locked: LabSettings['locked']): AdaptiveOptions {
  return locked === 'auto' ? { surface } : { surface, lockedProfile: locked };
}

function resolveLab(
  environment: AdaptiveEnvironment,
  surface: ProductSurface,
  locked: LabSettings['locked'],
): AdaptiveResolution {
  return resolveAdaptive(environment, labOptions(surface, locked));
}

/**
 * Actual document signals plus the opt-in simulation, as one memoized context value. Actual mode
 * on the automatic web surface returns the actual value itself, including its retained journey.
 */
function useAdaptiveLab() {
  const actual = useAdaptive();
  const [settings, setSettings] = useState(initialSettings);
  const update = (patch: Partial<LabSettings>) =>
    setSettings(current => ({ ...current, ...patch }));
  const value = useMemo<AdaptiveContextValue>(() => {
    if (settings.mode === 'actual' && settings.surface === 'web' && settings.locked === 'auto')
      return actual;
    const environment = labEnvironment(actual.environment, settings);
    const options = labOptions(settings.surface, settings.locked);
    return {
      environment,
      surface: settings.surface,
      resolution: resolveAdaptive(environment, options),
      options,
      // Releases only the actual document journey; the lab's chosen surface and lock stay.
      releaseJourney: actual.releaseJourney,
    };
  }, [actual, settings]);
  return { actual, settings, update, value };
}

/** Id of the focused control only; values and typed content are never read. */
function useFocusedId(): string {
  const [focused, setFocused] = useState('');
  useEffect(() => {
    const update = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement)
        setFocused(target.id || target.getAttribute('role') || target.tagName.toLowerCase());
    };
    document.addEventListener('focusin', update);
    return () => document.removeEventListener('focusin', update);
  }, []);
  return focused;
}

type Delivery = { readonly layout: string; readonly status: string; readonly loaded: string };
const emptyDelivery: Delivery = { layout: '', status: '', loaded: '' };

/** Mirrors the shell's own delivery attributes; the lab never imports layout modules. */
function useShellDelivery() {
  const host = useRef<HTMLDivElement>(null);
  const [delivery, setDelivery] = useState(emptyDelivery);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const read = () => {
      const shell = element.querySelector<HTMLElement>('[data-adaptive-shell]');
      const next = {
        layout: shell?.dataset.layout ?? '',
        status: shell?.dataset.deliveryStatus ?? '',
        loaded: shell?.dataset.loadedLayouts ?? '',
      };
      setDelivery(current =>
        current.layout === next.layout &&
        current.status === next.status &&
        current.loaded === next.loaded
          ? current
          : next,
      );
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(element, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-layout', 'data-delivery-status', 'data-loaded-layouts'],
    });
    return () => observer.disconnect();
  }, []);
  return { host, delivery };
}

type Draft = {
  readonly name: string;
  readonly path: readonly string[];
  readonly error: boolean;
  readonly reviewed: { readonly name: string; readonly path: readonly string[] } | null;
};
const initialDraft: Draft = { name: '', path: [], error: false, reviewed: null };

function translateOptions(
  options: readonly GenUXCascadeOption[],
  t: Translate,
): GenUXCascadeOption[] {
  return options.map(option => ({
    ...option,
    label: t(option.label),
    children: option.children && translateOptions(option.children, t),
  }));
}

/** The one business subtree; its state lives above the shell so profiles never reset it. */
function DraftJourney({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: Dispatch<SetStateAction<Draft>>;
}) {
  const { locale, t } = useI18n();
  const id = useId();
  const options = useMemo(() => translateOptions(categories, t), [locale]);
  const pathLabel = (path: readonly string[]) =>
    resolveCascadePath(options, path)
      .map(option => option.label)
      .join(' / ');
  const review = () =>
    onChange(current =>
      current.name.trim()
        ? { ...current, error: false, reviewed: { name: current.name.trim(), path: current.path } }
        : { ...current, error: true, reviewed: null },
    );
  return (
    <section className="adaptive-journey" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{t('Draft review')}</h3>
      <p>
        {t(
          'Name a draft, choose its category path and review it. Values stay while the profile, inputs, width or theme change.',
        )}
      </p>
      <div className="adaptive-field">
        <label htmlFor={`${id}-name`}>{t('Draft name')}</label>
        <GenUXInput
          id={`${id}-name`}
          value={draft.name}
          status={draft.error ? 'error' : undefined}
          aria-invalid={draft.error || undefined}
          aria-describedby={draft.error ? `${id}-error` : undefined}
          onChange={event => {
            const name = event.target.value;
            onChange(current => ({ ...current, name, error: false }));
          }}
          onPressEnter={review}
        />
        {draft.error && (
          <p id={`${id}-error`} className="adaptive-error" role="alert">
            {t('Enter a draft name before reviewing.')}
          </p>
        )}
      </div>
      <GenUXCascader
        label={t('Category path')}
        options={options}
        value={draft.path}
        changeOnSelect
        help={t('Browse levels or search for a team or area.')}
        onChange={path => onChange(current => ({ ...current, path }))}
      />
      <div className="adaptive-actions">
        <GenUXButton text={t('Review draft')} onClick={review} />
      </div>
      <p role="status" className="adaptive-result" data-adaptive-result>
        {draft.reviewed
          ? t('Ready for local review: {name} in {path}. Nothing was sent.', {
              name: draft.reviewed.name,
              path: pathLabel(draft.reviewed.path) || t('No category'),
            })
          : t('The review result appears here. Nothing is sent to a server.')}
      </p>
    </section>
  );
}

const journeyLinks = [
  { href: '#lab', label: 'Draft review' },
  { href: '#integration', label: 'Host integration' },
  { href: '#verification', label: 'Verification status' },
] as const;

/** Real page anchors for the critical journey; the TV module marks eligible links itself. */
function JourneyNavigation() {
  const { t } = useI18n();
  return (
    <ul className="adaptive-sider-items">
      {journeyLinks.map(link => (
        <li key={link.href}>
          <a href={link.href}>{t(link.label)}</a>
        </li>
      ))}
    </ul>
  );
}

type Rows = readonly (readonly [string, string])[];
const yesNo = (t: Translate, value: boolean | null) =>
  value === null ? t('Unknown') : t(value ? 'Yes' : 'No');
const area = (t: Translate, width: number, height: number) =>
  t('{width} by {height} CSS px', { width: Math.round(width), height: Math.round(height) });

function environmentRows(environment: AdaptiveEnvironment, t: Translate): Rows {
  return [
    [t('Viewport'), area(t, environment.width, environment.height)],
    [t('Visual viewport'), area(t, environment.visualWidth, environment.visualHeight)],
    [t('Coarse pointer'), yesNo(t, environment.coarse)],
    [t('Fine pointer'), yesNo(t, environment.fine)],
    [t('Hover'), yesNo(t, environment.hover)],
    [t('Any hover'), yesNo(t, environment.anyHover)],
    [t('Reduced motion'), yesNo(t, environment.reducedMotion)],
    [t('Forced colors'), yesNo(t, environment.forcedColors)],
    [t('Save data'), yesNo(t, environment.saveData)],
    [t('Active input'), t(inputLabels[environment.activeInput])],
  ];
}

function resolutionRows(resolution: AdaptiveResolution, t: Translate): Rows {
  return [
    [t('Layout profile'), t(profileLabels[resolution.layout])],
    [t('Width band'), resolution.band],
    [
      t('Input layers'),
      resolution.inputLayers.length
        ? resolution.inputLayers.map(layer => t(layerLabels[layer])).join(', ')
        : t('None reported'),
    ],
    [t('Orientation'), t(resolution.orientation === 'landscape' ? 'Landscape' : 'Portrait')],
    [t('Short height'), yesNo(t, resolution.shortHeight)],
    [t('Usable area'), area(t, resolution.usableWidth, resolution.usableHeight)],
  ];
}

function SignalList({ rows }: { rows: Rows }) {
  return (
    <dl className="adaptive-signals">
      {rows.map(([term, value]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Real AntD Grid on the actual viewport and the shared AdaptiveSider on the lab environment. */
function ResponsiveExamples() {
  const { t } = useI18n();
  const { token } = theme.useToken();
  // One gutter feeds the Row and the wrapper padding that takes back its negative inline margins.
  const gutter = token.margin;
  // Grid reads the browser's own media queries, so it reports the actual viewport.
  const screens = Grid.useBreakpoint();
  const probe = JSON.stringify(
    Object.fromEntries(Object.entries(screens).filter(([, active]) => active !== undefined)),
  );
  const [first] = records;
  const columns = [
    {
      title: t('Record'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <span className="adaptive-record-name">{t(name)}</span>,
    },
    { title: t('Owner'), dataIndex: 'owner', key: 'owner', render: (owner: string) => t(owner) },
    {
      title: t('Status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => t(status),
    },
    { title: t('Updated'), dataIndex: 'updated', key: 'updated' },
    {
      title: t('Note'),
      dataIndex: 'note',
      key: 'note',
      render: (note: string) => <span className="adaptive-record-note">{t(note)}</span>,
    },
  ];
  return (
    <div className="adaptive-examples">
      <div data-adaptive-grid-probe={probe} data-adaptive-grid-source="actual">
        <p>
          {t(
            'Grid breakpoints report the actual browser viewport through the shared policy tokens, not the simulated signals.',
          )}
        </p>
        <div
          className="adaptive-grid"
          style={{ '--adaptive-grid-gutter': `${gutter}px` } as CSSProperties}
        >
          <Row gutter={[gutter, gutter]}>
            {['Intake', 'Review', 'Approval'].map(step => (
              <Col key={step} xs={24} md={12} xl={8}>
                <div className="adaptive-grid-cell">
                  <strong>{t(step)}</strong>
                  <span>{t('Spans 24, 12 or 8 columns by breakpoint.')}</span>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      </div>
      {/* The adapter owns collapse; checks read AntD's native collapsed class, not a copy. */}
      <div className="adaptive-sider-demo" data-adaptive-sider="">
        <Layout>
          <AdaptiveSider collapsedWidth={0} trigger={null} theme="light" width="16em">
            <ul className="adaptive-sider-items" aria-label={t('Sider navigation')}>
              {['Drafts', 'Reviews', 'Archive'].map(item => (
                <li key={item}>{t(item)}</li>
              ))}
            </ul>
          </AdaptiveSider>
          <Layout.Content className="adaptive-sider-content">
            <p>
              {t(
                'The sider follows the lab environment width through AdaptiveSider and collapses below the shared laptop width.',
              )}
            </p>
          </Layout.Content>
        </Layout>
      </div>
      <Table<RecordRow>
        size="middle"
        pagination={false}
        dataSource={[...records]}
        columns={columns}
        scroll={{ x: 'max-content' }}
      />
      <Descriptions
        title={t('Selected record')}
        column={{ xs: 1, md: 2, xl: 3 }}
        items={[
          { key: 'name', label: t('Record'), children: t(first.name) },
          { key: 'owner', label: t('Owner'), children: t(first.owner) },
          { key: 'status', label: t('Status'), children: t(first.status) },
          { key: 'updated', label: t('Updated'), children: first.updated },
        ]}
      />
      <List<RecordRow>
        dataSource={[...records]}
        renderItem={row => (
          <List.Item>
            <List.Item.Meta title={t(row.name)} description={t(row.note)} />
          </List.Item>
        )}
      />
    </div>
  );
}

/** The same card in its own container at fixed widths; only the gallery scrolls. */
function CardGallery() {
  const { t } = useI18n();
  return (
    <div
      className="adaptive-card-gallery"
      role="region"
      tabIndex={0}
      aria-label={t('Card container widths')}
    >
      {cardWidths.map(width => (
        <figure
          key={width}
          className="adaptive-card-frame"
          style={{ '--adaptive-card-width': `${width}px` } as CSSProperties}
        >
          <figcaption>{t('{width} CSS px container', { width })}</figcaption>
          <EntityCard model={galleryCard} />
        </figure>
      ))}
    </div>
  );
}

class LabBoundary extends Component<
  {
    children: ReactNode;
    message: string;
    retryLabel: string;
    onRetry: () => void;
    onError: () => void;
  },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? (
      <div role="alert">
        <p>{this.props.message}</p>
        <GenUXButton text={this.props.retryLabel} onClick={this.props.onRetry} />
      </div>
    ) : (
      this.props.children
    );
  }
}

/** Existing recorded GenUX lab, imported only from the explicit button. */
function GenUXStory({
  status,
  onStatus,
}: {
  status: LabStatus;
  /** Must be stable (a state setter); each lazy factory keeps the reporter it was built with. */
  onStatus: (status: LabStatus) => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [requested, setRequested] = useState(false);
  const [Lab, setLab] = useState(() => trackedGenUXCardLab(onStatus));
  const [revision, setRevision] = useState(0);
  return (
    <section className="adaptive-genux" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{t('AI result story')}</h3>
      <p>
        {t(
          'Recorded fixture, not a live backend. The optional GenUX lab loads only after you open it.',
        )}
      </p>
      <div className="adaptive-actions">
        <GenUXButton
          text={t(open ? 'Close AI result story' : 'Open AI result story')}
          aria-expanded={open}
          aria-controls={`${id}-lab`}
          onClick={() => {
            setOpen(value => !value);
            setRequested(true);
            if (status === 'idle') onStatus('loading');
          }}
        />
      </div>
      <div id={`${id}-lab`} hidden={!open}>
        {requested && (
          <LabBoundary
            key={revision}
            message={t('The GenUX lab could not load. The rest of the page remains available.')}
            retryLabel={t('Retry GenUX lab')}
            onError={() => onStatus('error')}
            onRetry={() => {
              onStatus('loading');
              setLab(() => trackedGenUXCardLab(onStatus));
              setRevision(value => value + 1);
            }}
          >
            <Suspense fallback={<p role="status">{t('Loading the optional GenUX lab…')}</p>}>
              <Lab />
            </Suspense>
          </LabBoundary>
        )}
      </div>
    </section>
  );
}

function CoveragePanel() {
  const { t } = useI18n();
  const id = useId();
  const groups = useMemo(
    () => [
      { key: 'components', title: 'Components', entries: componentCoverageEntries() },
      { key: 'pages', title: 'Documentation pages', entries: slugCoverageEntries() },
    ],
    [],
  );
  return (
    <section className="adaptive-coverage" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`}>{t('Coverage')}</h3>
      <p>
        {t(
          'Statuses come from the coverage manifest. Pending and unverified entries are not passes.',
        )}
      </p>
      {groups.map(group => {
        // Every status is listed, so a zero verified count stays visible instead of hidden.
        const counts = EVIDENCE_STATUSES.map(
          status =>
            [status, group.entries.filter(entry => entry.status === status).length] as const,
        );
        return (
          <div
            key={group.key}
            data-adaptive-coverage={group.key}
            data-coverage-count={group.entries.length}
          >
            <h4>
              {t(group.title)}: {t('{count} entries', { count: group.entries.length })}
            </h4>
            <SignalList
              rows={counts.map(
                ([status, count]) => [t(evidenceLabels[status]), String(count)] as const,
              )}
            />
            <details>
              <summary>{t('Show entries')}</summary>
              <ul>
                {group.entries.map(entry => (
                  <li key={entry.id} data-evidence-status={entry.status}>
                    {entry.id}: {t(evidenceLabels[entry.status])}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        );
      })}
    </section>
  );
}

function AdaptiveLabContent() {
  const { t } = useI18n();
  const id = useId();
  const { actual, settings, update, value } = useAdaptiveLab();
  const [draft, setDraft] = useState(initialDraft);
  const [previewMode, setPreviewMode] = useState<ThemeMode>('light');
  // One stable preview owner: a theme change updates the value, never the subtree identity.
  const preview = useMemo<PreviewContextValue>(
    () => ({ exampleId: 'adaptive-lab', profile: 'large', mode: previewMode }),
    [previewMode],
  );
  const [compare, setCompare] = useState(false);
  const [labStatus, setLabStatus] = useState<LabStatus>('idle');
  const focusedId = useFocusedId();
  const { host, delivery } = useShellDelivery();
  const simulated = settings.mode === 'simulation';
  // A phone kept by the actual journey after a rotation; Reset drops only that retention.
  const retainedPhone =
    !simulated && settings.locked === 'auto' && actual.options.lockedProfile === 'phone';
  const sizeOption = (size: number) => ({
    value: size,
    label: t('{value} CSS px', { value: size }),
  });
  const comparison = compare
    ? (['web', 'living-room'] as const).map(
        surface => [surface, resolveLab(value.environment, surface, settings.locked)] as const,
      )
    : [];
  // A requested or failed lab is never reported as loaded; only a resolved module and CSS count.
  const loaded = [delivery.loaded, labStatus === 'ready' ? 'genux-card-lab' : '']
    .filter(Boolean)
    .join(', ');
  return (
    <div
      className="adaptive-lab"
      data-adaptive-mode={settings.mode}
      data-adaptive-surface={settings.surface}
      data-genux-lab-status={labStatus}
    >
      <section className="adaptive-lab-controls" aria-labelledby={`${id}-controls`}>
        <h3 id={`${id}-controls`}>{t('Lab controls')}</h3>
        <p>
          {t(
            simulated
              ? 'Simulation is on. Chosen signals are simulated, not measured from a physical device.'
              : 'Actual mode shows the signals this browser reports. Unknown values stay unknown.',
          )}
        </p>
        <div className="adaptive-control-row">
          <GenUXButton
            text={t(simulated ? 'Use actual signals' : 'Start simulation')}
            aria-pressed={simulated}
            onClick={() => update({ mode: simulated ? 'actual' : 'simulation' })}
          />
          <label className="adaptive-control" htmlFor={`${id}-surface`}>
            {t('Product surface')}
            <Select
              id={`${id}-surface`}
              value={settings.surface}
              onChange={surface => update({ surface })}
              options={(['web', 'living-room'] as const).map(surface => ({
                value: surface,
                label: t(surfaceLabels[surface]),
              }))}
            />
          </label>
          <label className="adaptive-control" htmlFor={`${id}-lock`}>
            {t('Layout profile lock')}
            <Select
              id={`${id}-lock`}
              value={settings.locked}
              onChange={locked => update({ locked })}
              options={[
                { value: 'auto' as const, label: t('Automatic') },
                ...lockable.map(profile => ({ value: profile, label: t(profileLabels[profile]) })),
              ]}
            />
          </label>
          <div className="adaptive-control">
            <span id={`${id}-theme`}>{t('Preview theme')}</span>
            <Segmented<ThemeMode>
              aria-labelledby={`${id}-theme`}
              value={previewMode}
              onChange={setPreviewMode}
              options={[
                { value: 'light', label: t('Light') },
                { value: 'dark', label: t('Dark') },
              ]}
            />
          </div>
        </div>
        {simulated && (
          <fieldset className="adaptive-simulation">
            <legend>{t('Simulated signals')}</legend>
            <p>{t('Simulation measurement choices, not CSS breakpoints or a physical device.')}</p>
            <label className="adaptive-control" htmlFor={`${id}-width`}>
              {t('Simulated width')}
              <Select
                id={`${id}-width`}
                value={settings.width}
                onChange={width => update({ width })}
                options={simulatedWidths.map(sizeOption)}
              />
            </label>
            <label className="adaptive-control" htmlFor={`${id}-height`}>
              {t('Simulated height')}
              <Select
                id={`${id}-height`}
                value={settings.height}
                onChange={height => update({ height })}
                options={simulatedHeights.map(sizeOption)}
              />
            </label>
            <label className="adaptive-switch">
              <Switch
                checked={settings.coarse}
                onChange={coarse => update({ coarse })}
                aria-label={t('Simulated coarse pointer')}
              />
              {t('Simulated coarse pointer')}
            </label>
            <label className="adaptive-switch">
              <Switch
                checked={settings.fine}
                onChange={fine => update({ fine })}
                aria-label={t('Simulated fine pointer and hover')}
              />
              {t('Simulated fine pointer and hover')}
            </label>
          </fieldset>
        )}
        <div className="adaptive-actions">
          <GenUXButton
            text={t(compare ? 'Hide web and TV comparison' : 'Compare web and TV')}
            fill="text"
            aria-expanded={compare}
            onClick={() => setCompare(current => !current)}
          />
          {retainedPhone && (
            <GenUXButton text={t('Reset')} fill="text" onClick={() => actual.releaseJourney()} />
          )}
        </div>
      </section>
      <AdaptiveContext.Provider value={value}>
        <section className="adaptive-telemetry" aria-labelledby={`${id}-telemetry`}>
          <h3 id={`${id}-telemetry`}>{t('Signals and resolution')}</h3>
          <div className="adaptive-telemetry-grid">
            <div>
              <h4>{t('Actual signals')}</h4>
              <SignalList rows={environmentRows(actual.environment, t)} />
            </div>
            {simulated && (
              <div>
                <h4>{t('Simulated signals')}</h4>
                <SignalList rows={environmentRows(value.environment, t)} />
              </div>
            )}
            <div>
              <h4>{t(simulated ? 'Simulated resolution' : 'Selected resolution')}</h4>
              <SignalList
                rows={[
                  ...resolutionRows(value.resolution, t),
                  [t('Product surface'), t(surfaceLabels[value.surface])],
                ]}
              />
            </div>
            <div>
              <h4>{t('Delivery and focus')}</h4>
              <SignalList
                rows={[
                  [t('Focused control id'), focusedId || t('None')],
                  [t('Shell layout'), delivery.layout || t('Not reported')],
                  [t('Delivery status'), delivery.status || t('Not reported')],
                  [t('Loaded modules'), loaded || t('Not reported')],
                  [t('GenUX lab status'), t(labStatusLabels[labStatus])],
                ]}
              />
            </div>
          </div>
          <p>
            {t(
              'Pen, eye tracking and remote hardware are noted here but not detected. Keyboard availability is never inferred.',
            )}
          </p>
          {compare && (
            <div className="adaptive-telemetry-grid" data-adaptive-comparison>
              {comparison.map(([surface, resolution]) => (
                <div key={surface}>
                  <h4>{t(surfaceLabels[surface])}</h4>
                  <SignalList rows={resolutionRows(resolution, t)} />
                </div>
              ))}
            </div>
          )}
        </section>
        {/* Local preview theme and overflow owner; the draft state above never remounts. */}
        <div className="adaptive-lab-frame" data-adaptive-preview-mode={previewMode}>
          <PreviewProvider value={preview}>
            <GenUXProvider appearance="docs">
              <div className="adaptive-lab-preview">
                <div ref={host} className="adaptive-lab-shell">
                  <AdaptiveShell
                    ariaLabel={t('Draft review journey')}
                    navigation={<JourneyNavigation />}
                  >
                    <DraftJourney draft={draft} onChange={setDraft} />
                  </AdaptiveShell>
                </div>
                <section
                  className="adaptive-container"
                  data-adaptive-container="responsive-data"
                  aria-labelledby={`${id}-data`}
                >
                  <h3 id={`${id}-data`}>{t('Responsive data examples')}</h3>
                  <ResponsiveExamples />
                </section>
                <GenUXStory status={labStatus} onStatus={setLabStatus} />
                <section
                  className="adaptive-container"
                  data-adaptive-container="card-widths"
                  aria-labelledby={`${id}-cards`}
                >
                  <h3 id={`${id}-cards`}>{t('Card container widths')}</h3>
                  <CardGallery />
                </section>
              </div>
            </GenUXProvider>
          </PreviewProvider>
        </div>
      </AdaptiveContext.Provider>
      <CoveragePanel />
    </div>
  );
}

export default function AdaptiveLab({ documentation = false }: { documentation?: boolean } = {}) {
  return (
    <GenUXProvider appearance={documentation ? 'docs' : undefined}>
      <AdaptiveLabContent />
    </GenUXProvider>
  );
}
