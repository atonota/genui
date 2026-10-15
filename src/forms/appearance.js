function applyFormAppearance() {
  const root = $('formLab'),
    radius = buttonVariant('radius', formAppearance.radius),
    size = buttonVariant('size', formAppearance.size),
    p = paletteFor(formAppearance),
    base = PALETTES[formAppearance.palette],
    controlSize = FORM_EXPERIMENTS.control_sizes[formAppearance.size];
  for (const [key, value] of Object.entries(formAppearance)) root.dataset[key] = value;
  for (const [key, value] of Object.entries({
    '--ff-radius': radius.css,
    '--ff-height': size.height_px + 'px',
    '--ff-fill': p.color,
    '--ff-on-fill': solidText(p.color),
    '--ff-edge': edgeColor(p.dark),
    '--ff-tint': p.tint,
    '--ff-tone-ink': base.dark,
    '--ff-focus-light': base.dark,
    '--ff-focus-dark': TONE_PALETTES[formAppearance.palette].light.color,
  }))
    root.style.setProperty(key, value);
  for (const [key, value] of Object.entries({
    '--ff-choice-size': controlSize.choice,
    '--ff-switch-width': controlSize.track,
    '--ff-switch-height': controlSize.track_height,
    '--ff-knob': controlSize.knob,
    '--ff-knob-travel': controlSize.travel,
  }))
    root.style.setProperty(key, value + 'px');
  for (const choice of root.querySelectorAll('[data-ff-setting]'))
    choice.setAttribute(
      'aria-pressed',
      String(formAppearance[choice.dataset.ffSetting] === choice.dataset.ffValue),
    );
}
function buildFormSettings() {
  const root = $('ff-settings');
  const settings = [
    ['size', 'Height', FORM_EXPERIMENTS.sizes.map(v => [v.value, v.label])],
    ['radius', 'Radius', FORM_EXPERIMENTS.radius.map(v => [v.value, v.label])],
    ['surface', 'Surface', FORM_EXPERIMENTS.surfaces],
    ['tone', 'Color tone', FORM_EXPERIMENTS.tones.map(v => [v.value, v.label])],
    ['palette', 'Color family', axisMap.palette.options],
  ];
  for (const [key, label, choices] of settings) {
    const group = element('fieldset', 'ff-setting');
    group.append(element('legend', '', label));
    const list = element('div', 'ff-setting-choices');
    for (const [value, text] of choices) {
      const button = element('button', '', text);
      button.id = 'ff-' + key + '-' + value;
      button.type = 'button';
      button.dataset.ffSetting = key;
      button.dataset.ffValue = value;
      button.onclick = () => {
        formAppearance[key] = value;
        applyFormAppearance();
      };
      list.append(button);
    }
    group.append(list);
    root.append(group);
  }
}
