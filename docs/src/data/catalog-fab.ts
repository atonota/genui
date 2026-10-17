import type { ComponentDoc } from './catalog';
import { FAB_DEFAULTS } from '../fab/options';

/** FAB entry; GenUXFab is a GenUX wrapper composed from Button, Badge and Modal, not the native FloatButton API. */
type FabApiRow = { name: string; type: string; description: string };

const list = (...values: string[]) => values.map(value => `'${value}'`).join(' | ');
const row = (name: string, type: string, description: string): FabApiRow => ({
  name,
  type,
  description,
});
const flag = (name: string, description: string) => row(name, 'boolean', description);
const prefixed = (prefix: string, rows: FabApiRow[]) =>
  rows.map(item => ({ ...item, name: prefix + item.name }));

type ApiRow = ComponentDoc['api'][number];

/** Caller-owned props and fields with no model default. */
const NO_DEFAULT = '—';
/** Fields validateFabActions fills in when an action omits them. */
const ACTION_DEFAULTS = {
  actionType: 'action',
  closeBehavior: 'inherit',
  visible: true,
  permission: true,
  offlineAvailable: false,
};

const formatDefault = (value: unknown): string => {
  if (typeof value === 'string') return `'${value}'`;
  if (Array.isArray(value)) return `[${value.map(formatDefault).join(', ')}]`;
  if (typeof value === 'object' && value !== null) {
    return `{ ${Object.entries(value)
      .map(([key, item]) => `${key}: ${formatDefault(item)}`)
      .join(', ')} }`;
  }
  return String(value);
};

/** Maps internal rows to ComponentDoc.api; exhaustive tables throw when a row has no model default. */
const documented = (
  rows: FabApiRow[],
  prefix = '',
  defaults: object = {},
  exhaustive = false,
): ApiRow[] =>
  rows.map(({ name, type, description }) => {
    const key = name.slice(prefix.length);
    const known = key in defaults;
    if (exhaustive && !known) throw new Error(`FAB API row ${name} has no FAB_DEFAULTS entry.`);
    const defaultValue = known
      ? formatDefault((defaults as Record<string, unknown>)[key])
      : NO_DEFAULT;
    return { property: name, type, defaultValue, description };
  });

const optionRows: FabApiRow[] = [
  row(
    'type',
    list('single', 'extended', 'collapsible', 'speed-dial', 'menu', 'contextual', 'adaptive'),
    'Behavior model: one action, labelled action, collapsible group, speed dial, menu, page-context actions or capability-adaptive delivery. Contextual renders only when the caller passes visible true with at least one eligible action.',
  ),
  row(
    'layout',
    list(
      'linear',
      'diagonal',
      'circle',
      'semi-circle',
      'quarter-circle',
      'custom-arc',
      'multi-directional',
      'floating-menu',
      'sheet',
    ),
    'Action geometry computed by layoutFab; when space runs out it resolves to menu or sheet mode.',
  ),
  row(
    'direction',
    list('up', 'down', 'start', 'end', 'up-start', 'up-end', 'down-start', 'down-end'),
    'Logical opening direction; start and end follow the writing direction.',
  ),
  row(
    'shape',
    list('circle', 'rounded-square', 'squircle', 'square', 'pill', 'custom'),
    'Trigger and action silhouette.',
  ),
  row(
    'appearance',
    list(
      'filled',
      'tonal',
      'outlined',
      'soft-outlined',
      'elevated',
      'flat',
      'semi-flat',
      'inset-press',
      'translucent',
      'branded',
    ),
    'Surface treatment drawn from the frozen palette roles.',
  ),
  row(
    'size',
    list('sm', 'md', 'lg'),
    'Step on the shared regular and compact control size scales.',
  ),
  row(
    'radius',
    `number | ${list('0px', '3px', '5px', '100%')}`,
    'Corner radius for square-based shapes; 5px is the approved default.',
  ),
  row(
    'density',
    list('compact', 'comfortable', 'spacious'),
    'Spacing between trigger, actions and labels; text and target sizes never shrink.',
  ),
  row(
    'content',
    list('icon-only', 'text-only', 'icon-text'),
    'Visible trigger content. The label stays the accessible name in every mode.',
  ),
  row(
    'labelPlacement',
    list('inside', 'outside', 'above', 'below', 'start', 'end'),
    'Where action labels sit relative to their buttons.',
  ),
  row(
    'labelVisibility',
    list('always', 'hover', 'focus', 'expanded-only'),
    'When visible labels appear; hover is never the only way to read them.',
  ),
  row(
    'tooltip',
    list('none', 'hover', 'focus', 'hover-focus'),
    'Supplementary tooltip trigger for icon-only content.',
  ),
  row(
    'iconPosition',
    list('start', 'end', 'top', 'bottom'),
    'Icon position inside extended and labelled buttons.',
  ),
  row(
    'iconTransition',
    list('rotate', 'replace', 'morph', 'static'),
    'How the trigger icon changes between closed and open.',
  ),
  row(
    'trigger',
    list('click', 'hover', 'long-press', 'gesture'),
    'Pointer opening gesture. Click, Enter and Space always remain available.',
  ),
  row('horizontal', list('start', 'center', 'end'), 'Inline placement inside the anchor bounds.'),
  row('vertical', list('top', 'center', 'bottom'), 'Block placement inside the anchor bounds.'),
  row(
    'anchor',
    list('viewport', 'container', 'element'),
    'Bounds used for placement: the viewport, containerRef or anchorRef.',
  ),
  row(
    'positioning',
    list('fixed', 'absolute', 'sticky'),
    'CSS positioning strategy of the root. Only owners with axis-aligned translation and positive per-axis scale are supported; a rotated, skewed, flipped or perspective owner is an explicit render error.',
  ),
  row(
    'edge',
    list('normal', 'header-overlap', 'footer-overlap'),
    'Overlap with a header or footer edge.',
  ),
  row('alignment', list('start', 'center', 'end'), 'Alignment along the overlapped edge.'),
  row('offset', 'FabPoint', 'Extra x and y distance from the resolved position.'),
  row(
    'arc',
    '{ startAngle?, endAngle?, radius?, angularGap? }',
    'Arc settings for circular layouts; see the arc rows.',
  ),
  row('motion', 'FabMotion', 'Open and close choreography; see the motion rows.'),
  row(
    'backdrop',
    list('none', 'transparent', 'dim', 'blur', 'dim-blur'),
    'Layer behind open actions. none is the provisional default and dim-blur is implemented; transparent, dim and blur are declared but stay disabled until the pending human decision.',
  ),
  flag('modal', 'Keeps focus inside the open actions until they close.'),
  row(
    'visibility',
    list(
      'always',
      'hide-on-scroll-down',
      'show-on-scroll-up',
      'collapse-on-scroll',
      'expand-near-top',
      'contextual',
      'sticky-boundary',
    ),
    'Scroll and context driven visibility, measured on scrollRef or the page.',
  ),
  row(
    'adaptation',
    list('auto', 'compact', 'expanded', 'sheet'),
    'Delivery tier; auto derives dial, menu or sheet mode from the available space.',
  ),
  flag('critical', 'Keeps the trigger reachable when visibility rules would hide it.'),
  flag('draggable', 'Lets the user reposition the trigger with pointer or keyboard.'),
  flag('closeOnSelect', 'Closes after an action completes.'),
  flag('closeOnOutside', 'Closes on a pointer press outside the FAB.'),
  flag('closeOnEscape', 'Closes on Escape and returns focus to the trigger.'),
  flag('closeOnScroll', 'Closes when the scroll target moves.'),
  flag('closeOnNavigation', 'Closes when a link action navigates.'),
  flag('closeOnBlur', 'Closes when focus leaves the FAB.'),
  flag('toggleOnTrigger', 'Lets the trigger close what it opened.'),
  flag('keepOpenOnError', 'Keeps actions open when an action handler rejects.'),
  flag('disableWhileLoading', 'Blocks other actions while one is running.'),
];

const propRows: FabApiRow[] = [
  row('label', 'string', 'Required accessible name of the trigger.'),
  row('icon', 'GenUXIconName', 'Trigger icon while closed.'),
  row('openIcon', 'GenUXIconName', 'Trigger icon while open.'),
  row(
    'actions',
    'readonly FabAction[]',
    'Actions checked by validateFabActions and resolved by resolveFabActions.',
  ),
  row(
    'groups',
    'readonly FabGroup[]',
    'Named action groups with their own direction, layout and angles.',
  ),
  row('open', 'boolean', 'Controlled open state.'),
  row('defaultOpen', 'boolean', 'Initial open state when uncontrolled.'),
  row('disabled', 'boolean', 'Disables the trigger; the state becomes disabled.'),
  row('loading', 'boolean', 'Busy state, announced through the genux-fab-status region.'),
  row('visible', 'boolean', 'Shows or hides the whole FAB.'),
  row(
    'online',
    'boolean',
    'Connection state; when false, actions without offlineAvailable become unavailable with a reason.',
  ),
  row('badge', 'number | string', 'Badge on the trigger, styled by genux-badge.css.'),
  row('counter', 'number', 'Numeric counter shown with the trigger.'),
  row('progress', 'number', 'Progress value for long running work.'),
  row('className', 'string', 'Extra class on the genux-fab root.'),
  row(
    'onOpenChange',
    '(open: boolean, reason: string) => void',
    'Called with the next open state and the reason that caused it.',
  ),
  row(
    'onAction',
    '(action: FabAction) => void | Promise<void>',
    'Component-level handler called with the activated action.',
  ),
  row(
    'onError',
    '(error: unknown, action: FabAction) => void',
    'Receives errors thrown or rejected by action handlers.',
  ),
  row(
    'onPositionChange',
    '(position: FabPoint) => void',
    'Reports the new trigger position after dragging.',
  ),
  row('dragPosition', 'FabPoint', 'Controlled drag position.'),
  row('defaultDragPosition', 'FabPoint', 'Initial drag position when uncontrolled.'),
  row('containerRef', 'RefObject<HTMLElement | null>', 'Bounds element when anchor is container.'),
  row('anchorRef', 'RefObject<HTMLElement | null>', 'Reference element when anchor is element.'),
  row(
    'scrollRef',
    'RefObject<HTMLElement | null>',
    'Scroll element for visibility rules and closeOnScroll.',
  ),
  row(
    'obstacles',
    'readonly (FabRect | RefObject<HTMLElement | null>)[]',
    'Rectangles or elements the trigger and actions avoid.',
  ),
];

const motionRows = prefixed('motion.', [
  row(
    'entrance',
    `readonly (${list('fade', 'scale', 'slide', 'pop')})[]`,
    'Combined entrance effects.',
  ),
  row('exit', `readonly (${list('fade', 'scale', 'slide')})[]`, 'Combined exit effects.'),
  row('sequence', list('together', 'staggered'), 'Actions animate together or one after another.'),
  row('order', list('forward', 'reverse', 'from-center'), 'Stagger order.'),
  row(
    'duration',
    `${list('fast', 'normal', 'slow')} | number`,
    'Opening duration from the central motion tokens or a custom value.',
  ),
  row(
    'closeDuration',
    `${list('fast', 'normal', 'slow')} | number`,
    'Closing duration; both directions stay positive.',
  ),
  row(
    'stagger',
    'number',
    'Delay in milliseconds between staggered actions, adjustable from 0 to 100. Together starts every action at once and keeps the configured value; 30 to 45 is a non-normative starting range.',
  ),
  row(
    'easing',
    list('cubic', 'linear', 'ease-out', 'ease-in-out', 'spring'),
    'Cubic is the current default; the other values are declared but provisional until the easing decision is answered.',
  ),
  row('origin', list('trigger-center', 'edge', 'custom'), 'Transform origin of the actions.'),
  row(
    'customOrigin',
    'FabPoint',
    'Normalized origin point, 0 to 1 on each axis, when origin is custom.',
  ),
]);

const arcRows = prefixed('arc.', [
  row('startAngle', 'number', 'Angle where the arc starts.'),
  row('endAngle', 'number', 'Angle where the arc ends.'),
  row('radius', 'number', 'Distance from the trigger center to action centers.'),
  row('angularGap', 'number', 'Minimum angle between neighbouring actions.'),
]);

const actionRows = prefixed('actions[].', [
  row('id', 'string', 'Stable unique id, checked by validateFabActions.'),
  row('label', 'string', 'Required visible and accessible name.'),
  row('description', 'string', 'Secondary text for the action.'),
  row('icon', 'GenUXIconName', 'Action icon.'),
  row('order', 'number', 'Sort order inside the group.'),
  row('group', 'string', 'Id of a FabGroup.'),
  row('visible', 'boolean', 'Removes the action when false.'),
  row('disabled', 'boolean', 'Keeps the action discoverable but not runnable.'),
  row('disabledReason', 'string', 'Announced reason for a disabled or unavailable action.'),
  row('loading', 'boolean', 'Busy state for one action.'),
  row('badge', 'number | string', 'Badge beside the action.'),
  row('actionType', list('action', 'link', 'panel', 'dialog'), 'Semantics of the activation.'),
  row(
    'permission',
    'boolean',
    'Caller-local UI permission; false filters the action out. It is not server authorization.',
  ),
  row(
    'confirmation',
    'boolean | string',
    'Asks for confirmation before running; a string is the question.',
  ),
  row('shortcut', 'string', 'Keyboard shortcut hint.'),
  row(
    'closeBehavior',
    list('inherit', 'close', 'keep-open'),
    'Overrides closeOnSelect for this action.',
  ),
  row('offlineAvailable', 'boolean', 'Keeps the action available when online is false.'),
  row('href', 'string', 'Destination for link actions.'),
  row('target', list('_self', '_blank'), 'Link target.'),
  row(
    'onAction',
    '(action: FabAction) => void | Promise<void>',
    'Action handler; a returned promise drives loading and error states.',
  ),
]);

const groupRows = prefixed('groups[].', [
  row('id', 'string', 'Group id referenced by actions.'),
  row('label', 'string', 'Visible and accessible group name.'),
  row('direction', 'FabDirection', 'Opening direction of the group.'),
  row(
    'layout',
    `Exclude<FabLayout, ${list('multi-directional', 'floating-menu', 'sheet')}>`,
    'Layout override for one dial arm. The six supported values are linear, diagonal, circle, semi-circle, quarter-circle and custom-arc; multi-directional, floating-menu and sheet stay top-level only.',
  ),
  row('startAngle', 'number', 'Arc start for the group.'),
  row('endAngle', 'number', 'Arc end for the group.'),
]);

const fabImports = `import { useRef, useState } from 'react';
import GenUXProvider from '../src/react/GenUXProvider';
import GenUXFab from '../src/react/GenUXFab';
import '../src/styles/genux-badge.css';
import '../src/styles/genux-fab.css';

`;

export const fabComponents: ComponentDoc[] = [
  {
    slug: 'fab',
    title: 'FAB',
    summary:
      'Floating action button for the primary action of a screen, with speed dial, menu, arc and sheet layouts. GenUXFab is a GenUX wrapper composed from Button, Badge and Modal with its own API; it does not expose the native FloatButton API.',
    antdComponent: 'Button · Badge · Modal',
    category: 'Actions',
    sourceUrl: 'https://ant.design/components/float-button/',
    whenToUse: [
      'For the single most important action on a screen, or a short set of closely related actions.',
      'Use a speed dial or menu for up to a handful of actions; longer lists belong in a menu or sheet layout.',
      'Do not hide navigation or destructive-only flows inside a FAB; use regular buttons for those.',
    ],
    examples: [
      {
        id: 'foundations',
        title: 'Foundations',
        description:
          'A speed dial anchored to its container. The label names the trigger, and the component-level onAction receives the chosen action.',
        code:
          fabImports +
          `export default function FabFoundations() {
  const stage = useRef<HTMLDivElement>(null);
  const [last, setLast] = useState('none');
  return <GenUXProvider appearance='docs'>
    <p role='status'>Last action: {last}</p>
    <div ref={stage} style={{ position: 'relative', blockSize: 320 }}>
      <GenUXFab type='speed-dial' layout='linear' direction='up' size='md' label='Quick actions' icon='settings'
        anchor='container' positioning='absolute' containerRef={stage} horizontal='end' vertical='bottom'
        onAction={(action) => setLast(action.label)}
        actions={[
          { id: 'approve', label: 'Approve request', icon: 'check' },
          { id: 'preferences', label: 'Preferences', icon: 'settings' },
        ]} />
    </div>
  </GenUXProvider>;
}`,
      },
      {
        id: 'geometry',
        title: 'Geometry',
        description:
          'Arc layouts and groups. Each group can open in its own direction; layoutFab keeps actions inside the bounds.',
        code:
          fabImports +
          `export default function FabGeometry() {
  const stage = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<'quarter-circle' | 'semi-circle' | 'custom-arc'>('quarter-circle');
  const [last, setLast] = useState('none');
  const next = layout === 'quarter-circle' ? 'semi-circle' : layout === 'semi-circle' ? 'custom-arc' : 'quarter-circle';
  return <GenUXProvider appearance='docs'>
    <button type='button' onClick={() => setLayout(next)}>Layout: {layout}</button>
    <p role='status'>Last action: {last}</p>
    <div ref={stage} style={{ position: 'relative', blockSize: 360 }}>
      <GenUXFab type='speed-dial' layout={layout} direction='up-start' label='Arrange' icon='settings'
        anchor='container' positioning='absolute' containerRef={stage} horizontal='end' vertical='bottom'
        arc={{ startAngle: 180, endAngle: 270, radius: 112, angularGap: 8 }}
        onAction={(action) => setLast(action.label)}
        groups={[
          { id: 'review', label: 'Review', direction: 'up' },
          { id: 'setup', label: 'Setup', direction: 'start', layout: 'linear' },
        ]}
        actions={[
          { id: 'approve', label: 'Approve', icon: 'check', group: 'review' },
          { id: 'verify', label: 'Verify', icon: 'check', group: 'review' },
          { id: 'configure', label: 'Configure', icon: 'settings', group: 'setup' },
        ]} />
    </div>
  </GenUXProvider>;
}`,
      },
      {
        id: 'appearance',
        title: 'Appearance',
        description:
          'Shape, appearance, radius and size are independent axes. Colors come from the frozen palette roles.',
        code:
          fabImports +
          `export default function FabAppearance() {
  const stage = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  const approve = [{ id: 'approve', label: 'Approve', icon: 'check' as const }];
  const onAction = () => setCount((value) => value + 1);
  return <GenUXProvider appearance='docs'>
    <p role='status'>Approved {count} times</p>
    <div ref={stage} style={{ position: 'relative', blockSize: 280 }}>
      <GenUXFab type='single' shape='circle' appearance='filled' size='lg' label='Approve, filled' icon='check'
        anchor='container' positioning='absolute' containerRef={stage} horizontal='start' vertical='bottom'
        actions={approve} onAction={onAction} />
      <GenUXFab type='single' shape='rounded-square' radius='5px' appearance='tonal' size='md' label='Approve, tonal' icon='check'
        anchor='container' positioning='absolute' containerRef={stage} horizontal='center' vertical='bottom'
        actions={approve} onAction={onAction} />
      <GenUXFab type='extended' shape='pill' appearance='outlined' size='sm' content='icon-text' label='Approve, outlined' icon='check'
        anchor='container' positioning='absolute' containerRef={stage} horizontal='end' vertical='bottom'
        actions={approve} onAction={onAction} />
    </div>
  </GenUXProvider>;
}`,
      },
      {
        id: 'content',
        title: 'Content',
        description:
          'Icon-only and extended content, label placement and visibility, tooltips, icon transitions, badge and counter.',
        code:
          fabImports +
          `export default function FabContent() {
  const stage = useRef<HTMLDivElement>(null);
  const [unread, setUnread] = useState(3);
  return <GenUXProvider appearance='docs'>
    <p role='status'>{unread} unread items</p>
    <div ref={stage} style={{ position: 'relative', blockSize: 320 }}>
      <GenUXFab type='speed-dial' content='icon-only' label='Inbox actions' icon='settings' openIcon='check'
        iconTransition='rotate' labelPlacement='start' labelVisibility='always' tooltip='hover-focus'
        badge={unread} counter={unread}
        anchor='container' positioning='absolute' containerRef={stage} horizontal='end' vertical='bottom'
        actions={[
          { id: 'read', label: 'Mark one read', icon: 'check', description: 'Lowers the unread count',
            onAction: () => setUnread((value) => Math.max(0, value - 1)) },
          { id: 'restore', label: 'Restore unread', icon: 'settings', onAction: () => setUnread(3) },
        ]} />
      <GenUXFab type='extended' content='icon-text' iconPosition='end' labelPlacement='inside' label='Mark all read' icon='check'
        anchor='container' positioning='absolute' containerRef={stage} horizontal='start' vertical='bottom'
        actions={[{ id: 'all', label: 'Mark all read', icon: 'check', onAction: () => setUnread(0) }]} />
    </div>
  </GenUXProvider>;
}`,
      },
      {
        id: 'interaction',
        title: 'Interaction',
        description:
          'Controlled open state with close rules. Long press opens on touch, while click, Enter and Space keep working as alternatives.',
        code:
          fabImports +
          `export default function FabInteraction() {
  const stage = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('none');
  return <GenUXProvider appearance='docs'>
    <button type='button' onClick={() => setOpen(!open)}>{open ? 'Close actions' : 'Open actions'}</button>
    <p role='status'>{open ? 'Open' : 'Closed'}, last reason: {reason}</p>
    <div ref={stage} style={{ position: 'relative', blockSize: 320 }}>
      <GenUXFab type='menu' trigger='long-press' label='Row actions' icon='settings'
        open={open} onOpenChange={(next, why) => { setOpen(next); setReason(why); }}
        toggleOnTrigger closeOnSelect closeOnOutside closeOnEscape closeOnBlur
        anchor='container' positioning='absolute' containerRef={stage} horizontal='end' vertical='bottom'
        actions={[
          { id: 'approve', label: 'Approve', icon: 'check', onAction: () => setReason('approve selected') },
          { id: 'settings', label: 'Row settings', icon: 'settings', closeBehavior: 'keep-open',
            onAction: () => setReason('settings selected') },
        ]} />
    </div>
  </GenUXProvider>;
}`,
      },
      {
        id: 'positioning',
        title: 'Positioning',
        description:
          'Footer overlap, offset, obstacle avoidance and a controlled drag position with a keyboard-friendly reset.',
        code:
          fabImports +
          `export default function FabPositioning() {
  const stage = useRef<HTMLDivElement>(null);
  const footer = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 24, y: 24 });
  const [drafts, setDrafts] = useState(0);
  return <GenUXProvider appearance='docs'>
    <button type='button' onClick={() => setPosition({ x: 24, y: 24 })}>Reset position</button>
    <p role='status'>Trigger at {Math.round(position.x)}, {Math.round(position.y)}; {drafts} drafts</p>
    <div ref={stage} style={{ position: 'relative', blockSize: 360 }}>
      <div ref={footer} style={{ position: 'absolute', insetInline: 0, insetBlockEnd: 0, blockSize: 56 }}>Footer toolbar</div>
      <GenUXFab type='single' label='Compose' icon='settings' draggable dragPosition={position} onPositionChange={setPosition}
        anchor='container' positioning='absolute' containerRef={stage} horizontal='end' vertical='bottom'
        edge='footer-overlap' alignment='end' offset={{ x: 16, y: 16 }} obstacles={[footer]}
        actions={[{ id: 'compose', label: 'Compose', icon: 'settings', onAction: () => setDrafts((value) => value + 1) }]} />
    </div>
  </GenUXProvider>;
}`,
      },
      {
        id: 'motion',
        title: 'Motion',
        description:
          'Staggered entrance and exit using central motion tokens. Cubic is the current easing; other easing values are provisional. Reduced motion removes movement while state updates stay immediate.',
        code:
          fabImports +
          `export default function FabMotion() {
  const stage = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState('none');
  return <GenUXProvider appearance='docs'>
    <p role='status'>{open ? 'Actions open' : 'Actions closed'}; last action: {last}</p>
    <div ref={stage} style={{ position: 'relative', blockSize: 320 }}>
      <GenUXFab type='speed-dial' label='Animated actions' icon='settings' openIcon='check' iconTransition='replace'
        open={open} onOpenChange={(next) => setOpen(next)} onAction={(action) => setLast(action.label)}
        motion={{ entrance: ['fade', 'scale'], exit: ['fade'], sequence: 'staggered', order: 'forward',
          duration: 'normal', closeDuration: 'fast', stagger: 30, easing: 'cubic', origin: 'trigger-center' }}
        anchor='container' positioning='absolute' containerRef={stage} horizontal='end' vertical='bottom'
        actions={[
          { id: 'approve', label: 'Approve', icon: 'check' },
          { id: 'settings', label: 'Settings', icon: 'settings' },
        ]} />
    </div>
  </GenUXProvider>;
}`,
      },
      {
        id: 'backdrop',
        title: 'Backdrop',
        description:
          'A modal floating menu over a dimmed, blurred backdrop. none stays the provisional default and dim-blur is the implemented layer; transparent, dim and blur await a pending human decision.',
        code:
          fabImports +
          `export default function FabBackdrop() {
  const stage = useRef<HTMLDivElement>(null);
  const [choice, setChoice] = useState('nothing yet');
  return <GenUXProvider appearance='docs'>
    <p role='status'>Chosen: {choice}</p>
    <div ref={stage} style={{ position: 'relative', blockSize: 320 }}>
      <GenUXFab type='menu' layout='floating-menu' backdrop='dim-blur' modal closeOnOutside closeOnEscape
        label='Share' icon='settings' onAction={(action) => setChoice(action.label)}
        anchor='container' positioning='absolute' containerRef={stage} horizontal='end' vertical='bottom'
        actions={[
          { id: 'copy', label: 'Copy link', icon: 'check' },
          { id: 'team', label: 'Share with team', icon: 'settings' },
        ]} />
    </div>
  </GenUXProvider>;
}`,
      },
      {
        id: 'scroll',
        title: 'Scroll',
        description:
          'Visibility follows the scroll element: the FAB hides while scrolling down and closes open actions on scroll.',
        code:
          fabImports +
          `export default function FabScroll() {
  const stage = useRef<HTMLDivElement>(null);
  const feed = useRef<HTMLDivElement>(null);
  const [last, setLast] = useState('none');
  return <GenUXProvider appearance='docs'>
    <p role='status'>Last action: {last}</p>
    <div ref={stage} style={{ position: 'relative', blockSize: 360 }}>
      <div ref={feed} tabIndex={0} aria-label='Activity feed' style={{ blockSize: '100%', overflowY: 'auto' }}>
        {Array.from({ length: 24 }, (_, index) => <p key={index}>Activity entry {index + 1}</p>)}
      </div>
      <GenUXFab type='speed-dial' visibility='hide-on-scroll-down' scrollRef={feed} closeOnScroll
        label='Feed actions' icon='settings' onAction={(action) => setLast(action.label)}
        anchor='container' positioning='absolute' containerRef={stage} horizontal='end' vertical='bottom'
        actions={[
          { id: 'resolve', label: 'Resolve all', icon: 'check' },
          { id: 'filters', label: 'Feed filters', icon: 'settings' },
        ]} />
    </div>
  </GenUXProvider>;
}`,
      },
      {
        id: 'actions',
        title: 'Actions',
        description:
          'The full action model: order, shortcut, offline availability, async loading, local error handling, confirmation, disabled reasons, caller-local permission and links. Nothing calls a backend.',
        code:
          fabImports +
          `export default function FabActions() {
  const stage = useRef<HTMLDivElement>(null);
  const [online, setOnline] = useState(true);
  const [log, setLog] = useState('Ready');
  return <GenUXProvider appearance='docs'>
    <button type='button' aria-pressed={!online} onClick={() => setOnline(!online)}>{online ? 'Go offline' : 'Go online'}</button>
    <p role='status'>{log}</p>
    <div ref={stage} style={{ position: 'relative', blockSize: 400 }}>
      <GenUXFab type='menu' label='Record actions' icon='settings' online={online} keepOpenOnError disableWhileLoading
        onError={(error, action) => setLog(action.label + ' failed: ' + (error instanceof Error ? error.message : 'unknown error'))}
        anchor='container' positioning='absolute' containerRef={stage} horizontal='end' vertical='bottom'
        actions={[
          { id: 'save', label: 'Save draft', icon: 'check', order: 1, shortcut: 'Ctrl+S', offlineAvailable: true,
            onAction: () => new Promise<void>((resolve) => { window.setTimeout(() => { setLog('Save finished in this local demo'); resolve(); }, 600); }) },
          { id: 'publish', label: 'Publish', description: 'Needs a connection', order: 2, badge: 2, confirmation: 'Publish this record?',
            onAction: () => Promise.reject(new Error('this demo has no publish service')) },
          { id: 'archive', label: 'Archive', order: 3, disabled: true, disabledReason: 'Record is already archived' },
          { id: 'delete', label: 'Delete', order: 4, permission: false, disabledReason: 'Your local role cannot delete' },
          { id: 'guide', label: 'Open FloatButton guide', order: 5, actionType: 'link', closeBehavior: 'close',
            href: 'https://ant.design/components/float-button/', target: '_blank' },
          { id: 'sync', label: 'Sync status', order: 6, loading: true, visible: true, closeBehavior: 'keep-open' },
        ]} />
    </div>
  </GenUXProvider>;
}`,
      },
      {
        id: 'adaptive',
        title: 'Adaptive',
        description:
          'One component and one action list serve phone, tablet, computer and TV. Tiers come from shared geometry (dial, menu or sheet mode), not copied UIs.',
        code:
          fabImports +
          `const tiers = ['auto', 'compact', 'expanded', 'sheet'] as const;

export default function FabAdaptive() {
  const stage = useRef<HTMLDivElement>(null);
  const [tier, setTier] = useState<(typeof tiers)[number]>('auto');
  const [last, setLast] = useState('none');
  return <GenUXProvider appearance='docs'>
    <div role='group' aria-label='Adaptation'>
      {tiers.map((value) => <button key={value} type='button' aria-pressed={tier === value} onClick={() => setTier(value)}>{value}</button>)}
    </div>
    <p role='status'>Last action: {last}</p>
    <div ref={stage} style={{ position: 'relative', blockSize: 360 }}>
      <GenUXFab type='adaptive' adaptation={tier} critical label='Create' icon='settings'
        onAction={(action) => setLast(action.label)}
        anchor='container' positioning='absolute' containerRef={stage} horizontal='end' vertical='bottom'
        actions={[
          { id: 'approve', label: 'Approve', icon: 'check' },
          { id: 'verify', label: 'Verify', icon: 'check' },
          { id: 'configure', label: 'Configure', icon: 'settings' },
        ]} />
    </div>
  </GenUXProvider>;
}`,
      },
      {
        id: 'playground',
        title: 'Playground',
        description:
          'Cycle layouts and appearances on the same speed dial to compare geometry and surfaces.',
        code:
          fabImports +
          `const layouts = ['linear', 'diagonal', 'circle', 'semi-circle', 'quarter-circle', 'multi-directional', 'floating-menu', 'sheet'] as const;
const appearances = ['filled', 'tonal', 'outlined', 'soft-outlined', 'elevated', 'translucent', 'branded'] as const;

export default function FabPlayground() {
  const stage = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<(typeof layouts)[number]>('linear');
  const [appearance, setAppearance] = useState<(typeof appearances)[number]>('filled');
  const [last, setLast] = useState('none');
  const nextLayout = layouts[(layouts.indexOf(layout) + 1) % layouts.length] ?? 'linear';
  const nextAppearance = appearances[(appearances.indexOf(appearance) + 1) % appearances.length] ?? 'filled';
  return <GenUXProvider appearance='docs'>
    <button type='button' onClick={() => setLayout(nextLayout)}>Layout: {layout}</button>
    <button type='button' onClick={() => setAppearance(nextAppearance)}>Appearance: {appearance}</button>
    <p role='status'>Last action: {last}</p>
    <div ref={stage} style={{ position: 'relative', blockSize: 400 }}>
      <GenUXFab type='speed-dial' layout={layout} appearance={appearance} label='Playground actions' icon='settings'
        onAction={(action) => setLast(action.label)}
        anchor='container' positioning='absolute' containerRef={stage} horizontal='end' vertical='bottom'
        actions={[
          { id: 'approve', label: 'Approve', icon: 'check' },
          { id: 'verify', label: 'Verify', icon: 'check' },
          { id: 'configure', label: 'Configure', icon: 'settings' },
        ]} />
    </div>
  </GenUXProvider>;
}`,
      },
    ],
    api: [
      ...documented(optionRows, '', FAB_DEFAULTS, true),
      ...documented(propRows),
      ...documented(motionRows, 'motion.', FAB_DEFAULTS.motion, true),
      ...documented(arcRows, 'arc.', FAB_DEFAULTS.arc, true),
      ...documented(actionRows, 'actions[].', ACTION_DEFAULTS),
      ...documented(groupRows, 'groups[].'),
    ],
    accessibility: [
      'The trigger and every action are named by label in every content mode; readable text uses the central Outfit typography roles with a 14 CSS px minimum.',
      'The trigger exposes aria-expanded while it owns actions. Escape and selection return focus to the trigger; modal keeps focus inside until close.',
      'Menu types follow the APG menu button pattern: arrow keys move between actions, Enter and Space activate them.',
      'Hover, long press and gesture triggers always keep click, Enter and Space as alternatives; TV and remote input relies on focus, never hover.',
      'Draggable triggers must remain movable without a pointer; controlled dragPosition lets pages offer explicit keyboard controls.',
      'Hidden and permission-denied actions are filtered out; retained disabled, loading and offline-unavailable actions stay discoverable and announce disabledReason; loading is announced through genux-fab-status.',
      'Focus uses the shared ringless indicator; reduced motion removes movement without delaying state changes.',
      'No physical device certification is claimed; verification is by browser emulation and inline previews.',
    ],
    notes: [
      'Every approved P0, P1 and P2 axis is declared: all types, layouts, directions, shapes, appearances, content, label, icon, trigger, positioning, motion, backdrop, visibility, adaptation, close rules, groups, drag, obstacles and the full action model.',
      'Previews render inline in the four device mockups (phone, tablet, computer and TV); no iframe is used.',
      'GenUXFab is a custom API composed from Button, Badge and Modal; FloatButton is referenced as the official source, not wrapped one to one.',
      'permission is a caller-local UI flag. It is not server authorization; ownership and access checks belong to the application backend.',
      'No backend or AI service is involved; examples use local React state only.',
      'Easing and backdrop values are all declared, but only Cubic easing and the none and dim-blur backdrops are current. The remaining easing and backdrop choices stay disabled as pending until the human decision.',
      'The contextual type renders only when the caller passes visible true with at least one eligible action; the gallery passes visible true for its contextual demonstration.',
      'The existing frozen palette and motion baseline are unchanged.',
    ],
  },
];
