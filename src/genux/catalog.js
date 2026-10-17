function buildDecisionChoices(root, key, variants) {
  const field = element('fieldset', 'variant-control');
  field.append(
    element(
      'legend',
      '',
      axisMap[key].name +
        ' · ' +
        variants.length +
        (['shadow', 'tone'].includes(key) ? ' experiment' : ' decision'),
    ),
  );
  const choices = element('div', 'variant-choices');
  choices.id = key + 'Choices';
  for (const variant of variants) {
    const b = element('button', 'plain', variant.label);
    b.type = 'button';
    b.dataset[key] = variant.value;
    if (key === 'shadow') {
      b.className += ' shadow-choice';
      const sample = element('span', 'shadow-swatch');
      sample.setAttribute('aria-hidden', 'true');
      sample.style.setProperty('--choice-shadow', variant.css);
      b.replaceChildren(sample, element('span', 'shadow-choice-label', variant.label));
    }
    b.onclick = () => {
      current = safeConfig({ ...current, [key]: variant.value });
      currentName = 'Custom combination';
      if (key === 'shadow') setStudioDemoState('default');
      updateControls();
      renderStudio();
    };
    choices.append(b);
  }
  field.append(choices);
  root.append(field);
  updateDecisionChoices(key);
}
function updateDecisionChoices(key) {
  for (const b of $(key + 'Choices').children) {
    b.setAttribute('aria-pressed', String(b.dataset[key] === current[key]));
    if (key === 'shadow')
      b.querySelector('.shadow-swatch').style.setProperty(
        '--shadow-accent-rgb',
        rgb(current.customColors?.bg || paletteFor(current).color).join(','),
      );
  }
}
function renderDecisionVariants(id, key, variants, reference) {
  const root = $(id);
  root.replaceChildren();
  if (key === 'width') {
    const wide = variants.find(variant => variant.value === 'wide');
    root.style.gridTemplateColumns = `repeat(auto-fit,minmax(min(100%,calc(${wide.min_width_px}px + 4 * var(--decision-gap))),1fr))`;
  }
  for (const variant of variants) {
    const config = { ...reference, [key]: variant.value },
      figure = element('figure', 'decision-option'),
      stage = element('div', 'spec-stage'),
      b = buttonFor(config);
    b.setAttribute('aria-label', variant.label + ': Continue');
    stage.append(b);
    const caption = element('figcaption');
    caption.append(element('strong', '', variant.label));
    const use = element('button', 'text-action', 'Use in studio');
    use.type = 'button';
    use.onclick = event =>
      loadStudio(config, 'Approved button · ' + variant.label, event?.detail === 0);
    caption.append(use);
    figure.append(stage, caption);
    root.append(figure);
  }
}
function renderDecisions() {
  const reference = PRESETS.find(p => p.name === 'Lower lip').config;
  renderDecisionVariants(
    'decisionRadiusGrid',
    'radius',
    BUTTON_DECISIONS.radius_variants,
    reference,
  );
  renderDecisionVariants('decisionBorderGrid', 'border', BUTTON_DECISIONS.border_variants, {
    ...BASE,
    fill: 'white',
    palette: 'coral',
    radius: '5',
  });
  renderDecisionVariants('decisionSizeGrid', 'size', BUTTON_DECISIONS.size_variants, reference);
  renderDecisionVariants('decisionWidthGrid', 'width', BUTTON_DECISIONS.width_variants, reference);
  renderDecisionVariants(
    'decisionTrackingGrid',
    'tracking',
    BUTTON_DECISIONS.tracking_variants,
    reference,
  );
  const states = $('decisionStateGrid');
  states.replaceChildren();
  for (const variant of BUTTON_DECISIONS.state_variants) {
    const figure = element('figure', 'decision-option'),
      stage = element('div', 'spec-stage'),
      caption = element('figcaption');
    stage.append(buttonFor(reference, variant.value));
    caption.append(element('strong', '', variant.label));
    figure.append(stage, caption);
    states.append(figure);
  }
  const opacity = $('decisionOpacityGrid');
  opacity.replaceChildren();
  for (const [state, label, value] of [
    ['default', 'Normal', BUTTON_DECISIONS.opacity.normal],
    ['hover', 'Hover', BUTTON_DECISIONS.opacity.hover],
  ]) {
    const figure = element('figure', 'decision-option'),
      stage = element('div', 'spec-stage');
    stage.append(buttonFor(reference, state));
    const caption = element('figcaption');
    caption.append(element('strong', '', label + ' · ' + value.toFixed(1).replace('.', ',')));
    figure.append(stage, caption);
    opacity.append(figure);
  }
}
function renderHero() {
  const reference = PRESETS[0].config;
  for (const [state, label] of [
    ['default', 'Normal'],
    ['hover', 'Hover'],
    ['pressed', 'Pressed'],
    ['loading', 'Processing'],
  ]) {
    const cell = element('div', 'hero-item');
    cell.append(buttonFor(reference, state), element('small', '', label));
    $('heroBoard').append(cell);
  }
}

function persist() {
  try {
    localStorage.setItem('buton-genuxi-v1', JSON.stringify(selected));
  } catch {}
  $('savedBadge').textContent = selected.length;
}
function fingerprint(c) {
  return JSON.stringify(safeConfig(c));
}
function saveSelection(config, name) {
  if (selected.some(s => fingerprint(s.config) === fingerprint(config))) {
    toast('This design is already in the comparison.');
    return;
  }
  if (selected.length >= 4) {
    toast('Up to four designs. Remove a selection first.');
    return;
  }
  selected.push({
    id: 'saved-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    name,
    config: safeConfig(config),
  });
  persist();
  renderGallery();
  renderCompare();
  toast('Design added to the comparison.');
}
function removeSelection(id) {
  selected = selected.filter(s => s.id !== id);
  persist();
  renderGallery();
  renderCompare();
}
function renderFilters() {
  const root = $('familyFilters');
  if (root.children.length) {
    for (const button of root.children)
      button.setAttribute('aria-pressed', String(button.dataset.family === family));
    return;
  }
  for (const f of FAMILIES) {
    const b = element('button', 'pill', f);
    b.type = 'button';
    b.dataset.family = f;
    b.setAttribute('aria-pressed', String(f === family));
    b.onclick = () => {
      family = f;
      renderFilters();
      renderGallery();
    };
    $('familyFilters').append(b);
  }
}
function renderGallery() {
  const items = PRESETS.filter(
    p =>
      (family === 'All' || p.family === family) &&
      (!search ||
        [
          p.name,
          p.description,
          p.family,
          ...AXES.map(a => labelFor(a.key, safeConfig(p.config)[a.key])),
        ]
          .map(value => value + ' ' + (Object.hasOwn(GENUX_TR, value) ? GENUX_TR[value] : value))
          .join(' ')
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/ı/g, 'i')
          .toLocaleLowerCase('en-US')
          .includes(search)),
  );
  const grid = $('galleryGrid');
  grid.replaceChildren();
  $('galleryCount').textContent = items.length + ' / ' + PRESETS.length + ' styles shown';
  if (!items.length) {
    grid.append(element('div', 'empty', 'No styles found for this search.'));
    return;
  }
  for (const p of items) {
    const saved = selected.find(s => fingerprint(s.config) === fingerprint(p.config));
    const card = element('article', 'spec-card' + (saved ? ' saved' : ''));
    const stage = element('div', 'spec-stage' + (p.stage !== 'auto' ? ' ' + p.stage : ''));
    const b = buttonFor(p.config, galleryState);
    b.setAttribute('aria-label', p.name + ': ' + b.textContent);
    b.onclick = () => {
      toast(p.name + ' · ' + labelFor('press', p.config.press));
    };
    stage.append(b);
    const info = element('div', 'card-info');
    const top = element('div', 'card-top');
    top.append(
      element('h3', '', p.name),
      element('span', 'card-number', String(PRESETS.indexOf(p) + 1).padStart(2, '0')),
    );
    info.append(top, element('p', '', p.description));
    const actions = element('div', 'card-actions');
    const use = element('button', 'text-action', 'Open in studio');
    use.type = 'button';
    use.onclick = event => loadStudio(p.config, p.name, event?.detail === 0);
    const add = element('button', 'text-action', saved ? 'Remove selection' : 'Compare');
    add.type = 'button';
    add.setAttribute('aria-pressed', String(!!saved));
    add.onclick = () => (saved ? removeSelection(saved.id) : saveSelection(p.config, p.name));
    actions.append(use, add);
    info.append(actions);
    card.append(stage, info);
    grid.append(card);
  }
}
function renderPrimitives() {
  let count = 0;
  for (const a of AXES) {
    count += a.options.length;
    const link = element('a', '', a.name);
    link.href = '#axis-' + a.key;
    $('axisJump').append(link);
    const section = element('section', 'axis-section');
    section.id = 'axis-' + a.key;
    const head = element('div', 'axis-header');
    const text = element('div');
    text.append(element('h3', '', a.name + ' · ' + a.english), element('p', '', a.explain));
    head.append(text, element('strong', '', String(a.options.length)));
    section.append(head);
    const examples = element('div', 'axis-examples');
    for (const [value, label] of a.options) {
      let conf = { ...BASE, [a.key]: value },
        state = 'default';
      if (a.key === 'border') conf.fill = 'white';
      if (a.key === 'shadow') conf = { ...conf, fill: 'white', border: 'hairline' };
      if (a.key === 'press') conf.detail = 'bottomedge';
      if (a.key === 'width') conf.fill = 'tint';
      if (a.key === 'hover') state = 'hover';
      if (a.key === 'press') state = 'pressed';
      if (a.key === 'duration' || a.key === 'easing') {
        conf.hover = 'opacity';
        conf.shadow = 'soft';
        if (a.key === 'easing') conf.duration = 'deliberate';
      }
      const cell = element('div', 'axis-example');
      const stage = element('div', 'spec-stage');
      const b = buttonFor(conf, state);
      stage.append(b);
      const pick = element('button', 'axis-pick', 'Apply to studio');
      pick.type = 'button';
      pick.onclick = event => {
        const next = { ...current, [a.key]: value };
        if (a.key === 'shadow') setStudioDemoState('default');
        loadStudio(next, a.name + ': ' + label, event?.detail === 0);
      };
      cell.append(stage, element('p', '', label));
      if (['duration', 'easing'].includes(a.key)) {
        const play = element('button', 'axis-pick', 'Play transition');
        play.type = 'button';
        play.onclick = () => {
          b.dataset.force = 'default';
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              b.dataset.force = 'hover';
              setTimeout(() => (b.dataset.force = 'default'), 850);
            }),
          );
        };
        cell.append(play);
      }
      cell.append(pick);
      examples.append(cell);
    }
    section.append(examples);
    $('primitiveGrid').append(section);
  }
  $('primitiveCount').textContent = count;
}
