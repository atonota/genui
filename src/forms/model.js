/* FormAtlas maintenance contract (this file only):
 * Standalone HTML preview, not the Ant Design runtime.
 * Do not promote experiments to COMPONENT_DECISIONS without explicit user approval.
 * Outfit, minimum 1rem, natural tracking, central tokens and shared easing.
 * No gradients, inset shadows or surrounding focus rings; one visible side marker.
 * Start at 320px; preserve input and focus when layout or theme changes.
 * Native checkbox/radio/switch semantics; embedded Zag 1.46.0 dropdowns.
 * Sources and checks: src/forms/*, src/styles/forms.css,
 * tests/legacy/*, tests/preservation.test.mjs, tests/dropdown.test.mjs.
 * Node DOM tests are not browser, screenshot or real-device evidence.
 */
const FORM_EXPERIMENTS = {
  status: 'deneme',
  input_variants: [
    'text',
    'email',
    'search',
    'password',
    'number',
    'textarea',
    'prefix',
    'suffix',
    'addon',
    'clearable',
    'required',
    'readonly',
    'disabled',
    'invalid',
    'warning',
    'success',
    'loading',
  ],
  dropdown_variants: [
    'single',
    'searchable',
    'multiple',
    'searchable-multiple',
    'clearable',
    'grouped',
    'empty',
    'loading',
    'readonly',
    'disabled',
    'invalid',
    'warning',
  ],
  checkbox_variants: [
    'unchecked',
    'checked',
    'mixed',
    'group',
    'disabled-off',
    'disabled-on',
    'invalid',
  ],
  radio_variants: ['vertical', 'horizontal', 'segmented', 'disabled', 'invalid'],
  switch_variants: ['off', 'on', 'text', 'icon', 'disabled-off', 'disabled-on', 'loading'],
  surfaces: [
    ['outlined', 'Outlined'],
    ['filled', 'Filled'],
    ['borderless', 'Borderless'],
    ['underlined', 'Underlined'],
  ],
  radius: BUTTON_DECISIONS.radius_variants,
  sizes: BUTTON_DECISIONS.size_variants,
  tones: BUTTON_VARIANTS.tone,
  control_sizes: {
    compact: { choice: 20, track: 40, track_height: 24, knob: 18, travel: 16 },
    normal: { choice: 22, track: 48, track_height: 28, knob: 22, travel: 20 },
    large: { choice: 24, track: 56, track_height: 32, knob: 26, travel: 24 },
    tall: { choice: 28, track: 64, track_height: 36, knob: 30, travel: 28 },
  },
  mapping: {
    inputs: ['Input', 'Input.Search', 'Input.Password', 'InputNumber', 'Input.TextArea'],
    dropdowns: ['Select'],
    checkboxes: ['Checkbox', 'Checkbox.Group'],
    radios: ['Radio', 'Radio.Group'],
    switches: ['Switch'],
  },
};
const formAppearance = {
  radius: '5',
  size: 'normal',
  tone: 'middle',
  palette: 'coral',
  surface: 'outlined',
};
const formDropdowns = [];
let formLabReady = false;
