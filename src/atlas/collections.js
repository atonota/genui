function renderBehavior() {
  const root = $('behaviorGrid');
  root.replaceChildren();
  const explanations = Object.fromEntries(BUTTON_VARIANTS.state.map(v => [v.value, v.description]));
  for (const [s, l] of STATES) {
    const card = element('article', 'spec-card'),
      stage = element('div', 'spec-stage');
    const b = buttonFor(behaviorConfig, s);
    stage.append(b);
    const info = element('div', 'card-info');
    info.append(element('h3', '', l), element('p', '', explanations[s]));
    card.append(stage, info);
    root.append(card);
  }
}
function renderCompare() {
  const root = $('compareGrid');
  root.replaceChildren();
  if (!selected.length) {
    root.append(
      element(
        'div',
        'empty',
        'No selections yet. Add up to four designs from the gallery or studio.',
      ),
    );
    return;
  }
  for (const s of selected) {
    const card = element('article', 'compare-card');
    card.append(element('h3', '', s.name, { localize: false }));
    const stage = element('div', 'spec-stage'),
      b = buttonFor(s.config, compareState, currentText());
    stage.append(b);
    card.append(stage);
    const dl = element('dl');
    for (const key of [
      'fill',
      'palette',
      'tone',
      'border',
      'shadow',
      'radius',
      'shape',
      'hover',
      'press',
    ])
      dl.append(
        element('dt', '', axisMap[key].name),
        element('dd', '', labelFor(key, s.config[key])),
      );
    card.append(dl);
    const open = element('button', 'action secondary', 'Edit in studio');
    open.type = 'button';
    open.onclick = event => loadStudio(s.config, s.name, event?.detail === 0);
    const remove = element('button', 'text-action', 'Remove selection');
    remove.type = 'button';
    remove.onclick = () => removeSelection(s.id);
    card.append(open, remove);
    root.append(card);
  }
}
let mathKeys = new Set(AXES.map(a => a.key));
function combinationCount(keys) {
  return AXES.reduce((n, a) => (keys.has(a.key) ? n * BigInt(a.options.length) : n), 1n);
}
function renderMath() {
  const total = combinationCount(mathKeys);
  $('comboTotal').textContent = formatNumber(total);
  $('comboDescription').textContent =
    mathKeys.size +
    ' active axes · One option per axis · Custom colors and the 13 states are excluded.';
  const factors = AXES.filter(a => mathKeys.has(a.key)).map(a => a.options.length);
  $('comboFormula').textContent =
    (factors.length ? factors.join(' × ') : '1') + ' = ' + formatNumber(total);
  const root = $('mathControls');
  if (root.children.length) {
    for (const check of root.querySelectorAll('input'))
      check.checked = mathKeys.has(check.dataset.axis);
    return;
  }
  for (const a of AXES) {
    const label = element('label', 'math-control');
    const left = element('span'),
      check = element('input');
    check.type = 'checkbox';
    check.dataset.axis = a.key;
    check.checked = mathKeys.has(a.key);
    check.setAttribute('aria-label', a.name + ' axis included in the calculation');
    check.onchange = () => {
      check.checked ? mathKeys.add(a.key) : mathKeys.delete(a.key);
      renderMath();
    };
    left.append(check, document.createTextNode(a.name));
    label.append(left, element('span', '', String(a.options.length)));
    root.append(label);
  }
}
