const $ = id => document.getElementById(id);
function element(tag, className, text, { localize = true } = {}) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.setAttribute(localize ? 'data-i18n' : 'data-i18n-ignore', '');
  if (text !== undefined) el.textContent = localize ? t(text) : text;
  return el;
}
const axisMap = Object.fromEntries(AXES.map(a => [a.key, a]));
const labelFor = (key, val) => axisMap[key]?.options.find(o => o[0] === val)?.[1] || val;
function rgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function luminance(hex) {
  const c = rgb(hex).map(v => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function solidText(color) {
  return contrast(color, '#ffffff') >= contrast(color, '#141414') ? '#ffffff' : '#141414';
}
function normalizeRadius(value) {
  const legacy = {
    square: '0',
    micro: '3',
    small: '5',
    medium: '5',
    large: '5',
    asym: '5',
    leaf: '5',
    '100%': 'pill',
  };
  const mapped = legacy[value] || String(value);
  if (BUTTON_DECISIONS.radius_variants.some(v => v.value === mapped)) return mapped;
  const n = Number(mapped);
  if (!Number.isFinite(n)) return '5';
  return String(
    [0, 3, 5].reduce((best, v) => (Math.abs(n - v) <= Math.abs(n - best) ? v : best), 0),
  );
}
function normalizeBorder(value) {
  if (value.customBorder !== undefined && Number.isFinite(+value.customBorder))
    return +value.customBorder <= 0 ? 'none' : 'hairline';
  if (['solid', 'bottom', 'left'].includes(value.border)) return 'hairline';
  return BUTTON_DECISIONS.border_variants.some(v => v.value === value.border)
    ? value.border
    : BASE.border;
}
function safeConfig(value) {
  const out = { ...BASE, icon: { ...BASE.icon } };
  if (!value || typeof value !== 'object') return out;
  value = {
    ...value,
    size: { compact: 'sm', normal: 'sm', large: 'md', tall: 'lg' }[value.size] || value.size,
    fill:
      { ghost: 'text', ink: 'solid', muted: 'tint', white: 'outline' }[value.fill] || value.fill,
    radius: normalizeRadius(
      value.customRadius !== undefined && Number.isFinite(+value.customRadius)
        ? value.customRadius
        : value.radius,
    ),
    border: normalizeBorder(value),
  };
  for (const a of AXES) if (a.options.some(o => o[0] === value[a.key])) out[a.key] = value[a.key];
  if (out.radius === 'pill') out.shape = 'rect';
  const icon = value.icon && typeof value.icon === 'object' ? value.icon : {};
  for (const key of ['library', 'name', 'position', 'motion'])
    if (BUTTON_EXPERIMENTS.icon_options[key].some(option => option.value === icon[key]))
      out.icon[key] = icon[key];
  if (value.customColors && typeof value.customColors === 'object') {
    const q = value.customColors,
      p = paletteFor(out);
    out.customColors = {
      bg: validHex(q.bg) ? q.bg : p.color,
      fg: validHex(q.fg) ? q.fg : solidText(p.color),
      edge: validHex(q.edge) ? q.edge : p.dark,
    };
  }
  return out;
}
function validHex(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}
function interactionTiming(config) {
  const scale =
    { instant: 0, quick: 120, normal: 200, slow: 320, deliberate: 500 }[config.duration] / 200;
  return {
    press_ms: Math.round(BUTTON_EXPERIMENTS.interaction.press_ms * scale),
    release_ms: Math.round(BUTTON_EXPERIMENTS.interaction.release_ms * scale),
    easing: 'var(--motion-easing)',
  };
}
function edgeColor(color) {
  return hexOf(
    rgb(color).map(value => value * BUTTON_EXPERIMENTS.interaction.edge_darkening_factor),
  );
}
