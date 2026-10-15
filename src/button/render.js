function paintIcon(svg, library, name, motion) {
  const asset = ICON_CATALOG[library].icons[name];
  svg.setAttribute('viewBox', asset.viewBox);
  svg.dataset.motion = motion;
  svg.dataset.glyph = name;
  svg.replaceChildren(
    ...asset.paths.map(attributes => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', attributes.d);
      return path;
    }),
  );
}
function createButtonIcon(icon) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'btx-icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('fill', 'currentColor');
  paintIcon(svg, icon.library, icon.name, icon.motion);
  return svg;
}
function syncButtonIcon(button, busy) {
  const svg = button.querySelector('.btx-icon');
  if (svg)
    paintIcon(
      svg,
      button.dataset.iconLibrary,
      busy ? 'loading' : button.dataset.iconName,
      busy ? 'spin' : button.dataset.iconMotion,
    );
}
function iconMapping(config) {
  if (config.icon.name === 'none') return null;
  const library = ICON_CATALOG[config.icon.library],
    asset = library.icons[config.icon.name];
  return {
    library: config.icon.library,
    source_package: library.package,
    source_version: library.version,
    react_package: asset.react_package,
    component: asset.component,
    position: config.icon.position,
    motion: config.icon.motion,
    antd_icon_placement: { left: 'start', right: 'end' }[config.icon.position] || null,
    custom_stack: ['top', 'bottom'].includes(config.icon.position),
    loading_component: library.icons.loading.component,
  };
}
function iconLicenseMarkup() {
  return (
    '<!--\n' +
    Object.values(ICON_CATALOG)
      .map(l => l.label + ' / ' + l.package + '@' + l.version + '\n' + l.license)
      .join('\n\n')
      .replace(/-->/g, '--&gt;') +
    '\n-->'
  );
}
function applyButtonState(b, state, label) {
  const status = buttonStatus(state);
  b.dataset.force = status.value;
  b.dataset.status = status.kind;
  b.dataset.busy = String(status.busy);
  delete b.dataset.keyPressed;
  b.disabled = status.blocked && !status.busy;
  for (const attr of ['aria-busy', 'aria-disabled']) b.removeAttribute(attr);
  if (status.busy) b.setAttribute('aria-busy', 'true');
  if (status.blocked) b.setAttribute('aria-disabled', 'true');
  const content = b.querySelector('.btx-label');
  const authored = b.dataset.userLabel === 'true' && !status.text;
  if (authored) content.setAttribute('data-i18n-ignore', '');
  else content.removeAttribute('data-i18n-ignore');
  content.textContent = status.text ? t(status.text) : authored ? label : t(label);
  syncButtonIcon(b, status.busy);
}
function buttonFor(raw, state = 'default', label = 'Continue', options = {}) {
  const c = safeConfig(raw),
    p = paletteFor(c),
    timing = interactionTiming(c),
    b = element('button', 'btx');
  b.type = 'button';
  if (arguments.length >= 3 && !options.localizeLabel) b.dataset.userLabel = 'true';
  for (const a of AXES) b.dataset[a.key] = c[a.key];
  const textSurface = ['text', 'link'].includes(c.fill);
  if (textSurface) {
    // Keep the frozen legacy CSS consumer compatible with the new public fills.
    b.dataset.fill = 'ghost';
    b.dataset.semanticFill = c.fill;
    b.dataset.detail = 'none';
    b.style.setProperty('--edgew', '0px');
    if (c.fill === 'link') b.style.textDecoration = 'underline';
  }
  b.dataset.force = state;
  for (const [key, value] of Object.entries(c.icon))
    b.dataset['icon' + key[0].toUpperCase() + key.slice(1)] = value;
  const radius = buttonVariant('radius', c.radius),
    size = buttonVariant('size', c.size),
    shadow = buttonVariant('shadow', c.shadow);
  const vars = {
    '--bc': p.color,
    '--bd': p.dark,
    '--bt': p.tint,
    '--shadow-accent-rgb': rgb(c.customColors?.bg || p.color).join(','),
    '--solidtext': solidText(p.color),
    '--surface-ink':
      contrast(p.dark, p.tint) >= 4.5 && contrast(p.dark, '#ffffff') >= 4.5
        ? p.dark
        : PALETTES[c.palette].dark,
    '--transparent-ink': c.tone === 'middle' ? 'var(--bc)' : 'var(--ink)',
    '--shade': p.dark,
    '--h': size.height_px + 'px',
    '--pad': size.padding_inline_px + 'px',
    '--sh': shadow.css,
    '--sh-pressed': shadow.pressed_css || 'none',
    '--lip-color': edgeColor(p.dark),
    '--press-duration': timing.press_ms + 'ms',
    '--release-duration': timing.release_ms + 'ms',
    '--r': c.shape === 'tab' ? radius.css + ' ' + radius.css + ' 0 0' : radius.css,
    '--corner': radius.css,
  };
  for (const [k, v] of Object.entries(vars)) b.style.setProperty(k, v);
  if (c.customColors) {
    for (const [key, val] of Object.entries(c.customColors))
      b.style.setProperty({ bg: '--bg', fg: '--fg', edge: '--edge' }[key], val);
  }
  if (c.detail === 'bottomedge' && !textSurface) {
    for (const name of ['btx-hitarea', 'btx-lip']) {
      const layer = element('span', name);
      layer.setAttribute('aria-hidden', 'true');
      b.append(layer);
    }
  }
  if (c.icon.name !== 'none') b.append(createButtonIcon(c.icon));
  const progress = element('span', 'btx-progress');
  progress.setAttribute('aria-hidden', 'true');
  b.append(element('span', 'btx-label', label, { localize: false }), progress);
  applyButtonState(b, state, label);
  return b;
}
