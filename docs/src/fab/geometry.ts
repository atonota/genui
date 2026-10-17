import type {
  FabConfig,
  FabDirection,
  FabGeometry,
  FabGeometryInput,
  FabGroup,
  FabLayout,
  FabMeasuredAction,
  FabPoint,
  FabRect,
} from './types';
import { FAB_METRICS, FAB_OPTIONS, normalizeFabOptions } from './options';
import fabTokens from '../data/fab-tokens.json';
import adaptivePolicy from '../adaptive/policy.json';

type Positioned = FabRect & { id: string; angle?: number; control?: FabRect; label?: FabRect };
type LabelSide = 'left' | 'right' | 'above' | 'below' | undefined;
type Arc = Readonly<{ startAngle: number; endAngle: number; angularGap: number }>;
type Part = Readonly<{ positions: readonly Positioned[]; radius: number; ok: boolean }>;
type Candidate = Readonly<{
  layout: FabLayout;
  direction: FabDirection;
  positions: readonly Positioned[];
  radius: number;
  mode: FabGeometry['mode'];
  maxHeight: number;
  panel?: FabRect;
  ok: boolean;
}>;
type Ctx = Readonly<{
  bounds: FabRect;
  area: FabRect;
  trigger: FabRect;
  center: FabPoint;
  obstacles: readonly FabRect[];
  rtl: boolean;
  pad: number;
  gap: number;
  minRow: number;
  labelLeft: boolean;
  placement: FabConfig['labelPlacement'];
  inwardUp: boolean;
}>;

const EPSILON = 1e-6;
const GRID_LIMIT = 24;
const RADIUS_STEPS = [1.25, 1.5, 0] as const;
const RADIAL: ReadonlySet<FabLayout> = new Set<FabLayout>([
  'circle',
  'semi-circle',
  'quarter-circle',
  'custom-arc',
]);
const SWEEP: Readonly<Partial<Record<FabLayout, number>>> = {
  circle: 360,
  'semi-circle': 180,
  'quarter-circle': 90,
};
const OPPOSITE: Readonly<Record<FabDirection, FabDirection>> = {
  up: 'down',
  down: 'up',
  start: 'end',
  end: 'start',
  'up-start': 'down-end',
  'up-end': 'down-start',
  'down-start': 'up-end',
  'down-end': 'up-start',
};

// Collision padding, label spacing, sheet, action and adaptive limits are read from the shared token and policy JSON.
const PAD = fabTokens.position.collisionPadding;
const LABEL_GAP = fabTokens.position.labelGap;
const SHEET_RATIO = fabTokens.position.sheetMaxHeightRatio;
const MAX_ACTIONS = fabTokens.position.maxActions;
const WIDE_PHONE = adaptivePolicy.widths.widePhone;
const SHORT_HEIGHT = adaptivePolicy.shortHeight;
const DIRECTIONS: ReadonlySet<string> = new Set<string>(FAB_OPTIONS.direction);
// A group is one dial arm; multi-directional, floating-menu and sheet stay top-level layouts and are never aliased.
const GROUP_LAYOUT_LIST: readonly NonNullable<FabGroup['layout']>[] = [
  'linear',
  'diagonal',
  'circle',
  'semi-circle',
  'quarter-circle',
  'custom-arc',
];
const GROUP_LAYOUTS: ReadonlySet<string> = new Set<string>(GROUP_LAYOUT_LIST);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), Math.max(min, max));
const centerOf = (r: FabRect): FabPoint => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
const inset = (r: FabRect, p: number): FabRect => ({
  x: r.x + p,
  y: r.y + p,
  width: Math.max(0, r.width - 2 * p),
  height: Math.max(0, r.height - 2 * p),
});
const intersects = (a: FabRect, b: FabRect): boolean =>
  a.x < b.x + b.width - EPSILON &&
  b.x < a.x + a.width - EPSILON &&
  a.y < b.y + b.height - EPSILON &&
  b.y < a.y + a.height - EPSILON;
const contains = (outer: FabRect, r: FabRect): boolean =>
  r.x >= outer.x - EPSILON &&
  r.y >= outer.y - EPSILON &&
  r.x + r.width <= outer.x + outer.width + EPSILON &&
  r.y + r.height <= outer.y + outer.height + EPSILON;
// Menu and sheet rows render the label inside the native row, so the row width reserves it beside the icon.
const rowWidth = (a: FabMeasuredAction): number =>
  a.width + ((a.labelWidth ?? 0) > 0 ? (a.labelWidth ?? 0) + LABEL_GAP : 0);
const union = (a: FabRect, b: FabRect): FabRect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
};
const rowHeight = (a: FabMeasuredAction, min: number): number =>
  Math.max(min, a.height, a.labelHeight ?? 0);
const groupLayout = (g: FabGroup): FabLayout =>
  g.layout ?? (g.startAngle !== undefined || g.endAngle !== undefined ? 'custom-arc' : 'linear');
const groupArc = (arc: Arc, g: FabGroup): Arc => ({
  ...arc,
  startAngle: g.startAngle ?? arc.startAngle,
  endAngle: g.endAngle ?? arc.endAngle,
});

function assertFinite(values: readonly number[], name: string): void {
  if (!values.every(value => Number.isFinite(value)))
    throw new RangeError(`${name} must be finite`);
}

function assertRect(r: FabRect, name: string, positive = false): void {
  assertFinite([r.x, r.y, r.width, r.height], name);
  if (positive ? r.width <= 0 || r.height <= 0 : r.width < 0 || r.height < 0) {
    throw new RangeError(`${name} must have a ${positive ? 'positive' : 'non-negative'} size`);
  }
}

function validateActions(actions: readonly FabMeasuredAction[]): void {
  if (actions.length > MAX_ACTIONS)
    throw new RangeError(`FAB actions must contain at most ${MAX_ACTIONS} items`);
  const ids = new Set<string>();
  for (const a of actions) {
    if (typeof a.id !== 'string' || a.id.trim() === '')
      throw new RangeError('FAB action id must be a non-empty string');
    if (ids.has(a.id)) throw new RangeError(`Duplicate FAB action id: ${a.id}`);
    ids.add(a.id);
    const sizes = [a.width, a.height, a.labelWidth ?? 0, a.labelHeight ?? 0];
    assertFinite(sizes, `FAB action ${a.id}`);
    if (sizes.some(size => size < 0))
      throw new RangeError(`FAB action ${a.id} must have a non-negative size`);
  }
}

function assertSpan(arc: Arc, name: string): void {
  const span = arc.endAngle - arc.startAngle;
  if (!(span > 0 && span <= 360))
    throw new RangeError(`${name} span must be greater than 0 and at most 360 degrees`);
}

function validateGroups(groups: readonly FabGroup[], arc: Arc): void {
  for (const g of groups) {
    if (typeof g.id !== 'string' || g.id.trim() === '')
      throw new RangeError('FAB group id must be a non-empty string');
    if (!DIRECTIONS.has(g.direction))
      throw new RangeError(`FAB group ${g.id} has an invalid direction`);
    if (g.layout !== undefined && !GROUP_LAYOUTS.has(g.layout))
      throw new RangeError(
        `FAB group ${g.id} layout ${String(g.layout)} is unsupported; a group arm is linear, diagonal or radial`,
      );
    if (g.startAngle !== undefined || g.endAngle !== undefined)
      assertSpan(groupArc(arc, g), `FAB group ${g.id} arc`);
  }
}

/** Unit vector in CSS space (y grows downward); start/end follow the writing direction. */
function vector(direction: FabDirection, rtl: boolean): FabPoint {
  const end = rtl ? -1 : 1;
  const x = direction.includes('start') ? -end : direction.includes('end') ? end : 0;
  const y = direction.startsWith('up') ? -1 : direction.startsWith('down') ? 1 : 0;
  const length = Math.hypot(x, y);
  return { x: x / length, y: y / length };
}

/** Diagonal layouts turn axis directions toward the interior of the bounds. */
function diagonalOf(direction: FabDirection, ctx: Ctx): FabDirection {
  const side = ctx.labelLeft !== ctx.rtl ? 'start' : 'end';
  if (direction === 'up' || direction === 'down') return `${direction}-${side}`;
  if (direction === 'start' || direction === 'end')
    return `${ctx.inwardUp ? 'up' : 'down'}-${direction}`;
  return direction;
}

/**
 * Physical side of an action's external label container. Outside turns toward the bounds interior, start/end follow
 * the writing direction. Inside placement keeps the name in the control, yet a measured external container (group
 * heading, description, shortcut, reason) still reserves its box on the physical interior side; only a label without
 * a positive measured width and height gets no external rect.
 */
function labelSide(a: FabMeasuredAction, ctx: Ctx): LabelSide {
  if (!((a.labelWidth ?? 0) > 0 && (a.labelHeight ?? 0) > 0)) return undefined;
  switch (ctx.placement) {
    case 'above':
    case 'below':
      return ctx.placement;
    case 'start':
      return ctx.rtl ? 'right' : 'left';
    case 'end':
      return ctx.rtl ? 'left' : 'right';
    default:
      return ctx.labelLeft ? 'left' : 'right';
  }
}

/** Centers the native control on the point, attaches the external label LABEL_GAP away and returns their exact union. */
function place(a: FabMeasuredAction, p: FabPoint, ctx: Ctx, angle?: number): Positioned {
  const control = { x: p.x - a.width / 2, y: p.y - a.height / 2, width: a.width, height: a.height };
  const side = labelSide(a, ctx);
  const lw = a.labelWidth ?? 0;
  const lh = a.labelHeight ?? 0;
  const label =
    side === undefined
      ? undefined
      : {
          x:
            side === 'left'
              ? control.x - LABEL_GAP - lw
              : side === 'right'
                ? control.x + control.width + LABEL_GAP
                : p.x - lw / 2,
          y:
            side === 'above'
              ? control.y - LABEL_GAP - lh
              : side === 'below'
                ? control.y + control.height + LABEL_GAP
                : p.y - lh / 2,
          width: lw,
          height: lh,
        };
  const outer = label === undefined ? control : union(control, label);
  const rect: Positioned = {
    id: a.id,
    ...outer,
    control,
    ...(label === undefined ? {} : { label }),
  };
  return angle === undefined ? rect : { ...rect, angle };
}

/** Support of a rect, relative to the control center, along the unit vector u. */
const support = (r: FabRect, u: FabPoint): number =>
  Math.max(r.x * u.x, (r.x + r.width) * u.x) + Math.max(r.y * u.y, (r.y + r.height) * u.y);

function linear(
  items: readonly FabMeasuredAction[],
  v: FabPoint,
  ctx: Ctx,
  clear: boolean,
): Positioned[] {
  // Control centers sit on the axis; each step reserves the union's real extent behind and ahead of its control.
  let distance =
    (Math.abs(v.x) * ctx.trigger.width + Math.abs(v.y) * ctx.trigger.height) / 2 + ctx.gap;
  const at = (a: FabMeasuredAction, reach: number): Positioned =>
    place(a, { x: ctx.center.x + v.x * reach, y: ctx.center.y + v.y * reach }, ctx);
  // Only a clearing attempt orders the supplied obstacles, the trigger's own outside label included, by their far
  // extent along the ray. An action crossing one moves just past it plus the gap and later actions keep the uniform
  // gap from there; each obstacle is checked once per action, so the clearance stays bounded and an unobstructed arm
  // keeps its spacing. Unadjusted attempts keep the natural spacing and fits() rejects any crossing.
  const blockers = (clear ? ctx.obstacles : [])
    .map(o => ({
      rect: o,
      far: support({ ...o, x: o.x - ctx.center.x, y: o.y - ctx.center.y }, v),
    }))
    .sort((p, q) => p.far - q.far);
  return items.map(a => {
    const local = place(a, { x: 0, y: 0 }, ctx);
    const behind = support(local, { x: -v.x, y: -v.y });
    let reach = distance + behind;
    for (const { rect, far } of blockers)
      if (intersects(at(a, reach), rect)) reach = Math.max(reach, far + ctx.gap + behind);
    distance = reach + support(local, v) + ctx.gap;
    return at(a, reach);
  });
}

/**
 * Public angles are CSS degrees clockwise from the physical right axis (y grows downward), so -90 points up and
 * y = cy + r sin. RTL mirrors an angle across the vertical axis with 180 - angle.
 */
function radial(
  items: readonly FabMeasuredAction[],
  layout: FabLayout,
  direction: FabDirection,
  arc: Arc,
  base: number,
  grow: number,
  ctx: Ctx,
): Part {
  const n = items.length;
  const v = vector(direction, ctx.rtl);
  const heading = (Math.atan2(v.y, v.x) * 180) / Math.PI;
  const mirror = (deg: number): number => (ctx.rtl ? 180 - deg : deg);
  const fixed = SWEEP[layout];
  // Fixed sweeps run clockwise around the heading in LTR and counter-clockwise in RTL, so every action ID lands on the
  // mirror (180 - angle) of its LTR slot instead of only the heading turning; custom arcs mirror their explicit angles.
  const turn = ctx.rtl ? -1 : 1;
  const start =
    fixed === undefined
      ? mirror(arc.startAngle)
      : fixed === 360
        ? heading
        : heading - (turn * fixed) / 2;
  const sweep = fixed === undefined ? mirror(arc.endAngle) - mirror(arc.startAngle) : turn * fixed;
  // A full turn ends where it starts, so it divides by n; a partial arc keeps both endpoints and divides by n - 1.
  const full = Math.abs(sweep) >= 360 - EPSILON;
  const step = sweep / (full ? Math.max(n, 1) : Math.max(n - 1, 1));
  // angularGap is a minimum separation contract for every radial layout, never a fixed step: when the uniform spacing
  // of a circle, semi-circle, quarter-circle or closed custom arc cannot honour it, the part is not ok and the caller
  // falls back to a menu instead of crowding the arc.
  const spaced = n < 2 || Math.abs(step) >= arc.angularGap - EPSILON;
  // Rects stay axis-aligned while the arc turns, so neighbours need a chord as long as the widest footprint diagonal.
  const size = items.reduce((max, a) => Math.max(max, a.width, a.height), 0);
  const reach = items.reduce((max, a) => {
    const local = place(a, { x: 0, y: 0 }, ctx);
    return Math.max(max, Math.hypot(local.width, local.height));
  }, 0);
  const chord =
    n > 1 && step !== 0
      ? (reach + ctx.gap) / (2 * Math.sin((Math.min(Math.abs(step), 180) * Math.PI) / 360))
      : 0;
  const minimum = Math.max(
    Math.max(ctx.trigger.width, ctx.trigger.height) / 2 + size / 2 + ctx.gap,
    chord,
  );
  // Larger radius attempts scale the computed minimum too, so they still grow when the chord exceeds the base radius.
  const radius = Math.max(base, minimum * grow);
  const positions = items.map((a, i) => {
    const angle = n === 1 && !full ? start + sweep / 2 : start + step * i;
    const rad = (angle * Math.PI) / 180;
    const point = {
      x: ctx.center.x + radius * Math.cos(rad),
      y: ctx.center.y + radius * Math.sin(rad),
    };
    return place(a, point, ctx, ((angle % 360) + 360) % 360);
  });
  return { positions, radius, ok: spaced };
}

function dial(
  items: readonly FabMeasuredAction[],
  layout: FabLayout,
  direction: FabDirection,
  arc: Arc,
  base: number,
  grow: number,
  ctx: Ctx,
  clear: boolean,
): Part {
  if (RADIAL.has(layout)) return radial(items, layout, direction, arc, base, grow, ctx);
  const v = vector(layout === 'diagonal' ? diagonalOf(direction, ctx) : direction, ctx.rtl);
  const positions = linear(items, v, ctx, clear);
  const radius = positions.reduce((max, r) => {
    const c = centerOf(r.control ?? r);
    return Math.max(max, Math.hypot(c.x - ctx.center.x, c.y - ctx.center.y));
  }, 0);
  return { positions, radius, ok: true };
}

/** Every eligible action lands in exactly one group; ungrouped or unknown-group actions follow the main direction. */
function partition(
  actions: readonly FabMeasuredAction[],
  groups: readonly FabGroup[],
  direction: FabDirection,
): readonly Readonly<{ group: FabGroup; items: readonly FabMeasuredAction[] }>[] {
  const buckets = new Map<string, FabMeasuredAction[]>();
  for (const group of groups) {
    if (buckets.has(group.id)) throw new RangeError(`Duplicate FAB group id: ${group.id}`);
    buckets.set(group.id, []);
  }
  const rest: FabMeasuredAction[] = [];
  for (const a of actions) (a.group === undefined ? rest : (buckets.get(a.group) ?? rest)).push(a);
  const parts = groups
    .map(group => ({ group, items: buckets.get(group.id) ?? [] }))
    .filter(part => part.items.length > 0);
  return rest.length > 0 ? [...parts, { group: { id: '', direction }, items: rest }] : parts;
}

function fits(rects: readonly FabRect[], ctx: Ctx): boolean {
  return rects.every(
    (r, i) =>
      contains(ctx.area, r) &&
      !intersects(r, ctx.trigger) &&
      !ctx.obstacles.some(o => intersects(r, o)) &&
      rects.every((q, j) => j <= i || !intersects(r, q)),
  );
}

/** Free height beside the trigger edge in the panel column, stopping at the padded bounds and the nearest obstacle. */
function clearance(edge: number, up: boolean, x: number, width: number, ctx: Ctx): number {
  let limit = up ? ctx.area.y : ctx.area.y + ctx.area.height;
  for (const o of ctx.obstacles) {
    if (!(o.x < x + width - EPSILON && x < o.x + o.width - EPSILON)) continue;
    if (up && o.y < edge - EPSILON) limit = Math.max(limit, Math.min(edge, o.y + o.height));
    if (!up && o.y + o.height > edge + EPSILON) limit = Math.min(limit, Math.max(edge, o.y));
  }
  return Math.max(0, up ? edge - limit : limit - edge);
}

/**
 * Floating menu beside the trigger. A spatial (explicit TV) scroll menu never drops to a sheet: it clamps its width to
 * the padded bounds, stops before obstacles and keeps every full-height row, so rows beyond maxHeight form the scroll
 * region; it is ok only when at least one full row and the panel fit.
 */
function menu(
  actions: readonly FabMeasuredAction[],
  up: boolean,
  ctx: Ctx,
  scroll = false,
): Candidate {
  const { trigger, area, gap } = ctx;
  const rows = actions.map(a => ({ id: a.id, height: rowHeight(a, ctx.minRow) }));
  const natural = actions.reduce((max, a) => Math.max(max, rowWidth(a)), trigger.width);
  const width = scroll ? Math.min(natural, area.width) : natural;
  const total = rows.reduce((sum, row) => sum + row.height, 0);
  const x = clamp(
    ctx.labelLeft ? trigger.x + trigger.width - width : trigger.x,
    area.x,
    area.x + area.width - width,
  );
  const edge = up ? trigger.y - gap : trigger.y + trigger.height + gap;
  const available = scroll
    ? clearance(edge, up, x, width, ctx)
    : up
      ? edge - area.y
      : area.y + area.height - edge;
  const maxHeight = clamp(total, 0, available);
  const top = up ? edge - maxHeight : edge;
  let y = top;
  const positions = rows.map(row => {
    const rect = {
      id: row.id,
      x,
      y,
      width,
      height: row.height,
      control: { x, y, width, height: row.height },
    };
    y += row.height;
    return rect;
  });
  const tallest = rows.reduce((max, row) => Math.max(max, row.height), 0);
  const room = scroll
    ? maxHeight > EPSILON && maxHeight >= Math.min(total, tallest) - EPSILON
    : total <= available + EPSILON;
  const panel = { x, y: top, width, height: maxHeight };
  const ok = room && fits([panel], ctx);
  return {
    layout: 'floating-menu',
    direction: up ? 'up' : 'down',
    positions,
    radius: 0,
    mode: 'menu',
    maxHeight,
    panel,
    ok,
  };
}

type Slot = Readonly<{ top: number; bottom: number }>;

/**
 * Last resort: bottom sheet in the full-width column of the padded bounds, capped by the token height ratio. Obstacles
 * crossing the column and the trigger expanded by the gap split it into free vertical slots; the sheet takes the
 * roomiest slot, nearest the bottom on ties, that shows at least one full row plus padding. panel is the outer rect and
 * maxHeight its height including the top and bottom padding; rows start pad below panel.y at their natural height and
 * rows beyond it form the scroll region, nothing is dropped. ok is false when no slot fits one row, so the caller
 * reports a collision instead of claiming a free sheet.
 */
function sheet(
  actions: readonly FabMeasuredAction[],
  direction: FabDirection,
  ctx: Ctx,
): Candidate {
  const { bounds, area, pad, trigger, gap } = ctx;
  const rows = actions.map(a => ({ id: a.id, height: rowHeight(a, ctx.minRow) }));
  const total = rows.reduce((sum, row) => sum + row.height, 2 * pad);
  const need = Math.min(total, ctx.minRow + 2 * pad);
  const cap = Math.min(total, bounds.height * SHEET_RATIO);
  const bottomEdge = area.y + area.height;
  const keepOut = {
    x: trigger.x - gap,
    y: trigger.y - gap,
    width: trigger.width + 2 * gap,
    height: trigger.height + 2 * gap,
  };
  const blockers = [...ctx.obstacles, keepOut]
    .filter(
      o =>
        o.height > EPSILON &&
        o.x < area.x + area.width - EPSILON &&
        area.x < o.x + o.width - EPSILON,
    )
    .sort((a, b) => a.y - b.y);
  const slots: Slot[] = [];
  let top = area.y;
  for (const o of blockers) {
    const end = Math.min(o.y, bottomEdge);
    if (end > top + EPSILON) slots.push({ top, bottom: end });
    top = Math.max(top, o.y + o.height);
  }
  if (bottomEdge > top + EPSILON) slots.push({ top, bottom: bottomEdge });
  const heightIn = (s: Slot): number => Math.min(cap, s.bottom - s.top);
  // Every slot that shows all rows reaches cap, so the height-then-bottom order keeps the lowest of them.
  const slot = slots
    .filter(s => heightIn(s) >= need - EPSILON)
    .reduce<Slot | undefined>((best, s) => {
      if (best === undefined) return s;
      const delta = heightIn(s) - heightIn(best);
      return delta > EPSILON || (delta > -EPSILON && s.bottom > best.bottom) ? s : best;
    }, undefined);
  const ok = slot !== undefined;
  const maxHeight = slot === undefined ? clamp(cap, 0, area.height) : heightIn(slot);
  const panel = {
    x: area.x,
    y: (slot?.bottom ?? bottomEdge) - maxHeight,
    width: area.width,
    height: maxHeight,
  };
  let y = panel.y + pad;
  const positions = rows.map(row => {
    const control = { x: area.x, y, width: area.width, height: row.height };
    const rect = { id: row.id, ...control, control };
    y += row.height;
    return rect;
  });
  return { layout: 'sheet', direction, positions, radius: 0, mode: 'sheet', maxHeight, panel, ok };
}

function requestedLayout(
  options: FabConfig,
  count: number,
  bounds: FabRect,
  spatial: boolean,
): FabLayout {
  if (options.adaptation === 'sheet') return 'sheet';
  if (spatial) return 'floating-menu';
  if (options.adaptation !== 'auto') return options.layout;
  if (bounds.height < SHORT_HEIGHT) return 'sheet';
  if (bounds.width < WIDE_PHONE && count >= 6 && RADIAL.has(options.layout)) return 'floating-menu';
  return options.layout;
}

function finish(c: Candidate, trigger: FabPoint, collision: boolean): FabGeometry {
  return {
    layout: c.layout,
    direction: c.direction,
    trigger,
    positions: c.positions,
    radius: c.radius,
    mode: c.mode,
    collision,
    maxHeight: c.maxHeight,
    ...(c.panel === undefined ? {} : { panel: c.panel }),
  };
}

export function layoutFab(input: FabGeometryInput): FabGeometry {
  const {
    bounds,
    trigger,
    actions,
    groups = [],
    obstacles = [],
    rtl = false,
    spatial = false,
  } = input;
  // The public boundary re-validates the complete config, so a directly supplied FabConfig cannot carry a
  // non-positive radius, an out-of-range angularGap or any other value normalizeFabOptions rejects.
  const options = normalizeFabOptions(input.options);
  const { arc } = options;
  assertRect(bounds, 'bounds', true);
  assertRect(trigger, 'trigger');
  obstacles.forEach((o, i) => assertRect(o, `obstacles[${i}]`));
  validateActions(actions);
  assertFinite([...groups.map(g => g.startAngle ?? 0), ...groups.map(g => g.endAngle ?? 0)], 'arc');
  validateGroups(groups, arc);
  const pad = PAD;
  const metrics = FAB_METRICS[options.size];
  const center = centerOf(trigger);
  const ctx: Ctx = {
    bounds,
    area: inset(bounds, pad),
    trigger,
    center,
    obstacles,
    rtl,
    pad,
    gap:
      metrics.gap *
      fabTokens.density[options.adaptation === 'compact' ? 'compact' : options.density],
    minRow: metrics.actionTarget,
    labelLeft: center.x > bounds.x + bounds.width / 2,
    inwardUp: center.y > bounds.y + bounds.height / 2,
    placement: options.labelPlacement,
  };
  const parts = partition(actions, groups, options.direction);
  const base = options.adaptation === 'compact' ? 0 : arc.radius;
  const requested = requestedLayout(options, actions.length, bounds, spatial);
  const up =
    options.direction.startsWith('up') || (!options.direction.startsWith('down') && ctx.inwardUp);
  const buildDial = (flip: boolean, scale: number, clear = false): Candidate => {
    const turn = (d: FabDirection): FabDirection => (flip ? OPPOSITE[d] : d);
    const grow = Math.max(scale, 1);
    const results =
      requested === 'multi-directional'
        ? parts.map(p =>
            dial(
              p.items,
              groupLayout(p.group),
              turn(p.group.direction),
              groupArc(arc, p.group),
              base * scale,
              grow,
              ctx,
              clear,
            ),
          )
        : [dial(actions, requested, turn(options.direction), arc, base * scale, grow, ctx, clear)];
    const positions = results.flatMap(r => r.positions);
    return {
      layout: requested,
      direction: turn(options.direction),
      positions,
      radius: results.reduce((max, r) => Math.max(max, r.radius), 0),
      mode: 'dial',
      maxHeight: ctx.area.height,
      ok: results.every(r => r.ok) && fits(positions, ctx),
    };
  };
  const attempts: Array<() => Candidate> = [];
  if (requested !== 'sheet' && requested !== 'floating-menu') {
    for (const scale of [1, ...RADIUS_STEPS]) {
      if (scale === 1 || RADIAL.has(requested) || requested === 'multi-directional') {
        attempts.push(
          () => buildDial(false, scale),
          () => buildDial(true, scale),
        );
      }
    }
    // Bounded obstacle clearance is a later collision resolution: the requested and flipped arms stay preferred
    // unadjusted, and only then do linear arms move along their rays past obstacles before a menu or sheet.
    if (!RADIAL.has(requested))
      attempts.push(
        () => buildDial(false, 1, true),
        () => buildDial(true, 1, true),
      );
  }
  if (requested !== 'sheet')
    attempts.push(
      () => menu(actions, up, ctx),
      () => menu(actions, !up, ctx),
    );
  // An explicit spatial (TV) surface keeps its labelled menu: a bounded scroll menu on the roomier side replaces the sheet.
  if (spatial && requested === 'floating-menu') {
    attempts.push(() => {
      const near = menu(actions, up, ctx, true);
      const far = menu(actions, !up, ctx, true);
      return far.ok && (!near.ok || far.maxHeight > near.maxHeight + EPSILON) ? far : near;
    });
  }
  // Public geometry reports the trigger's top-left corner; every position shares the same absolute bounds space.
  const origin = { x: trigger.x, y: trigger.y };
  let index = 0;
  for (const attempt of attempts) {
    const candidate = attempt();
    if (candidate.ok) return finish(candidate, origin, index > 0);
    index += 1;
  }
  const fallback = sheet(actions, options.direction, ctx);
  return finish(fallback, origin, attempts.length > 0 || !fallback.ok);
}

export function placeFabTrigger(input: {
  bounds: FabRect;
  anchor?: FabRect;
  width: number;
  height: number;
  options: FabConfig;
  obstacles?: readonly FabRect[];
  rtl?: boolean;
}): FabRect {
  const { bounds, anchor, width, height, obstacles = [], rtl = false } = input;
  const options = normalizeFabOptions(input.options);
  assertRect(bounds, 'bounds', true);
  assertRect({ x: 0, y: 0, width, height }, 'trigger');
  if (anchor) assertRect(anchor, 'anchor');
  obstacles.forEach((o, i) => assertRect(o, `obstacles[${i}]`));
  assertFinite([options.offset.x, options.offset.y], 'offset');
  const pad = PAD;
  const area = inset(bounds, pad);
  // Header and footer overlaps straddle the supplied anchor rect whatever the anchor option; without one they use the
  // bounds edge, which the padded clamp below keeps the trigger inside.
  const overlap = options.edge !== 'normal';
  const ref = (overlap || options.anchor === 'element') && anchor ? anchor : bounds;
  const { x: dx, y: dy } = options.offset;
  const logical = options.edge === 'normal' ? options.horizontal : options.alignment;
  const x =
    logical === 'center'
      ? ref.x + (ref.width - width) / 2 + (rtl ? -dx : dx)
      : (logical === 'start') !== rtl
        ? ref.x + dx
        : ref.x + ref.width - width - dx;
  const y =
    options.edge === 'header-overlap'
      ? ref.y - height / 2
      : options.edge === 'footer-overlap'
        ? ref.y + ref.height - height / 2
        : options.vertical === 'top'
          ? ref.y + dy
          : options.vertical === 'bottom'
            ? ref.y + ref.height - height - dy
            : ref.y + (ref.height - height) / 2 + dy;
  // The whole trigger stays usable inside the padded bounds on both axes. An overlap keeps its exact straddle of an
  // internal reference edge only while that safety permits; a reference edge at or beyond the padded inset clamps the
  // trigger inside instead of clipping it out of the viewport.
  const at = (cx: number, cy: number): FabRect => ({
    x: clamp(cx, area.x, area.x + area.width - width),
    y: clamp(cy, area.y, area.y + area.height - height),
    width,
    height,
  });
  const desired = at(x, y);
  const free = (r: FabRect): boolean => !obstacles.some(o => intersects(r, o));
  if (free(desired)) return desired;
  const steps = (start: number, span: number, size: number): number[] => {
    const range = Math.max(0, span - size);
    const step = Math.max(size, pad, 1, range / (GRID_LIMIT - 1));
    const count = Math.floor(range / step) + 1;
    return [...Array.from({ length: count }, (_, i) => start + i * step), start + range];
  };
  const edges = obstacles.flatMap(o => [
    at(o.x - pad - width, desired.y),
    at(o.x + o.width + pad, desired.y),
    at(desired.x, o.y - pad - height),
    at(desired.x, o.y + o.height + pad),
  ]);
  const rows = steps(area.y, area.height, height);
  const grid = steps(area.x, area.width, width).flatMap(gx => rows.map(gy => at(gx, gy)));
  const distance = (r: FabRect): number => Math.hypot(r.x - desired.x, r.y - desired.y);
  return [...edges, ...grid]
    .filter(free)
    .reduce<FabRect>(
      (best, r) => (best === desired || distance(r) < distance(best) ? r : best),
      desired,
    );
}
