function buildIconControls(root) {
  const options = BUTTON_EXPERIMENTS.icon_options;
  for (const [key, title] of [
    ['library', 'Icon library'],
    ['name', 'Icon'],
    ['position', 'Icon position'],
    ['motion', 'Icon motion'],
  ]) {
    const field = element('fieldset', 'variant-control icon-control');
    field.append(element('legend', '', title + ' · experiment'));
    const choices = element('div', 'variant-choices');
    choices.id = 'icon' + key[0].toUpperCase() + key.slice(1) + 'Choices';
    for (const option of options[key]) {
      const choice = element('button', 'plain', option.label);
      choice.type = 'button';
      choice.dataset.value = option.value;
      choice.onclick = () => {
        const icon = { ...current.icon, [key]: option.value };
        if (key === 'position' && icon.name === 'none') icon.name = 'arrowRight';
        if (key === 'motion' && icon.name === 'none' && icon.motion !== 'static')
          icon.name = icon.motion === 'spin' ? 'loading' : 'check';
        current = safeConfig({ ...current, icon });
        currentName = 'Custom combination';
        updateIconControls();
        renderStudio();
      };
      choices.append(choice);
    }
    field.append(choices);
    root.append(field);
  }
  updateIconControls();
}
function updateIconControls() {
  for (const key of ['library', 'name', 'position', 'motion']) {
    const root = $('icon' + key[0].toUpperCase() + key.slice(1) + 'Choices');
    if (root)
      for (const choice of root.children)
        choice.setAttribute('aria-pressed', String(choice.dataset.value === current.icon[key]));
  }
}
function renderIconTrials() {
  const root = $('iconTrialGrid');
  root.replaceChildren();
  for (const library of ['phosphor', 'antd']) {
    const examples = BUTTON_EXPERIMENTS.icon_options.position.map(p => ({
      icon: {
        ...current.icon,
        library,
        name: current.icon.name === 'none' ? 'arrowRight' : current.icon.name,
        position: p.value,
      },
      label: p.label,
    }));
    for (const [name, motion, label] of [
      ['arrowRight', 'static', 'Static'],
      ['loading', 'spin', 'Loader / spin'],
      ['check', 'pulse', 'Gentle pulse'],
    ])
      examples.push({ icon: { library, name, position: current.icon.position, motion }, label });
    for (const example of examples) {
      const figure = element('figure', 'decision-option'),
        stage = element(
          'div',
          'spec-stage' + ($('stageSelect').value !== 'auto' ? ' ' + $('stageSelect').value : ''),
        );
      stage.append(
        bindOperationDemo(
          buttonFor({ ...current, icon: example.icon }, studioState, currentText()),
        ),
      );
      const caption = element('figcaption');
      caption.append(element('strong', '', ICON_CATALOG[library].label + ' · ' + example.label));
      figure.append(stage, caption);
      root.append(figure);
    }
  }
}
function buildControls() {
  const root = $('studioControls');
  const label = element('label', 'control');
  label.htmlFor = 'buttonText';
  label.append(element('span', 'control-label', 'Button text'));
  const input = element('input');
  input.id = 'buttonText';
  input.type = 'text';
  input.value = 'Continue';
  input.maxLength = 24;
  input.oninput = () => renderStudio();
  label.append(input);
  root.append(label);
  for (const a of AXES) {
    if (['radius', 'border', 'size', 'shadow', 'tone', 'tracking'].includes(a.key)) {
      buildDecisionChoices(root, a.key, BUTTON_VARIANTS[a.key]);
      continue;
    }
    const row = element('label', 'control');
    row.htmlFor = 'select-' + a.key;
    const title = element('span', 'control-label', a.name);
    title.append(element('small', '', a.options.length + ' options'));
    row.append(title);
    const select = element('select');
    select.id = 'select-' + a.key;
    for (const [v, t] of a.options) {
      const option = element('option', '', t);
      option.value = v;
      select.append(option);
    }
    select.value = current[a.key];
    select.title = a.explain;
    select.onchange = () => {
      current = safeConfig({ ...current, [a.key]: select.value });
      currentName = 'Custom combination';
      updateControls();
      renderStudio();
    };
    row.append(select);
    root.append(row);
  }
  buildIconControls(root);
}
function updateControls() {
  for (const a of AXES) {
    if (['radius', 'border', 'size', 'shadow', 'tone', 'tracking'].includes(a.key))
      updateDecisionChoices(a.key);
    else {
      const select = $('select-' + a.key);
      select.value = current[a.key];
      if (a.key === 'shape')
        for (const option of select.children)
          option.disabled = option.value === 'tab' && current.radius === 'pill';
    }
  }
  updateIconControls();
  syncAdvanced();
}
function loadStudio(config, name, keyboard = false) {
  current = safeConfig(config);
  currentName = name;
  updateControls();
  showTab('studio', keyboard);
  $('liveTitle').textContent = currentName;
  document.querySelector('.tabbar').scrollIntoView({ block: 'start', behavior: 'auto' });
}
function currentText() {
  return $('buttonText').value.trim() || 'Continue';
}
// Export schema compatibility: translated axis names must never rename these keys.
const LEGACY_RECIPE_EXPLANATION_KEYS = Object.freeze({
  fill: 'Yüzey',
  palette: 'Renk ailesi',
  tone: 'Renk tonu',
  border: 'Kenarlık',
  shadow: 'Derinlik ve gölge',
  radius: 'Köşe dili',
  shape: 'Geometri',
  size: 'Yükseklik ve iç boşluk',
  width: 'En ve oran',
  detail: 'Yüzey detayı',
  hover: 'Üzerine gelince',
  press: 'Basılınca',
  duration: 'Geçiş süresi',
  easing: 'Zaman eğrisi',
  tracking: 'Harf aralığı',
});
function exportedRecipe() {
  const timing = interactionTiming(current);
  return {
    ad: currentName,
    metin: currentText(),
    yaklasim: 'Semi-flat / Flat 2.0',
    gradient: false,
    ikon: current.icon.name === 'none' ? false : { ...current.icon },
    kararlar: BUTTON_DECISIONS,
    denemeler: BUTTON_EXPERIMENTS,
    secili_durum: studioState,
    antd: buildAntdRecipe(current, studioState),
    etkilesim: {
      normal_opaklik: 0.9,
      hover_opaklik: 1,
      govde_hareketi: false,
      basma_mesafesi_px: 0,
      alt_kenar_uzamasi_px: current.detail === 'bottomedge' ? 4 : 0,
      ust_kenar_sabit: true,
      metin_sabit: true,
      metin_hizalama: 'toplam_govde_ortasi',
      hover_hareketi: false,
      zemin_sabit: true,
      gecis_egrisi: timing.easing,
      basma_ms: timing.press_ms,
      birakma_ms: timing.release_ms,
      basili_golge: buttonVariant('shadow', current.shadow).pressed_css || 'none',
      islem_akisi: 'release → processing → demo result',
      basili_ust_serit_px: current.detail === 'bottomedge' ? 2 : 0,
      ust_yuzey_ice_cekilmesi_px: current.detail === 'bottomedge' ? 2 : 0,
      ust_serit_govde_icinde: true,
      ust_serit_tetik: current.detail === 'bottomedge' ? 'alt_serit_ortuldukten_sonra' : 'yok',
    },
    tasarim: safeConfig(current),
    aciklama: Object.fromEntries(
      AXES.map(a => [LEGACY_RECIPE_EXPLANATION_KEYS[a.key], labelFor(a.key, current[a.key])]),
    ),
    renkler: paletteFor(current),
    not: 'This is a visual design recipe. Verify interaction, contrast and focus on the target surface.',
  };
}
let demoEpoch = 0,
  demoRunning = false,
  demoTimers = [];
const heldDemoKeys = new Map();
function cancelHeldDemoKeys() {
  for (const cancel of [...heldDemoKeys.values()]) cancel(true);
}
function setStudioDemoState(state) {
  studioState = state;
  for (const id of ['liveStage', 'mobileStudioPreview', 'iconTrialGrid']) {
    const root = $(id);
    if (root)
      for (const b of root.querySelectorAll('.btx')) applyButtonState(b, state, currentText());
  }
  for (const choice of $('studioStates').children)
    if (choice.dataset.state)
      choice.setAttribute('aria-pressed', String(choice.dataset.state === state));
  $('recipeOutput').textContent = JSON.stringify(exportedRecipe(), null, 2);
  requestAnimationFrame(() => {
    const live = $('liveButton');
    if (live) updatePreviewReadout(live);
  });
}
function cancelOperationDemo() {
  cancelHeldDemoKeys();
  demoEpoch++;
  for (const timer of demoTimers) clearTimeout(timer);
  demoTimers = [];
  if (demoRunning) {
    demoRunning = false;
    setStudioDemoState('default');
    $('demoStatus').textContent = 'Operation demo cancelled; no data was sent.';
  }
}
function startOperationDemo(button) {
  if (
    demoRunning ||
    !$('demoProcessingOn').checked ||
    button.disabled ||
    button.getAttribute('aria-disabled') === 'true' ||
    button.isConnected === false
  )
    return;
  const epoch = ++demoEpoch,
    options = BUTTON_EXPERIMENTS.operation_demo;
  demoRunning = true;
  setStudioDemoState('loading');
  $('demoStatus').textContent = 'Demo processing; no data is being sent.';
  demoTimers.push(
    setTimeout(() => {
      if (epoch !== demoEpoch) return;
      setStudioDemoState('success');
      $('demoStatus').textContent = 'Demo completed; no data was sent.';
      demoTimers.push(
        setTimeout(() => {
          if (epoch !== demoEpoch) return;
          demoRunning = false;
          demoTimers = [];
          setStudioDemoState('default');
        }, options.result_ms),
      );
    }, options.processing_ms),
  );
}
function bindOperationDemo(button) {
  let heldKey = null,
    pendingClick = false,
    cancelKeyboardClick = false;
  const clearHeld = (cancel = false) => {
    if (cancel && heldKey) cancelKeyboardClick = true;
    heldKey = null;
    pendingClick = false;
    delete button.dataset.keyPressed;
    heldDemoKeys.delete(button);
  };
  button.onkeydown = event => {
    if (
      !['Enter', ' '].includes(event.key) ||
      event.altKey ||
      event.metaKey ||
      event.ctrlKey ||
      button.disabled ||
      button.getAttribute('aria-disabled') === 'true' ||
      event.repeat
    )
      return;
    cancelKeyboardClick = false;
    heldKey = event.key;
    button.dataset.keyPressed = 'true';
    heldDemoKeys.set(button, clearHeld);
  };
  button.onkeyup = event => {
    if (event.key !== heldKey) return;
    const activate = pendingClick;
    clearHeld();
    if (activate) startOperationDemo(button);
  };
  button.onclick = event => {
    if (cancelKeyboardClick && event?.detail === 0) {
      cancelKeyboardClick = false;
      return;
    }
    if (heldKey) {
      pendingClick = true;
      return;
    }
    startOperationDemo(button);
  };
  button.ontransitionend = event => {
    if (
      button.id === 'liveButton' &&
      event.target === button &&
      ['color', 'background-color'].includes(event.propertyName)
    )
      updatePreviewReadout(button);
  };
  button.onpointerdown = () => {
    cancelKeyboardClick = false;
    clearHeld();
  };
  button.onblur = () => clearHeld(true);
  button.onpointercancel = () => clearHeld(true);
  return button;
}
function renderShadowTrials() {
  const root = $('shadowTrialGrid');
  root.replaceChildren();
  for (const shadow of BUTTON_VARIANTS.shadow) {
    const figure = element('figure', 'decision-option');
    figure.append(element('strong', '', shadow.label));
    for (const [state, label] of [
      ['default', 'Normal'],
      ['pressed', 'Pressed'],
    ]) {
      const stage = element(
          'div',
          'spec-stage' + ($('stageSelect').value !== 'auto' ? ' ' + $('stageSelect').value : ''),
        ),
        button = buttonFor({ ...current, shadow: shadow.value }, state, currentText());
      button.setAttribute('aria-label', shadow.label + ' · ' + label);
      stage.append(button);
      figure.append(stage, element('small', '', label));
    }
    root.append(figure);
  }
}
function renderStudio() {
  cancelOperationDemo();
  updateDecisionChoices('shadow');
  const timing = interactionTiming(current);
  $('interactionReadout').textContent =
    'Press: ' + timing.press_ms + ' ms · Release: ' + timing.release_ms + ' ms';
  const label = currentText(),
    stage = $('liveStage');
  stage.className =
    'live-stage spec-stage' +
    ($('stageSelect').value !== 'auto' ? ' ' + $('stageSelect').value : '');
  const b = buttonFor(current, studioState, label);
  b.id = 'liveButton';
  bindOperationDemo(b);
  stage.replaceChildren(b);
  $('liveTitle').textContent = currentName;
  const mobile = $('mobileStudioPreview');
  if (mobile) {
    const copy = bindOperationDemo(buttonFor(current, studioState, label));
    mobile.replaceChildren(element('small', '', 'Live preview'), copy);
  }
  renderShadowTrials();
  renderIconTrials();
  const grid = $('studioStateGrid');
  grid.replaceChildren();
  for (const [s, l] of STATES) {
    const cell = element('div', 'state-cell');
    const sample = element('div', 'spec-stage');
    const sb = buttonFor(current, s, label);
    sample.append(sb);
    cell.append(sample, element('small', '', l));
    grid.append(cell);
  }
  $('recipeOutput').textContent = JSON.stringify(exportedRecipe(), null, 2);
  const warnings = [];
  if (current.customColors)
    warnings.push(
      'Custom colors are enabled: surface and text colors override the palette. Transparent recipes also become filled; check contrast on the selected background.',
    );
  const note = $('compatibilityNote');
  note.hidden = !warnings.length;
  note.replaceChildren();
  if (warnings.length) {
    note.append(element('strong', '', 'Check compatibility'));
    for (const w of warnings) note.append(element('p', '', w));
  }
  requestAnimationFrame(() => updatePreviewReadout(b));
}
