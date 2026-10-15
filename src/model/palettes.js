const PALETTES = {
  violet: {
    color: '#531dab',
    dark: '#391085',
    tint: '#f9f0ff',
  },
  blue: {
    color: '#0958d9',
    dark: '#003eb3',
    tint: '#e6f4ff',
  },
  teal: {
    color: '#006d75',
    dark: '#00474f',
    tint: '#e6fffb',
  },
  moss: {
    color: '#237804',
    dark: '#135200',
    tint: '#f6ffed',
  },
  clay: {
    color: '#ad2102',
    dark: '#871400',
    tint: '#fff2e8',
  },
  coral: {
    color: '#cf1322',
    dark: '#a8071a',
    tint: '#fff1f0',
  },
  amber: {
    color: '#874d00',
    dark: '#613400',
    tint: '#fffbe6',
  },
  graphite: {
    color: '#434343',
    dark: '#262626',
    tint: '#f5f5f5',
  },
  magenta: {
    color: '#da037d',
    dark: '#b3006b',
    tint: '#ffe6f0',
  },
};
/* Tone experiments: @ant-design/colors 8.0.1 chromatic levels; Ant Design 5.27.6 neutral gray. Middle literals are unchanged. These four project roles are not an Ant Design prescription. */
/* Custom magenta seed #da037d: generate() indices 5/6 for middle, 6/7 dark,
   2/3 light, 0/1 pastel; index 0 supplies every tint. */
const TONE_PALETTES = {
  violet: {
    dark: { color: '#391085', dark: '#22075e', tint: '#f9f0ff' },
    light: { color: '#b37feb', dark: '#9254de', tint: '#f9f0ff' },
    pastel: { color: '#f9f0ff', dark: '#efdbff', tint: '#f9f0ff' },
  },
  blue: {
    dark: { color: '#003eb3', dark: '#002c8c', tint: '#e6f4ff' },
    light: { color: '#69b1ff', dark: '#4096ff', tint: '#e6f4ff' },
    pastel: { color: '#e6f4ff', dark: '#bae0ff', tint: '#e6f4ff' },
  },
  teal: {
    dark: { color: '#00474f', dark: '#002329', tint: '#e6fffb' },
    light: { color: '#5cdbd3', dark: '#36cfc9', tint: '#e6fffb' },
    pastel: { color: '#e6fffb', dark: '#b5f5ec', tint: '#e6fffb' },
  },
  moss: {
    dark: { color: '#135200', dark: '#092b00', tint: '#f6ffed' },
    light: { color: '#95de64', dark: '#73d13d', tint: '#f6ffed' },
    pastel: { color: '#f6ffed', dark: '#d9f7be', tint: '#f6ffed' },
  },
  clay: {
    dark: { color: '#871400', dark: '#610b00', tint: '#fff2e8' },
    light: { color: '#ff9c6e', dark: '#ff7a45', tint: '#fff2e8' },
    pastel: { color: '#fff2e8', dark: '#ffd8bf', tint: '#fff2e8' },
  },
  coral: {
    dark: { color: '#a8071a', dark: '#820014', tint: '#fff1f0' },
    light: { color: '#ff7875', dark: '#ff4d4f', tint: '#fff1f0' },
    pastel: { color: '#fff1f0', dark: '#ffccc7', tint: '#fff1f0' },
  },
  amber: {
    dark: { color: '#613400', dark: '#613400', tint: '#fffbe6' },
    light: { color: '#ffd666', dark: '#ffc53d', tint: '#fffbe6' },
    pastel: { color: '#fffbe6', dark: '#fff1b8', tint: '#fffbe6' },
  },
  graphite: {
    dark: { color: '#262626', dark: '#1f1f1f', tint: '#f5f5f5' },
    light: { color: '#bfbfbf', dark: '#8c8c8c', tint: '#f5f5f5' },
    pastel: { color: '#f5f5f5', dark: '#f0f0f0', tint: '#f5f5f5' },
  },
  magenta: {
    dark: { color: '#b3006b', dark: '#8c0059', tint: '#ffe6f0' },
    light: { color: '#ff7dba', dark: '#f250a1', tint: '#ffe6f0' },
    pastel: { color: '#ffe6f0', dark: '#ffa6cc', tint: '#ffe6f0' },
  },
};
function paletteFor(config) {
  return TONE_PALETTES[config.palette]?.[config.tone] || PALETTES[config.palette];
}
