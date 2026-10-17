function stateBar(id, value, callback) {
  const root = $(id);
  root.replaceChildren();
  root.append(element('span', 'state-label', 'Visual state'));
  for (const [s, l] of STATES) {
    const b = element('button', 'pill', l);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(s === value));
    b.dataset.state = s;
    b.onclick = () => {
      for (const choice of root.children)
        if (choice.dataset.state)
          choice.setAttribute('aria-pressed', String(choice.dataset.state === s));
      callback(s);
    };
    root.append(b);
  }
}
function showTab(name, focus = false) {
  if (name !== 'forms') closeFormDropdowns();
  if (name === 'forms') buildFormLab();
  if (name !== 'studio') cancelOperationDemo();
  document.querySelectorAll('.tab').forEach(b => {
    const on = b.dataset.tab === name;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  });
  document.querySelectorAll('[role=tabpanel]').forEach(p => (p.hidden = p.id !== 'panel-' + name));
  if (name === 'studio') renderStudio();
  if (name === 'compare') renderCompare();
  if (name === 'math') renderMath();
}
