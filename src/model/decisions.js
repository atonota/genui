// Add decisions only with explicit user approval. Experiments remain in BUTTON_EXPERIMENTS.
const COMPONENT_DECISIONS = {
  buttons: {
    status: 'karar_verildi',
    fill_variants: [
      { value: 'solid', label: 'Solid' },
      { value: 'outline', label: 'Outline' },
      { value: 'tint', label: 'Pastel-filled' },
      { value: 'text', label: 'Text button' },
      { value: 'link', label: 'Link' },
    ],
    palette_variants: [
      { value: 'violet', label: 'Ant Purple' },
      { value: 'blue', label: 'Ant Blue' },
      { value: 'teal', label: 'Ant Cyan' },
      { value: 'moss', label: 'Ant Green' },
      { value: 'clay', label: 'Ant Volcano' },
      { value: 'coral', label: 'Ant Red' },
      { value: 'amber', label: 'Ant Gold' },
      { value: 'graphite', label: 'Ant Gray' },
    ],
    tone_variants: [
      { value: 'dark', label: 'Dark tone' },
      { value: 'middle', label: 'Middle' },
      { value: 'light', label: 'Light tone' },
      { value: 'pastel', label: 'Pastel' },
    ],
    duration_variants: [{ value: 'deliberate', label: '500 ms / deliberate', duration_ms: 500 }],
    shadow_variants: [
      { value: 'none', label: 'None', css: 'none' },
      { value: 'soft', label: 'Soft shadow', css: 'var(--shadow-soft)' },
      { value: 'ambient', label: 'Ambient color', css: 'var(--shadow-ambient)' },
      {
        value: 'longFlat',
        label: 'Long flat · 6 px',
        css: 'var(--shadow-long-flat)',
        pressed_css: 'var(--shadow-flat-pressed)',
      },
      {
        value: 'layeredFlat',
        label: 'Layered flat · 4 px',
        css: 'var(--shadow-layered-flat)',
        pressed_css: 'var(--shadow-layered-pressed)',
      },
      {
        value: 'layeredFlat8',
        label: 'Layered flat · 8 px',
        css: 'var(--shadow-layered-flat-8)',
        pressed_css: 'var(--shadow-layered-pressed-8)',
        max_offset_px: 8,
      },
    ],
    radius_variants: [
      {
        value: '0',
        label: '0 px',
        css: '0px',
      },
      {
        value: '3',
        label: '3 px',
        css: '3px',
      },
      {
        value: '5',
        label: '5 px',
        css: '5px',
      },
      {
        value: 'pill',
        label: '100% · Pill',
        css: '9999px',
      },
    ],
    border_variants: [
      {
        value: 'none',
        label: 'No additional border',
      },
      {
        value: 'hairline',
        label: '1 px hairline',
      },
    ],
    size_variants: [
      { value: 'sm', label: 'Small · 48 px', height_px: 48, padding_inline_px: 25 },
      { value: 'md', label: 'Medium · 56 px', height_px: 56, padding_inline_px: 30 },
      { value: 'lg', label: 'Large · 64 px', height_px: 64, padding_inline_px: 24 },
    ],
    width_variants: [
      { value: 'content', label: 'Content width', min_width_px: null, block: false },
      { value: 'wide', label: 'Wide', min_width_px: 175, block: false },
      { value: 'full', label: 'Full width', min_width_px: null, block: true },
    ],
    opacity: {
      normal: 0.9,
      hover: 1,
    },
    style: 'Semi-flat / Flat 2.0',
    selected_base: 'Lower lip',
    implementation: {
      library: 'Ant Design',
      component: 'Button',
      theme_provider: 'ConfigProvider',
      docs_version_observed: '6.6.6',
      installed_version: null,
      preview_runtime: 'standalone HTML / JavaScript',
      size_mapping: {
        sm: 'small (48 px minimum)',
        md: 'medium (56 px minimum)',
        lg: 'large (64 px minimum)',
      },
      shared_styles: [
        'opacity',
        'single-edge borders',
        'stationary lower/top lip',
        'non-surrounding keyboard focus',
        '1rem minimum text',
        '48 / 56 / 64 px size profiles',
      ],
      sources: [
        'https://ant.design/docs/spec/colors/',
        'https://ant.design/components/button/',
        'https://ant.design/docs/react/customize-theme/',
      ],
    },
    state_variants: [
      {
        value: 'default',
        label: 'Normal',
        text: null,
        busy: false,
        blocked: false,
        kind: 'interaction',
        description: 'Initial surface and depth.',
      },
      {
        value: 'hover',
        label: 'Hovered',
        text: null,
        busy: false,
        blocked: false,
        kind: 'interaction',
        description: 'Hover can be simulated manually on narrow screens; the body does not move.',
      },
      {
        value: 'pressed',
        label: 'Pressed',
        text: null,
        busy: false,
        blocked: false,
        kind: 'interaction',
        description: 'During press; not a persistent selection.',
      },
      {
        value: 'disabled',
        label: 'Disabled',
        text: null,
        busy: false,
        blocked: true,
        kind: 'disabled',
        description: 'The action is currently unavailable.',
      },
      {
        value: 'loading',
        label: 'Processing',
        text: 'Processing',
        busy: true,
        blocked: true,
        kind: 'busy',
        description: 'Duplicate submission is blocked while processing.',
      },
    ],
    tracking_variants: [
      {
        value: 'normal',
        label: '0 px / natural',
        letter_spacing_px: 0,
      },
    ],
  },
};
const BUTTON_DECISIONS = COMPONENT_DECISIONS.buttons;
const BUTTON_EXPERIMENTS = {
  width_variants: [
    { value: 'narrow', label: 'Narrow', min_width_px: 80, padding_inline_px: 14, block: false },
  ],
  palette_variants: [{ value: 'magenta', label: 'Magenta' }],
  tone_variants: [],
  duration_variants: [
    { value: 'instant', label: '0 ms / instant' },
    { value: 'quick', label: '120 ms / quick' },
    { value: 'normal', label: '200 ms / balanced' },
    { value: 'slow', label: '320 ms / calm' },
  ],
  status: 'deneme',
  shadow_variants: [
    {
      value: 'contact',
      label: 'Contact shadow',
      css: 'var(--shadow-contact)',
    },
    {
      value: 'diffuse',
      label: 'Diffuse soft',
      css: 'var(--shadow-diffuse)',
    },
    {
      value: 'raised',
      label: 'Raised',
      css: 'var(--shadow-raised)',
    },
    {
      value: 'antd',
      label: 'Ant Design / boxShadow',
      css: 'var(--shadow-antd)',
    },
    {
      value: 'flatLayer',
      label: 'Short flat layer · 3 px',
      css: 'var(--shadow-flat-layer)',
      pressed_css: 'var(--shadow-flat-pressed)',
    },
  ],
  state_variants: [
    {
      value: 'offline',
      label: 'Offline',
      text: 'Offline',
      busy: false,
      blocked: true,
      kind: 'offline',
      description:
        'This example represents an action requiring a network. Offline-capable actions should remain available in the product.',
    },
    {
      value: 'warning',
      label: 'Review required',
      text: 'Review',
      busy: false,
      blocked: false,
      kind: 'warning',
      description: 'A state requiring user review before continuing.',
    },
    {
      value: 'retry',
      label: 'Retry',
      text: 'Try again',
      busy: false,
      blocked: false,
      kind: 'error',
      description: 'The user can restart the operation.',
    },
    {
      value: 'success',
      label: 'Success',
      text: 'Completed',
      busy: false,
      blocked: false,
      kind: 'success',
      description: 'Success is communicated with both text and color.',
    },
    {
      value: 'error',
      label: 'Error',
      text: 'Try again',
      busy: false,
      blocked: false,
      kind: 'error',
      description: 'Retry remains available after an error.',
    },
  ],
  interaction: {
    press_ms: 80,
    release_ms: 140,
    press_lower_fraction: 0.625,
    processing_after_release: true,
    edge_darkening_factor: 0.88,
  },
  operation_demo: {
    kind: 'simulation',
    processing_ms: 1200,
    result_ms: 900,
    network: false,
  },
  icon_options: {
    status: 'deneme',
    default: {
      library: 'phosphor',
      name: 'none',
      position: 'left',
      motion: 'static',
    },
    library: [
      {
        value: 'phosphor',
        label: 'Phosphor · default',
      },
      {
        value: 'antd',
        label: 'Ant Design',
      },
    ],
    name: [
      {
        value: 'none',
        label: 'No icon',
      },
      {
        value: 'arrowRight',
        label: 'Arrow right',
      },
      {
        value: 'check',
        label: 'Onay',
      },
      {
        value: 'plus',
        label: 'Add',
      },
      {
        value: 'download',
        label: 'Download',
      },
      {
        value: 'search',
        label: 'Ara',
      },
      {
        value: 'settings',
        label: 'Ayarlar',
      },
      {
        value: 'loading',
        label: 'Loader',
      },
      {
        value: 'reload',
        label: 'Yenile',
      },
      {
        value: 'sync',
        label: 'Senkronizasyon',
      },
    ],
    position: [
      {
        value: 'left',
        label: 'Left',
      },
      {
        value: 'right',
        label: 'Right',
      },
      {
        value: 'top',
        label: 'Top',
      },
      {
        value: 'bottom',
        label: 'Bottom',
      },
    ],
    motion: [
      {
        value: 'static',
        label: 'Static',
      },
      {
        value: 'spin',
        label: 'Spin / loader',
      },
      {
        value: 'pulse',
        label: 'Gentle pulse',
      },
    ],
  },
};
/* Official SVG paths, pinned source versions and full MIT notices; no CDN/runtime icon dependency. */
// Decisions and experiments own their variant lists. Views and exporters derive from them.
const BUTTON_VARIANTS = {
  fill: BUTTON_DECISIONS.fill_variants,
  palette: [...BUTTON_DECISIONS.palette_variants, ...BUTTON_EXPERIMENTS.palette_variants],
  radius: BUTTON_DECISIONS.radius_variants,
  border: BUTTON_DECISIONS.border_variants,
  size: BUTTON_DECISIONS.size_variants,
  width: [...BUTTON_DECISIONS.width_variants, ...BUTTON_EXPERIMENTS.width_variants],
  tracking: BUTTON_DECISIONS.tracking_variants,
  tone: BUTTON_DECISIONS.tone_variants,
  duration: [...BUTTON_EXPERIMENTS.duration_variants, ...BUTTON_DECISIONS.duration_variants],
  // Keep historical standalone choices/order; the approved 8px wrapper is a React component.
  shadow: [
    'none',
    'contact',
    'soft',
    'ambient',
    'diffuse',
    'raised',
    'antd',
    'flatLayer',
    'longFlat',
    'layeredFlat',
  ].map(
    value =>
      BUTTON_DECISIONS.shadow_variants.find(item => item.value === value) ||
      BUTTON_EXPERIMENTS.shadow_variants.find(item => item.value === value),
  ),
  state: [...BUTTON_DECISIONS.state_variants, ...BUTTON_EXPERIMENTS.state_variants],
};
const buttonVariantIndex = new Map(
  Object.entries(BUTTON_VARIANTS).map(([key, values]) => [
    key,
    new Map(values.map(value => [value.value, value])),
  ]),
);
function variantOptions(key) {
  return BUTTON_VARIANTS[key].map(({ value, label }) => [value, label]);
}
function buttonVariant(key, value) {
  return buttonVariantIndex.get(key)?.get(value);
}
function buttonStatus(value) {
  const normalized = ['saving', 'syncing', 'queued', 'processing'].includes(value)
    ? 'loading'
    : value;
  return buttonVariant('state', normalized) || BUTTON_DECISIONS.state_variants[0];
}
