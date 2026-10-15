const AXES = [
  {
    key: 'fill',
    name: 'Surface',
    english: 'Fill',
    explain: 'Solid, outline, pastel-filled, text or link surfaces.',
    group: 'Appearance',
    options: variantOptions('fill'),
  },
  {
    key: 'palette',
    name: 'Color family',
    english: 'Color',
    explain: 'The base, dark and light colors change together. Each tone uses a solid color.',
    group: 'Appearance',
    options: variantOptions('palette'),
  },
  {
    key: 'tone',
    name: 'Color tone',
    english: 'Tone',
    explain:
      'Approved Dark, Middle, Light and Pastel tones use Ant Design color scales and preserve readable text on light and transparent surfaces.',
    group: 'Appearance',
    options: variantOptions('tone'),
  },
  {
    key: 'border',
    name: 'Border',
    english: 'Border',
    explain: 'Two options: no additional border or a 1 px hairline.',
    group: 'Appearance',
    options: variantOptions('border'),
  },
  {
    key: 'shadow',
    name: 'Depth and shadow',
    english: 'Shadow',
    explain:
      'None, soft, ambient, 6 px long and 4 px layered shadows are approved; other historical options remain experiments. The approved 8 px layer is a separate React component. No inset shadows or textures.',
    group: 'Appearance',
    options: variantOptions('shadow'),
  },
  {
    key: 'radius',
    name: 'Corner style',
    english: 'Radius',
    explain:
      'Four approved options: 0 px, 3 px, 5 px and fully rounded pill corners. No arbitrary radius.',
    group: 'Appearance',
    options: variantOptions('radius'),
  },
  {
    key: 'shape',
    name: 'Geometry',
    english: 'Shape',
    explain: 'Rectangle or tab silhouette. No cut, chamfered or skewed geometry.',
    group: 'Appearance',
    options: [
      ['rect', 'Rectangle'],
      ['tab', 'Tab silhouette'],
    ],
  },
  {
    key: 'size',
    name: 'Height and padding',
    english: 'Size / Padding',
    explain:
      'Three sizes: sm 48 px, md 56 px and lg 64 px. Long or enlarged text may increase the height.',
    group: 'Appearance',
    options: variantOptions('size'),
  },
  {
    key: 'width',
    name: 'Width and proportion',
    english: 'Width',
    explain: 'Content width, wide, full width or narrow.',
    group: 'Appearance',
    options: variantOptions('width'),
  },
  {
    key: 'detail',
    name: 'Surface detail',
    english: 'Layer detail',
    explain: 'Smooth flat surface, thin lower layer or leading accent. No texture or extra frame.',
    group: 'Appearance',
    options: [
      ['none', 'No detail'],
      ['bottomedge', 'Lower lip'],
      ['leftstripe', 'Leading accent'],
    ],
  },
  {
    key: 'hover',
    name: 'On hover',
    english: 'Hover',
    explain: 'All buttons use 0.9 resting opacity and 1 on hover. Position and size remain fixed.',
    group: 'Behavior',
    options: [['opacity', 'Opacity 0.9 → 1']],
  },
  {
    key: 'press',
    name: 'On press',
    english: 'Pressed',
    explain:
      'On lower-lip buttons, the outer top edge and label remain fixed. The bottom extends from 44 to 48 px to cover the stationary lower strip. Soft shadow recedes; no gradient or inset shadow is added.',
    group: 'Behavior',
    options: [
      ['flatten', 'Bottom covers the strip'],
      ['none', 'Unchanged'],
    ],
  },
  {
    key: 'duration',
    name: 'Transition duration',
    english: 'Duration',
    explain:
      'Opacity and press duration. Press is faster, release is softer; the experimental instant option uses zero duration.',
    group: 'Behavior',
    options: variantOptions('duration'),
  },
  {
    key: 'easing',
    name: 'Easing curve',
    english: 'Easing',
    explain:
      'All transitions, loaders and icon animations use the shared ease-in-out curve. Historical linear and fast-start choices map to this curve; durations are preserved.',
    group: 'Behavior',
    options: [['inout', 'Ease-in-out · starts and ends slowly']],
  },
  {
    key: 'tracking',
    name: 'Letter spacing',
    english: 'Letter spacing',
    explain:
      'Decision: 0 px / natural. Letter spacing is fixed; historical recipe values normalize to 0 px.',
    group: 'Appearance',
    options: variantOptions('tracking'),
  },
];
