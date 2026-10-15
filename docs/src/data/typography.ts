/** Documentation typography: explicit user decision of 14 October 2026. */
export const docsTypography = {
  fontFamily: 'Outfit, ui-sans-serif, system-ui, sans-serif',
  fontSize: 14,
  fontSizeSM: 14,
  fontSizeLG: 16,
  fontSizeXL: 20,
  lineHeight: 22 / 14,
  lineHeightPx: 22,
  fontWeight: 400,
  minFontWeight: 300,
} as const;

export const docsTypographyVariables = {
  '--font-body': docsTypography.fontFamily,
  '--text': `${docsTypography.fontSize}px`,
  '--text-large': `${docsTypography.fontSizeLG}px`,
  '--text-section': '24px',
  '--text-title': 'clamp(30px,5vw,38px)',
  '--text-subsection': `${docsTypography.fontSizeXL}px`,
  '--heading-line-height': '46px',
  '--section-line-height': '32px',
  '--subsection-line-height': '28px',
  '--line-height': String(docsTypography.lineHeight),
  '--font-weight-body': String(docsTypography.fontWeight),
  '--font-weight-min': String(docsTypography.minFontWeight),
  '--font-weight-light': String(docsTypography.minFontWeight),
  '--font-weight-label': String(docsTypography.fontWeight),
  '--font-weight-medium': String(docsTypography.fontWeight),
} as const;

/** Reset inherited documentation variables only on an explicit approved child. */
export const approvedTypographyVariables = {
  '--text': '1rem',
  '--text-large': 'initial',
  '--text-section': '1.5rem',
  '--text-title': 'clamp(2rem,5vw,3.5rem)',
  '--text-subsection': 'initial',
  '--heading-line-height': 'initial',
  '--section-line-height': 'initial',
  '--subsection-line-height': 'initial',
  '--line-height': '1.6',
  '--font-weight-body': 'initial',
  '--font-weight-min': 'initial',
  '--font-weight-light': 'initial',
  '--font-weight-label': 'initial',
  '--font-weight-medium': 'initial',
} as const;

// Body scope reaches documentation portals; provider variables also serve embeds.
// Approved Storybook/standalone profiles retain their separately approved typography.
export const docsTypographyStyleText = `
body[data-atlas-surface='docs'],.atlas-demo[data-atlas-appearance='docs'] {
  ${Object.entries(docsTypographyVariables)
    .map(([name, value]) => `${name}:${value};`)
    .join('\n  ')}
  font-family: var(--font-body);
  font-weight: var(--font-weight-body);
}`;
