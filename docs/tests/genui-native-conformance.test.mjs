/**
 * GenUI native adapter conformance: one table-driven node:test scenario covering the
 * 49 frozen native components. Every row runs against its own local GenUI runtime
 * built from the real docs/src/genui sources with esbuild; nothing is mocked.
 *
 * RED on the pre-adapter baseline: contracts/policy/runtime still carry the old 12
 * component names and native-registry / actions/authorization do not exist, so each
 * row fails its registry assertion before any authorization module is needed.
 * GREEN once all 34 adapters are registered and the policy, runtime and authorization
 * contracts behave as asserted below. The original adapter-specific DOM/regression controls are retained as one
 * additional check per row in this file; their former separate files are removed.
 */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { mountPattern, buttonByText, headerByText, selectOption } from './harness.mjs';

const APPROVED_COUNT = 49;
const SCOPE_ID = 'genui-native-conformance';
const REQUEST_ID = 'conformance-request';
const SURFACE_ID = 'main';
const ROOT_ID = 'root';
const A2UI_VERSION = 'v0.9';
/** Any edit against a read-only or action-only native must be rejected unchanged. */
const REJECTED_EDIT = 'conformance-probe';

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** Outer registered action on the root native node; inspect needs no field readiness. */
const INSPECT_ACTION = deepFreeze({
  id: 'inspect-root',
  label: 'Inspect record',
  intent: 'inspect',
});

/**
 * Explicit approved list. `sample` is plain serializable payload data copied from the
 * adapter schemas. `nextValue` is a distinct value valid for that schema; rows without
 * withValue (read-only widgets and the action-only button) carry `editable: false`
 * and must reject every runtime value edit.
 */
const ROWS = deepFreeze([
  {
    name: 'AtlasButton',
    readOnly: false,
    hasValue: false,
    editable: false,
    sample: { label: 'Review record' },
  },
  {
    name: 'AtlasInput',
    readOnly: false,
    hasValue: true,
    editable: true,
    nextValue: 'Aster Lane',
    sample: {
      label: 'Display name',
      value: 'Aster',
      placeholder: 'Enter a display name',
      required: true,
      maxLength: 80,
    },
  },
  {
    name: 'AtlasInputNumber',
    readOnly: false,
    hasValue: true,
    editable: true,
    nextValue: 7,
    sample: { label: 'Quantity', value: 2, min: 0, max: 10, step: 1 },
  },
  {
    name: 'AtlasSelect',
    readOnly: false,
    hasValue: true,
    editable: true,
    nextValue: 'engineering',
    sample: {
      label: 'Team',
      options: [
        { id: 'design', label: 'Design' },
        { id: 'engineering', label: 'Engineering' },
        { id: 'operations', label: 'Operations' },
        { id: 'archived', label: 'Archived', disabled: true },
      ],
      value: 'design',
    },
  },
  {
    name: 'AtlasRadio',
    readOnly: false,
    hasValue: true,
    editable: true,
    nextValue: 'engineering',
    sample: {
      label: 'Team',
      value: 'design',
      options: [
        { id: 'design', label: 'Design' },
        { id: 'engineering', label: 'Engineering' },
        { id: 'operations', label: 'Operations', disabled: true },
      ],
    },
  },
  {
    name: 'AtlasCheckbox',
    readOnly: false,
    hasValue: true,
    editable: true,
    nextValue: true,
    sample: { label: 'Notify the review team', value: false },
  },
  {
    name: 'AtlasSwitch',
    readOnly: false,
    hasValue: true,
    editable: true,
    nextValue: true,
    sample: { label: 'Email notifications', value: false },
  },
  {
    name: 'AtlasSlider',
    readOnly: false,
    hasValue: true,
    editable: true,
    nextValue: 65,
    sample: { label: 'Review threshold', value: 40, min: 0, max: 100, step: 5 },
  },
  {
    name: 'AtlasCascader',
    readOnly: false,
    hasValue: true,
    editable: true,
    nextValue: ['south', 'bay'],
    sample: {
      label: 'Service area',
      placeholder: 'Choose a service area',
      options: [
        {
          value: 'north',
          label: 'North region',
          children: [
            { value: 'harbor', label: 'Harbor district' },
            { value: 'old-town', label: 'Old town', disabled: true },
          ],
        },
        {
          value: 'south',
          label: 'South region',
          description: 'Coastal teams',
          children: [{ value: 'bay', label: 'Bay office' }],
        },
      ],
      value: ['north', 'harbor'],
    },
  },
  {
    name: 'AtlasDateTimePicker',
    readOnly: false,
    hasValue: true,
    editable: true,
    // 2026-10-22 is a Thursday inside the delivery window; weekends are disabled.
    nextValue: '2026-10-22',
    sample: {
      kind: 'date',
      label: 'Delivery date',
      value: '2026-10-20',
      minDate: '2026-10-01',
      maxDate: '2026-12-31',
      disabledWeekdays: [0, 6],
      required: true,
      help: 'Weekdays in the delivery window.',
    },
  },
  {
    name: 'AtlasPagination',
    readOnly: false,
    hasValue: true,
    editable: true,
    nextValue: 3,
    sample: { value: 2, total: 48, pageSize: 10, label: 'Order pages' },
  },
  {
    name: 'AtlasSteps',
    readOnly: false,
    hasValue: true,
    editable: true,
    nextValue: 1,
    sample: {
      label: 'Onboarding progress',
      value: 0,
      items: [
        {
          id: 'account',
          title: 'Account',
          description: 'Confirm the workspace owner.',
        },
        {
          id: 'review',
          title: 'Review',
          description: 'Check imported records.',
        },
        { id: 'publish', title: 'Publish', disabled: true },
      ],
    },
  },
  {
    name: 'AtlasBreadcrumb',
    readOnly: false,
    hasValue: true,
    editable: true,
    nextValue: 'catalog',
    sample: {
      label: 'Catalog path',
      items: [
        { key: 'home', label: 'Home' },
        { key: 'catalog', label: 'Catalog' },
        { key: 'lighting', label: 'Lighting' },
        { key: 'lamps', label: 'Desk lamps' },
        { key: 'archive', label: 'Archive', disabled: true },
      ],
      value: 'lighting',
    },
  },
  {
    name: 'AtlasAccordion',
    readOnly: false,
    hasValue: true,
    editable: true,
    nextValue: ['scope', 'source'],
    sample: {
      items: [
        {
          id: 'scope',
          title: 'Scope',
          body: 'Records from the selected workspace.',
        },
        { id: 'source', title: 'Source', body: 'Recorded host snapshot.' },
        {
          id: 'retention',
          title: 'Retention',
          body: 'Kept for 30 days.',
          disabled: true,
        },
      ],
      value: ['scope'],
    },
  },
  {
    name: 'AtlasPill',
    readOnly: true,
    hasValue: false,
    editable: false,
    sample: { label: 'Approved', colorIndex: 4 },
  },
  {
    name: 'AtlasAvatar',
    readOnly: true,
    hasValue: false,
    editable: false,
    sample: { name: 'Ada Lovelace', shape: 'circle' },
  },
  {
    name: 'AtlasAvatarGroup',
    readOnly: true,
    hasValue: false,
    editable: false,
    sample: {
      people: [
        { id: 'ada', name: 'Ada Lovelace', src: '/media/avatars/ada.png' },
        { id: 'grace', name: 'Grace Hopper' },
        { id: 'katherine', name: 'Katherine Johnson' },
        { id: 'mary', name: 'Mary Jackson' },
        { id: 'dorothy', name: 'Dorothy Vaughan' },
      ],
      maxVisible: 3,
    },
  },
  {
    name: 'AtlasMediaFrame',
    readOnly: true,
    hasValue: false,
    editable: false,
    sample: {
      src: '/media/aster-workshop.jpg',
      alt: 'Workshop bench with labelled tool drawers',
      caption: 'Aster Workshop, east bay',
      ratio: 'landscape',
      fit: 'cover',
    },
  },
  {
    name: 'AtlasScreenshot',
    readOnly: true,
    hasValue: false,
    editable: false,
    sample: {
      src: '/screenshots/genui-review-panel.png',
      alt: 'Review panel listing three pending supplier records with their totals.',
      caption: 'Supplier review panel',
      width: 1280,
      height: 800,
    },
  },
  {
    name: 'AtlasIconList',
    readOnly: true,
    hasValue: false,
    editable: false,
    sample: {
      items: [
        {
          id: 'scope',
          title: 'Scoped to the active tenant',
          description: 'Only records from the selected workspace are listed.',
          icon: 'lock-simple',
        },
        {
          id: 'overview',
          title: 'Return to the overview at any time',
          icon: 'house',
        },
        { id: 'plain', title: 'Items without an icon keep their alignment' },
      ],
    },
  },
  {
    name: 'AtlasQuote',
    readOnly: true,
    hasValue: false,
    editable: false,
    sample: {
      quote: 'Calm defaults let teams decide faster than clever ones.',
      attribution: 'Atlas design review',
      context: 'Illustrative example, not an endorsement.',
    },
  },
  {
    name: 'AtlasCarousel',
    readOnly: true,
    hasValue: false,
    editable: false,
    sample: {
      label: 'Workshop gallery',
      slides: [
        {
          id: 'bench',
          title: 'Workbench',
          src: '/media/workshop-bench.jpg',
          alt: 'Wooden workbench with hand tools',
          caption: 'Main bench, east wall',
        },
        {
          id: 'kiln',
          title: 'Kiln room',
          src: 'https://images.atlas.test/kiln.jpg',
          alt: 'Ceramic kiln with an open door',
        },
      ],
    },
  },
  {
    name: 'AtlasRichMenu',
    readOnly: false,
    hasValue: true,
    editable: true,
    nextValue: 'copy-link',
    sample: {
      label: 'Record actions',
      groups: [
        {
          id: 'share',
          label: 'Share',
          items: [
            {
              id: 'copy-link',
              label: 'Copy link',
              description: 'Copy a link to this record',
            },
            {
              id: 'export-csv',
              label: 'Export CSV',
              description: 'Download the visible rows',
            },
          ],
        },
        {
          id: 'manage',
          label: 'Manage',
          items: [
            {
              id: 'archive',
              label: 'Archive',
              description: 'Requires owner approval',
              disabled: true,
            },
          ],
        },
      ],
      value: null,
    },
  },
  {
    name: 'AtlasUpload',
    readOnly: false,
    hasValue: true,
    editable: true,
    // Metadata only: one accepted text file within maxBytes for a single-file control.
    nextValue: [{ name: 'evidence.txt', type: 'text/plain', size: 1024 }],
    sample: {
      label: 'Attach evidence',
      accept: '.txt,text/plain',
      maxBytes: 1048576,
      multiple: false,
      value: [],
    },
  },
  {
    name: 'AtlasDrawer',
    readOnly: false,
    hasValue: true,
    editable: true,
    nextValue: true,
    sample: {
      label: 'Open details',
      title: 'Order details',
      body: 'The shipment leaves the warehouse today.',
      placement: 'right',
      value: false,
    },
  },
  {
    name: 'AtlasToast',
    readOnly: false,
    hasValue: true,
    editable: true,
    nextValue: true,
    sample: {
      label: 'Show notice',
      message: 'Review the highlighted fields before sending.',
      value: false,
    },
  },
  {
    name: 'AtlasAlert',
    readOnly: true,
    hasValue: false,
    editable: false,
    sample: { message: 'Records are up to date.' },
  },
  {
    name: 'AtlasNotification',
    readOnly: false,
    hasValue: true,
    editable: true,
    nextValue: true,
    sample: { value: false, message: 'Changes saved' },
  },
  {
    name: 'AtlasModal',
    readOnly: false,
    hasValue: true,
    editable: true,
    nextValue: true,
    sample: {
      value: false,
      title: 'Archive record',
      body: 'The record leaves the active list after confirmation.',
      opener: 'Review archive',
    },
  },
  {
    name: 'AtlasPopconfirm',
    readOnly: false,
    hasValue: true,
    editable: true,
    nextValue: true,
    sample: {
      title: 'Archive this record?',
      triggerLabel: 'Archive',
      value: false,
    },
  },
  {
    name: 'AtlasSplitter',
    readOnly: false,
    hasValue: true,
    editable: true,
    nextValue: [55, 45],
    sample: {
      id: 'layout',
      label: 'Review layout',
      panels: [
        { id: 'summary', label: 'Summary', text: 'Totals for the quarter.' },
        { id: 'details', label: 'Details', text: 'Line items and notes.' },
      ],
      value: [40, 60],
    },
  },
  {
    name: 'AtlasAutoComplete',
    readOnly: false,
    hasValue: true,
    editable: true,
    nextValue: 'Ankara',
    sample: {
      label: 'Destination city',
      value: '',
      suggestions: [
        { id: 'ankara', label: 'Ankara' },
        { id: 'izmir', label: 'Izmir', disabled: true },
      ],
    },
  },
  {
    name: 'AtlasDropdown',
    readOnly: false,
    hasValue: true,
    editable: true,
    nextValue: 'inspect',
    sample: {
      label: 'Record actions',
      items: [{ id: 'inspect', label: 'Inspect record' }],
      value: null,
    },
  },
  {
    name: 'AtlasSegmented',
    readOnly: false,
    hasValue: true,
    editable: true,
    nextValue: 'month',
    sample: {
      label: 'Report period',
      options: [
        { label: 'Week', value: 'week' },
        { label: 'Month', value: 'month' },
        { label: 'Quarter', value: 'quarter', disabled: true },
      ],
      value: 'week',
    },
  },

  {
    name: 'AtlasRecordCollection',
    readOnly: false,
    hasValue: true,
    editable: true,
    sample: {
      fields: [
        {
          key: 'name',
          label: 'Name',
          kind: 'text',
          required: true,
        },
        {
          key: 'status',
          label: 'Status',
          kind: 'choice',
          options: [
            {
              value: 'open',
              label: 'Open',
            },
            {
              value: 'done',
              label: 'Done',
            },
          ],
        },
        {
          key: 'due',
          label: 'Due date',
          kind: 'date',
        },
      ],
      records: [
        {
          id: 'task-1',
          name: 'Draft brief',
          status: 'open',
          due: '2026-10-20',
        },
        {
          id: 'task-2',
          name: 'Review copy',
          status: 'done',
          due: '2026-10-22',
        },
        {
          id: 'task-3',
          name: 'Publish notes',
          status: 'open',
          due: '2026-11-02',
        },
      ],
      dateFieldKey: 'due',
      boardFieldKey: 'status',
      value: {
        query: {
          search: '',
          filters: [],
          sort: [
            {
              fieldKey: 'due',
              direction: 'asc',
            },
          ],
        },
        projection: ['name', 'status', 'due'],
        activeId: null,
        checkedIds: ['task-1'],
        view: 'table',
        page: 1,
      },
    },
    nextValue: {
      query: {
        search: '',
        filters: [],
        sort: [
          {
            fieldKey: 'due',
            direction: 'asc',
          },
        ],
      },
      projection: ['name', 'status', 'due'],
      activeId: null,
      checkedIds: ['task-1'],
      view: 'list',
      page: 1,
    },
  },
  {
    name: 'AtlasRecordDisplay',
    readOnly: true,
    hasValue: false,
    editable: false,
    sample: {
      title: 'Supplier record',
      presentation: 'tabs',
      fields: [
        {
          key: 'name',
          label: 'Supplier name',
          kind: 'text',
          section: 'Overview',
        },
        {
          key: 'status',
          label: 'Status',
          kind: 'choice',
          section: 'Overview',
          options: [
            {
              value: 'active',
              label: 'Active',
            },
            {
              value: 'paused',
              label: 'Paused',
            },
          ],
        },
        {
          key: 'balance',
          label: 'Open balance',
          kind: 'money',
          currency: 'EUR',
          precision: 2,
          section: 'Finance',
        },
        {
          key: 'onboarded',
          label: 'Onboarded',
          kind: 'date',
          section: 'Finance',
        },
      ],
      record: {
        id: 'supplier-1',
        name: 'Aster Logistics',
        status: 'active',
        balance: 1250.5,
        onboarded: '2026-03-02',
      },
    },
  },
  {
    name: 'AtlasRecordForm',
    readOnly: false,
    hasValue: true,
    editable: true,
    sample: {
      title: 'Account draft',
      organization: 'sections',
      fields: [
        {
          key: 'name',
          label: 'Account name',
          kind: 'text',
          required: true,
          section: 'Profile',
        },
        {
          key: 'owner',
          label: 'Owner',
          kind: 'text',
          section: 'Profile',
        },
        {
          key: 'region',
          label: 'Region',
          kind: 'text',
          readOnly: true,
          section: 'Plan',
        },
      ],
      record: {
        id: 'account-1',
        name: 'Aster Labs',
        owner: 'Ada Lovelace',
        region: 'EU',
      },
      value: {
        id: 'account-1',
        name: 'Aster Labs',
        owner: 'Ada Lovelace',
        region: 'EU',
      },
    },
    nextValue: {
      id: 'account-1',
      name: 'Aster Labs Europe',
      owner: 'Ada Lovelace',
      region: 'EU',
    },
  },
  {
    name: 'AtlasEditableGrid',
    readOnly: false,
    hasValue: true,
    editable: true,
    sample: {
      fields: [
        {
          key: 'name',
          label: 'Name',
          kind: 'text',
          required: true,
        },
        {
          key: 'code',
          label: 'Code',
          kind: 'text',
          readOnly: true,
        },
      ],
      records: [
        {
          id: 'r1',
          name: 'Aster',
          code: 'A-1',
        },
        {
          id: 'r2',
          name: 'Birch',
          code: 'B-2',
        },
      ],
      value: {},
    },
    nextValue: {
      r1: {
        id: 'r1',
        name: 'Aster Group',
        code: 'A-1',
      },
    },
  },
  {
    name: 'AtlasRepeatingRecords',
    readOnly: false,
    hasValue: true,
    editable: true,
    sample: {
      label: 'Order lines',
      fields: [
        {
          key: 'item',
          label: 'Item',
          kind: 'text',
          required: true,
        },
        {
          key: 'quantity',
          label: 'Quantity',
          kind: 'number',
        },
      ],
      value: [
        {
          id: 'line-a',
          item: 'Paper',
          quantity: 2,
        },
        {
          id: 'line-b',
          item: 'Ink',
          quantity: 1,
        },
      ],
      minRows: 1,
      maxRows: 4,
      rowTemplate: {
        quantity: 1,
      },
    },
    nextValue: [
      {
        id: 'line-a',
        item: 'Paper',
        quantity: 3,
      },
      {
        id: 'line-b',
        item: 'Ink',
        quantity: 1,
      },
    ],
  },
  {
    name: 'AtlasConnectedWorkspace',
    readOnly: false,
    hasValue: true,
    editable: true,
    sample: {
      label: 'Local order preview',
      fields: [
        {
          key: 'title',
          label: 'Title',
          kind: 'text',
          required: true,
        },
        {
          key: 'quantity',
          label: 'Quantity',
          kind: 'number',
          precision: 0,
        },
        {
          key: 'status',
          label: 'Status',
          kind: 'choice',
          options: [
            {
              value: 'draft',
              label: 'Draft',
            },
            {
              value: 'ready',
              label: 'Ready',
            },
          ],
        },
      ],
      records: [
        {
          id: 'ord-1',
          title: 'Hinge order',
          quantity: 12,
          status: 'ready',
        },
        {
          id: 'ord-2',
          title: 'Bracket order',
          quantity: 4,
          status: 'draft',
        },
      ],
      value: {
        activeId: null,
        checkedIds: [],
        view: 'table',
        draft: null,
      },
    },
    nextValue: {
      activeId: 'ord-1',
      checkedIds: ['ord-1'],
      view: 'table',
      draft: null,
    },
  },
  {
    name: 'AtlasEmptyState',
    readOnly: true,
    hasValue: false,
    editable: false,
    sample: {
      kind: 'no-match',
      title: 'No matching records',
      description: 'Try a different search term.',
      actionLabel: 'Clear search',
      headingLevel: 3,
    },
  },
  {
    name: 'AtlasSeriesChart',
    readOnly: true,
    hasValue: false,
    editable: false,
    sample: {
      title: 'Requests by quarter',
      description: 'Support and billing requests opened each quarter.',
      categories: ['Q1', 'Q2', 'Q3'],
      series: [
        {
          id: 'support',
          label: 'Support',
          values: [12, 18, 9],
        },
        {
          id: 'billing',
          label: 'Billing',
          values: [4, 7, 11],
        },
      ],
    },
  },
  {
    name: 'AtlasPasswordInput',
    readOnly: false,
    hasValue: true,
    editable: true,
    sample: {
      label: 'Password',
      value: '',
      placeholder: 'Enter a password',
      required: true,
      maxLength: 64,
    },
    nextValue: 'illustrative-example-only',
  },
  {
    name: 'AtlasTextArea',
    readOnly: false,
    hasValue: true,
    editable: true,
    sample: {
      label: 'Release notes',
      value: 'Fixed sync retries.\nImproved export labels.',
      placeholder: 'Describe the change',
      maxLength: 500,
      required: true,
      rows: 4,
    },
    nextValue: 'Fixed sync retries.\nImproved export labels.\nAdded release checklist.',
  },
  {
    name: 'AtlasSearchInput',
    readOnly: false,
    hasValue: true,
    editable: true,
    sample: {
      label: 'Search records',
      value: 'Aster',
      placeholder: 'Search by name',
      maxLength: 120,
    },
    nextValue: 'Birch',
  },
  {
    name: 'AtlasDateTimeMultiple',
    readOnly: false,
    hasValue: true,
    editable: true,
    sample: {
      kind: 'date',
      multiple: true,
      label: 'Review days',
      value: ['2026-10-05', '2026-10-20'],
      minDate: '2026-10-01',
      maxDate: '2026-12-31',
      disabledWeekdays: [0, 6],
      help: 'Choose every weekday the review panel meets.',
    },
    nextValue: ['2026-10-05', '2026-10-20', '2026-11-03'],
  },
  {
    name: 'AtlasRadioCards',
    readOnly: false,
    hasValue: true,
    editable: true,
    sample: {
      label: 'Workspace plan',
      layout: 'icon-cards',
      value: 'starter',
      options: [
        {
          id: 'starter',
          label: 'Starter',
          description: 'One workspace for personal projects and early drafts.',
          icon: 'house',
        },
        {
          id: 'team',
          label: 'Team',
          description: 'Shared workspaces with roles and comments for up to 20 people.',
          icon: 'sun',
        },
        {
          id: 'enterprise',
          label: 'Enterprise',
          description: 'Single sign-on, audit history and dedicated support.',
          icon: 'settings',
        },
        {
          id: 'unavailable',
          label: 'Unavailable',
          description: 'Not offered for this account; shown disabled for comparison.',
          icon: 'lock-simple',
          disabled: true,
        },
      ],
    },
    nextValue: 'team',
  },
  {
    name: 'AtlasCheckboxCards',
    readOnly: false,
    hasValue: true,
    editable: true,
    sample: {
      label: 'Plan add-ons',
      variant: 'icon-cards',
      options: [
        {
          value: 'starter',
          label: 'Starter',
          description: 'One workspace for personal projects and early drafts.',
          icon: 'house',
        },
        {
          value: 'team',
          label: 'Team',
          description: 'Shared workspaces with roles and comments for up to 20 people.',
          icon: 'sun',
        },
        {
          value: 'enterprise',
          label: 'Enterprise',
          description: 'Single sign-on, audit history and dedicated support.',
          icon: 'settings',
        },
        {
          value: 'unavailable',
          label: 'Unavailable',
          description: 'Not offered for this account; shown disabled for comparison.',
          icon: 'lock-simple',
          disabled: true,
        },
      ],
      value: ['starter', 'enterprise'],
    },
    nextValue: ['starter', 'team', 'enterprise'],
  },
  {
    name: 'AtlasSwitchCards',
    readOnly: false,
    hasValue: true,
    editable: true,
    sample: {
      label: 'Notifications',
      help: 'Each channel turns on or off on its own.',
      layout: 'icon-cards',
      options: [
        {
          id: 'digest',
          label: 'Daily digest',
          description: 'A morning summary of workspace activity.',
          icon: 'sun',
        },
        {
          id: 'quiet',
          label: 'Quiet hours',
          description: 'Hold non-urgent alerts overnight.',
          icon: 'moon',
        },
        {
          id: 'account',
          label: 'Account changes',
          description: 'Role, billing and member updates.',
          icon: 'settings',
        },
        {
          id: 'security',
          label: 'Security alerts',
          description: 'Always on for this workspace; shown disabled for comparison.',
          icon: 'lock-simple',
          disabled: true,
        },
      ],
      value: ['digest', 'security'],
    },
    nextValue: ['digest', 'quiet', 'security'],
  },
]);

// ---------------------------------------------------------------------------
// Loader: bundle the real GenUI sources with esbuild. Core modules are required;
// the registry and authorization modules are optional at load time only so the
// baseline can still boot, but every row must then fail (never skip).
// ---------------------------------------------------------------------------
const GENUI_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/genui');
const CORE_MODULES = Object.freeze({
  contracts: 'contracts.ts',
  policy: 'policy.ts',
  runtime: 'runtime.ts',
});
const OPTIONAL_MODULES = Object.freeze({
  nativeRegistry: 'native-registry.ts',
  authorization: 'actions/authorization.ts',
});

async function loadGenUI() {
  const present = {};
  for (const [key, file] of Object.entries(CORE_MODULES)) {
    if (!existsSync(path.join(GENUI_DIR, file)))
      throw new Error(`Required GenUI module is missing: src/genui/${file}`);
    present[key] = file;
  }
  const missing = [];
  for (const [key, file] of Object.entries(OPTIONAL_MODULES)) {
    if (existsSync(path.join(GENUI_DIR, file))) present[key] = file;
    else missing.push(file);
  }
  const entry = Object.entries(present)
    .map(([key, file]) => `export * as ${key} from './${file}';`)
    .join('\n');
  const result = await build({
    stdin: {
      contents: entry,
      resolveDir: GENUI_DIR,
      sourcefile: 'genui-native-conformance.entry.ts',
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    target: 'esnext',
    logLevel: 'silent',
  });
  const code = result.outputFiles[0].text;
  const modules = await import(
    `data:text/javascript;base64,${Buffer.from(code, 'utf8').toString('base64')}`
  );
  return { modules, missing };
}

// ---------------------------------------------------------------------------
// Row helpers
// ---------------------------------------------------------------------------
const rootComponent = row => ({
  id: ROOT_ID,
  component: row.name,
  payload: {
    title: `${row.name} conformance`,
    native: row.sample,
    action: INSPECT_ACTION,
  },
});

function publishedSurface(runtime) {
  const surface = runtime.getSnapshot().surfaces.find(item => item.id === SURFACE_ID);
  assert.ok(surface, 'The conformance surface is not published.');
  return surface;
}

function publishedNative(runtime) {
  const block = publishedSurface(runtime).blocks[ROOT_ID];
  assert.ok(
    block && block.native && typeof block.native === 'object',
    'The root native block is not published.',
  );
  return block.native;
}

function hostNative(runtime) {
  const node = publishedSurface(runtime).components.find(item => item.id === ROOT_ID);
  assert.ok(
    node && node.payload && typeof node.payload === 'object' && 'native' in node.payload,
    'The root component payload is not published.',
  );
  return node.payload.native;
}

/** Independent local runtime whose host action handler is bound later (see step 5). */
function startRowRuntime(modules, row) {
  const host = {
    handler: null,
    handlerCalls: 0,
    hostEffects: 0,
    lastError: null,
  };
  const runtime = modules.runtime.createGenUIRuntime({
    scopeId: SCOPE_ID,
    onAction: (action, model) => {
      host.handlerCalls += 1;
      if (typeof host.handler !== 'function') throw new Error('No trusted handler is bound.');
      try {
        host.handler(action, model);
      } catch (error) {
        host.lastError = error;
        throw error;
      }
    },
  });
  runtime.beginRequest(REQUEST_ID);
  const accepted = runtime.applyBatch({
    requestId: REQUEST_ID,
    sequence: 1,
    commands: [
      {
        version: A2UI_VERSION,
        createSurface: {
          surfaceId: SURFACE_ID,
          catalogId: modules.contracts.ATLAS_CARD_CATALOG_ID,
        },
      },
      {
        version: A2UI_VERSION,
        updateComponents: {
          surfaceId: SURFACE_ID,
          components: [rootComponent(row)],
        },
      },
    ],
  });
  assert.equal(accepted.ok, true, `Stream frame rejected: ${accepted.error}`);
  runtime.finishRequest(REQUEST_ID, 'success');
  const snapshot = runtime.getSnapshot();
  assert.equal(snapshot.status, 'success', `Stream did not complete: ${snapshot.error}`);
  assert.equal(snapshot.error, null, `Stream completed with an error: ${snapshot.error}`);
  return { runtime, host };
}

function checkRow(modules, row) {
  const { contracts, policy, nativeRegistry, authorization } = modules;
  const pristineSample = JSON.parse(JSON.stringify(row.sample));

  // 1. Registry: the approved name is registered in contracts and the native registry.
  const nativeNames = contracts.GENUI_NATIVE_COMPONENT_NAMES;
  assert.ok(
    Array.isArray(nativeNames) && nativeNames.includes(row.name),
    `${row.name} is not listed in GENUI_NATIVE_COMPONENT_NAMES.`,
  );
  assert.ok(
    Array.isArray(contracts.GENUI_COMPONENT_NAMES) &&
      contracts.GENUI_COMPONENT_NAMES.includes(row.name),
    `${row.name} is not listed in GENUI_COMPONENT_NAMES.`,
  );
  assert.ok(nativeRegistry, 'src/genui/native-registry.ts is missing.');
  assert.equal(typeof nativeRegistry.nativeDefinition, 'function', 'nativeDefinition missing.');
  const definition = nativeRegistry.nativeDefinition(row.name);
  assert.ok(definition, `nativeDefinition(${row.name}) returned nothing.`);
  assert.equal(definition.name, row.name, 'Definition name does not match the registry key.');
  assert.equal(definition.readOnly, row.readOnly, 'Definition readOnly flag mismatch.');
  assert.equal(typeof definition.parse, 'function', 'Definition has no parse function.');
  assert.equal(
    typeof definition.withValue === 'function',
    row.editable,
    row.editable ? 'Definition must expose withValue.' : 'Definition must not expose withValue.',
  );
  assert.ok(nativeRegistry.NATIVE_DEFINITIONS, 'NATIVE_DEFINITIONS is not exported.');
  assert.equal(
    nativeRegistry.NATIVE_DEFINITIONS[row.name],
    definition,
    'nativeDefinition() and NATIVE_DEFINITIONS disagree.',
  );

  // 2. Serialization: the sample is plain JSON and survives policy validation unchanged.
  assert.deepEqual(pristineSample, row.sample, 'Sample does not survive a JSON round trip.');
  const component = {
    id: ROOT_ID,
    component: row.name,
    payload: { title: `${row.name} conformance`, native: row.sample },
  };
  const pristineComponent = structuredClone(component);
  const validatedComponent = policy.validateComponent(component);
  assert.deepEqual(component, pristineComponent, 'validateComponent mutated its input.');
  assert.deepEqual(row.sample, pristineSample, 'validateComponent mutated the sample.');
  const serializedComponent = JSON.parse(JSON.stringify(validatedComponent));
  assert.equal(serializedComponent.component, row.name);
  if (row.hasValue)
    assert.deepEqual(
      serializedComponent.payload.native.value,
      row.sample.value,
      'Validated component payload lost its value.',
    );
  assert.equal(typeof policy.validateTaskBlock, 'function', 'validateTaskBlock missing.');
  const block = policy.validateTaskBlock(row.name, component.payload);
  assert.deepEqual(
    component.payload,
    pristineComponent.payload,
    'validateTaskBlock mutated input.',
  );
  const serializedBlock = JSON.parse(JSON.stringify(block));
  assert.deepEqual(serializedBlock, block, 'Validated block does not survive a JSON round trip.');
  assert.ok(serializedBlock.native && typeof serializedBlock.native === 'object');
  if (row.hasValue)
    assert.deepEqual(serializedBlock.native.value, row.sample.value, 'Parsed native lost value.');
  else
    assert.equal(
      Object.hasOwn(serializedBlock.native, 'value'),
      false,
      'A value-less native must not gain a value when parsed.',
    );

  // 3. Invalid props: an unapproved model-supplied handler property is rejected.
  const forged = {
    id: ROOT_ID,
    component: row.name,
    payload: {
      title: `${row.name} conformance`,
      native: { ...row.sample, onClick: 'window.alert(1)' },
    },
  };
  assert.throws(
    () => policy.validateComponent(forged),
    Error,
    'validateComponent accepted an onClick string property on the native payload.',
  );

  // 4. Controlled values through a complete local stream.
  const { runtime, host } = startRowRuntime(modules, row);
  const before = publishedSurface(runtime);
  const sourceBefore = structuredClone(publishedNative(runtime));
  if (row.hasValue)
    assert.deepEqual(sourceBefore.value, row.sample.value, 'Published source value mismatch.');
  else
    assert.equal(
      Object.hasOwn(sourceBefore, 'value'),
      false,
      'A value-less native was published with a value.',
    );
  assert.deepEqual(hostNative(runtime), row.sample, 'Published host payload differs from sample.');
  const baseRevision = runtime.getSnapshot().revision;
  if (row.editable) {
    assert.notDeepEqual(
      row.nextValue,
      row.sample.value,
      'The expected changed value must differ from the sample value.',
    );
    const changed = runtime.changeNativeValue(
      SURFACE_ID,
      ROOT_ID,
      row.nextValue,
      before.generation,
      baseRevision,
    );
    assert.equal(changed.ok, true, `Native edit rejected: ${changed.error}`);
    const after = publishedSurface(runtime);
    assert.equal(after.generation, before.generation, 'A local edit changed the generation.');
    assert.notEqual(runtime.getSnapshot().revision, baseRevision, 'Edit did not advance revision.');
    assert.deepEqual(publishedNative(runtime).value, row.nextValue, 'Published value mismatch.');
    assert.deepEqual(hostNative(runtime), row.sample, 'Host component payload was mutated.');
    assert.deepEqual(row.sample, pristineSample, 'Source sample was mutated by the edit.');
    const stale = runtime.changeNativeValue(
      SURFACE_ID,
      ROOT_ID,
      row.nextValue,
      after.generation,
      baseRevision,
    );
    assert.equal(stale.ok, false, 'An edit against a stale revision must be rejected.');
    assert.deepEqual(
      publishedNative(runtime).value,
      row.nextValue,
      'A rejected stale edit changed the published value.',
    );
  } else {
    const rejected = runtime.changeNativeValue(
      SURFACE_ID,
      ROOT_ID,
      REJECTED_EDIT,
      before.generation,
      baseRevision,
    );
    assert.equal(rejected.ok, false, 'A value edit on a non-editable native must be rejected.');
    assert.deepEqual(
      publishedNative(runtime),
      sourceBefore,
      'Rejected edit changed published data.',
    );
    assert.deepEqual(hostNative(runtime), row.sample, 'Rejected edit changed the host payload.');
    assert.deepEqual(row.sample, pristineSample, 'Rejected edit mutated the source sample.');
    assert.equal(runtime.getSnapshot().revision, baseRevision, 'Rejected edit advanced revision.');
  }

  // 5. Unauthorized action: runtime-bound authorization with no host permission denies.
  assert.ok(authorization, 'src/genui/actions/authorization.ts is missing.');
  const actionAuthorization = authorization.createActionAuthorization({
    runtime,
  });
  host.handler = authorization.createAuthorizedActionHandler({
    authorization: actionAuthorization,
    execute: () => {
      host.hostEffects += 1;
    },
  });
  const registered = publishedSurface(runtime).blocks[ROOT_ID].action;
  assert.equal(registered?.id, INSPECT_ACTION.id, 'Inspect action is not registered on root.');
  assert.equal(registered?.intent, 'inspect');
  const currentRevision = runtime.getSnapshot().revision;
  const dispatched = runtime.dispatchAction({
    surfaceId: SURFACE_ID,
    componentId: ROOT_ID,
    actionId: INSPECT_ACTION.id,
    baseRevision: currentRevision,
    idempotencyKey: `genui-conformance-${row.name}-1`,
  });
  assert.equal(dispatched.ok, false, 'Dispatch must be denied without host authorization.');
  assert.equal(host.handlerCalls, 1, 'The registered action must reach the trusted handler.');
  assert.ok(host.lastError instanceof Error, 'The denial must originate in authorization.');
  assert.equal(host.hostEffects, 0, 'A denied action must produce no host effect.');
  assert.equal(runtime.getSnapshot().actionResult, null, 'Denied action published a result.');
  assert.equal(runtime.getSnapshot().revision, currentRevision, 'Denied action changed revision.');
}

// Adapter-specific behavior moved from the former separate files.
// Exactly one optional check per table row; no additional node:test cases.
const SPECIFIC_CHECKS = Object.freeze({
  // docs/tests/genui-native-button.test.mjs
  AtlasButton: async ctx => {
    const { assert, build, mountPattern, buttonByText } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };

    {
      // AtlasButton native node renders a labelled action whose only effect is the outer action.
      const { createGenUIRuntime } = await load('docs/src/genui/runtime.ts');
      const sample = { label: 'Review record' };
      const node = {
        id: 'root',
        component: 'AtlasButton',
        payload: { title: 'Next step', native: sample },
      };
      // Models cannot smuggle callbacks or extra properties through the native payload.
      const forged = {
        ...node,
        payload: { ...node.payload, native: { ...sample, onClick: 'alert(1)' } },
      };
      const runtime = createGenUIRuntime({ scopeId: 'native-button' });
      runtime.beginRequest('button-request');
      assert.equal(
        runtime.applyBatch({
          requestId: 'button-request',
          sequence: 1,
          commands: [
            {
              version: 'v0.9',
              createSurface: { surfaceId: 'actions', catalogId: 'local://atlas-cards/v1' },
            },
          ],
        }).ok,
        true,
      );
      const before = runtime.getSnapshot().surfaces;
      assert.equal(
        runtime.applyBatch({
          requestId: 'button-request',
          sequence: 2,
          commands: [
            { version: 'v0.9', updateComponents: { surfaceId: 'actions', components: [forged] } },
          ],
        }).ok,
        false,
      );
      assert.equal(runtime.getSnapshot().surfaces, before);

      const { definition, sample: moduleSample } = await load('docs/src/genui/native/button.ts');
      assert.deepEqual(moduleSample, sample);
      assert.equal(definition.withValue, undefined);
      const frozen = Object.freeze({ label: 'Review record', disabled: true });
      const parsed = definition.parse(frozen);
      assert.deepEqual(parsed, frozen);
      assert.notEqual(parsed, frozen);
      for (const bad of [
        { ...sample, onClick: 'alert(1)' },
        { label: '   ' },
        { label: 'x'.repeat(121) },
        { ...sample, disabled: 'yes' },
        {},
      ])
        assert.throws(() => definition.parse(bad));

      const calls = { change: 0, action: 0 };
      const props = (data, disabled = false) => ({
        data,
        disabled,
        onChange() {
          calls.change++;
        },
        onAction() {
          calls.action++;
        },
      });
      let harness = await mountPattern(
        'default',
        'docs/src/react/genui/native/button.tsx',
        props(sample),
      );
      try {
        const button = buttonByText(harness.document, sample.label);
        assert.ok(button, 'visible labelled button');
        assert.equal(button.disabled, false);
        await harness.click(button);
        assert.deepEqual(calls, { change: 0, action: 1 });
      } finally {
        await harness.dispose();
      }
      for (const [data, disabled] of [
        [{ ...sample, disabled: true }, false],
        [sample, true],
      ]) {
        harness = await mountPattern(
          'default',
          'docs/src/react/genui/native/button.tsx',
          props(data, disabled),
        );
        try {
          const button = buttonByText(harness.document, sample.label);
          assert.ok(button, 'disabled button stays visible');
          assert.equal(button.disabled, true);
          await harness.click(button);
          assert.deepEqual(calls, { change: 0, action: 1 });
        } finally {
          await harness.dispose();
        }
      }
    }

    {
      // dispatchAction rejects an enabled outer action on a disabled native AtlasButton without running it.
      const { createGenUIRuntime } = await load('docs/src/genui/runtime.ts');
      const calls = [];
      const runtime = createGenUIRuntime({
        scopeId: 'native-button-disabled',
        onAction(action) {
          calls.push(action);
        },
      });
      runtime.beginRequest('disabled-request');
      assert.equal(
        runtime.applyBatch({
          requestId: 'disabled-request',
          sequence: 1,
          commands: [
            {
              version: 'v0.9',
              createSurface: { surfaceId: 'actions', catalogId: 'local://atlas-cards/v1' },
            },
            {
              version: 'v0.9',
              updateComponents: {
                surfaceId: 'actions',
                components: [
                  {
                    id: 'root',
                    component: 'AtlasButton',
                    payload: {
                      title: 'Next step',
                      native: { label: 'Review record', disabled: true },
                      action: { id: 'inspect-record', label: 'Inspect record', intent: 'inspect' },
                    },
                  },
                ],
              },
            },
          ],
        }).ok,
        true,
      );
      runtime.finishRequest('disabled-request', 'success');
      const snapshot = runtime.getSnapshot();
      assert.equal(snapshot.status, 'success');
      const block = snapshot.surfaces.find(surface => surface.id === 'actions').blocks.root;
      assert.equal(block.native.disabled, true);
      assert.notEqual(block.action.disabled, true);

      const result = runtime.dispatchAction({
        surfaceId: 'actions',
        componentId: 'root',
        actionId: 'inspect-record',
        baseRevision: snapshot.revision,
        idempotencyKey: 'disabled-native-button-1',
      });
      assert.equal(result.ok, false);
      assert.equal(calls.length, 0);
      assert.equal(runtime.getSnapshot().actionResult, null);
    }
  },
  // docs/tests/genui-native-input.test.mjs
  AtlasInput: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const nativeSample = {
      label: 'Display name',
      value: 'Aster',
      placeholder: 'Enter a display name',
      required: true,
      maxLength: 80,
    };

    // AtlasInput native node validates, rejects invalid values and forwards typed text.
    const { validateComponent } = await load('docs/src/genui/policy.ts');
    const node = {
      id: 'name',
      component: 'AtlasInput',
      payload: { title: 'Profile', native: nativeSample },
    };
    assert.throws(() =>
      validateComponent({
        ...node,
        payload: { title: 'Profile', native: { ...nativeSample, href: 'https://atlas.test' } },
      }),
    );

    const { definition, sample } = await load('docs/src/genui/native/input.ts');
    assert.deepEqual(sample, nativeSample);
    assert.deepEqual(definition.parse(sample), nativeSample);
    const before = structuredClone(sample);
    assert.equal(definition.withValue(sample, 'Ada').value, 'Ada');
    assert.deepEqual(sample, before);
    assert.throws(() => definition.withValue(sample, 42));
    assert.throws(() => definition.withValue(sample, 'x'.repeat(81)));
    assert.throws(() => definition.withValue({ ...sample, readOnly: true }, 'Ada'));

    const changes = [];
    const harness = await mountPattern('default', 'docs/src/react/genui/native/input.tsx', {
      data: sample,
      disabled: false,
      onChange: value => changes.push(value),
      onAction() {},
    });
    try {
      const input = harness.document.querySelector('input');
      const label = harness.document.querySelector('label');
      assert.ok(input);
      assert.ok(label?.textContent.includes('Display name'));
      assert.equal(label.htmlFor, input.id);
      assert.equal(input.value, 'Aster');
      assert.equal(input.placeholder, 'Enter a display name');
      assert.equal(input.maxLength, 80);
      assert.equal(input.required, true);
      assert.equal(input.disabled, false);
      await harness.type(input, 'Ada Lovelace');
      assert.deepEqual(changes, ['Ada Lovelace']);
      assert.equal(definition.withValue(sample, changes[0]).value, 'Ada Lovelace');
    } finally {
      await harness.dispose();
    }
  },
  // docs/tests/genui-native-input-number.test.mjs
  AtlasInputNumber: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const sampleLiteral = { label: 'Quantity', value: 2, min: 0, max: 10, step: 1 };
    const node = native => ({
      id: 'root',
      component: 'AtlasInputNumber',
      payload: { title: 'Order quantity', native },
    });

    // AtlasInputNumber native node validates, renders a controlled spinbutton and rejects out-of-bound values.
    const { validateComponent } = await load('docs/src/genui/policy.ts');
    const { definition, sample } = await load('docs/src/genui/native/input-number.ts');
    assert.deepEqual(sample, sampleLiteral);

    const changes = [];
    const harness = await mountPattern('default', 'docs/src/react/genui/native/input-number.tsx', {
      data: sample,
      disabled: false,
      onChange: value => changes.push(value),
      onAction() {},
    });
    try {
      const input = harness.document.querySelector('input[role="spinbutton"]');
      assert.ok(input);
      const label = harness.document.querySelector(`label[for="${input.id}"]`);
      assert.equal(label?.textContent, 'Quantity');
      assert.equal(input.value, '2');
      assert.equal(input.getAttribute('aria-valuemin'), '0');
      assert.equal(input.getAttribute('aria-valuemax'), '10');
      assert.equal(input.disabled, false);
      await harness.type(input, '7');
      assert.equal(changes.at(-1), 7);
    } finally {
      await harness.dispose();
    }

    assert.deepEqual(definition.withValue(sample, 7), { ...sampleLiteral, value: 7 });
    assert.equal(definition.withValue(sample, null).value, null);
    assert.throws(() => definition.withValue(sample, 11));
    assert.throws(() => definition.withValue(sample, -1));
    assert.throws(() => definition.withValue(sample, '7'));
    assert.deepEqual(sample, sampleLiteral);
    assert.throws(() => validateComponent(node({ ...sampleLiteral, href: '/x' })));
    assert.throws(() => definition.parse({ ...sampleLiteral, min: 5, max: 1 }));
  },
  // docs/tests/genui-native-select.test.mjs
  AtlasSelect: async ctx => {
    const { assert, build, mountPattern, selectOption } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const native = {
      label: 'Team',
      options: [
        { id: 'design', label: 'Design' },
        { id: 'engineering', label: 'Engineering' },
        { id: 'operations', label: 'Operations' },
        { id: 'archived', label: 'Archived', disabled: true },
      ],
      value: 'design',
    };

    // AtlasSelect validates bounded options and sends real selections through checked values.
    const policy = await load('docs/src/genui/policy.ts');
    const node = { id: 'root', component: 'AtlasSelect', payload: { title: 'Team', native } };
    assert.throws(() =>
      policy.validateComponent({
        ...node,
        payload: { title: 'Team', native: { ...native, value: 'missing' } },
      }),
    );

    const { definition, sample } = await load('docs/src/genui/native/select.ts');
    assert.deepEqual(sample, native);
    const original = structuredClone(sample);
    assert.equal(definition.withValue(sample, 'engineering').value, 'engineering');
    assert.throws(() => definition.withValue(sample, 'missing'));
    assert.throws(() => definition.withValue(sample, 'archived'));
    assert.throws(() => definition.withValue(sample, ['design']));
    assert.deepEqual(sample, original);

    const changes = [];
    const harness = await mountPattern('default', 'docs/src/react/genui/native/select.tsx', {
      data: sample,
      disabled: false,
      onChange: value => changes.push(value),
      onAction() {},
    });
    try {
      const label = harness.document.querySelector('label');
      assert.equal(label?.textContent, 'Team');
      const input = harness.document.getElementById(label.htmlFor);
      assert.ok(input);
      assert.ok(input.closest('.ant-select').textContent.includes('Design'));
      await selectOption(harness, input, 'Engineering');
      assert.ok(
        [...harness.document.querySelectorAll('.ant-select-item-option-disabled')].some(
          option => option.textContent.trim() === 'Archived',
        ),
      );
      assert.deepEqual(changes, ['engineering']);
      assert.equal(definition.withValue(sample, changes[0]).value, 'engineering');
    } finally {
      await harness.dispose();
    }
  },
  // docs/tests/genui-native-radio.test.mjs
  AtlasRadio: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async contents => {
      const bundled = await build({
        stdin: { contents, resolveDir: process.cwd(), sourcefile: 'radio-entry.ts', loader: 'ts' },
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const native = {
      label: 'Team',
      value: 'design',
      options: [
        { id: 'design', label: 'Design' },
        { id: 'engineering', label: 'Engineering' },
        { id: 'operations', label: 'Operations', disabled: true },
      ],
    };

    // AtlasRadio validates bounded exclusive options and reports real user choices.
    const { validateComponent, createGenUIRuntime } = await load(
      "export { validateComponent } from './docs/src/genui/policy.ts'; export { createGenUIRuntime } from './docs/src/genui/runtime.ts';",
    );
    const node = { id: 'root', component: 'AtlasRadio', payload: { title: 'Choose team', native } };
    assert.throws(() =>
      validateComponent({
        ...node,
        payload: { title: 'Choose team', native: { ...native, href: 'https://atlas.test/' } },
      }),
    );

    const runtime = createGenUIRuntime({ scopeId: 'radio-scope' });
    runtime.beginRequest('radio-request');
    assert.equal(
      runtime.applyBatch({
        requestId: 'radio-request',
        sequence: 1,
        commands: [
          {
            version: 'v0.9',
            createSurface: { surfaceId: 'records', catalogId: 'local://atlas-cards/v1' },
          },
          { version: 'v0.9', updateComponents: { surfaceId: 'records', components: [node] } },
        ],
      }).ok,
      true,
    );
    runtime.finishRequest('radio-request', 'success');
    const generation = runtime.getSnapshot().surfaces[0].generation;
    assert.equal(
      runtime.changeNativeValue(
        'records',
        'root',
        'engineering',
        generation,
        runtime.getSnapshot().revision,
      ).ok,
      true,
    );
    assert.equal(
      runtime.changeNativeValue(
        'records',
        'root',
        'operations',
        generation,
        runtime.getSnapshot().revision,
      ).ok,
      false,
    );

    const { definition, sample } = await load("export * from './docs/src/genui/native/radio.ts';");
    assert.deepEqual(definition.parse(sample), native);
    const input = structuredClone(native);
    assert.equal(definition.withValue(input, 'engineering').value, 'engineering');
    assert.deepEqual(input, native);
    for (const invalid of ['unknown', 'operations', 3])
      assert.throws(() => definition.withValue(native, invalid));

    const changes = [];
    const harness = await mountPattern('default', 'docs/src/react/genui/native/radio.tsx', {
      data: native,
      disabled: false,
      onChange: value => changes.push(value),
      onAction() {},
    });
    try {
      const group = harness.document.querySelector('[aria-label="Team"]');
      assert.ok(group);
      const radios = [...group.querySelectorAll('input[type="radio"]')];
      assert.deepEqual(
        radios.map(radio => radio.value),
        ['design', 'engineering', 'operations'],
      );
      assert.match(group.textContent, /Design.*Engineering.*Operations/);
      assert.equal(radios.find(radio => radio.checked).value, 'design');
      assert.equal(radios[2].disabled, true);
      await harness.click(radios[1]);
      assert.deepEqual(changes, ['engineering']);
      assert.equal(
        [...group.querySelectorAll('input[type="radio"]')].find(radio => radio.checked).value,
        'design',
      );
      await harness.click(radios[2]);
      assert.deepEqual(changes, ['engineering']);
    } finally {
      await harness.dispose();
    }
  },
  // docs/tests/genui-native-checkbox.test.mjs
  AtlasCheckbox: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };

    // AtlasCheckbox validates a labelled boolean and routes a real click through withValue.
    const { createGenUIRuntime } = await load('docs/src/genui/runtime.ts');
    const literal = { label: 'Notify the review team', value: false };
    const node = {
      id: 'notice',
      component: 'AtlasCheckbox',
      payload: { title: 'Review notice', native: literal },
    };

    const runtime = createGenUIRuntime({ scopeId: 'checkbox-scope' });
    runtime.beginRequest('checkbox-request');
    assert.equal(
      runtime.applyBatch({
        requestId: 'checkbox-request',
        sequence: 1,
        commands: [
          {
            version: 'v0.9',
            createSurface: { surfaceId: 'records', catalogId: 'local://atlas-cards/v1' },
          },
          {
            version: 'v0.9',
            updateComponents: {
              surfaceId: 'records',
              components: [{ id: 'root', component: 'AtlasStack', children: ['notice'] }, node],
            },
          },
        ],
      }).ok,
      true,
    );
    runtime.finishRequest('checkbox-request', 'success');
    const { revision } = runtime.getSnapshot();
    const { generation } = runtime.getSnapshot().surfaces[0];
    assert.equal(
      runtime.changeNativeValue('records', 'notice', 'yes', generation, revision).ok,
      false,
    );
    assert.equal(
      runtime.changeNativeValue('records', 'notice', true, generation, revision - 1).ok,
      false,
    );
    assert.equal(
      runtime.changeNativeValue('records', 'notice', true, generation, revision).ok,
      true,
    );

    const { definition, sample } = await load('docs/src/genui/native/checkbox.ts');
    assert.deepEqual(definition.parse(sample), literal);
    assert.throws(() => definition.parse({ ...literal, href: 'https://example.com' }));
    assert.throws(() => definition.withValue(sample, 'yes'));
    assert.throws(() => definition.withValue({ ...literal, readOnly: true }, true));

    const changes = [];
    const harness = await mountPattern('default', 'docs/src/react/genui/native/checkbox.tsx', {
      data: sample,
      disabled: false,
      onChange: value => changes.push(value),
      onAction() {},
    });
    try {
      const input = harness.document.querySelector('input[type="checkbox"]');
      assert.ok(input);
      assert.equal(input.checked, false);
      assert.equal(input.disabled, false);
      assert.equal(input.closest('label').textContent.trim(), literal.label);
      await harness.click(input);
      assert.deepEqual(changes, [true]);
      assert.deepEqual(definition.withValue(sample, changes[0]), { ...literal, value: true });
      assert.deepEqual(sample, literal);
    } finally {
      await harness.dispose();
    }
  },
  // docs/tests/genui-native-switch.test.mjs
  AtlasSwitch: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };

    // AtlasSwitch is an approved native node whose labelled controlled switch reports immediate boolean changes.
    const nativeLiteral = { label: 'Email notifications', value: false };
    const { definition, sample } = await load('docs/src/genui/native/switch.ts');
    assert.deepEqual(sample, nativeLiteral);
    assert.deepEqual(definition.parse(sample), nativeLiteral);
    assert.throws(() => definition.parse({ ...sample, value: 'yes' }));
    assert.throws(() => definition.parse({ ...sample, onClick: 'alert(1)' }));
    assert.throws(() => definition.parse({ label: ' ', value: true }));
    assert.throws(() => definition.withValue(sample, 'true'));
    const input = { ...sample };
    assert.deepEqual(definition.withValue(input, true), { ...sample, value: true });
    assert.deepEqual(input, nativeLiteral);

    const changes = [];
    const props = { data: sample, disabled: false, onChange: v => changes.push(v), onAction() {} };
    const harness = await mountPattern('default', 'docs/src/react/genui/native/switch.tsx', props);
    try {
      const control = harness.document.querySelector('button[role="switch"]');
      assert.ok(control);
      assert.equal(control.getAttribute('aria-checked'), 'false');
      const labelledBy = control.getAttribute('aria-labelledby');
      assert.equal(harness.document.getElementById(labelledBy)?.textContent, 'Email notifications');
      await harness.click(control);
      assert.deepEqual(changes, [true]);
      assert.equal(control.getAttribute('aria-checked'), 'false');
    } finally {
      await harness.dispose();
    }

    const locked = await mountPattern('default', 'docs/src/react/genui/native/switch.tsx', {
      ...props,
      data: { ...sample, disabled: true },
    });
    try {
      const control = locked.document.querySelector('button[role="switch"]');
      assert.equal(control.disabled, true);
      await locked.click(control);
      assert.deepEqual(changes, [true]);
    } finally {
      await locked.dispose();
    }
  },
  // docs/tests/genui-native-slider.test.mjs
  AtlasSlider: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const sampleLiteral = { label: 'Review threshold', value: 40, min: 0, max: 100, step: 5 };
    const node = native => ({
      id: 'threshold',
      component: 'AtlasSlider',
      payload: { title: 'Threshold', native },
    });
    const create = {
      version: 'v0.9',
      createSurface: { surfaceId: 'records', catalogId: 'local://atlas-cards/v1' },
    };
    const update = nodes => ({
      version: 'v0.9',
      updateComponents: { surfaceId: 'records', components: nodes },
    });
    const arrowRight = window => {
      const event = new window.KeyboardEvent('keydown', {
        key: 'ArrowRight',
        code: 'ArrowRight',
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, 'keyCode', { value: 39 });
      Object.defineProperty(event, 'which', { value: 39 });
      return event;
    };

    {
      // AtlasSlider native node validates step-aligned bounded values and reports user changes.
      const { validateComponent } = await load('docs/src/genui/policy.ts');
      const { createGenUIRuntime } = await load('docs/src/genui/runtime.ts');
      const runtime = createGenUIRuntime({ scopeId: 'slider-scope' });
      runtime.beginRequest('slider-request');
      assert.equal(
        runtime.applyBatch({
          requestId: 'slider-request',
          sequence: 1,
          commands: [
            create,
            update([
              { id: 'root', component: 'AtlasStack', children: ['threshold'] },
              node(sampleLiteral),
            ]),
          ],
        }).ok,
        true,
      );
      runtime.finishRequest('slider-request', 'success');

      const { definition, sample } = await load('docs/src/genui/native/slider.ts');
      assert.deepEqual(definition.parse(sample), sampleLiteral);
      assert.throws(() => validateComponent(node({ ...sampleLiteral, value: 42 })));
      assert.throws(() => definition.parse({ ...sampleLiteral, href: 'https://atlas.test/' }));
      const frozen = structuredClone(sample);
      assert.equal(definition.withValue(sample, 45).value, 45);
      for (const bad of [42, Number.NaN, 105, '45'])
        assert.throws(() => definition.withValue(sample, bad));
      assert.deepEqual(sample, frozen);
      const { revision, surfaces } = runtime.getSnapshot();
      const generation = surfaces[0].generation;
      assert.equal(
        runtime.changeNativeValue('records', 'threshold', 42, generation, revision).ok,
        false,
      );
      assert.equal(
        runtime.changeNativeValue('records', 'threshold', 45, generation, revision).ok,
        true,
      );

      const changes = [];
      const entry = 'docs/src/react/genui/native/slider.tsx';
      const props = data => ({
        data,
        disabled: false,
        onChange: value => changes.push(value),
        onAction() {},
      });
      const harness = await mountPattern('default', entry, props(sample));
      try {
        const handle = harness.document.querySelector('[role="slider"]');
        assert.ok(handle);
        assert.equal(handle.getAttribute('aria-valuenow'), '40');
        assert.equal(handle.getAttribute('aria-valuemin'), '0');
        assert.equal(handle.getAttribute('aria-valuemax'), '100');
        const label = harness.document.getElementById(handle.getAttribute('aria-labelledby'));
        assert.equal(label?.textContent, 'Review threshold');
        await harness.act(async () => {
          handle.dispatchEvent(arrowRight(harness.window));
        });
        assert.deepEqual(changes, [45]);
      } finally {
        await harness.dispose();
      }
      const locked = await mountPattern('default', entry, props({ ...sample, readOnly: true }));
      try {
        const handle = locked.document.querySelector('[role="slider"]');
        assert.equal(handle.getAttribute('aria-disabled'), 'true');
        await locked.act(async () => {
          handle.dispatchEvent(arrowRight(locked.window));
        });
        assert.deepEqual(changes, [45]);
      } finally {
        await locked.dispose();
      }
    }

    {
      // AtlasSlider rejects an invalid readOnly flag even when disabled is true.
      const { definition, sample } = await load('docs/src/genui/native/slider.ts');
      assert.throws(
        () => definition.parse({ ...sample, disabled: true, readOnly: 'invalid' }),
        /AtlasSlider readOnly must be a boolean\./,
      );
    }
  },
  // docs/tests/genui-native-cascader.test.mjs
  AtlasCascader: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };

    {
      // AtlasCascader native node accepts only complete enabled paths and reports user selections.
      const native = {
        label: 'Service area',
        placeholder: 'Choose a service area',
        options: [
          {
            value: 'north',
            label: 'North region',
            children: [
              { value: 'harbor', label: 'Harbor district' },
              { value: 'old-town', label: 'Old town', disabled: true },
            ],
          },
          {
            value: 'south',
            label: 'South region',
            description: 'Coastal teams',
            children: [{ value: 'bay', label: 'Bay office' }],
          },
        ],
        value: ['north', 'harbor'],
      };
      const node = {
        id: 'root',
        component: 'AtlasCascader',
        payload: { title: 'Service area', native },
      };

      const { createGenUIRuntime } = await load('docs/src/genui/runtime.ts');
      const runtime = createGenUIRuntime({ scopeId: 'cascader-scope' });
      runtime.beginRequest('cascader-request');
      assert.equal(
        runtime.applyBatch({
          requestId: 'cascader-request',
          sequence: 1,
          commands: [
            {
              version: 'v0.9',
              createSurface: { surfaceId: 'records', catalogId: 'local://atlas-cards/v1' },
            },
            { version: 'v0.9', updateComponents: { surfaceId: 'records', components: [node] } },
          ],
        }).ok,
        true,
      );
      runtime.finishRequest('cascader-request', 'success');
      const snapshot = runtime.getSnapshot();
      const generation = snapshot.surfaces[0].generation;
      assert.equal(
        runtime.changeNativeValue(
          'records',
          'root',
          ['north', 'old-town'],
          generation,
          snapshot.revision,
        ).ok,
        false,
      );
      assert.equal(
        runtime.changeNativeValue(
          'records',
          'root',
          ['south', 'bay'],
          generation,
          snapshot.revision,
        ).ok,
        true,
      );

      // Schema: exact payload, complete enabled leaf paths, no input mutation.
      const { definition, sample } = await load('docs/src/genui/native/cascader.ts');
      assert.deepEqual(definition.parse(sample), sample);
      assert.deepEqual(definition.parse(native), native);
      const original = structuredClone(native);
      assert.deepEqual(definition.withValue(native, ['south', 'bay']).value, ['south', 'bay']);
      assert.equal(definition.withValue(native, null).value, null);
      assert.deepEqual(native, original);
      assert.throws(() => definition.withValue(native, ['north', 'old-town']));
      assert.throws(() => definition.withValue(native, ['north']));
      assert.throws(() => definition.withValue(native, ['north', 'bay']));
      assert.throws(
        () =>
          definition.parse({
            ...native,
            options: [...native.options, { value: 'harbor', label: 'Second harbor' }],
          }),
        /duplicate/i,
      );

      // Adapter: real AtlasCascader control; a user path selection reaches onChange.
      const changes = [];
      const harness = await mountPattern('default', 'docs/src/react/genui/native/cascader.tsx', {
        data: native,
        disabled: false,
        onChange: value => changes.push(value),
        onAction() {},
      });
      try {
        const input = harness.document.querySelector('input[role="combobox"]');
        assert.ok(input);
        assert.equal(input.disabled, false);
        assert.equal(
          harness.document.querySelector(`label[for="${input.id}"]`)?.textContent,
          'Service area',
        );
        assert.match(
          harness.document.querySelector('.atlas-cascader').textContent,
          /North region \/ Harbor district/,
        );
        const control = input.closest('.atlas-cascader-control') ?? input.closest('.ant-select');
        await harness.act(async () => {
          control.dispatchEvent(
            new harness.window.MouseEvent('mousedown', {
              bubbles: true,
              cancelable: true,
              button: 0,
            }),
          );
        });
        const item = text =>
          [...harness.document.querySelectorAll('.ant-cascader-menu-item')].find(
            entry => entry.querySelector('.atlas-cascader-option > span')?.textContent === text,
          );
        await harness.waitFor(() => item('South region'), 'top-level cascader options');
        await harness.click(item('South region'));
        await harness.waitFor(() => item('Bay office'), 'child cascader options');
        await harness.click(item('Bay office'));
        assert.deepEqual(changes, [['south', 'bay']]);
      } finally {
        await harness.dispose();
      }
    }

    {
      // AtlasCascader native multiple selection keeps complete paths for a leaf repeated under different parents.
      const native = {
        label: 'Coverage areas',
        multiple: true,
        options: [
          {
            value: 'north',
            label: 'North region',
            children: [
              { value: 'depot', label: 'North depot' },
              { value: 'harbor', label: 'Harbor district' },
            ],
          },
          {
            value: 'south',
            label: 'South region',
            children: [
              { value: 'depot', label: 'South depot' },
              { value: 'bay', label: 'Bay office', disabled: true },
            ],
          },
        ],
        value: [['north', 'depot']],
      };
      const node = {
        id: 'coverage',
        component: 'AtlasCascader',
        payload: { title: 'Coverage areas', native },
      };
      // The surface graph needs a root; the native node is its only child.
      const root = { id: 'root', component: 'AtlasStack', children: [node.id] };

      // Current policy must accept the multiple node whose leaf value repeats across parents.
      const { validateComponent } = await load('docs/src/genui/policy.ts');
      assert.equal(validateComponent(node).component, 'AtlasCascader');
      const { createGenUIRuntime } = await load('docs/src/genui/runtime.ts');
      const runtime = createGenUIRuntime({ scopeId: 'cascader-multiple-scope' });
      runtime.beginRequest('cascader-multiple-request');
      assert.equal(
        runtime.applyBatch({
          requestId: 'cascader-multiple-request',
          sequence: 1,
          commands: [
            {
              version: 'v0.9',
              createSurface: { surfaceId: 'records', catalogId: 'local://atlas-cards/v1' },
            },
            {
              version: 'v0.9',
              updateComponents: { surfaceId: 'records', components: [root, node] },
            },
          ],
        }).ok,
        true,
      );
      runtime.finishRequest('cascader-multiple-request', 'success');
      const snapshot = runtime.getSnapshot();
      const generation = snapshot.surfaces[0].generation;
      const both = [
        ['north', 'depot'],
        ['south', 'depot'],
      ];
      assert.equal(
        runtime.changeNativeValue(
          'records',
          'coverage',
          [both[0], both[0]],
          generation,
          snapshot.revision,
        ).ok,
        false,
      );
      assert.equal(
        runtime.changeNativeValue(
          'records',
          'coverage',
          both,
          generation,
          runtime.getSnapshot().revision,
        ).ok,
        true,
      );

      // Schema: each path checked on its own; cleared is []; siblings stay unique.
      const { definition } = await load('docs/src/genui/native/cascader.ts');
      assert.deepEqual(definition.parse(native), native);
      assert.deepEqual(definition.withValue(native, both).value, both);
      assert.deepEqual(definition.withValue(native, []).value, []);
      assert.throws(() => definition.withValue(native, null));
      assert.throws(() => definition.withValue(native, [['south', 'bay']]));
      assert.throws(() => definition.withValue(native, [['north']]));
      assert.throws(
        () =>
          definition.parse({
            ...native,
            options: [...native.options, { value: 'north', label: 'Second north' }],
          }),
        /duplicate/i,
      );

      // Adapter: a real native check reports full paths that tell the two depots apart.
      const changes = [];
      const harness = await mountPattern('default', 'docs/src/react/genui/native/cascader.tsx', {
        data: native,
        disabled: false,
        onChange: value => changes.push(value),
        onAction() {},
      });
      try {
        const input = harness.document.querySelector('input[role="combobox"]');
        assert.ok(input);
        const control = input.closest('.atlas-cascader-control') ?? input.closest('.ant-select');
        await harness.act(async () => {
          control.dispatchEvent(
            new harness.window.MouseEvent('mousedown', {
              bubbles: true,
              cancelable: true,
              button: 0,
            }),
          );
        });
        const item = text =>
          [...harness.document.querySelectorAll('.ant-cascader-menu-item')].find(
            entry => entry.querySelector('.atlas-cascader-option > span')?.textContent === text,
          );
        await harness.waitFor(() => item('South region'), 'top-level cascader options');
        await harness.click(item('South region'));
        await harness.waitFor(() => item('South depot'), 'child cascader options');
        const checkbox = item('South depot').querySelector('.ant-cascader-checkbox');
        assert.ok(checkbox);
        await harness.click(checkbox);
        assert.equal(changes.length, 1);
        assert.deepEqual(changes[0].map(path => path.join('/')).sort(), [
          'north/depot',
          'south/depot',
        ]);
      } finally {
        await harness.dispose();
      }
    }
  },
  // docs/tests/genui-native-date-time.test.mjs
  AtlasDateTimePicker: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const sampleLiteral = {
      kind: 'date',
      label: 'Delivery date',
      value: '2026-10-20',
      minDate: '2026-10-01',
      maxDate: '2026-12-31',
      disabledWeekdays: [0, 6],
      required: true,
      help: 'Weekdays in the delivery window.',
    };

    {
      // Validates constrained wall-time values and commits real picker selections.
      const { definition, sample } = await load('docs/src/genui/native/date-time.ts');
      assert.deepEqual(sample, sampleLiteral);
      assert.deepEqual(definition.parse(sampleLiteral), sampleLiteral);
      assert.equal(definition.withValue(sample, '2026-10-21').value, '2026-10-21');
      assert.deepEqual(sample, sampleLiteral);
      assert.throws(() => definition.withValue(sample, '2026-10-24'), /available weekday/);
      assert.throws(
        () => definition.parse({ ...sampleLiteral, value: '2026-02-30' }),
        /calendar date/,
      );

      const changes = [];
      const harness = await mountPattern('default', 'docs/src/react/genui/native/date-time.tsx', {
        data: sample,
        disabled: false,
        onChange: value => changes.push(value),
        onAction() {},
      });
      try {
        const group = harness.document.querySelector('[data-atlas-date-time="date"]');
        assert.ok(group);
        assert.match(group.textContent, /Delivery date/);
        const input = group.querySelector('input');
        assert.equal(input.value, '2026-10-20');
        await harness.act(async () => {
          input.focus();
        });
        await harness.click(input);
        const cell = date => harness.document.querySelector(`td[title="${date}"]`);
        await harness.waitFor(() => cell('2026-10-21'), 'October date panel');
        assert.ok(cell('2026-10-24').classList.contains('ant-picker-cell-disabled'));
        assert.ok(cell('2026-09-30').classList.contains('ant-picker-cell-disabled'));
        assert.equal(cell('2026-10-21').classList.contains('ant-picker-cell-disabled'), false);
        await harness.click(cell('2026-10-21').querySelector('.ant-picker-cell-inner'));
        await harness.waitFor(() => changes.length > 0, 'committed date change');
        assert.deepEqual(changes, ['2026-10-21']);
      } finally {
        await harness.dispose();
      }
    }

    {
      // Accepts validated cell notes and renders each on its calendar date.
      const native = {
        ...sampleLiteral,
        cellNotes: [{ date: '2026-10-22', label: 'Dock closed' }],
      };
      const node = {
        id: 'delivery-notes',
        component: 'AtlasDateTimePicker',
        payload: { title: 'Delivery', native },
      };
      const { validateComponent } = await load('docs/src/genui/policy.ts');
      assert.equal(validateComponent(node).component, 'AtlasDateTimePicker');

      const changes = [];
      const harness = await mountPattern('default', 'docs/src/react/genui/native/date-time.tsx', {
        data: native,
        disabled: false,
        onChange: value => changes.push(value),
        onAction() {},
      });
      try {
        const input = harness.document.querySelector('[data-atlas-date-time="date"] input');
        assert.ok(input);
        await harness.act(async () => {
          input.focus();
        });
        await harness.click(input);
        const cell = date => harness.document.querySelector(`td[title="${date}"]`);
        await harness.waitFor(() => cell('2026-10-22'), 'October date panel');
        assert.match(cell('2026-10-22').textContent, /Dock closed/);
        assert.doesNotMatch(cell('2026-10-21').textContent, /Dock closed/);
        assert.deepEqual(changes, []);
      } finally {
        await harness.dispose();
      }
    }
  },
  // docs/tests/genui-native-pagination.test.mjs
  AtlasPagination: async ctx => {
    const { assert, build, mountPattern } = ctx;
    async function load(entry) {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    }

    const native = { value: 2, total: 48, pageSize: 10, label: 'Order pages' };
    const node = {
      id: 'pages',
      component: 'AtlasPagination',
      payload: { title: 'Orders', native },
    };

    const { validateComponent } = await load('docs/src/genui/policy.ts');
    const { createGenUIRuntime } = await load('docs/src/genui/runtime.ts');
    assert.deepEqual(validateComponent(node), node);
    assert.throws(() =>
      validateComponent({ ...node, payload: { title: 'Orders', native: { ...native, value: 0 } } }),
    );
    const runtime = createGenUIRuntime({ scopeId: 'pagination-scope' });
    runtime.beginRequest('pagination-request');
    const result = runtime.applyBatch({
      requestId: 'pagination-request',
      sequence: 1,
      commands: [
        {
          version: 'v0.9',
          createSurface: { surfaceId: 'records', catalogId: 'local://atlas-cards/v1' },
        },
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'records',
            components: [
              {
                id: 'root',
                component: 'AtlasTaskSurface',
                payload: { title: 'Orders', intent: 'query' },
                children: ['pages'],
              },
              node,
            ],
          },
        },
      ],
    });
    assert.equal(result.ok, true, result.error);

    const { definition, sample } = await load('docs/src/genui/native/pagination.ts');
    assert.deepEqual(sample, native);
    const moved = definition.withValue(sample, 3);
    assert.equal(moved.value, 3);
    assert.equal(sample.value, 2);
    for (const value of [6, 2.5, '3']) assert.throws(() => definition.withValue(sample, value));
    assert.throws(() => definition.parse({ ...sample, href: 'https://example.test' }));

    const changes = [];
    const harness = await mountPattern('default', 'docs/src/react/genui/native/pagination.tsx', {
      data: sample,
      disabled: false,
      onChange: value => changes.push(value),
      onAction() {},
    });
    try {
      const nav = harness.document.querySelector('nav[aria-label="Order pages"]');
      assert.ok(nav);
      assert.equal(nav.getAttribute('data-pagination-pages'), '5');
      assert.equal(nav.querySelector('[aria-current="page"]')?.textContent.trim(), '2');
      const next = nav.querySelector('[data-pagination-page="3"]');
      assert.ok(next);
      assert.equal(next.getAttribute('aria-current'), null);
      await harness.click(next);
      assert.deepEqual(changes, [3]);
    } finally {
      await harness.dispose();
    }
  },
  // docs/tests/genui-native-steps.test.mjs
  AtlasSteps: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };

    const native = {
      label: 'Onboarding progress',
      value: 0,
      items: [
        { id: 'account', title: 'Account', description: 'Confirm the workspace owner.' },
        { id: 'review', title: 'Review', description: 'Check imported records.' },
        { id: 'publish', title: 'Publish', disabled: true },
      ],
    };

    const { definition, sample } = await load('docs/src/genui/native/steps.ts');
    assert.deepEqual(definition.parse(sample), native);
    assert.throws(() =>
      definition.parse({ ...native, items: [...native.items, { id: 'account', title: 'Again' }] }),
    );
    const original = structuredClone(sample);
    assert.equal(definition.withValue(sample, 1).value, 1);
    assert.deepEqual(sample, original);
    for (const invalid of [2, 3, -1, 0.5, '1', null])
      assert.throws(() => definition.withValue(sample, invalid));

    const changes = [];
    const harness = await mountPattern('default', 'docs/src/react/genui/native/steps.tsx', {
      data: sample,
      disabled: false,
      onChange: value => changes.push(value),
      onAction() {},
    });
    try {
      const group = harness.document.querySelector('.atlas-steps[role="group"]');
      assert.ok(group);
      assert.equal(group.getAttribute('aria-label'), 'Onboarding progress');
      const steps = [...group.querySelectorAll('.ant-steps-item')];
      assert.equal(steps.length, 3);
      assert.equal(steps[0].getAttribute('aria-current'), 'step');
      assert.equal(steps[2].getAttribute('aria-disabled'), 'true');
      assert.match(group.textContent, /Check imported records\./);
      await harness.click(group.querySelector('[data-step-key="publish"] [data-atlas-step-title]'));
      assert.deepEqual(changes, []);
      await harness.click(group.querySelector('[data-step-key="review"] [data-atlas-step-title]'));
      assert.deepEqual(changes, [1]);
      assert.equal(definition.withValue(sample, changes[0]).value, 1);
    } finally {
      await harness.dispose();
    }
  },
  // docs/tests/genui-native-breadcrumb.test.mjs
  AtlasBreadcrumb: async ctx => {
    const { assert, build, mountPattern, buttonByText } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const SAMPLE = {
      label: 'Catalog path',
      items: [
        { key: 'home', label: 'Home' },
        { key: 'catalog', label: 'Catalog' },
        { key: 'lighting', label: 'Lighting' },
        { key: 'lamps', label: 'Desk lamps' },
        { key: 'archive', label: 'Archive', disabled: true },
      ],
      value: 'lighting',
    };

    const { definition, sample } = await load('docs/src/genui/native/breadcrumb.ts');
    assert.deepEqual(sample, SAMPLE);
    assert.deepEqual(definition.parse(sample), SAMPLE);
    const input = structuredClone(sample);
    assert.equal(definition.withValue(input, 'catalog').value, 'catalog');
    assert.deepEqual(input, SAMPLE);
    assert.throws(() => definition.withValue(sample, 'nowhere'));
    assert.throws(() => definition.withValue(sample, 'archive'));
    assert.throws(() =>
      definition.parse({
        ...sample,
        items: [{ key: 'home', label: 'Home', href: 'javascript:alert(1)' }],
        value: 'home',
      }),
    );

    const changes = [];
    const harness = await mountPattern('default', 'docs/src/react/genui/native/breadcrumb.tsx', {
      data: sample,
      disabled: false,
      onChange: value => changes.push(value),
      onAction() {},
    });
    try {
      const { document } = harness;
      assert.equal(document.querySelector('nav')?.getAttribute('aria-label'), 'Catalog path');
      assert.equal(document.querySelector('[aria-current="page"]')?.textContent.trim(), 'Lighting');
      const links = [...document.querySelectorAll('a.atlas-breadcrumb-link')];
      assert.deepEqual(
        links.map(link => link.getAttribute('href')),
        ['#home', '#catalog'],
      );
      await harness.click(links.find(link => link.textContent.trim() === 'Catalog'));
      assert.deepEqual(changes, ['catalog']);
      assert.equal(harness.window.location.hash, '');
      await harness.click(
        buttonByText(document, '') ?? document.querySelector('.atlas-breadcrumb-trigger'),
      );
      await harness.waitFor(
        () => document.querySelectorAll('[role="menuitem"] a[href]').length > 0,
        'sibling menu',
      );
      const menu = [...document.querySelectorAll('[role="menuitem"] a[href]')];
      assert.deepEqual(
        menu.map(link => link.textContent.trim()),
        ['Home', 'Catalog', 'Desk lamps'],
      );
      await harness.click(menu.find(link => link.textContent.trim() === 'Desk lamps'));
      assert.deepEqual(changes, ['catalog', 'lamps']);
      assert.equal(harness.window.location.hash, '');
    } finally {
      await harness.dispose();
    }

    const locked = await mountPattern('default', 'docs/src/react/genui/native/breadcrumb.tsx', {
      data: sample,
      disabled: true,
      onChange: value => changes.push(value),
      onAction() {},
    });
    try {
      assert.equal(locked.document.querySelectorAll('a[href], button').length, 0);
      assert.equal(
        locked.document.querySelector('[aria-current="page"]')?.textContent.trim(),
        'Lighting',
      );
    } finally {
      await locked.dispose();
    }
  },
  // docs/tests/genui-native-accordion.test.mjs
  AtlasAccordion: async ctx => {
    const { assert, build, mountPattern, headerByText } = ctx;
    const load = async contents => {
      const bundled = await build({
        stdin: {
          contents,
          resolveDir: process.cwd(),
          sourcefile: 'accordion-entry.ts',
          loader: 'ts',
        },
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };

    const native = {
      items: [
        { id: 'scope', title: 'Scope', body: 'Records from the selected workspace.' },
        { id: 'source', title: 'Source', body: 'Recorded host snapshot.' },
        { id: 'retention', title: 'Retention', body: 'Kept for 30 days.', disabled: true },
      ],
      value: ['scope'],
    };

    const { validateComponent } = await load(
      "export { validateComponent } from './docs/src/genui/policy.ts'; export { createGenUIRuntime } from './docs/src/genui/runtime.ts';",
    );
    const node = { id: 'root', component: 'AtlasAccordion', payload: { title: 'Details', native } };
    assert.deepEqual(validateComponent(node).payload.native, native);

    const { definition, sample } = await load(
      "export * from './docs/src/genui/native/accordion.ts';",
    );
    assert.deepEqual(sample, native);
    assert.deepEqual(definition.parse(sample), native);
    assert.throws(() => definition.parse({ ...native, value: ['ghost'] }));
    const next = definition.withValue(sample, ['scope', 'source']);
    assert.deepEqual(next.value, ['scope', 'source']);
    assert.deepEqual(sample.value, ['scope']);
    assert.throws(() => definition.withValue(sample, ['retention']));

    const changes = [];
    const harness = await mountPattern('default', 'docs/src/react/genui/native/accordion.tsx', {
      data: sample,
      disabled: false,
      onChange: value => changes.push(value),
      onAction() {},
    });
    try {
      const { document } = harness;
      assert.ok(document.querySelector('.ant-collapse'));
      const scope = headerByText(document, 'Scope');
      const source = headerByText(document, 'Source');
      const retention = headerByText(document, 'Retention');
      assert.equal(scope.getAttribute('aria-expanded'), 'true');
      assert.equal(source.getAttribute('aria-expanded'), 'false');
      assert.equal(retention.getAttribute('aria-disabled'), 'true');
      assert.ok(document.body.textContent.includes('Records from the selected workspace.'));
      await harness.click(source);
      assert.equal(changes.length, 1);
      assert.deepEqual([...changes[0]].sort(), ['scope', 'source']);
      assert.deepEqual(definition.withValue(sample, changes[0]).value, changes[0]);
      // Controlled: no hidden local state expands the panel without a runtime update.
      assert.equal(headerByText(document, 'Source').getAttribute('aria-expanded'), 'false');
      await harness.click(retention);
      assert.equal(changes.length, 1);
    } finally {
      await harness.dispose();
    }
  },
  // docs/tests/genui-native-pill.test.mjs
  AtlasPill: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };

    const { validateComponent } = await load('docs/src/genui/policy.ts');
    const node = {
      id: 'status',
      component: 'AtlasPill',
      payload: { title: 'Status', native: { label: 'Approved', colorIndex: 4 } },
    };
    assert.throws(() =>
      validateComponent({
        ...node,
        payload: { title: 'Status', native: { label: 'Approved', colorIndex: 24 } },
      }),
    );

    const { definition, sample } = await load('docs/src/genui/native/pill.ts');
    assert.deepEqual(definition.parse(sample), sample);
    assert.throws(() => definition.parse({ label: 'Approved', style: 'color: red' }));

    const harness = await mountPattern('default', 'docs/src/react/genui/native/pill.tsx', {
      data: sample,
      disabled: false,
      onChange() {
        throw new Error('read-only pill must not change');
      },
      onAction() {
        throw new Error('read-only pill must not act');
      },
    });
    try {
      const pill = harness.document.querySelector('.atlas-pill');
      assert.ok(pill, 'AtlasPill rendered');
      assert.equal(pill.querySelector('.atlas-pill-label').textContent, 'Approved');
      assert.equal(
        harness.document.querySelector('input, button, select, .atlas-pill-close'),
        null,
      );
    } finally {
      await harness.dispose();
    }
  },
  // docs/tests/genui-native-avatar.test.mjs
  AtlasAvatar: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const sample = { name: 'Ada Lovelace', shape: 'circle' };
    const unsafe = { name: 'Ada Lovelace', src: 'javascript:alert(1)' };
    const node = native => ({
      id: 'root',
      component: 'AtlasAvatar',
      payload: { title: 'Record owner', native },
    });

    const { validateComponent } = await load('docs/src/genui/policy.ts');
    const { createGenUIRuntime } = await load('docs/src/genui/runtime.ts');
    assert.deepEqual(validateComponent(node(sample)).payload.native, sample);
    assert.throws(() => validateComponent(node(unsafe)));

    const runtime = createGenUIRuntime({ scopeId: 'avatar-scope' });
    runtime.beginRequest('avatar-request');
    assert.equal(
      runtime.applyBatch({
        requestId: 'avatar-request',
        sequence: 1,
        commands: [
          {
            version: 'v0.9',
            createSurface: { surfaceId: 'people', catalogId: 'local://atlas-cards/v1' },
          },
          {
            version: 'v0.9',
            updateComponents: { surfaceId: 'people', components: [node(sample)] },
          },
        ],
      }).ok,
      true,
    );
    runtime.finishRequest('avatar-request', 'success');
    const published = runtime.getSnapshot();
    assert.equal(
      runtime.changeNativeValue(
        'people',
        'root',
        'Grace Hopper',
        published.surfaces[0].generation,
        published.revision,
      ).ok,
      false,
    );
    assert.equal(runtime.getSnapshot().surfaces, published.surfaces);

    const schema = await load('docs/src/genui/native/avatar.ts');
    assert.equal(schema.definition.withValue, undefined);
    assert.deepEqual(schema.sample, sample);
    const data = { name: '  Ada   Lovelace ', src: '/media/people/ada.png', shape: 'square' };
    const parsed = schema.definition.parse(data);
    assert.deepEqual(parsed, data);
    assert.notEqual(parsed, data);
    assert.throws(() => schema.definition.parse(unsafe));

    let changes = 0;
    let actions = 0;
    const harness = await mountPattern('default', 'docs/src/react/genui/native/avatar.tsx', {
      data,
      disabled: false,
      onChange() {
        changes++;
      },
      onAction() {
        actions++;
      },
    });
    try {
      const avatars = harness.document.querySelectorAll('[role="img"]');
      assert.equal(avatars.length, 1);
      const avatar = avatars[0];
      assert.equal(avatar.getAttribute('aria-label'), 'Ada Lovelace');
      assert.equal(avatar.getAttribute('data-avatar-shape'), 'square');
      assert.equal(avatar.getAttribute('data-avatar-image'), 'image');
      const image = avatar.querySelector('img');
      assert.equal(image?.getAttribute('src'), '/media/people/ada.png');
      assert.equal(
        harness.document.querySelectorAll('button, input, textarea, select, [contenteditable]')
          .length,
        0,
      );
      await harness.act(async () => {
        image.dispatchEvent(new harness.window.Event('error'));
      });
      await harness.waitFor(
        () =>
          avatar.getAttribute('data-avatar-image') === 'fallback' && !avatar.querySelector('img'),
        'initials fallback after a broken image',
      );
      assert.equal(avatar.textContent.trim(), 'AL');
      assert.equal(changes, 0);
      assert.equal(actions, 0);
    } finally {
      await harness.dispose();
    }
  },
  // docs/tests/genui-native-avatar-group.test.mjs
  AtlasAvatarGroup: async ctx => {
    const { assert, build, mountPattern, dirname, resolve, fileURLToPath, metaURL } = ctx;
    const projectDirectory = resolve(dirname(fileURLToPath(metaURL)), '../..');
    const bundle = async contents => {
      const bundled = await build({
        absWorkingDir: projectDirectory,
        stdin: {
          contents,
          resolveDir: projectDirectory,
          sourcefile: 'avatar-entry.ts',
          loader: 'ts',
        },
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };

    const native = {
      people: [
        { id: 'ada', name: 'Ada Lovelace', src: '/media/avatars/ada.png' },
        { id: 'grace', name: 'Grace Hopper' },
        { id: 'katherine', name: 'Katherine Johnson' },
        { id: 'mary', name: 'Mary Jackson' },
        { id: 'dorothy', name: 'Dorothy Vaughan' },
      ],
      maxVisible: 3,
    };

    const { validateComponent } = await bundle(
      "export { validateComponent } from './docs/src/genui/policy.ts'; export { createGenUIRuntime } from './docs/src/genui/runtime.ts';",
    );
    const node = {
      id: 'people',
      component: 'AtlasAvatarGroup',
      payload: { title: 'Team', native },
    };
    const duplicate = { ...native, people: [native.people[0], { id: 'ada', name: 'Ada Again' }] };
    assert.throws(() =>
      validateComponent({ ...node, payload: { title: 'Team', native: duplicate } }),
    );

    const schema = await bundle("export * from './docs/src/genui/native/avatar-group.ts';");
    assert.equal(schema.definition.withValue, undefined);
    const input = structuredClone(native);
    assert.deepEqual(schema.definition.parse(input), native);
    assert.deepEqual(input, native);
    schema.definition.parse(schema.sample);

    let changes = 0;
    const harness = await mountPattern('default', 'docs/src/react/genui/native/avatar-group.tsx', {
      data: native,
      disabled: false,
      onChange() {
        changes++;
      },
      onAction() {
        changes++;
      },
    });
    try {
      const names = () =>
        [...harness.document.querySelectorAll('.atlas-avatar-group-names li')].map(item =>
          item.textContent.trim(),
        );
      assert.deepEqual(names().slice(0, 3), ['Ada Lovelace', 'Grace Hopper', 'Katherine Johnson']);
      assert.equal(names().length, 4);
      assert.equal(names().includes('Mary Jackson'), false);
      assert.equal(
        harness.document.querySelector('.atlas-avatar-group-more')?.textContent.trim(),
        '+2',
      );
      const toggle = harness.document.querySelector('button[aria-controls]');
      assert.ok(toggle);
      assert.equal(toggle.getAttribute('aria-expanded'), 'false');
      assert.ok(
        harness.document
          .getElementById(toggle.getAttribute('aria-controls'))
          ?.classList.contains('atlas-avatar-group-names'),
      );
      await harness.click(toggle);
      assert.equal(toggle.getAttribute('aria-expanded'), 'true');
      assert.deepEqual(
        names(),
        native.people.map(person => person.name),
      );
      assert.equal(changes, 0);
    } finally {
      await harness.dispose();
    }
  },
  // docs/tests/genui-native-media-frame.test.mjs
  AtlasMediaFrame: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };

    const native = {
      src: '/media/aster-workshop.jpg',
      alt: 'Workshop bench with labelled tool drawers',
      caption: 'Aster Workshop, east bay',
      ratio: 'landscape',
      fit: 'cover',
    };

    const { definition, sample } = await load('docs/src/genui/native/media-frame.ts');
    assert.equal(definition.withValue, undefined);
    assert.deepEqual(sample, native);
    assert.throws(() => definition.parse({ ...native, src: 'javascript:alert(1)' }));

    const calls = [];
    const harness = await mountPattern('default', 'docs/src/react/genui/native/media-frame.tsx', {
      data: definition.parse(sample),
      disabled: false,
      onChange: value => calls.push(['change', value]),
      onAction: () => calls.push(['action']),
    });
    try {
      const figure = harness.document.querySelector('figure.atlas-media');
      assert.ok(figure);
      assert.equal(figure.dataset.ratio, 'landscape');
      assert.equal(figure.dataset.fit, 'cover');
      const image = figure.querySelector('img.atlas-media-image');
      assert.equal(image.getAttribute('src'), native.src);
      assert.equal(image.getAttribute('alt'), native.alt);
      const caption = figure.querySelector('figcaption');
      assert.equal(caption.textContent, native.caption);
      assert.equal(figure.getAttribute('aria-labelledby'), caption.id);
      assert.equal(figure.querySelectorAll('button, input, select, textarea').length, 0);
      assert.deepEqual(calls, []);
    } finally {
      await harness.dispose();
    }
  },
  // docs/tests/genui-native-screenshot.test.mjs
  AtlasScreenshot: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const sample = {
      src: '/screenshots/genui-review-panel.png',
      alt: 'Review panel listing three pending supplier records with their totals.',
      caption: 'Supplier review panel',
      width: 1280,
      height: 800,
    };

    const { validateComponent } = await load('docs/src/genui/policy.ts');
    const node = {
      id: 'shot',
      component: 'AtlasScreenshot',
      payload: { title: 'Review panel', native: sample },
    };
    assert.throws(() =>
      validateComponent({
        ...node,
        payload: { title: 'Review panel', native: { ...sample, src: 'javascript:alert(1)' } },
      }),
    );

    const schema = await load('docs/src/genui/native/screenshot.ts');
    assert.deepEqual(schema.sample, sample);
    assert.deepEqual(schema.definition.parse(sample), sample);

    let calls = 0;
    const harness = await mountPattern('default', 'docs/src/react/genui/native/screenshot.tsx', {
      data: sample,
      disabled: false,
      onChange() {
        calls++;
      },
      onAction() {
        calls++;
      },
    });
    try {
      const figure = harness.document.querySelector('figure.atlas-screenshot');
      assert.equal(figure?.dataset.screenshotState, 'available');
      const image = figure.querySelector('img');
      assert.equal(image.getAttribute('src'), sample.src);
      assert.equal(image.getAttribute('alt'), sample.alt);
      assert.equal(image.getAttribute('width'), String(sample.width));
      assert.equal(image.getAttribute('height'), String(sample.height));
      const region = figure.querySelector('[role="region"]');
      assert.equal(region.tabIndex, 0);
      assert.equal(
        harness.document.getElementById(region.getAttribute('aria-labelledby')).textContent,
        sample.caption,
      );
      assert.equal(figure.querySelectorAll('input, button, select, textarea').length, 0);
      assert.equal(calls, 0);
    } finally {
      await harness.dispose();
    }
  },
  // docs/tests/genui-native-icon-list.test.mjs
  AtlasIconList: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };

    const native = {
      items: [
        {
          id: 'scope',
          title: 'Scoped to the active tenant',
          description: 'Only records from the selected workspace are listed.',
          icon: 'lock-simple',
        },
        { id: 'overview', title: 'Return to the overview at any time', icon: 'house' },
        { id: 'plain', title: 'Items without an icon keep their alignment' },
      ],
    };
    const node = payload => ({ id: 'root', component: 'AtlasIconList', payload });
    const { validateComponent } = await load('docs/src/genui/policy.ts');

    const { definition, sample } = await load('docs/src/genui/native/icon-list.ts');
    assert.deepEqual(definition.parse(sample), sample);
    assert.deepEqual(sample, native);
    const item = { id: 'one', title: 'One' };
    assert.throws(() => definition.parse({ items: [{ ...item, icon: '<img onerror=x>' }] }));
    assert.throws(() => definition.parse({ items: [item, { ...item }] }));
    assert.throws(() => definition.parse({ items: [{ ...item, href: 'https://evil.test' }] }));
    assert.throws(() =>
      validateComponent(
        node({ title: 'Guidance', native: { items: [{ ...item, icon: 'not-an-icon' }] } }),
      ),
    );

    const calls = [];
    const harness = await mountPattern('default', 'docs/src/react/genui/native/icon-list.tsx', {
      data: sample,
      disabled: false,
      onChange: value => calls.push(['change', value]),
      onAction: () => calls.push(['action']),
    });
    try {
      const list = harness.document.querySelector('ul.atlas-icon-list');
      assert.ok(list);
      const rows = [...list.querySelectorAll('li.atlas-icon-list-item')];
      assert.deepEqual(
        rows.map(row => row.querySelector('.atlas-icon-list-title').textContent),
        native.items.map(entry => entry.title),
      );
      assert.equal(
        rows[0].querySelector('.atlas-icon-list-description').textContent,
        native.items[0].description,
      );
      const icon = rows[1].querySelector('svg[data-icon-name="house"]');
      assert.ok(icon);
      assert.equal(icon.getAttribute('aria-hidden'), 'true');
      assert.equal(rows[2].querySelector('svg'), null);
      assert.equal(list.querySelectorAll('button, input, a, select, textarea').length, 0);
      assert.deepEqual(calls, []);
    } finally {
      await harness.dispose();
    }
  },
  // docs/tests/genui-native-quote.test.mjs
  AtlasQuote: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };

    const { validateComponent } = await load('docs/src/genui/policy.ts');
    const { createGenUIRuntime } = await load('docs/src/genui/runtime.ts');
    const native = {
      quote: 'Calm defaults let teams decide faster than clever ones.',
      attribution: 'Atlas design review',
      context: 'Illustrative example, not an endorsement.',
    };
    const node = { id: 'root', component: 'AtlasQuote', payload: { title: 'Quote', native } };
    assert.deepEqual(validateComponent(node), node);

    const runtime = createGenUIRuntime({ scopeId: 'quote-scope' });
    runtime.beginRequest('quote-request');
    const create = {
      version: 'v0.9',
      createSurface: { surfaceId: 'quotes', catalogId: 'local://atlas-cards/v1' },
    };
    const update = components => ({
      version: 'v0.9',
      updateComponents: { surfaceId: 'quotes', components },
    });
    const malformed = {
      ...node,
      payload: { title: 'Quote', native: { ...native, href: 'https://example.com' } },
    };
    assert.throws(() => validateComponent(malformed));
    assert.equal(
      runtime.applyBatch({
        requestId: 'quote-request',
        sequence: 1,
        commands: [create, update([malformed])],
      }).ok,
      false,
    );
    assert.equal(runtime.getSnapshot().surfaces.length, 0);
    assert.equal(
      runtime.applyBatch({
        requestId: 'quote-request',
        sequence: 1,
        commands: [create, update([node])],
      }).ok,
      true,
    );

    const { definition, sample } = await load('docs/src/genui/native/quote.ts');
    const frozen = Object.freeze({ ...native });
    assert.deepEqual(definition.parse(frozen), native);
    assert.deepEqual(definition.parse(sample), sample);
    assert.throws(() => definition.parse({ quote: native.quote }));
    assert.throws(() => definition.parse({ ...native, quote: '   ' }));
    assert.throws(() => definition.parse({ ...native, href: 'https://example.com' }));

    let changes = 0;
    let actions = 0;
    const harness = await mountPattern('default', 'docs/src/react/genui/native/quote.tsx', {
      data: native,
      disabled: false,
      onChange() {
        changes++;
      },
      onAction() {
        actions++;
      },
    });
    try {
      const figure = harness.document.querySelector('figure.atlas-quote');
      assert.ok(figure);
      assert.equal(figure.querySelector('blockquote p').textContent, native.quote);
      assert.equal(
        figure.querySelector('figcaption .atlas-quote-attribution').textContent,
        native.attribution,
      );
      assert.equal(figure.querySelector('.atlas-quote-context').textContent, native.context);
      assert.equal(figure.querySelector('cite'), null);
      assert.equal(harness.document.querySelector('button, input, textarea, select, a'), null);
      assert.equal(changes, 0);
      assert.equal(actions, 0);
    } finally {
      await harness.dispose();
    }
  },
  // docs/tests/genui-native-carousel.test.mjs
  AtlasCarousel: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const catalog = 'local://atlas-cards/v1';
    const sample = {
      label: 'Workshop gallery',
      slides: [
        {
          id: 'bench',
          title: 'Workbench',
          src: '/media/workshop-bench.jpg',
          alt: 'Wooden workbench with hand tools',
          caption: 'Main bench, east wall',
        },
        {
          id: 'kiln',
          title: 'Kiln room',
          src: 'https://images.atlas.test/kiln.jpg',
          alt: 'Ceramic kiln with an open door',
        },
      ],
    };
    const malformed = {
      ...sample,
      slides: [sample.slides[0], { ...sample.slides[1], src: 'javascript:alert(1)' }],
    };

    const node = {
      id: 'gallery',
      component: 'AtlasCarousel',
      payload: { title: 'Gallery', native: sample },
    };

    const { createGenUIRuntime } = await load('docs/src/genui/runtime.ts');
    const runtime = createGenUIRuntime({ scopeId: 'carousel-scope' });
    runtime.beginRequest('carousel-request');
    const update = nodes => ({
      version: 'v0.9',
      updateComponents: { surfaceId: 'records', components: nodes },
    });
    const accepted = runtime.applyBatch({
      requestId: 'carousel-request',
      sequence: 1,
      commands: [
        { version: 'v0.9', createSurface: { surfaceId: 'records', catalogId: catalog } },
        update([
          {
            id: 'root',
            component: 'AtlasTaskSurface',
            payload: { title: 'Review', intent: 'review' },
            children: ['gallery'],
          },
          node,
        ]),
      ],
    });
    assert.equal(accepted.ok, true, accepted.error);
    const published = runtime.getSnapshot().surfaces;
    assert.equal(
      runtime.applyBatch({
        requestId: 'carousel-request',
        sequence: 2,
        commands: [update([{ ...node, payload: { title: 'Gallery', native: malformed } }])],
      }).ok,
      false,
    );
    assert.equal(runtime.getSnapshot().surfaces, published);

    const schema = await load('docs/src/genui/native/carousel.ts');
    const { definition } = schema;
    assert.deepEqual(definition.parse(schema.sample), sample);
    const input = structuredClone(sample);
    assert.deepEqual(definition.parse(input), sample);
    assert.deepEqual(input, sample);
    assert.throws(() => definition.parse(malformed));

    let changes = 0;
    let actions = 0;
    const harness = await mountPattern('default', 'docs/src/react/genui/native/carousel.tsx', {
      data: definition.parse(sample),
      disabled: false,
      onChange() {
        changes++;
      },
      onAction() {
        actions++;
      },
    });
    try {
      const { document } = harness;
      const section = document.querySelector('section.atlas-carousel');
      assert.equal(section.getAttribute('aria-label'), 'Workshop gallery');
      assert.equal(section.dataset.carouselState, 'multiple');
      const shown = () => [
        document.querySelector('[data-slide-id]').dataset.slideId,
        document.querySelector('.atlas-carousel-title').textContent,
      ];
      assert.deepEqual(shown(), ['bench', 'Workbench']);
      const [previous, next] = document.querySelectorAll('.atlas-carousel-controls button');
      await harness.click(next);
      assert.deepEqual(shown(), ['kiln', 'Kiln room']);
      await harness.click(next);
      assert.deepEqual(shown(), ['bench', 'Workbench']);
      await harness.click(previous);
      assert.deepEqual(shown(), ['kiln', 'Kiln room']);
      assert.equal(changes, 0);
      assert.equal(actions, 0);
    } finally {
      await harness.dispose();
    }
  },
  // docs/tests/genui-native-rich-menu.test.mjs
  AtlasRichMenu: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const sampleLiteral = {
      label: 'Record actions',
      groups: [
        {
          id: 'share',
          label: 'Share',
          items: [
            { id: 'copy-link', label: 'Copy link', description: 'Copy a link to this record' },
            { id: 'export-csv', label: 'Export CSV', description: 'Download the visible rows' },
          ],
        },
        {
          id: 'manage',
          label: 'Manage',
          items: [
            {
              id: 'archive',
              label: 'Archive',
              description: 'Requires owner approval',
              disabled: true,
            },
          ],
        },
      ],
      value: null,
    };

    const { validateComponent } = await load('docs/src/genui/policy.ts');
    const { createGenUIRuntime } = await load('docs/src/genui/runtime.ts');
    const node = {
      id: 'menu',
      component: 'AtlasRichMenu',
      payload: { title: 'Record actions', native: structuredClone(sampleLiteral) },
    };
    const duplicate = {
      ...sampleLiteral,
      groups: [sampleLiteral.groups[0], sampleLiteral.groups[0]],
    };
    assert.throws(() =>
      validateComponent({ ...node, payload: { title: 'Record actions', native: duplicate } }),
    );

    const runtime = createGenUIRuntime({ scopeId: 'rich-menu-scope' });
    runtime.beginRequest('menu-request');
    assert.equal(
      runtime.applyBatch({
        requestId: 'menu-request',
        sequence: 1,
        commands: [
          {
            version: 'v0.9',
            createSurface: { surfaceId: 'records', catalogId: 'local://atlas-cards/v1' },
          },
          {
            version: 'v0.9',
            updateComponents: {
              surfaceId: 'records',
              components: [{ id: 'root', component: 'AtlasStack', children: ['menu'] }, node],
            },
          },
        ],
      }).ok,
      true,
    );
    runtime.finishRequest('menu-request', 'success');
    const { generation } = runtime.getSnapshot().surfaces[0];
    const revision = runtime.getSnapshot().revision;
    assert.equal(
      runtime.changeNativeValue('records', 'menu', 'archive', generation, revision).ok,
      false,
    );
    assert.equal(
      runtime.changeNativeValue('records', 'menu', 'export-csv', generation, revision).ok,
      true,
    );

    const { definition, sample } = await load('docs/src/genui/native/rich-menu.ts');
    assert.deepEqual(sample, sampleLiteral);
    assert.deepEqual(definition.parse(sampleLiteral), sampleLiteral);
    assert.throws(() => definition.parse({ ...sampleLiteral, href: 'https://example.test/' }));
    const input = structuredClone(sampleLiteral);
    const chosen = definition.withValue(input, 'copy-link');
    assert.equal(chosen.value, 'copy-link');
    assert.deepEqual(input, sampleLiteral);
    assert.throws(() => definition.withValue(input, 'archive'));
    assert.throws(() => definition.withValue(input, 'missing'));
    assert.throws(() => definition.withValue({ ...input, disabled: true }, 'copy-link'));

    const changes = [];
    let actions = 0;
    const harness = await mountPattern('default', 'docs/src/react/genui/native/rich-menu.tsx', {
      data: chosen,
      disabled: false,
      onChange: value => changes.push(value),
      onAction: () => {
        actions++;
      },
    });
    try {
      assert.equal(harness.document.querySelector('[role="status"]')?.textContent, 'Copy link');
      const trigger = [...harness.document.querySelectorAll('button')].find(button =>
        button.textContent.includes('Record actions'),
      );
      assert.ok(trigger, 'rich menu trigger');
      const item = id => harness.document.querySelector(`[data-rich-menu-item="${id}"]`);
      await harness.click(trigger);
      if (!item('export-csv'))
        await harness.act(async () => {
          trigger.dispatchEvent(new harness.window.MouseEvent('mouseover', { bubbles: true }));
        });
      await harness.waitFor(() => item('export-csv') && item('archive'), 'rich menu items');
      await harness.click(item('archive'));
      await harness.click(item('export-csv'));
      assert.deepEqual(changes, ['export-csv']);
      assert.equal(actions, 0);
    } finally {
      await harness.dispose();
    }
  },
  // docs/tests/genui-native-upload.test.mjs
  AtlasUpload: async ctx => {
    const { assert, build, mountPattern, buttonByText, randomUUID, writeFile, unlink, metaURL } =
      ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const sample = {
      label: 'Attach evidence',
      accept: '.txt,text/plain',
      maxBytes: 1048576,
      multiple: false,
      value: [],
    };

    {
      // AtlasUpload native node keeps File handles local and publishes bounded metadata only.
      const { validateComponent } = await load('docs/src/genui/policy.ts');
      const node = {
        id: 'upload',
        component: 'AtlasUpload',
        payload: { title: 'Evidence', native: sample },
      };
      assert.deepEqual(validateComponent(node).payload.native, sample);
      assert.throws(() =>
        validateComponent({
          ...node,
          payload: {
            title: 'Evidence',
            native: { ...sample, endpoint: 'https://example.com/upload' },
          },
        }),
      );

      const { definition, sample: exported } = await load('docs/src/genui/native/upload.ts');
      assert.deepEqual(definition.parse(exported), exported);

      const calls = [];
      const harness = await mountPattern('default', 'docs/src/react/genui/native/upload.tsx', {
        data: sample,
        disabled: false,
        onChange: value => calls.push(value),
        onAction() {},
      });
      try {
        const input = harness.document.querySelector('.atlas-upload input[type=file]');
        assert.ok(input);
        assert.equal(input.getAttribute('accept'), sample.accept);
        assert.equal(input.disabled, false);
        assert.match(
          harness.document.querySelector('.atlas-upload-label').textContent,
          /Attach evidence/,
        );
        const file = new harness.window.File(['abc'], 'notes.txt', { type: 'text/plain' });
        await harness.act(async () => {
          Object.defineProperty(input, 'files', { configurable: true, value: [file] });
          input.dispatchEvent(new harness.window.Event('change', { bubbles: true }));
        });
        await harness.waitFor(() => calls.length > 0, 'metadata reaches onChange');
      } finally {
        await harness.dispose();
      }
      const metadata = [{ name: 'notes.txt', type: 'text/plain', size: 3 }];
      assert.deepEqual(calls.at(-1), metadata);

      assert.deepEqual(definition.withValue(sample, calls.at(-1)).value, metadata);
      assert.deepEqual(sample.value, []);
      assert.throws(() => definition.withValue(sample, [{ ...metadata[0], contents: 'abc' }]));
      assert.throws(() => definition.withValue(sample, [{ ...metadata[0], size: 1048577 }]));
    }

    {
      // AtlasUpload native node shows host metadata, follows controlled removal and reset, and
      // bounds a selection to 24 files.
      // Ephemeral host: owns the native value like a runtime would and can reset it.
      const wrapper = `.upload-host-${randomUUID()}.jsx`;
      const wrapperUrl = new URL(wrapper, metaURL);
      await writeFile(
        wrapperUrl,
        `import { useState } from 'react';
import NativeUpload from '../src/react/genui/native/upload.tsx';
import { definition } from '../src/genui/native/upload.ts';
export function Host({ initial, calls }) {
  const [data, setData] = useState(initial);
  return (
    <>
      <NativeUpload
        data={data}
        disabled={false}
        onAction={() => {}}
        onChange={value => {
          calls.push(value);
          setData(current => definition.withValue(current, value));
        }}
      />
      <button type="button" onClick={() => setData(current => definition.withValue(current, []))}>
        Reset host value
      </button>
    </>
  );
}
`,
        { flag: 'wx' },
      );
      const restored = { name: 'restored.txt', type: 'text/plain', size: 5 };
      const notes = { name: 'notes.txt', type: 'text/plain', size: 3 };
      const calls = [];
      let harness;
      try {
        harness = await mountPattern('Host', `docs/tests/${wrapper}`, {
          initial: { ...sample, multiple: true, value: [restored] },
          calls,
        });
        const names = () =>
          [...harness.document.querySelectorAll('.atlas-upload-name')].map(
            name => name.textContent,
          );
        const file = (name, contents) =>
          new harness.window.File([contents], name, { type: 'text/plain' });
        const choose = async (files, description) => {
          const count = calls.length;
          const input = harness.document.querySelector('.atlas-upload input[type=file]');
          assert.ok(input);
          await harness.act(async () => {
            Object.defineProperty(input, 'files', { configurable: true, value: files });
            input.dispatchEvent(new harness.window.Event('change', { bubbles: true }));
          });
          await harness.waitFor(() => calls.length > count, description);
        };

        assert.deepEqual(names(), ['restored.txt']);

        await choose([file('notes.txt', 'abc')], 'selection joins restored metadata');
        assert.deepEqual(calls.at(-1), [restored, notes]);
        await harness.waitFor(() => names().length === 2, 'host value renders both entries');
        assert.deepEqual(names(), ['restored.txt', 'notes.txt']);

        await harness.click(
          harness.document.querySelector('button[aria-label="Remove restored.txt"]'),
        );
        assert.deepEqual(calls.at(-1), [notes]);
        assert.deepEqual(names(), ['notes.txt']);

        const beforeReset = calls.length;
        await harness.click(buttonByText(harness.document, 'Reset host value'));
        assert.deepEqual(names(), []);
        assert.equal(calls.length, beforeReset);

        const batch = Array.from({ length: 25 }, (_, index) =>
          file(`file-${String(index + 1).padStart(2, '0')}.txt`, 'x'),
        );
        await choose(batch, 'bounded batch reaches onChange');
        const kept = batch.slice(0, 24).map(({ name }) => ({ name, type: 'text/plain', size: 1 }));
        assert.deepEqual(calls.at(-1), kept);
        await harness.waitFor(() => names().length === 24, 'host value renders the bounded list');
        assert.deepEqual(
          names(),
          kept.map(({ name }) => name),
        );
        assert.match(
          harness.document.querySelector('.atlas-upload-alert').textContent,
          /file-25\.txt was not added because no more than 24 files can be selected\./,
        );
      } finally {
        await harness?.dispose();
        await unlink(wrapperUrl);
      }
    }
  },
  // docs/tests/genui-native-drawer.test.mjs
  AtlasDrawer: async ctx => {
    const { assert, build, mountPattern, buttonByText, delay } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };

    const sample = {
      label: 'Open details',
      title: 'Order details',
      body: 'The shipment leaves the warehouse today.',
      placement: 'right',
      value: false,
    };

    {
      // AtlasDrawer is an approved controlled native node whose opener, close and Escape report
      // the value.
      const { definition } = await load('docs/src/genui/native/drawer.ts');
      assert.deepEqual(definition.parse(sample), sample);
      const input = structuredClone(sample);
      assert.equal(definition.withValue(input, true).value, true);
      assert.deepEqual(input, sample);
      assert.throws(() => definition.withValue(input, 'open'));
      assert.throws(() => definition.parse({ ...sample, placement: 'top' }));
      assert.deepEqual(input, sample);

      const entry = 'docs/src/react/genui/native/drawer.tsx';
      const changes = [];
      const closed = await mountPattern('default', entry, {
        data: sample,
        disabled: false,
        onChange: value => changes.push(value),
        onAction() {},
      });
      try {
        const opener = buttonByText(closed.document.querySelector('#root'), 'Open details');
        assert.ok(opener);
        assert.equal(opener.getAttribute('aria-expanded'), 'false');
        assert.equal(closed.document.querySelector('[role="dialog"]'), null);
        await closed.click(opener);
        assert.deepEqual(changes, [true]);
      } finally {
        await closed.dispose();
      }

      const opened = await mountPattern('default', entry, {
        data: { ...sample, value: true },
        disabled: false,
        onChange: value => changes.push(value),
        onAction() {},
      });
      try {
        const { document, window } = opened;
        await opened.waitFor(
          () => document.querySelector('.ant-drawer-close'),
          'native drawer close button',
        );
        assert.ok(document.body.textContent.includes('Order details'));
        assert.ok(document.body.textContent.includes('The shipment leaves the warehouse today.'));
        const close = document.querySelector('.ant-drawer-close');
        assert.ok(close.getAttribute('aria-label'));
        await opened.click(close);
        assert.deepEqual(changes, [true, false]);
        await opened.act(async () => {
          close.dispatchEvent(
            new window.KeyboardEvent('keydown', {
              key: 'Escape',
              code: 'Escape',
              keyCode: 27,
              bubbles: true,
              cancelable: true,
            }),
          );
        });
        assert.deepEqual(changes, [true, false, false]);
      } finally {
        await opened.dispose();
      }
    }

    {
      // A locked AtlasDrawer with a stored open value renders no blocking dialog until a
      // controlled unlock reveals it.
      const data = { ...sample, value: true, disabled: true };
      const changes = [];
      const locked = await mountPattern('default', 'docs/src/react/genui/native/drawer.tsx', {
        data,
        disabled: false,
        onChange: value => changes.push(value),
        onAction() {},
      });
      try {
        const { document } = locked;
        // Give a would-be open Drawer time to portal before asserting its absence.
        await locked.act(async () => {
          await delay(50);
        });
        const opener = buttonByText(document.querySelector('#root'), 'Open details');
        assert.ok(opener);
        assert.equal(opener.disabled, true);
        assert.equal(opener.getAttribute('aria-expanded'), 'false');
        assert.equal(document.querySelector('[role="dialog"]'), null);
        assert.equal(document.querySelector('.ant-drawer-open'), null);
        assert.ok(!document.body.textContent.includes('The shipment leaves the warehouse today.'));

        // The host lifts only the lock; the stored value stays true. A locale switch re-renders
        // the adapter with the same host-owned data object.
        data.disabled = false;
        await locked.act(async () => {
          locked.setLocale('tr');
        });
        await locked.waitFor(
          () => document.querySelector('.ant-drawer-close'),
          'unlocked drawer reveals its stored open value',
        );
        assert.ok(document.body.textContent.includes('The shipment leaves the warehouse today.'));
        assert.equal(
          buttonByText(document.querySelector('#root'), 'Open details').getAttribute(
            'aria-expanded',
          ),
          'true',
        );
        assert.equal(data.value, true);
        assert.deepEqual(changes, []);
      } finally {
        await locked.dispose();
      }
    }
  },
  // docs/tests/genui-native-toast.test.mjs
  AtlasToast: async ctx => {
    const {
      assert,
      build,
      mountPattern,
      buttonByText,
      randomUUID,
      writeFile,
      unlink,
      dirname,
      resolve,
      fileURLToPath,
      delay,
      metaURL,
    } = ctx;
    const testDirectory = dirname(fileURLToPath(metaURL));
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };

    // Controlled host: feeds the runtime-style validated value back like the native renderer.
    // With `control`, the test owns acceptance and the lock instead.
    const host = `import { useState } from 'react';
import AtlasToast from '../src/react/genui/native/toast.tsx';
import { definition } from '../src/genui/native/toast.ts';
export function Host({ initial, disabled, onChange, onAction, control }) {
  const [data, setData] = useState(initial);
  const [locked, setLocked] = useState(disabled);
  const accept = value => setData(current => definition.withValue(current, value));
  if (control) Object.assign(control, { accept, setLocked });
  return (
    <AtlasToast
      data={data}
      disabled={locked}
      onAction={onAction}
      onChange={value => {
        onChange(value);
        if (!control) accept(value);
      }}
    />
  );
}
`;

    {
      // AtlasToast validates its native payload and opens one user-triggered notice through the
      // controlled value.
      const { validateComponent } = await load('docs/src/genui/policy.ts');
      const sample = {
        label: 'Show notice',
        message: 'Review the highlighted fields before sending.',
        value: false,
      };
      const node = {
        id: 'notice',
        component: 'AtlasToast',
        payload: { title: 'Notice', native: sample },
      };
      assert.throws(() =>
        validateComponent({
          ...node,
          payload: { title: 'Notice', native: { ...sample, href: 'https://example.com' } },
        }),
      );

      const schema = await load('docs/src/genui/native/toast.ts');
      assert.deepEqual(schema.definition.parse(schema.sample), schema.sample);
      const input = structuredClone(sample);
      assert.equal(schema.definition.withValue(input, true).value, true);
      assert.equal(input.value, false);
      assert.throws(() => schema.definition.withValue(input, 'yes'));

      const name = `.toast-host-${randomUUID()}.jsx`;
      await writeFile(resolve(testDirectory, name), host, { flag: 'wx' });
      const changes = [];
      try {
        const harness = await mountPattern('Host', `docs/tests/${name}`, {
          initial: sample,
          disabled: false,
          onChange: value => changes.push(value),
          onAction() {},
        });
        try {
          const { document } = harness;
          const trigger = buttonByText(document, sample.label);
          assert.ok(trigger);
          assert.equal(trigger.disabled, false);
          assert.equal(document.querySelector('.atlas-toast-text'), null);
          await harness.click(trigger);
          assert.deepEqual(changes, [true]);
          await harness.waitFor(
            () => document.querySelector('.atlas-toast-text') !== null,
            'user-triggered toast',
          );
          const notices = document.querySelectorAll('.atlas-toast-text');
          assert.equal(notices.length, 1);
          assert.equal(notices[0].textContent, sample.message);
          assert.equal(notices[0].getAttribute('data-toast-entry'), 'top');
          assert.equal(trigger.disabled, true);
        } finally {
          await harness.dispose();
        }
      } finally {
        await unlink(resolve(testDirectory, name));
      }
    }

    {
      // AtlasToast drops a pending click when locked, so a later host value stays quiet.
      const sample = {
        label: 'Show notice',
        message: 'Review the highlighted fields before sending.',
        value: false,
      };
      const name = `.toast-host-${randomUUID()}.jsx`;
      await writeFile(resolve(testDirectory, name), host, { flag: 'wx' });
      const changes = [];
      const control = {};
      try {
        const harness = await mountPattern('Host', `docs/tests/${name}`, {
          initial: sample,
          disabled: false,
          onChange: value => changes.push(value),
          onAction() {},
          control,
        });
        try {
          const { document } = harness;
          await harness.click(buttonByText(document, sample.label));
          assert.deepEqual(changes, [true]);
          assert.equal(document.querySelector('.atlas-toast-text'), null);
          await harness.act(async () => control.setLocked(true));
          assert.equal(buttonByText(document, sample.label).disabled, true);
          await harness.act(async () => control.setLocked(false));
          await harness.act(async () => control.accept(true));
          await harness.act(async () => {
            await delay(200);
          });
          assert.equal(document.querySelector('.atlas-toast-text'), null);
        } finally {
          await harness.dispose();
        }
      } finally {
        await unlink(resolve(testDirectory, name));
      }
    }
  },
  // docs/tests/genui-native-alert.test.mjs
  AtlasAlert: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const sample = { message: 'Records are up to date.' };

    const { validateComponent } = await load('docs/src/genui/policy.ts');
    const node = {
      id: 'notice',
      component: 'AtlasAlert',
      payload: { title: 'Status', native: sample },
    };
    assert.deepEqual(validateComponent(node), node);
    assert.throws(() =>
      validateComponent({
        ...node,
        payload: { title: 'Status', native: { ...sample, href: 'https://atlas.test/x' } },
      }),
    );

    const { sample: moduleSample } = await load('docs/src/genui/native/alert.ts');
    assert.deepEqual(moduleSample, sample);

    let calls = 0;
    const data = Object.freeze({
      status: 'error',
      message: 'Sync failed',
      description: 'The host rejected the latest batch.',
    });
    const harness = await mountPattern('default', 'docs/src/react/genui/native/alert.tsx', {
      data,
      disabled: false,
      onChange() {
        calls++;
      },
      onAction() {
        calls++;
      },
    });
    try {
      const alert = harness.document.querySelector('.atlas-alert.atlas-alert-error');
      assert.ok(alert, 'AtlasAlert root renders');
      assert.equal(alert.getAttribute('role'), 'alert');
      assert.match(alert.textContent, /Sync failed/);
      assert.match(alert.textContent, /The host rejected the latest batch\./);
      assert.ok(alert.querySelector('svg[data-icon-name="x-circle"]'));
      assert.equal(alert.querySelectorAll('button, input, a[href]').length, 0);
      assert.equal(calls, 0);
      assert.deepEqual(data, {
        status: 'error',
        message: 'Sync failed',
        description: 'The host rejected the latest batch.',
      });
    } finally {
      await harness.dispose();
    }
  },
  // docs/tests/genui-native-notification.test.mjs
  AtlasNotification: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };

    {
      const { validateComponent } = await load('docs/src/genui/policy.ts');
      const { createGenUIRuntime } = await load('docs/src/genui/runtime.ts');
      const native = { value: false, message: 'Changes saved' };
      const node = payload => ({ id: 'notice', component: 'AtlasNotification', payload });
      assert.equal(
        validateComponent(node({ title: 'Save status', native })).payload.native.message,
        'Changes saved',
      );

      const runtime = createGenUIRuntime({ scopeId: 'notification-scope' });
      runtime.beginRequest('notice-request');
      const apply = payload =>
        runtime.applyBatch({
          requestId: 'notice-request',
          sequence: 1,
          commands: [
            {
              version: 'v0.9',
              createSurface: { surfaceId: 'notices', catalogId: 'local://atlas-cards/v1' },
            },
            {
              version: 'v0.9',
              updateComponents: { surfaceId: 'notices', components: [node(payload)] },
            },
          ],
        });
      assert.equal(
        apply({ title: 'Save status', native: { ...native, href: 'https://atlas.test/' } }).ok,
        false,
      );
      assert.equal(runtime.getSnapshot().surfaces.length, 0);
      assert.equal(apply({ title: 'Save status', native }).ok, true);

      const { definition, sample } = await load('docs/src/genui/native/notification.ts');
      assert.deepEqual(definition.parse(sample), native);
      assert.equal(definition.withValue(sample, true).value, true);
      assert.equal(sample.value, false);
      assert.throws(() => definition.withValue(sample, 'open'));
      assert.throws(() => definition.parse({ ...sample, status: 'critical' }));

      const mount = async (data, disabled = false) => {
        const changes = [];
        const harness = await mountPattern(
          'default',
          'docs/src/react/genui/native/notification.tsx',
          {
            data,
            disabled,
            onChange: value => changes.push(value),
            onAction() {
              throw new Error('notification must not dispatch host actions');
            },
          },
        );
        return { harness, changes, button: harness.document.querySelector('.atlas-button') };
      };

      const received = await mount({ ...native, value: true, status: 'success' });
      try {
        const { harness, changes, button } = received;
        assert.equal(harness.document.querySelector('.atlas-notification'), null);
        await harness.click(button);
        await harness.waitFor(
          () => harness.document.querySelector('.atlas-notification'),
          'notification opened by the local trigger',
        );
        assert.match(
          harness.document.querySelector('.atlas-notification').textContent,
          /Changes saved/,
        );
        assert.deepEqual(changes, []);
        await harness.click(harness.document.querySelector('.ant-notification-notice-close'));
        await harness.waitFor(() => changes.length === 1, 'close reported through onChange');
        assert.deepEqual(changes, [false]);
      } finally {
        await received.harness.dispose();
      }

      const closed = await mount(native);
      try {
        await closed.harness.click(closed.button);
        assert.deepEqual(closed.changes, [true]);
        assert.equal(closed.harness.document.querySelector('.atlas-notification'), null);
      } finally {
        await closed.harness.dispose();
      }

      const blocked = await mount(native, true);
      try {
        assert.equal(blocked.button.disabled, true);
        await blocked.harness.click(blocked.button);
        assert.deepEqual(blocked.changes, []);
      } finally {
        await blocked.harness.dispose();
      }
    }

    {
      const native = { value: false, message: 'Changes saved' };
      const marker = () => {};
      const harness = await mountPattern(
        'default',
        'docs/src/react/genui/native/notification.tsx',
        {
          data: native,
          disabled: false,
          onChange: marker,
          onAction() {},
        },
      );
      const [React, ReactDOM, AntD] = await Promise.all([
        import('react'),
        import('react-dom/client'),
        import('antd'),
      ]);
      // Resolve the mounted adapter so the controlled host renders the real component.
      const mounted = harness.document.querySelector('.atlas-button');
      let fiber = mounted[Object.keys(mounted).find(key => key.startsWith('__reactFiber$'))];
      while (fiber && fiber.memoizedProps?.onChange !== marker) fiber = fiber.return;
      assert.ok(fiber, 'mounted notification adapter');
      const Adapter = fiber.type;

      const changes = [];
      // The host records the requested `true` but only applies it on an explicit Accept.
      const Host = () => {
        const [value, setValue] = React.useState(false);
        const [pending, setPending] = React.useState(false);
        return React.createElement(
          React.Fragment,
          null,
          React.createElement(Adapter, {
            data: { ...native, value },
            disabled: false,
            onChange: next => {
              changes.push(next);
              if (next) setPending(true);
              else setValue(false);
            },
            onAction() {
              throw new Error('notification must not dispatch host actions');
            },
          }),
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'host-accept',
              disabled: !pending,
              onClick: () => {
                setPending(false);
                setValue(true);
              },
            },
            'Accept',
          ),
        );
      };
      const container = harness.document.createElement('section');
      harness.document.body.append(container);
      const root = ReactDOM.createRoot(container);
      try {
        await harness.act(async () => {
          root.render(
            React.createElement(
              AntD.ConfigProvider,
              { theme: { token: { motion: false } } },
              React.createElement(Host),
            ),
          );
        });
        await harness.click(container.querySelector('.atlas-button'));
        assert.deepEqual(changes, [true]);
        assert.equal(harness.document.querySelector('.atlas-notification'), null);
        await harness.click(container.querySelector('.host-accept'));
        await harness.waitFor(
          () => harness.document.querySelector('.atlas-notification'),
          'notification opened once the host accepted the pending request',
        );
        assert.match(
          harness.document.querySelector('.atlas-notification').textContent,
          /Changes saved/,
        );
        assert.deepEqual(changes, [true]);
      } finally {
        await harness.act(async () => {
          root.unmount();
        });
        container.remove();
        await harness.dispose();
      }
    }
  },
  // docs/tests/genui-native-modal.test.mjs
  AtlasModal: async ctx => {
    const { assert, build, buttonByText, mountPattern } = ctx;
    async function load(entry) {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    }
    const adapter = 'docs/src/react/genui/native/modal.tsx';

    {
      const { validateComponent } = await load('docs/src/genui/policy.ts');
      const literal = {
        value: false,
        title: 'Archive record',
        body: 'The record leaves the active list after confirmation.',
        opener: 'Review archive',
      };
      const node = {
        id: 'archive',
        component: 'AtlasModal',
        payload: { title: 'Archive', native: literal },
      };
      assert.deepEqual(validateComponent(node).payload, node.payload);
      assert.throws(() =>
        validateComponent({
          ...node,
          payload: { title: 'Archive', native: { ...literal, value: 'open' } },
        }),
      );

      const { definition, sample } = await load('docs/src/genui/native/modal.ts');
      assert.deepEqual(definition.parse(sample), literal);
      const opened = definition.withValue({ ...sample, confirmLabel: 'Archive now' }, true);
      assert.equal(opened.value, true);
      assert.equal(sample.value, false);
      assert.throws(() => definition.withValue(sample, 'open'));

      const log = [];
      const props = (data, disabled = false) => ({
        data,
        disabled,
        onChange: value => log.push(['change', value]),
        onAction: () => log.push('action'),
      });

      const closed = await mountPattern('default', adapter, props(sample));
      try {
        await closed.click(buttonByText(closed.document, 'Review archive'));
        assert.deepEqual(log, [['change', true]]);
        // Controlled: the request alone must not open a hidden local dialog.
        assert.equal(closed.document.querySelector('[role="dialog"]'), null);
      } finally {
        await closed.dispose();
      }

      log.length = 0;
      const open = await mountPattern('default', adapter, props(opened));
      try {
        const dialog = open.document.querySelector('[role="dialog"]');
        assert.ok(dialog, 'open value renders the native dialog');
        assert.match(dialog.textContent, /Archive record/);
        assert.match(dialog.textContent, /The record leaves the active list after confirmation\./);
        await open.act(async () => {
          dialog.dispatchEvent(
            new open.window.KeyboardEvent('keydown', {
              key: 'Escape',
              code: 'Escape',
              keyCode: 27,
              which: 27,
              bubbles: true,
              cancelable: true,
            }),
          );
        });
        await open.click(buttonByText(open.document, 'Cancel'));
        await open.click(buttonByText(open.document, 'Archive now'));
        assert.deepEqual(log, [['change', false], ['change', false], 'action', ['change', false]]);
      } finally {
        await open.dispose();
      }

      log.length = 0;
      const locked = await mountPattern('default', adapter, props(sample, true));
      try {
        const opener = buttonByText(locked.document, 'Review archive');
        assert.equal(opener.disabled, true);
        await locked.click(opener);
        assert.deepEqual(log, []);
      } finally {
        await locked.dispose();
      }
    }

    {
      const { definition, sample } = await load('docs/src/genui/native/modal.ts');
      // An incomplete or failed stream can leave value=true while the node is locked.
      const stored = definition.withValue(sample, true);
      const log = [];
      const props = disabled => ({
        data: stored,
        disabled,
        onChange: value => log.push(['change', value]),
        onAction: () => log.push('action'),
      });

      const locked = await mountPattern('default', adapter, props(true));
      try {
        assert.equal(
          locked.document.querySelector('[role="dialog"]'),
          null,
          'a locked node must not show a dialog whose cancel and confirm are blocked',
        );
        assert.equal(buttonByText(locked.document, 'Review archive').disabled, true);
        await locked.act(async () => {
          locked.document.body.dispatchEvent(
            new locked.window.KeyboardEvent('keydown', {
              key: 'Escape',
              code: 'Escape',
              keyCode: 27,
              which: 27,
              bubbles: true,
              cancelable: true,
            }),
          );
        });
        assert.deepEqual(log, []);
      } finally {
        await locked.dispose();
      }
      // Hiding the dialog is a render decision only; the stored value is unchanged.
      assert.equal(stored.value, true);

      const unlocked = await mountPattern('default', adapter, props(false));
      try {
        const dialog = unlocked.document.querySelector('[role="dialog"]');
        assert.ok(dialog, 'unlocking shows the stored open value again');
        assert.match(dialog.textContent, /Archive record/);
        assert.match(dialog.textContent, /The record leaves the active list after confirmation\./);
        assert.deepEqual(log, [], 'unlocking does not trigger a made-up onChange');
      } finally {
        await unlocked.dispose();
      }
    }

    {
      const adapters = [[adapter, 'docs/src/genui/native/modal.ts']];
      for (const [entry, schema] of adapters) {
        const { definition, sample } = await load(schema);
        const stored = definition.withValue(sample, true);
        const log = [];
        let result;
        const props = actionAvailable => ({
          data: stored,
          disabled: false,
          actionAvailable,
          onChange: value => log.push(['change', value]),
          onAction: () => {
            log.push('action');
            if (result === 'throw') throw new Error('Host action failed.');
            return result;
          },
        });

        const unavailable = await mountPattern('default', entry, props(false));
        try {
          const confirm = buttonByText(unavailable.document, 'Confirm');
          assert.ok(confirm, `${entry}: the open value renders its confirmation`);
          assert.equal(
            confirm.disabled,
            true,
            `${entry}: Confirm is disabled without an available action`,
          );
          await unavailable.click(confirm);
          assert.deepEqual(log, [], `${entry}: an unavailable action neither runs nor closes`);
          await unavailable.click(buttonByText(unavailable.document, 'Cancel'));
          assert.deepEqual(log, [['change', false]], `${entry}: Cancel stays available`);
        } finally {
          await unavailable.dispose();
        }

        log.length = 0;
        const failing = await mountPattern('default', entry, props(true));
        try {
          for (const failure of [false, 'throw']) {
            result = failure;
            await failing.click(buttonByText(failing.document, 'Confirm'));
          }
          assert.deepEqual(
            log,
            ['action', 'action'],
            `${entry}: a failed action does not request close`,
          );
          assert.ok(
            buttonByText(failing.document, 'Confirm'),
            `${entry}: the confirmation stays open`,
          );
          result = true;
          await failing.click(buttonByText(failing.document, 'Confirm'));
          assert.deepEqual(log, ['action', 'action', 'action', ['change', false]]);
        } finally {
          await failing.dispose();
        }
      }
    }
  },
  // docs/tests/genui-native-popconfirm.test.mjs, docs/tests/genui-native-modal.test.mjs
  AtlasPopconfirm: async ctx => {
    const { assert, build, buttonByText, mountPattern } = ctx;
    const load = async contents => {
      const bundled = await build({
        stdin: { contents, resolveDir: process.cwd(), sourcefile: 'entry.ts', loader: 'ts' },
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };

    {
      const native = { title: 'Archive this record?', triggerLabel: 'Archive', value: false };
      const node = {
        id: 'confirm',
        component: 'AtlasPopconfirm',
        payload: { title: 'Archive', native },
      };
      const core = await load("export { validateComponent } from './docs/src/genui/policy.ts';");
      assert.deepEqual(core.validateComponent(node), node);

      const { definition, sample } = await load(
        "export { definition, sample } from './docs/src/genui/native/popconfirm.ts';",
      );
      assert.deepEqual(definition.parse(sample), sample);
      const before = structuredClone(sample);
      assert.equal(definition.withValue(sample, true).value, true);
      assert.deepEqual(sample, before);
      assert.throws(() => definition.withValue(sample, 'open'));
      assert.throws(() => definition.parse({ ...sample, href: 'https://example.test' }));

      const entry = 'docs/src/react/genui/native/popconfirm.tsx';
      const mount = async (data, disabled = false) => {
        const events = [];
        const harness = await mountPattern('default', entry, {
          data,
          disabled,
          onChange: value => events.push(['change', value]),
          onAction: () => events.push(['action']),
        });
        return { harness, events };
      };
      const popup = harness => harness.document.querySelector('.atlas-popconfirm');

      let { harness, events } = await mount(sample);
      try {
        await harness.click(buttonByText(harness.document, 'Archive'));
        assert.deepEqual(events, [['change', true]]);
      } finally {
        await harness.dispose();
      }

      ({ harness, events } = await mount({
        ...sample,
        description: 'It leaves the list.',
        value: true,
      }));
      try {
        await harness.waitFor(
          () => buttonByText(popup(harness) ?? harness.document.body, 'Confirm'),
          'popup',
        );
        assert.match(popup(harness).textContent, /It leaves the list\./);
        await harness.click(buttonByText(popup(harness), 'Confirm'));
        assert.deepEqual(events, [['action'], ['change', false]]);
      } finally {
        await harness.dispose();
      }

      ({ harness, events } = await mount({ ...sample, value: true }));
      try {
        await harness.waitFor(() => popup(harness), 'popup');
        await harness.act(async () => {
          harness.document.dispatchEvent(
            new harness.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
          );
        });
        assert.ok(
          events.length > 0 &&
            events.every(([kind, value]) => kind === 'change' && value === false),
        );
        assert.equal(harness.document.activeElement, buttonByText(harness.document, 'Archive'));
      } finally {
        await harness.dispose();
      }

      ({ harness, events } = await mount({ ...sample, disabled: true }));
      try {
        const trigger = buttonByText(harness.document, 'Archive');
        assert.equal(trigger.disabled, true);
        await harness.click(trigger);
        assert.deepEqual(events, []);
      } finally {
        await harness.dispose();
      }
    }

    {
      const loadEntry = async entry => {
        const bundled = await build({
          entryPoints: [entry],
          bundle: true,
          write: false,
          format: 'esm',
          platform: 'node',
        });
        return import(
          'data:text/javascript;base64,' +
            Buffer.from(bundled.outputFiles[0].text).toString('base64')
        );
      };
      const adapters = [
        ['docs/src/react/genui/native/popconfirm.tsx', 'docs/src/genui/native/popconfirm.ts'],
      ];
      for (const [entry, schema] of adapters) {
        const { definition, sample } = await loadEntry(schema);
        const stored = definition.withValue(sample, true);
        const log = [];
        let result;
        const props = actionAvailable => ({
          data: stored,
          disabled: false,
          actionAvailable,
          onChange: value => log.push(['change', value]),
          onAction: () => {
            log.push('action');
            if (result === 'throw') throw new Error('Host action failed.');
            return result;
          },
        });

        const unavailable = await mountPattern('default', entry, props(false));
        try {
          const confirm = buttonByText(unavailable.document, 'Confirm');
          assert.ok(confirm, `${entry}: the open value renders its confirmation`);
          assert.equal(
            confirm.disabled,
            true,
            `${entry}: Confirm is disabled without an available action`,
          );
          await unavailable.click(confirm);
          assert.deepEqual(log, [], `${entry}: an unavailable action neither runs nor closes`);
          await unavailable.click(buttonByText(unavailable.document, 'Cancel'));
          assert.deepEqual(log, [['change', false]], `${entry}: Cancel stays available`);
        } finally {
          await unavailable.dispose();
        }

        log.length = 0;
        const failing = await mountPattern('default', entry, props(true));
        try {
          for (const failure of [false, 'throw']) {
            result = failure;
            await failing.click(buttonByText(failing.document, 'Confirm'));
          }
          assert.deepEqual(
            log,
            ['action', 'action'],
            `${entry}: a failed action does not request close`,
          );
          assert.ok(
            buttonByText(failing.document, 'Confirm'),
            `${entry}: the confirmation stays open`,
          );
          result = true;
          await failing.click(buttonByText(failing.document, 'Confirm'));
          assert.deepEqual(log, ['action', 'action', 'action', ['change', false]]);
        } finally {
          await failing.dispose();
        }
      }
    }
  },
  // docs/tests/genui-native-splitter.test.mjs
  AtlasSplitter: async ctx => {
    const { assert, build, buttonByText, mountPattern, randomUUID, writeFile, unlink, metaURL } =
      ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };

    const native = {
      id: 'layout',
      label: 'Review layout',
      panels: [
        { id: 'summary', label: 'Summary', text: 'Totals for the quarter.' },
        { id: 'details', label: 'Details', text: 'Line items and notes.' },
      ],
      value: [40, 60],
    };

    {
      const { definition, sample } = await load('docs/src/genui/native/splitter.ts');
      assert.deepEqual(sample, native);
      const input = structuredClone(native);
      assert.deepEqual(definition.parse(input), native);
      assert.throws(() =>
        definition.parse({
          ...native,
          panels: [{ ...native.panels[0], html: '<b>unsafe</b>' }, native.panels[1]],
        }),
      );
      assert.throws(() => definition.withValue(input, [70, 20]));
      assert.deepEqual(input, native);

      const changes = [];
      const harness = await mountPattern('default', 'docs/src/react/genui/native/splitter.tsx', {
        data: input,
        disabled: false,
        onChange: value => changes.push(value),
        onAction() {},
      });
      try {
        const { document } = harness;
        const handle = document.querySelector('[data-atlas-splitter] [role="separator"]');
        assert.ok(handle);
        assert.equal(handle.getAttribute('aria-valuenow'), '40');
        assert.equal(handle.getAttribute('aria-disabled'), 'false');
        assert.ok(document.querySelector('[role="region"][aria-label="Summary"]'));
        assert.match(document.body.textContent, /Totals for the quarter\./);
        assert.equal(changes.length, 0);
        await harness.click(buttonByText(document, 'More space for Summary'));
        await harness.waitFor(() => changes.length === 1, 'splitter onChange');
        assert.deepEqual(changes[0], [50, 50]);
        assert.deepEqual(definition.withValue(input, changes[0]).value, [50, 50]);
        assert.deepEqual(input, native);
      } finally {
        await harness.dispose();
      }
    }

    {
      const changes = [];
      // onChange records the candidate but never feeds it back: the runtime rejected it.
      const harness = await mountPattern('default', 'docs/src/react/genui/native/splitter.tsx', {
        data: { ...structuredClone(native), value: [50, 50] },
        disabled: false,
        onChange: value => changes.push(value),
        onAction() {},
      });
      try {
        const { document } = harness;
        const handle = document.querySelector('[data-atlas-splitter] [role="separator"]');
        assert.ok(handle);
        assert.equal(handle.getAttribute('aria-valuenow'), '50');
        await harness.act(async () => {
          handle.focus();
        });
        assert.equal(document.activeElement, handle);
        await harness.click(buttonByText(document, 'More space for Summary'));
        await harness.waitFor(() => changes.length >= 1, 'splitter candidate');
        assert.equal(changes.length, 1);
        const [first, second] = changes[0];
        assert.ok(first > 50);
        assert.equal(first + second, 100);
        const current = document.querySelector('[data-atlas-splitter] [role="separator"]');
        assert.equal(current, handle);
        assert.ok(handle.isConnected);
        assert.equal(handle.getAttribute('aria-valuenow'), '50');
        assert.equal(document.activeElement, handle);
      } finally {
        await harness.dispose();
      }
    }

    {
      // The harness mounts one module export; this transient wrapper renders two
      // instances in the same root and is removed like the harness's own module.
      const name = `.splitter-pair-${randomUUID()}.ts`;
      const wrapper = new URL(`./${name}`, metaURL);
      await writeFile(
        wrapper,
        [
          "import { createElement, Fragment } from 'react';",
          "import NativeSplitter from '../src/react/genui/native/splitter.tsx';",
          'export default function Pair(props: any) {',
          '  return createElement(Fragment, null, createElement(NativeSplitter, props), createElement(NativeSplitter, props));',
          '}',
          '',
        ].join('\n'),
        { flag: 'wx' },
      );
      let harness;
      try {
        harness = await mountPattern('default', `docs/tests/${name}`, {
          data: structuredClone(native),
          disabled: false,
          onChange() {},
          onAction() {},
        });
        const { document } = harness;
        const groups = [...document.querySelectorAll('[data-atlas-splitter]')];
        assert.equal(groups.length, 2);
        const ids = [...document.querySelectorAll('[id]')].map(element => element.id);
        assert.deepEqual(
          ids.filter((id, index) => ids.indexOf(id) !== index),
          [],
        );
        for (const group of groups) {
          const own = reference => {
            const target = document.getElementById(reference);
            assert.ok(target, `missing reference ${reference}`);
            assert.ok(group.contains(target), `${reference} belongs to another splitter`);
            return target;
          };
          own(group.getAttribute('aria-labelledby'));
          const handle = group.querySelector('[role="separator"]');
          assert.ok(handle);
          assert.equal(handle.getAttribute('aria-valuenow'), '40');
          own(handle.getAttribute('aria-describedby'));
          const panes = handle.getAttribute('aria-controls').split(/\s+/).map(own);
          assert.deepEqual(
            panes.map(pane => pane.getAttribute('aria-label')),
            ['Summary', 'Details'],
          );
          for (const pane of panes) assert.equal(pane.getAttribute('role'), 'region');
        }
      } finally {
        await harness?.dispose();
        await unlink(wrapper);
      }
    }
  },
  // docs/tests/genui-native-auto-complete.test.mjs
  AtlasAutoComplete: async ctx => {
    const { assert, build, mountPattern, selectOption } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };

    const native = {
      label: 'Destination city',
      value: '',
      suggestions: [
        { id: 'ankara', label: 'Ankara' },
        { id: 'izmir', label: 'Izmir', disabled: true },
      ],
    };

    const { validateComponent } = await load('docs/src/genui/policy.ts');
    const node = {
      id: 'root',
      component: 'AtlasAutoComplete',
      payload: { title: 'Choose a city', native },
    };
    assert.throws(() =>
      validateComponent({
        ...node,
        payload: { title: 'Choose a city', native: { ...native, href: 'https://atlas.test/' } },
      }),
    );

    const { definition, sample } = await load('docs/src/genui/native/auto-complete.ts');
    assert.deepEqual(sample, native);
    const parsed = definition.parse(sample);
    assert.deepEqual(parsed, native);
    assert.notEqual(parsed, sample);
    assert.equal(definition.withValue(sample, 'Ank').value, 'Ank');
    assert.equal(sample.value, '');
    assert.throws(() => definition.withValue(sample, 42));
    assert.throws(() =>
      definition.parse({ ...native, suggestions: [native.suggestions[0], native.suggestions[0]] }),
    );

    const entry = 'docs/src/react/genui/native/auto-complete.tsx';
    const changes = [];
    const props = {
      data: sample,
      disabled: false,
      onChange: value => changes.push(value),
      onAction() {},
    };
    const harness = await mountPattern('default', entry, props);
    try {
      const input = harness.document.querySelector('input[role="combobox"]');
      assert.ok(input);
      assert.equal(input.disabled, false);
      assert.equal(harness.document.querySelector('label').textContent, 'Destination city');
      await harness.type(input, 'Ank');
      assert.equal(changes.at(-1), 'Ank');
      await selectOption(harness, input, 'Ankara');
      assert.equal(changes.at(-1), 'Ankara');
      const unavailable = [...harness.document.querySelectorAll('.ant-select-item-option')].find(
        option => option.textContent.includes('Izmir'),
      );
      assert.ok(unavailable?.classList.contains('ant-select-item-option-disabled'));
    } finally {
      await harness.dispose();
    }
    const locked = await mountPattern('default', entry, {
      ...props,
      data: { ...sample, readOnly: true },
    });
    try {
      assert.equal(locked.document.querySelector('input[role="combobox"]').disabled, true);
    } finally {
      await locked.dispose();
    }
  },
  // docs/tests/genui-native-dropdown.test.mjs
  AtlasDropdown: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };

    const { validateComponent } = await load('docs/src/genui/policy.ts');
    const { createGenUIRuntime } = await load('docs/src/genui/runtime.ts');
    const native = {
      label: 'Record actions',
      items: [
        { id: 'inspect', label: 'Inspect record' },
        { id: 'archive', label: 'Archive record', disabled: true },
      ],
      value: null,
    };
    const original = structuredClone(native);
    const node = { id: 'root', component: 'AtlasDropdown', payload: { title: 'Actions', native } };
    assert.doesNotThrow(() => validateComponent(node));
    const runtime = createGenUIRuntime({ scopeId: 'dropdown-scope' });
    runtime.beginRequest('dropdown-request');
    assert.equal(
      runtime.applyBatch({
        requestId: 'dropdown-request',
        sequence: 1,
        commands: [
          {
            version: 'v0.9',
            createSurface: { surfaceId: 'records', catalogId: 'local://atlas-cards/v1' },
          },
          { version: 'v0.9', updateComponents: { surfaceId: 'records', components: [node] } },
        ],
      }).ok,
      true,
    );
    assert.throws(() =>
      validateComponent({
        ...node,
        payload: {
          title: 'Actions',
          native: { ...native, items: [native.items[0], native.items[0]] },
        },
      }),
    );

    const { definition, sample } = await load('docs/src/genui/native/dropdown.ts');
    assert.deepEqual(definition.parse(sample), sample);
    assert.equal(definition.withValue(native, 'inspect').value, 'inspect');
    assert.throws(() => definition.withValue(native, 'archive'));
    assert.throws(() => definition.withValue(native, 'missing'));
    assert.deepEqual(native, original);

    const changes = [];
    let actions = 0;
    const props = {
      data: native,
      disabled: false,
      onChange: value => changes.push(value),
      onAction: () => actions++,
    };
    const harness = await mountPattern(
      'default',
      'docs/src/react/genui/native/dropdown.tsx',
      props,
    );
    try {
      const trigger = harness.document.querySelector('.atlas-dropdown-trigger');
      assert.ok(trigger);
      assert.equal(trigger.getAttribute('aria-haspopup'), 'menu');
      assert.match(trigger.textContent, /Record actions/);
      await harness.click(trigger);
      const item = text =>
        [...harness.document.querySelectorAll('[role="menuitem"]')].find(
          entry => entry.textContent.trim() === text,
        );
      await harness.waitFor(() => item('Inspect record'), 'dropdown menu items');
      assert.equal(item('Archive record').getAttribute('aria-disabled'), 'true');
      await harness.click(item('Archive record'));
      assert.deepEqual(changes, []);
      await harness.click(item('Inspect record'));
      assert.deepEqual(changes, ['inspect']);
      assert.equal(actions, 0);
      assert.deepEqual(native, original);
    } finally {
      await harness.dispose();
    }

    const locked = await mountPattern('default', 'docs/src/react/genui/native/dropdown.tsx', {
      ...props,
      data: { ...native, value: 'inspect' },
      disabled: true,
    });
    try {
      const trigger = locked.document.querySelector('.atlas-dropdown-trigger');
      assert.equal(trigger.disabled, true);
      assert.match(trigger.textContent, /Inspect record/);
      await locked.click(trigger);
      assert.equal(trigger.getAttribute('aria-expanded'), 'false');
      assert.deepEqual(changes, ['inspect']);
    } finally {
      await locked.dispose();
    }
  },
  // docs/tests/genui-native-segmented.test.mjs
  AtlasSegmented: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async contents => {
      const bundled = await build({
        stdin: {
          contents,
          resolveDir: process.cwd(),
          sourcefile: 'segmented-entry.ts',
          loader: 'ts',
        },
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const native = {
      label: 'Report period',
      options: [
        { label: 'Week', value: 'week' },
        { label: 'Month', value: 'month' },
        { label: 'Quarter', value: 'quarter', disabled: true },
      ],
      value: 'week',
    };
    const item = (scope, text) =>
      [...scope.querySelectorAll('.ant-segmented-item')].find(
        entry => entry.textContent.trim() === text,
      );

    const { validateComponent, createGenUIRuntime } = await load(
      "export { validateComponent } from './docs/src/genui/policy.ts'; export { createGenUIRuntime } from './docs/src/genui/runtime.ts';",
    );
    const node = {
      id: 'root',
      component: 'AtlasSegmented',
      payload: { title: 'Report period', native },
    };
    assert.throws(() =>
      validateComponent({
        ...node,
        payload: { title: 'Report period', native: { ...native, value: 'year' } },
      }),
    );

    const runtime = createGenUIRuntime({ scopeId: 'segmented-scope' });
    runtime.beginRequest('segmented-request');
    assert.equal(
      runtime.applyBatch({
        requestId: 'segmented-request',
        sequence: 1,
        commands: [
          {
            version: 'v0.9',
            createSurface: { surfaceId: 'records', catalogId: 'local://atlas-cards/v1' },
          },
          { version: 'v0.9', updateComponents: { surfaceId: 'records', components: [node] } },
        ],
      }).ok,
      true,
    );
    runtime.finishRequest('segmented-request', 'success');
    const snapshot = runtime.getSnapshot();
    const generation = snapshot.surfaces[0].generation;
    assert.equal(
      runtime.changeNativeValue('records', 'root', 'quarter', generation, snapshot.revision).ok,
      false,
    );
    assert.equal(
      runtime.changeNativeValue('records', 'root', 'month', generation, snapshot.revision).ok,
      true,
    );

    const { definition, sample } = await load(
      "export * from './docs/src/genui/native/segmented.ts';",
    );
    assert.deepEqual(definition.parse(sample), sample);
    assert.equal(definition.withValue(native, 'month').value, 'month');
    assert.equal(native.value, 'week');
    assert.throws(() => definition.withValue(native, 'quarter'));
    assert.throws(() => definition.withValue(native, 'year'));

    const calls = [];
    const entry = 'docs/src/react/genui/native/segmented.tsx';
    const props = { data: native, onChange: value => calls.push(value), onAction() {} };
    const view = await mountPattern('default', entry, { ...props, disabled: false });
    try {
      const group = view.document.querySelector('.atlas-segmented');
      assert.ok(group);
      assert.equal(group.getAttribute('aria-label'), 'Report period');
      const input = text => item(view.document, text)?.querySelector('input');
      assert.equal(input('Week').checked, true);
      assert.equal(input('Quarter').disabled, true);
      await view.click(input('Month'));
      assert.deepEqual(calls, ['month']);
      assert.equal(
        view.document.querySelector('.ant-segmented-item-selected')?.textContent.trim(),
        'Week',
      );
    } finally {
      await view.dispose();
    }

    const locked = await mountPattern('default', entry, { ...props, disabled: true });
    try {
      const inputs = [...locked.document.querySelectorAll('.ant-segmented-item input')];
      assert.equal(inputs.length, 3);
      assert.ok(inputs.every(control => control.disabled));
      await locked.click(item(locked.document, 'Month').querySelector('input'));
      assert.deepEqual(calls, ['month']);
    } finally {
      await locked.dispose();
    }
  },

  AtlasRecordCollection: async ctx => {
    const { assert, build, mountPattern, selectOption } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const nativeSample = {
      fields: [
        { key: 'name', label: 'Name', kind: 'text', required: true },
        {
          key: 'status',
          label: 'Status',
          kind: 'choice',
          options: [
            { value: 'open', label: 'Open' },
            { value: 'done', label: 'Done' },
          ],
        },
        { key: 'due', label: 'Due date', kind: 'date' },
      ],
      records: [
        { id: 'task-1', name: 'Draft brief', status: 'open', due: '2026-10-20' },
        { id: 'task-2', name: 'Review copy', status: 'done', due: '2026-10-22' },
        { id: 'task-3', name: 'Publish notes', status: 'open', due: '2026-11-02' },
      ],
      dateFieldKey: 'due',
      boardFieldKey: 'status',
      value: {
        query: { search: '', filters: [], sort: [{ fieldKey: 'due', direction: 'asc' }] },
        projection: ['name', 'status', 'due'],
        activeId: null,
        checkedIds: ['task-1'],
        view: 'table',
        page: 1,
      },
    };

    {
      // Former test: native node emits controlled view and selection candidates.
      const { definition, sample } = await load('docs/src/genui/native/record-collection.ts');
      assert.equal(definition.containsCards, true);
      assert.deepEqual(sample, nativeSample);
      assert.deepEqual(definition.parse(sample), nativeSample);
      // Gantt needs supplied start and end fields; checked IDs must reference supplied records.
      assert.throws(() => definition.withValue(sample, { ...nativeSample.value, view: 'gantt' }));
      assert.throws(() =>
        definition.withValue(sample, { ...nativeSample.value, checkedIds: ['task-9'] }),
      );

      const changes = [];
      const harness = await mountPattern(
        'default',
        'docs/src/react/genui/native/record-collection.tsx',
        { data: sample, disabled: false, onChange: value => changes.push(value), onAction() {} },
      );
      try {
        const presentation = [...harness.document.querySelectorAll('label')].find(label =>
          label.textContent.includes('Collection presentation'),
        );
        await selectOption(harness, presentation?.querySelector('.ant-select'), 'List');
        assert.deepEqual(changes, [{ ...nativeSample.value, view: 'list' }]);
        // The parent has not accepted the candidate, so the controlled view remains a table.
        assert.ok(harness.document.querySelector('table.kit-table'));

        await harness.click(harness.document.querySelector('input[aria-label="Select task-2"]'));
        const selected = { ...nativeSample.value, checkedIds: ['task-1', 'task-2'] };
        assert.deepEqual(changes.at(-1), selected);
        assert.deepEqual(definition.withValue(sample, changes.at(-1)).value, selected);
        assert.deepEqual(sample, nativeSample);
      } finally {
        await harness.dispose();
      }
    }

    {
      // Former test: query change publishes query and page in one surface revision.
      const { createGenUIRuntime } = await load('docs/src/genui/runtime.ts');
      const runtime = createGenUIRuntime({ scopeId: 'native-record-collection-surface' });
      runtime.beginRequest('request-surface');
      assert.equal(
        runtime.applyBatch({
          requestId: 'request-surface',
          sequence: 1,
          commands: [
            {
              version: 'v0.9',
              createSurface: { surfaceId: 'records', catalogId: 'local://atlas-cards/v1' },
            },
            {
              version: 'v0.9',
              updateComponents: {
                surfaceId: 'records',
                components: [
                  {
                    id: 'root',
                    component: 'AtlasRecordCollection',
                    payload: { title: 'Tasks', native: nativeSample },
                  },
                ],
              },
            },
          ],
        }).ok,
        true,
      );
      runtime.finishRequest('request-surface', 'success');
      assert.equal(runtime.getSnapshot().status, 'success');
      const published = () => runtime.getSnapshot().surfaces[0].blocks.root.native.value;

      const harness = await mountPattern('default', 'docs/src/react/genui/AtlasGenUISurface.tsx', {
        runtime,
      });
      try {
        await harness.waitFor(
          () => harness.document.querySelector('input[aria-label="Select task-2"]'),
          'lazy record collection adapter',
        );
        await harness.click(harness.document.querySelector('input[aria-label="Select task-2"]'));
        assert.deepEqual(published().checkedIds, ['task-1', 'task-2']);

        const before = runtime.getSnapshot();
        const lastEvent = before.events.at(-1).id;
        const search = [...harness.document.querySelectorAll('.kit-collection input')].find(
          input =>
            !input.closest('.ant-select') &&
            (input.type === 'search' ||
              /search/i.test(
                `${input.getAttribute('aria-label') ?? ''} ${input.getAttribute('placeholder') ?? ''} ${input.closest('label')?.textContent ?? ''}`,
              )),
        );
        assert.ok(search, 'Collection query search input');
        await harness.type(search, 'Draft');
        await harness.waitFor(
          () => runtime.getSnapshot().revision !== before.revision || runtime.getSnapshot().error,
          'query change reaches the runtime',
        );
        // Let any trailing callback from the same event reach the runtime.
        await harness.act(async () => {
          await new Promise(resolve => setTimeout(resolve, 20));
        });

        const after = runtime.getSnapshot();
        assert.equal(after.error, null);
        assert.deepEqual(
          after.events.filter(entry => entry.id > lastEvent && entry.kind === 'rejected'),
          [],
        );
        assert.equal(after.revision, before.revision + 1);
        const value = published();
        assert.equal(value.query.search, 'Draft');
        assert.deepEqual(value, {
          ...nativeSample.value,
          query: value.query,
          page: 1,
          checkedIds: ['task-1', 'task-2'],
        });
      } finally {
        await harness.dispose();
      }
    }
  },
  AtlasRecordDisplay: async ctx => {
    const { assert, build, mountPattern, headerByText } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const nativeSample = {
      title: 'Supplier record',
      presentation: 'tabs',
      fields: [
        { key: 'name', label: 'Supplier name', kind: 'text', section: 'Overview' },
        {
          key: 'status',
          label: 'Status',
          kind: 'choice',
          section: 'Overview',
          options: [
            { value: 'active', label: 'Active' },
            { value: 'paused', label: 'Paused' },
          ],
        },
        {
          key: 'balance',
          label: 'Open balance',
          kind: 'money',
          currency: 'EUR',
          precision: 2,
          section: 'Finance',
        },
        { key: 'onboarded', label: 'Onboarded', kind: 'date', section: 'Finance' },
      ],
      record: {
        id: 'supplier-1',
        name: 'Aster Logistics',
        status: 'active',
        balance: 1250.5,
        onboarded: '2026-03-02',
      },
    };

    {
      // Former test: native node validates and renders formatted fields in local sections.
      const { definition, sample } = await load('docs/src/genui/native/record-display.ts');
      assert.deepEqual(sample, nativeSample);
      assert.deepEqual(definition.parse(sample), nativeSample);
      assert.deepEqual(definition.parse({ ...sample, record: null }).record, null);
      assert.throws(() => definition.parse({ ...sample, onEdit: 'open' }));
      assert.throws(() => definition.parse({ ...sample, presentation: 'drawer' }));
      assert.throws(() =>
        definition.parse({ ...sample, record: { ...sample.record, secret: 'hidden' } }),
      );

      const changes = [];
      const harness = await mountPattern(
        'default',
        'docs/src/react/genui/native/record-display.tsx',
        {
          data: sample,
          disabled: false,
          onChange: value => changes.push(value),
          onAction() {},
        },
      );
      try {
        const { document } = harness;
        const field = key => document.querySelector(`[data-read-field="${key}"]`);
        assert.equal(field('name').querySelector('dt').textContent, 'Supplier name');
        assert.ok(field('name').querySelector('dd').textContent.includes('Aster Logistics'));
        assert.ok(field('status').querySelector('dd').textContent.includes('Active'));
        assert.ok(field('balance').querySelector('dd').textContent.includes('€1,250.50'));
        assert.ok(field('onboarded').querySelector('dd').textContent.includes('Mar 2, 2026'));
        assert.ok(
          ![...document.querySelectorAll('button')].some(b => b.textContent.includes('Edit')),
        );

        const panels = [...document.querySelectorAll('[role="tabpanel"]')];
        assert.equal(panels.length, 2);
        assert.ok(panels[0].contains(field('name')));
        assert.ok(panels[1].contains(field('balance')));
        assert.equal(panels[0].getAttribute('aria-hidden'), 'false');
        assert.equal(panels[1].getAttribute('aria-hidden'), 'true');

        await harness.click(headerByText(document, 'Finance'));
        assert.equal(panels[0].getAttribute('aria-hidden'), 'true');
        assert.equal(panels[1].getAttribute('aria-hidden'), 'false');
        assert.deepEqual(changes, []);
      } finally {
        await harness.dispose();
      }
    }
  },
  AtlasRecordForm: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const nativeSample = {
      title: 'Account draft',
      organization: 'sections',
      fields: [
        { key: 'name', label: 'Account name', kind: 'text', required: true, section: 'Profile' },
        { key: 'owner', label: 'Owner', kind: 'text', section: 'Profile' },
        { key: 'region', label: 'Region', kind: 'text', readOnly: true, section: 'Plan' },
      ],
      record: { id: 'account-1', name: 'Aster Labs', owner: 'Ada Lovelace', region: 'EU' },
      value: { id: 'account-1', name: 'Aster Labs', owner: 'Ada Lovelace', region: 'EU' },
    };

    {
      // Former test: native node emits a validated draft and gates local review on record validation.
      const { definition, sample } = await load('docs/src/genui/native/record-form.ts');
      assert.deepEqual(sample, nativeSample);
      assert.deepEqual(definition.parse(sample), nativeSample);
      const before = structuredClone(sample);
      // Empty typing is a valid draft; required-ness is enforced only at explicit commit.
      assert.equal(definition.withValue(sample, { ...sample.value, name: '' }).value.name, '');
      assert.throws(() => definition.withValue(sample, { ...sample.value, id: 'account-2' }));
      assert.throws(() => definition.withValue(sample, { ...sample.value, region: 'US' }));
      assert.throws(() => definition.withValue(sample, { ...sample.value, owner: 42 }));
      assert.throws(() => definition.withValue(sample, { ...sample.value, secret: 'x' }));
      assert.throws(() => definition.withValue(sample, { id: 'account-1', name: 'Aster Labs' }));
      assert.deepEqual(sample, before);

      const data = { ...structuredClone(sample), value: { ...sample.value, name: '' } };
      const source = structuredClone(data);
      const changes = [];
      let actions = 0;
      const harness = await mountPattern('default', 'docs/src/react/genui/native/record-form.tsx', {
        data,
        disabled: false,
        onChange: value => changes.push(value),
        onAction: () => actions++,
      });
      try {
        const legends = [...harness.document.querySelectorAll('fieldset legend')].map(legend =>
          legend.textContent.trim(),
        );
        assert.deepEqual(legends, ['Profile', 'Plan']);
        const owner = harness.document.querySelector('[data-field-key="owner"] input');
        assert.ok(owner);
        await harness.type(owner, 'Grace Hopper');
        assert.deepEqual(changes, [
          { id: 'account-1', name: '', owner: 'Grace Hopper', region: 'EU' },
        ]);
        assert.deepEqual(definition.withValue(data, changes[0]).value, changes[0]);
        assert.deepEqual(data, source);

        await harness.submit(harness.document.querySelector('form.kit-record-form'));
        const summary = harness.document.querySelector('.kit-error-summary');
        assert.ok(summary, 'explicit review must run record validation first');
        assert.ok(summary.textContent.includes('Account name'));
        assert.equal(actions, 0);
        assert.ok(!harness.document.body.textContent.includes('Nothing has been saved'));
      } finally {
        await harness.dispose();
      }
    }
  },
  AtlasEditableGrid: async ctx => {
    const { assert, build, mountPattern, buttonByText } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const nativeSample = {
      fields: [
        { key: 'name', label: 'Name', kind: 'text', required: true },
        { key: 'code', label: 'Code', kind: 'text', readOnly: true },
      ],
      records: [
        { id: 'r1', name: 'Aster', code: 'A-1' },
        { id: 'r2', name: 'Birch', code: 'B-2' },
      ],
      value: {},
    };

    {
      // Former test: native editing emits drafts while records stay unchanged and rejection keeps the authoritative value.
      const { definition, sample } = await load('docs/src/genui/native/editable-grid.ts');
      const parsed = definition.parse(sample);
      assert.deepEqual(parsed.records, nativeSample.records);
      assert.deepEqual(parsed.value, {});
      const before = structuredClone(sample);
      const drafted = definition.withValue(sample, { r1: { id: 'r1', name: 'Ada', code: 'A-1' } });
      assert.equal(drafted.value.r1.name, 'Ada');
      assert.deepEqual(sample, before);
      // Protected identity, unknown records and read-only fields cannot enter the drafts map.
      assert.throws(() =>
        definition.withValue(sample, { r1: { id: 'r2', name: 'Ada', code: 'B-2' } }),
      );
      assert.throws(() =>
        definition.withValue(sample, { r9: { id: 'r9', name: 'Ada', code: 'A-1' } }),
      );
      assert.throws(() =>
        definition.withValue(sample, { r1: { id: 'r1', name: 'Aster', code: 'Z-9' } }),
      );
      assert.throws(() =>
        definition.withValue(
          { ...sample, readOnly: true },
          { r1: { id: 'r1', name: 'Ada', code: 'A-1' } },
        ),
      );

      // The parent records proposals but never applies them, i.e. it rejects every change.
      const changes = [];
      const harness = await mountPattern(
        'default',
        'docs/src/react/genui/native/editable-grid.tsx',
        {
          data: sample,
          disabled: false,
          onChange: value => changes.push(value),
          onAction() {},
        },
      );
      try {
        const { document } = harness;
        assert.equal(buttonByText(document, 'Edit Code for r1'), undefined);
        await harness.click(buttonByText(document, 'Edit Name for r1'));
        const editor = () =>
          document.querySelector(
            'td[data-editing-cell="true"] input, td[data-editing-cell="true"] textarea',
          );
        await harness.waitFor(() => editor(), 'Name editor for r1');
        await harness.type(editor(), 'Ada');
        assert.ok(changes.length > 0);
        for (const change of changes)
          assert.deepEqual(change, { r1: { id: 'r1', name: 'Ada', code: 'A-1' } });
        assert.deepEqual(sample, before);
        const retained = [...document.querySelectorAll('p[role="status"]')].find(item =>
          item.textContent.includes('row drafts retained'),
        );
        assert.match(retained?.textContent ?? '', /^0\b/);
        assert.ok(!document.body.textContent.includes('Unsaved draft'));
      } finally {
        await harness.dispose();
      }
    }
  },
  AtlasRepeatingRecords: async ctx => {
    const { assert, build, mountPattern, buttonByText } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const rowA = { id: 'line-a', item: 'Paper', quantity: 2 };
    const rowB = { id: 'line-b', item: 'Ink', quantity: 1 };
    const nativeSample = {
      label: 'Order lines',
      fields: [
        { key: 'item', label: 'Item', kind: 'text', required: true },
        { key: 'quantity', label: 'Quantity', kind: 'number' },
      ],
      value: [rowA, rowB],
      minRows: 1,
      maxRows: 4,
      rowTemplate: { quantity: 1 },
    };

    {
      // Former test: adds and removes controlled rows without mutating the source.
      const { definition, sample } = await load('docs/src/genui/native/repeating-records.ts');
      assert.deepEqual(sample, nativeSample);
      assert.deepEqual(definition.parse(sample), nativeSample);
      assert.throws(() => definition.withValue(sample, [rowA, rowA]));
      assert.throws(() => definition.withValue(sample, [rowA, rowB, rowA, rowB, rowA]));
      assert.throws(() => definition.parse({ ...sample, rowTemplate: { id: 'forged' } }));
      assert.throws(() => definition.withValue({ ...sample, readOnly: true }, [rowA]));
      const before = structuredClone(sample);

      const changes = [];
      const harness = await mountPattern(
        'default',
        'docs/src/react/genui/native/repeating-records.tsx',
        {
          data: sample,
          disabled: false,
          onChange: value => changes.push(value),
          onAction() {},
        },
      );
      try {
        const frames = () => harness.document.querySelectorAll('[data-child-id]');
        assert.equal(frames().length, 2);
        await harness.click(buttonByText(harness.document, 'Add child record'));
        assert.equal(changes.length, 1);
        const added = changes[0];
        assert.equal(added.length, 3);
        assert.deepEqual(added.slice(0, 2), [rowA, rowB]);
        assert.match(
          added[2].id,
          /^row-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        );
        assert.deepEqual({ ...added[2], id: null }, { id: null, item: null, quantity: 1 });
        assert.equal(new Set(added.map(row => row.id)).size, 3);
        assert.deepEqual(definition.withValue(sample, added).value, added);
        // The parent has not accepted the candidate, so the controlled rows stay unchanged.
        assert.equal(frames().length, 2);

        await harness.click(buttonByText(harness.document, 'Remove line-a'));
        assert.deepEqual(changes[1], [rowB]);
        assert.deepEqual(sample, before);
      } finally {
        await harness.dispose();
      }
    }
  },
  AtlasConnectedWorkspace: async ctx => {
    const { assert, build, mountPattern, buttonByText, selectOption } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const nativeSample = {
      label: 'Local order preview',
      fields: [
        { key: 'title', label: 'Title', kind: 'text', required: true },
        { key: 'quantity', label: 'Quantity', kind: 'number', precision: 0 },
        {
          key: 'status',
          label: 'Status',
          kind: 'choice',
          options: [
            { value: 'draft', label: 'Draft' },
            { value: 'ready', label: 'Ready' },
          ],
        },
      ],
      records: [
        { id: 'ord-1', title: 'Hinge order', quantity: 12, status: 'ready' },
        { id: 'ord-2', title: 'Bracket order', quantity: 4, status: 'draft' },
      ],
      value: { activeId: null, checkedIds: [], view: 'table', draft: null },
    };

    {
      // Former test: drafts the selected record into the local JSON preview only.
      const { definition, sample } = await load('docs/src/genui/native/connected-workspace.ts');
      assert.equal(definition.containsCards, true);
      const parsed = definition.parse(sample);
      assert.deepEqual(parsed.records, sample.records);
      assert.deepEqual(parsed.value, sample.value);
      assert.equal(parsed.fields.length, sample.fields.length);
      assert.throws(() =>
        definition.withValue(sample, {
          ...sample.value,
          draft: { id: 'ord-9', title: 'Invented' },
        }),
      );

      const host = structuredClone(sample);
      const changes = [];
      const harness = await mountPattern(
        'NativeConnectedWorkspacePreview',
        'docs/src/react/genui/native/connected-workspace.tsx',
        { data: sample, onChange: value => changes.push(value) },
      );
      try {
        const { document } = harness;
        assert.ok(
          document.querySelector('[role="note"]')?.textContent.includes('Local preview only'),
        );
        const label = [...document.querySelectorAll('label')].find(
          item => item.textContent.trim() === 'Inspect record',
        );
        await selectOption(
          harness,
          document.getElementById(label?.htmlFor),
          'Bracket order (ord-2)',
        );
        assert.equal(changes.at(-1).activeId, 'ord-2');

        const display = () => document.querySelector('[data-kit-display="ord-2"]');
        await harness.waitFor(() => display(), 'selected record display');
        await harness.click(buttonByText(display(), 'Edit record'));
        assert.equal(changes.at(-1).draft.id, 'ord-2');

        const form = () => document.querySelector('[data-kit-form="ord-2"]');
        assert.ok(form());
        await harness.type(
          form().querySelector('[data-field-key="title"] input'),
          'Bracket order revised',
        );
        assert.equal(changes.at(-1).draft.id, 'ord-2');
        assert.equal(changes.at(-1).draft.title, 'Bracket order revised');
        assert.equal(
          form().querySelector('[data-field-key="title"] input').value,
          'Bracket order revised',
        );

        await harness.submit(form().querySelector('form'));
        const committed = changes.at(-1);
        assert.equal(committed.draft, null);
        assert.deepEqual(
          committed.records.map(record => [record.id, record.title]),
          [
            ['ord-1', 'Hinge order'],
            ['ord-2', 'Bracket order revised'],
          ],
        );
        await harness.waitFor(
          () => display()?.textContent.includes('Bracket order revised'),
          'committed local preview value in record display',
        );
        assert.deepEqual(sample, host);
      } finally {
        await harness.dispose();
      }
    }

    {
      // Former test: native read-only fields reject direct runtime edits while editable fields still apply.
      const { createGenUIRuntime } = await load('docs/src/genui/runtime.ts');
      const connected = {
        label: 'Locked order preview',
        fields: [
          { key: 'title', label: 'Title', kind: 'text', required: true },
          { key: 'sku', label: 'SKU', kind: 'text', readOnly: true },
        ],
        records: [
          { id: 'ord-1', title: 'Hinge order', sku: 'HNG-1' },
          { id: 'ord-2', title: 'Bracket order', sku: 'BRK-2' },
        ],
        value: { activeId: null, checkedIds: [], view: 'table', draft: null },
      };
      const repeating = {
        label: 'Locked order lines',
        fields: [
          { key: 'item', label: 'Item', kind: 'text', required: true },
          { key: 'code', label: 'Code', kind: 'text', readOnly: true },
          { key: 'quantity', label: 'Quantity', kind: 'number' },
        ],
        value: [
          { id: 'line-a', item: 'Paper', code: 'PAP-1', quantity: 2 },
          { id: 'line-b', item: 'Ink', code: 'INK-1', quantity: 1 },
        ],
        maxRows: 4,
      };
      const surface = (surfaceId, component, native) => [
        { version: 'v0.9', createSurface: { surfaceId, catalogId: 'local://atlas-cards/v1' } },
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId,
            components: [{ id: 'root', component, payload: { title: 'Orders', native } }],
          },
        },
      ];
      const runtime = createGenUIRuntime({ scopeId: 'native-readonly-scope' });
      runtime.beginRequest('request-readonly');
      assert.equal(
        runtime.applyBatch({
          requestId: 'request-readonly',
          sequence: 1,
          commands: [
            ...surface('connected', 'AtlasConnectedWorkspace', connected),
            ...surface('lines', 'AtlasRepeatingRecords', repeating),
          ],
        }).ok,
        true,
      );
      runtime.finishRequest('request-readonly', 'success');
      assert.equal(runtime.getSnapshot().status, 'success');

      // Every direct edit reads the current generation and revision first.
      const change = (surfaceId, value) => {
        const snapshot = runtime.getSnapshot();
        const owner = snapshot.surfaces.find(item => item.id === surfaceId);
        return runtime.changeNativeValue(
          surfaceId,
          'root',
          value,
          owner.generation,
          snapshot.revision,
        ).ok;
      };
      const native = surfaceId =>
        runtime.getSnapshot().surfaces.find(item => item.id === surfaceId).blocks.root.native;

      const base = connected.value;
      const [ord1, ord2] = connected.records;
      assert.equal(
        change('connected', { ...base, records: [ord1, { ...ord2, sku: 'FORGED' }] }),
        false,
      );
      assert.equal(
        change('connected', { ...base, activeId: 'ord-2', draft: { ...ord2, sku: 'FORGED' } }),
        false,
      );
      assert.deepEqual(native('connected').value, base);
      assert.equal(
        change('connected', {
          ...base,
          records: [ord1, { ...ord2, title: 'Bracket order revised' }],
        }),
        true,
      );
      assert.deepEqual(
        native('connected').value.records.map(record => [record.id, record.title, record.sku]),
        [
          ['ord-1', 'Hinge order', 'HNG-1'],
          ['ord-2', 'Bracket order revised', 'BRK-2'],
        ],
      );
      assert.equal(
        change('connected', {
          ...base,
          activeId: 'ord-2',
          draft: { ...ord2, title: 'Bracket draft' },
        }),
        true,
      );
      assert.deepEqual(native('connected').value.draft, { ...ord2, title: 'Bracket draft' });

      const [lineA, lineB] = repeating.value;
      assert.equal(change('lines', [{ ...lineA, code: 'FORGED' }, lineB]), false);
      assert.deepEqual(native('lines').value, repeating.value);
      assert.equal(
        change('lines', [
          { ...lineA, quantity: 5 },
          lineB,
          { id: 'line-c', item: 'Toner', code: 'TON-1', quantity: 3 },
        ]),
        true,
      );
      assert.deepEqual(
        native('lines').value.map(row => [row.id, row.code, row.quantity]),
        [
          ['line-a', 'PAP-1', 5],
          ['line-b', 'INK-1', 1],
          ['line-c', 'TON-1', 3],
        ],
      );
    }
  },
  AtlasEmptyState: async ctx => {
    const { assert, build, mountPattern, buttonByText } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const nativeSample = {
      kind: 'no-match',
      title: 'No matching records',
      description: 'Try a different search term.',
      actionLabel: 'Clear search',
      headingLevel: 3,
    };

    {
      // Former test: native node validates bounded text and exposes status, heading and granted action only.
      const { definition, sample } = await load('docs/src/genui/native/empty-state.ts');
      assert.deepEqual(sample, nativeSample);
      assert.deepEqual(definition.parse(sample), nativeSample);
      assert.deepEqual(definition.parse({ kind: 'empty', title: 'Nothing yet' }), {
        kind: 'empty',
        title: 'Nothing yet',
      });
      for (const invalid of [
        { ...sample, kind: 'denied' },
        { ...sample, href: 'https://atlas.test' },
        { ...sample, onAction: 'reload' },
        { ...sample, headingLevel: 1 },
        { ...sample, headingLevel: 7 },
        { ...sample, headingLevel: 3.5 },
        { ...sample, title: '   ' },
        { ...sample, title: 'x'.repeat(161) },
        { ...sample, title: 42 },
        { ...sample, description: 'Line\u0000break' },
        { ...sample, actionLabel: 'x'.repeat(61) },
        { kind: 'empty' },
      ])
        assert.throws(() => definition.parse(invalid));

      const actions = [];
      const granted = await mountPattern('default', 'docs/src/react/genui/native/empty-state.tsx', {
        data: { ...sample, kind: 'error' },
        disabled: false,
        actionAvailable: true,
        onChange() {},
        onAction: () => actions.push('recover'),
      });
      try {
        const live = granted.document.querySelector('[data-empty-state="error"]');
        assert.equal(live?.getAttribute('role'), 'alert');
        assert.equal(live.querySelector('h3')?.textContent, 'No matching records');
        assert.equal(live.querySelector('p')?.textContent, 'Try a different search term.');
        const button = buttonByText(granted.document, 'Clear search');
        assert.ok(button);
        assert.equal(live.contains(button), false);
        await granted.click(button);
        assert.deepEqual(actions, ['recover']);
      } finally {
        await granted.dispose();
      }

      const withheld = await mountPattern(
        'default',
        'docs/src/react/genui/native/empty-state.tsx',
        {
          data: { kind: 'empty', title: 'Nothing yet', actionLabel: 'Create record' },
          disabled: false,
          onChange() {},
          onAction: () => actions.push('fabricated'),
        },
      );
      try {
        const live = withheld.document.querySelector('[data-empty-state="empty"]');
        assert.equal(live?.getAttribute('role'), 'status');
        assert.equal(live.querySelector('h4')?.textContent, 'Nothing yet');
        assert.equal(withheld.document.querySelector('button'), null);
        assert.deepEqual(actions, ['recover']);
      } finally {
        await withheld.dispose();
      }
    }
  },
  AtlasSeriesChart: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const nativeSample = {
      title: 'Requests by quarter',
      description: 'Support and billing requests opened each quarter.',
      categories: ['Q1', 'Q2', 'Q3'],
      series: [
        { id: 'support', label: 'Support', values: [12, 18, 9] },
        { id: 'billing', label: 'Billing', values: [4, 7, 11] },
      ],
    };
    {
      const { validateComponent } = await load('docs/src/genui/policy.ts');
      const node = {
        id: 'requests',
        component: 'AtlasSeriesChart',
        payload: { title: 'Requests', native: nativeSample },
      };
      const shortSeries = {
        ...nativeSample,
        series: [nativeSample.series[0], { id: 'billing', label: 'Billing', values: [4, 7] }],
      };
      assert.throws(() =>
        validateComponent({ ...node, payload: { title: 'Requests', native: shortSeries } }),
      );

      const { definition, sample } = await load('docs/src/genui/native/series-chart.ts');
      assert.deepEqual(sample, nativeSample);
      assert.deepEqual(definition.parse(sample), nativeSample);
      assert.throws(() => definition.parse(shortSeries), /one value for each category/);
      assert.throws(() =>
        definition.parse({
          ...nativeSample,
          series: [{ id: 'support', label: 'Support', values: [12, -1, 9] }],
        }),
      );
      assert.throws(() =>
        definition.parse({
          ...nativeSample,
          series: Array.from({ length: 9 }, (_, index) => ({
            id: `s${index}`,
            label: `Series ${index}`,
            values: [1, 2, 3],
          })),
        }),
      );

      const harness = await mountPattern(
        'default',
        'docs/src/react/genui/native/series-chart.tsx',
        {
          data: sample,
          disabled: false,
          onChange() {},
          onAction() {},
        },
      );
      try {
        const figure = harness.document.querySelector('figure.atlas-chart');
        assert.equal(figure?.dataset.chartState, 'ready');
        assert.deepEqual(
          [...harness.document.querySelectorAll('.atlas-chart-legend-item')].map(item =>
            item.textContent.trim(),
          ),
          ['Support', 'Billing'],
        );
        const table = harness.document.querySelector('table.atlas-chart-table');
        assert.deepEqual(
          [...table.querySelectorAll('thead th')].slice(1).map(cell => cell.textContent.trim()),
          ['Support', 'Billing'],
        );
        assert.deepEqual(
          [...table.querySelectorAll('tbody tr')].map(row =>
            [...row.children].map(cell => cell.textContent.trim()),
          ),
          [
            ['Q1', '12', '4'],
            ['Q2', '18', '7'],
            ['Q3', '9', '11'],
          ],
        );
        assert.equal(harness.document.querySelectorAll('input, button, a, select').length, 0);
      } finally {
        await harness.dispose();
      }
    }
  },
  AtlasPasswordInput: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    // Example-only value; no real credential appears in fixtures.
    const nativeSample = {
      label: 'Password',
      value: '',
      placeholder: 'Enter a password',
      required: true,
      maxLength: 64,
    };
    {
      const { definition, sample } = await load('docs/src/genui/native/password-input.ts');
      assert.deepEqual(sample, nativeSample);
      assert.deepEqual(definition.parse(sample), nativeSample);
      assert.throws(() => definition.parse({ ...sample, href: 'https://atlas.test' }));
      const before = structuredClone(sample);
      assert.equal(definition.withValue(sample, 'example').value, 'example');
      assert.deepEqual(sample, before);
      assert.throws(() => definition.withValue(sample, 42));
      assert.throws(() => definition.withValue(sample, 'x'.repeat(65)));
      assert.throws(() => definition.withValue({ ...sample, readOnly: true }, 'example'));

      const changes = [];
      const harness = await mountPattern(
        'default',
        'docs/src/react/genui/native/password-input.tsx',
        {
          data: sample,
          disabled: false,
          onChange: value => changes.push(value),
          onAction() {},
        },
      );
      try {
        const input = harness.document.querySelector('input');
        const label = harness.document.querySelector('label');
        assert.ok(input);
        assert.equal(input.type, 'password');
        assert.ok(label?.textContent.includes('Password'));
        assert.equal(label.htmlFor, input.id);
        assert.equal(input.value, '');
        assert.equal(input.placeholder, 'Enter a password');
        assert.equal(input.maxLength, 64);
        assert.equal(input.required, true);
        assert.equal(input.readOnly, false);
        await harness.type(input, 'example');
        assert.deepEqual(changes, ['example']);
        assert.equal(harness.document.body.textContent.includes('example'), false);
        await harness.click(harness.document.querySelector('.ant-input-password-icon'));
        assert.equal(harness.document.querySelector('input').type, 'text');
      } finally {
        await harness.dispose();
      }

      const guarded = [];
      const readOnly = await mountPattern(
        'default',
        'docs/src/react/genui/native/password-input.tsx',
        {
          data: { ...sample, readOnly: true },
          disabled: false,
          onChange: value => guarded.push(value),
          onAction() {},
        },
      );
      try {
        const input = readOnly.document.querySelector('input');
        assert.equal(input.readOnly, true);
        await readOnly.type(input, 'example');
        assert.deepEqual(guarded, []);
      } finally {
        await readOnly.dispose();
      }
    }
  },
  AtlasTextArea: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const nativeSample = {
      label: 'Release notes',
      value: 'Fixed sync retries.\nImproved export labels.',
      placeholder: 'Describe the change',
      maxLength: 500,
      required: true,
      rows: 4,
    };
    {
      const { validateComponent } = await load('docs/src/genui/policy.ts');
      const node = {
        id: 'notes',
        component: 'AtlasTextArea',
        payload: { title: 'Release', native: nativeSample },
      };
      assert.throws(() =>
        validateComponent({
          ...node,
          payload: { title: 'Release', native: { ...nativeSample, autoSize: { minRows: 2 } } },
        }),
      );

      const { definition, sample } = await load('docs/src/genui/native/text-area.ts');
      assert.deepEqual(sample, nativeSample);
      assert.deepEqual(definition.parse(sample), nativeSample);
      assert.throws(() => definition.parse({ ...sample, rows: 1 }));
      assert.throws(() => definition.parse({ ...sample, rows: 13 }));
      assert.throws(() => definition.parse({ ...sample, style: { height: 400 } }));
      const before = structuredClone(sample);
      assert.equal(definition.withValue(sample, 'One\nTwo').value, 'One\nTwo');
      assert.deepEqual(sample, before);
      assert.throws(() => definition.withValue(sample, 42));
      assert.throws(() => definition.withValue(sample, 'x'.repeat(501)));
      assert.throws(() => definition.withValue({ ...sample, readOnly: true }, 'One'));

      const changes = [];
      const harness = await mountPattern('default', 'docs/src/react/genui/native/text-area.tsx', {
        data: sample,
        disabled: false,
        onChange: value => changes.push(value),
        onAction() {},
      });
      try {
        const textarea = harness.document.querySelector('textarea');
        const label = harness.document.querySelector('label');
        assert.ok(textarea);
        assert.equal(harness.document.querySelector('[contenteditable]'), null);
        assert.ok(label?.textContent.includes('Release notes'));
        assert.equal(label.htmlFor, textarea.id);
        assert.equal(textarea.value, 'Fixed sync retries.\nImproved export labels.');
        assert.equal(textarea.rows, 4);
        assert.equal(textarea.placeholder, 'Describe the change');
        assert.equal(textarea.required, true);
        assert.equal(textarea.readOnly, false);
        assert.equal(textarea.disabled, false);
        await harness.type(textarea, 'First line\nSecond line');
        assert.deepEqual(changes, ['First line\nSecond line']);
        assert.deepEqual(sample, before);
        assert.equal(definition.withValue(sample, changes[0]).value, 'First line\nSecond line');
      } finally {
        await harness.dispose();
      }
    }
  },
  AtlasSearchInput: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const nativeSample = {
      label: 'Search records',
      value: 'Aster',
      placeholder: 'Search by name',
      maxLength: 120,
    };
    const pressEnter = (harness, input) =>
      harness.act(async () => {
        input.dispatchEvent(
          new harness.window.KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true,
          }),
        );
        input.dispatchEvent(
          new harness.window.KeyboardEvent('keyup', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
          }),
        );
      });
    {
      const { validateComponent } = await load('docs/src/genui/policy.ts');
      const node = {
        id: 'finder',
        component: 'AtlasSearchInput',
        payload: { title: 'Records', native: nativeSample },
      };
      assert.throws(() =>
        validateComponent({
          ...node,
          payload: {
            title: 'Records',
            native: { ...nativeSample, endpoint: 'https://atlas.test/q' },
          },
        }),
      );

      const { definition, sample } = await load('docs/src/genui/native/search-input.ts');
      assert.deepEqual(definition.parse(sample), nativeSample);
      const before = structuredClone(sample);
      assert.equal(definition.withValue(sample, 'Ada').value, 'Ada');
      assert.deepEqual(sample, before);
      assert.throws(() => definition.withValue(sample, 42));
      assert.throws(() => definition.withValue(sample, 'x'.repeat(121)));
      assert.throws(() => definition.withValue({ ...sample, readOnly: true }, 'Ada'));

      const changes = [];
      const actions = [];
      const available = await mountPattern(
        'default',
        'docs/src/react/genui/native/search-input.tsx',
        {
          data: sample,
          disabled: false,
          actionAvailable: true,
          onChange: value => changes.push(value),
          onAction: () => actions.push('search'),
        },
      );
      try {
        const input = available.document.querySelector('input');
        const label = available.document.querySelector('label');
        assert.ok(input);
        assert.ok(label?.textContent.includes('Search records'));
        assert.equal(label.htmlFor, input.id);
        assert.equal(input.value, 'Aster');
        assert.equal(input.placeholder, 'Search by name');
        assert.equal(input.maxLength, 120);
        await available.type(input, 'quarterly');
        assert.deepEqual(changes, ['quarterly']);
        assert.equal(actions.length, 0, 'typing must not submit a search');
        await pressEnter(available, input);
        assert.equal(actions.length, 1, 'Enter triggers the configured search once');
        await available.click(available.document.querySelector('button'));
        assert.equal(actions.length, 2, 'search button triggers the configured search once');
      } finally {
        await available.dispose();
      }

      const unavailableActions = [];
      const unavailable = await mountPattern(
        'default',
        'docs/src/react/genui/native/search-input.tsx',
        {
          data: sample,
          disabled: false,
          onChange() {},
          onAction: () => unavailableActions.push('search'),
        },
      );
      try {
        const input = unavailable.document.querySelector('input');
        assert.equal(unavailable.document.querySelector('button'), null);
        await pressEnter(unavailable, input);
        assert.equal(unavailableActions.length, 0, 'no action without trusted availability');
      } finally {
        await unavailable.dispose();
      }
    }
  },
  AtlasDateTimeMultiple: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const nativeSample = {
      kind: 'date',
      multiple: true,
      label: 'Review days',
      value: ['2026-10-05', '2026-10-20'],
      minDate: '2026-10-01',
      maxDate: '2026-12-31',
      disabledWeekdays: [0, 6],
      help: 'Choose every weekday the review panel meets.',
    };
    {
      const { definition, sample } = await load('docs/src/genui/native/date-multiple.ts');
      assert.deepEqual(sample, nativeSample);
      assert.deepEqual(definition.parse(sample), nativeSample);
      assert.throws(() => definition.parse({ ...sample, multiple: false }));
      assert.throws(() => definition.parse({ ...sample, variant: 'outlined' }));
      const before = structuredClone(sample);
      assert.deepEqual(
        definition.withValue(sample, ['2026-10-20', '2026-10-05', '2026-10-12']).value,
        ['2026-10-05', '2026-10-12', '2026-10-20'],
      );
      assert.equal(definition.withValue(sample, []).value, null);
      assert.throws(() => definition.withValue(sample, ['2026-10-17']));
      assert.deepEqual(sample, before);

      const changes = [];
      const harness = await mountPattern(
        'default',
        'docs/src/react/genui/native/date-multiple.tsx',
        {
          data: sample,
          disabled: false,
          onChange: value => changes.push(value),
          onAction() {},
        },
      );
      try {
        const picker = harness.document.querySelector('.ant-picker');
        assert.ok(picker);
        await harness.act(async () => {
          picker.dispatchEvent(
            new harness.window.MouseEvent('mousedown', {
              bubbles: true,
              cancelable: true,
              button: 0,
            }),
          );
        });
        await harness.click(picker);
        const cell = date => harness.document.querySelector(`.ant-picker-cell[title="${date}"]`);
        await harness.waitFor(() => cell('2026-10-12'), 'October 2026 date panel');
        assert.ok(cell('2026-10-17').classList.contains('ant-picker-cell-disabled'));
        assert.ok(cell('2026-09-30').classList.contains('ant-picker-cell-disabled'));
        assert.equal(cell('2026-10-12').classList.contains('ant-picker-cell-disabled'), false);
        await harness.click(cell('2026-10-12'));
        // Multiple selection is a native confirmed picker: AntD's own OK commits the complete list.
        const confirm = () => harness.document.querySelector('.ant-picker-ok button');
        await harness.waitFor(() => confirm(), 'native multiple date confirm');
        await harness.click(confirm());
        await harness.waitFor(() => changes.length > 0, 'multiple date change');
        assert.deepEqual(changes, [['2026-10-05', '2026-10-12', '2026-10-20']]);
      } finally {
        await harness.dispose();
      }
    }
  },
  AtlasRadioCards: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const nativeSample = {
      label: 'Workspace plan',
      layout: 'icon-cards',
      value: 'starter',
      options: [
        {
          id: 'starter',
          label: 'Starter',
          description: 'One workspace for personal projects and early drafts.',
          icon: 'house',
        },
        {
          id: 'team',
          label: 'Team',
          description: 'Shared workspaces with roles and comments for up to 20 people.',
          icon: 'sun',
        },
        {
          id: 'enterprise',
          label: 'Enterprise',
          description: 'Single sign-on, audit history and dedicated support.',
          icon: 'settings',
        },
        {
          id: 'unavailable',
          label: 'Unavailable',
          description: 'Not offered for this account; shown disabled for comparison.',
          icon: 'lock-simple',
          disabled: true,
        },
      ],
    };
    {
      const { definition, sample } = await load('docs/src/genui/native/radio-cards.ts');
      assert.deepEqual(sample, nativeSample);
      assert.deepEqual(definition.parse(sample), nativeSample);
      const withOptions = (layout, map) => ({
        ...nativeSample,
        layout,
        options: nativeSample.options.map(map),
      });
      // Trusted icon names and safe media only; no markup, script URLs or duplicate members.
      assert.throws(() =>
        definition.parse(withOptions('icon-cards', option => ({ ...option, icon: '<svg/>' }))),
      );
      assert.throws(() =>
        definition.parse(withOptions('icon-cards', ({ icon, ...option }) => option)),
      );
      assert.equal(
        definition.parse(
          withOptions('image-cards', ({ icon, ...option }) => ({
            ...option,
            image: '/selection/forest.svg',
          })),
        ).layout,
        'image-cards',
      );
      assert.throws(() =>
        definition.parse(
          withOptions('image-cards', ({ icon, ...option }) => ({
            ...option,
            image: 'javascript:alert(1)',
          })),
        ),
      );
      assert.throws(() =>
        definition.parse({
          ...nativeSample,
          options: [...nativeSample.options, { ...nativeSample.options[0] }],
        }),
      );
      const before = structuredClone(sample);
      assert.equal(definition.withValue(sample, 'team').value, 'team');
      assert.deepEqual(sample, before);
      assert.throws(() => definition.withValue(sample, 'unavailable'));
      assert.throws(() => definition.withValue(sample, 'missing'));
      assert.throws(() => definition.withValue(sample, ['team']));

      const changes = [];
      const harness = await mountPattern('default', 'docs/src/react/genui/native/radio-cards.tsx', {
        data: sample,
        disabled: false,
        onChange: value => changes.push(value),
        onAction() {},
      });
      try {
        const { document } = harness;
        const radio = label =>
          [...document.querySelectorAll('input[type="radio"]')].find(
            input =>
              document.getElementById(input.getAttribute('aria-labelledby'))?.textContent === label,
          );
        assert.ok(document.querySelector('legend')?.textContent.includes('Workspace plan'));
        const team = radio('Team');
        assert.ok(team);
        assert.ok(team.closest('label')?.querySelector('svg[data-icon-name="sun"]'));
        assert.equal(radio('Unavailable')?.disabled, true);
        assert.equal(radio('Starter')?.checked, true);
        await harness.click(team);
        assert.deepEqual(changes, ['team']);
        // Controlled: the parent has not accepted the draft, so the selection stays put.
        assert.equal(radio('Starter').checked, true);
        assert.equal(radio('Team').checked, false);
        assert.equal(definition.withValue(sample, changes[0]).value, 'team');
      } finally {
        await harness.dispose();
      }
    }
  },
  AtlasCheckboxCards: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const nativeSample = {
      label: 'Plan add-ons',
      variant: 'icon-cards',
      options: [
        {
          value: 'starter',
          label: 'Starter',
          description: 'One workspace for personal projects and early drafts.',
          icon: 'house',
        },
        {
          value: 'team',
          label: 'Team',
          description: 'Shared workspaces with roles and comments for up to 20 people.',
          icon: 'sun',
        },
        {
          value: 'enterprise',
          label: 'Enterprise',
          description: 'Single sign-on, audit history and dedicated support.',
          icon: 'settings',
        },
        {
          value: 'unavailable',
          label: 'Unavailable',
          description: 'Not offered for this account; shown disabled for comparison.',
          icon: 'lock-simple',
          disabled: true,
        },
      ],
      value: ['starter', 'enterprise'],
    };
    {
      const { definition, sample } = await load('docs/src/genui/native/checkbox-cards.ts');
      assert.deepEqual(sample, nativeSample);
      const before = structuredClone(sample);

      const changes = [];
      const harness = await mountPattern(
        'default',
        'docs/src/react/genui/native/checkbox-cards.tsx',
        {
          data: sample,
          disabled: false,
          onChange: value => changes.push(value),
          onAction() {},
        },
      );
      try {
        const cardInput = label =>
          [...harness.document.querySelectorAll('.atlas-selection-choice-title')]
            .find(title => title.textContent.trim() === label)
            ?.closest('label')
            ?.querySelector('input[type="checkbox"]');
        const team = cardInput('Team');
        assert.ok(team);
        assert.equal(team.checked, false);
        assert.equal(cardInput('Starter').checked, true);
        assert.equal(cardInput('Unavailable').disabled, true);
        await harness.click(team);
        assert.deepEqual(changes, [['starter', 'enterprise', 'team']]);
        assert.deepEqual(definition.withValue(sample, changes[0]).value, [
          'starter',
          'enterprise',
          'team',
        ]);
        assert.deepEqual(sample, before);
      } finally {
        await harness.dispose();
      }
    }
  },
  AtlasSwitchCards: async ctx => {
    const { assert, build, mountPattern } = ctx;
    const load = async entry => {
      const bundled = await build({
        entryPoints: [entry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'node',
      });
      return import(
        'data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')
      );
    };
    const nativeSample = {
      label: 'Notifications',
      help: 'Each channel turns on or off on its own.',
      layout: 'icon-cards',
      options: [
        {
          id: 'digest',
          label: 'Daily digest',
          description: 'A morning summary of workspace activity.',
          icon: 'sun',
        },
        {
          id: 'quiet',
          label: 'Quiet hours',
          description: 'Hold non-urgent alerts overnight.',
          icon: 'moon',
        },
        {
          id: 'account',
          label: 'Account changes',
          description: 'Role, billing and member updates.',
          icon: 'settings',
        },
        {
          id: 'security',
          label: 'Security alerts',
          description: 'Always on for this workspace; shown disabled for comparison.',
          icon: 'lock-simple',
          disabled: true,
        },
      ],
      value: ['digest', 'security'],
    };
    {
      const { definition, sample } = await load('docs/src/genui/native/switch-cards.ts');
      assert.deepEqual(sample, nativeSample);
      assert.deepEqual(definition.parse(sample), nativeSample);
      const before = structuredClone(sample);
      assert.throws(() => definition.withValue(sample, ['digest', 'digest', 'security']));
      assert.throws(() => definition.withValue(sample, ['digest', 'missing', 'security']));
      // The disabled option keeps its membership: it can be neither cleared nor added.
      assert.throws(() => definition.withValue(sample, ['digest']));

      const changes = [];
      const harness = await mountPattern(
        'default',
        'docs/src/react/genui/native/switch-cards.tsx',
        {
          data: sample,
          disabled: false,
          onChange: value => changes.push(value),
          onAction() {},
        },
      );
      try {
        const switchFor = label =>
          [...harness.document.querySelectorAll('[role="switch"]')].find(
            control =>
              harness.document.getElementById(control.getAttribute('aria-labelledby'))
                ?.textContent === label,
          );
        const digest = switchFor('Daily digest');
        const quiet = switchFor('Quiet hours');
        const security = switchFor('Security alerts');
        assert.ok(digest && quiet && security);
        assert.equal(digest.getAttribute('aria-checked'), 'true');
        assert.equal(quiet.getAttribute('aria-checked'), 'false');
        assert.equal(security.disabled, true);

        await harness.click(quiet);
        assert.deepEqual(changes, [['digest', 'quiet', 'security']]);
        // Controlled: nothing changes on screen until the parent accepts the draft.
        assert.equal(quiet.getAttribute('aria-checked'), 'false');
        assert.equal(digest.getAttribute('aria-checked'), 'true');
        assert.deepEqual(definition.withValue(sample, changes[0]).value, [
          'digest',
          'quiet',
          'security',
        ]);
        assert.deepEqual(sample, before);
      } finally {
        await harness.dispose();
      }
    }
  },
});
const SPECIFIC_CONTEXT = Object.freeze({
  assert,
  build,
  mountPattern,
  buttonByText,
  headerByText,
  selectOption,
  randomUUID,
  writeFile,
  unlink,
  delay,
  dirname: path.dirname,
  resolve: path.resolve,
  fileURLToPath,
  metaURL: import.meta.url,
});

// ---------------------------------------------------------------------------
// The single conformance scenario.
// ---------------------------------------------------------------------------
test(`GenUI native registry conformance for the ${APPROVED_COUNT} approved components`, async t => {
  assert.equal(ROWS.length, APPROVED_COUNT, 'The approved table must list exactly 49 rows.');
  assert.equal(
    new Set(ROWS.map(row => row.name)).size,
    APPROVED_COUNT,
    'Approved row names must be unique.',
  );
  const { modules, missing } = await loadGenUI();
  t.diagnostic(`optional modules missing: ${missing.length ? missing.join(', ') : 'none'}`);

  const failures = [];
  let passed = 0;
  for (const row of ROWS) {
    try {
      checkRow(modules, row);
      await SPECIFIC_CHECKS[row.name](SPECIFIC_CONTEXT);
      passed += 1;
      t.diagnostic(`ROW ${row.name} PASS`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${row.name}: ${message}`);
      t.diagnostic(`ROW ${row.name} FAIL ${message}`);
    }
  }
  t.diagnostic(`SUMMARY checked=${ROWS.length} pass=${passed} fail=${failures.length}`);
  assert.equal(passed + failures.length, ROWS.length, 'Every row must be checked.');
  assert.equal(
    failures.length,
    0,
    `${failures.length} of ${ROWS.length} native conformance rows failed:\n${failures.join('\n')}`,
  );
});
