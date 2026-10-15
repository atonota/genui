function sharedMotionRequirement() {
  return {
    scope: ':root',
    tokens: {
      '--motion-easing': $('atlas-styles').textContent.match(/--motion-easing:([^;]+)/)[1],
    },
    animated_descendants:
      'Apply var(--motion-easing) to each transition and animation, including the child loading icon: animation-timing-function does not inherit.',
  };
}
function buildAntdRecipe(raw, state = 'default') {
  const c = safeConfig(raw),
    p = paletteFor(c),
    timing = interactionTiming(c),
    size = buttonVariant('size', c.size),
    width = buttonVariant('width', c.width),
    radius = buttonVariant('radius', c.radius),
    status = buttonStatus(state);
  const shadow = buttonVariant('shadow', c.shadow),
    shadowValue =
      status.blocked && !status.busy
        ? 'none'
        : status.value === 'pressed' && c.press === 'flatten'
          ? shadow.pressed_css || 'none'
          : shadow.css;
  const sizeProps = c.size === 'sm' ? { size: 'small' } : c.size === 'lg' ? { size: 'large' } : {},
    sizes = Object.fromEntries(BUTTON_DECISIONS.size_variants.map(v => [v.value, v]));
  return {
    runtime: 'implementation mapping; standalone preview is not React antd',
    configProvider: {
      wave: { disabled: true },
      theme: {
        token: {
          fontFamily: 'Outfit, sans-serif',
          fontSize: 16,
          colorPrimary: p.color,
          colorPrimaryHover: p.color,
          colorPrimaryActive: p.dark,
          borderRadius: 5,
          borderRadiusSM: 3,
          borderRadiusLG: 5,
          controlHeightSM: sizes.sm.height_px,
          controlHeight: sizes.md.height_px,
          controlHeightLG: sizes.lg.height_px,
          lineWidthFocus: 0,
        },
        components: {
          Button: {
            primaryColor: solidText(p.color),
            paddingInlineSM: sizes.sm.padding_inline_px,
            paddingInline: sizes.md.padding_inline_px,
            paddingInlineLG: sizes.lg.padding_inline_px,
            contentFontSize: 16,
            contentFontSizeSM: 16,
            contentFontSizeLG: 16,
            defaultShadow: 'none',
            primaryShadow: 'none',
            dangerShadow: 'none',
          },
        },
      },
    },
    button: {
      props: {
        ...sizeProps,
        color: 'primary',
        htmlType: 'button',
        shape: c.radius === 'pill' && c.shape !== 'tab' ? 'round' : 'default',
        variant: {
          solid: 'solid',
          tint: 'filled',
          outline: 'outlined',
          text: 'text',
          link: 'link',
        }[c.fill],
        block: c.width === 'full',
        loading: status.busy,
        disabled: status.blocked && !status.busy,
      },
      styles: {
        root: {
          letterSpacing: BUTTON_DECISIONS.tracking_variants[0].letter_spacing_px + 'px',
          transitionTimingFunction: timing.easing,
          animationTimingFunction: timing.easing,
          boxShadow: shadowValue,
          minHeight: size.height_px,
          height: 'auto',
          paddingInline: size.padding_inline_px,
          ...(c.width === 'wide' ? { minWidth: `min(100%, ${width.min_width_px}px)` } : {}),
          borderRadius: c.shape === 'tab' ? radius.css + ' ' + radius.css + ' 0 0' : radius.css,
          fontSize: '1rem',
        },
        content: { fontSize: '1rem' },
      },
      state: status,
    },
    shared_styles_required: BUTTON_DECISIONS.implementation.shared_styles,
    font_loading_required: {
      family: 'Outfit',
      stylesheet_id: 'atlas-styles',
      source_url:
        'https://fonts.google.com/specimen/Outfit?preview.script=Latn&preview.lang=tr_Latn',
      instruction:
        'Reuse the embedded @font-face (100–900, SIL OFL 1.1) or load Outfit explicitly; fontFamily alone does not load the font.',
    },
    shared_motion_required: sharedMotionRequirement(),
    shadow_experiment: c.shadow,
    icon_mapping: iconMapping(c),
    interaction_timing: timing,
    shadow_states: {
      normal: buttonVariant('shadow', c.shadow).css,
      pressed: buttonVariant('shadow', c.shadow).pressed_css || 'none',
    },
  };
}
