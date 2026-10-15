document.querySelectorAll('.tab').forEach(b => {
  b.onclick = () => showTab(b.dataset.tab);
  b.onkeydown = e => {
    const tabs = [...document.querySelectorAll('.tab')],
      i = tabs.indexOf(b);
    let n;
    if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
    if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') n = 0;
    if (e.key === 'End') n = tabs.length - 1;
    if (n !== undefined) {
      e.preventDefault();
      showTab(tabs[n].dataset.tab, true);
    }
  };
});
$('gallerySearch').oninput = e => {
  search = normalizeSearch(e.target.value);
  renderGallery();
};
$('themeToggle').onclick = () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('themeToggle').textContent = dark ? 'Light appearance' : 'Dark appearance';
  renderStudio();
};
$('motionToggle').onchange = e => {
  document.documentElement.dataset.motion = e.target.checked ? 'on' : 'off';
};
$('downloadDecisions').onclick = () =>
  download(
    JSON.stringify(COMPONENT_DECISIONS, null, 2),
    'component-decisions.json',
    'application/json;charset=utf-8',
  );
$('downloadAll').onclick = () =>
  download(SOURCE_DOC, 'button-atlas.html', 'text/html;charset=utf-8');
$('demoProcessingOn').onchange = () => {
  cancelOperationDemo();
};
$('randomize').onclick = () => {
  current = safeConfig(
    Object.fromEntries(
      AXES.map(a => [a.key, a.options[Math.floor(Math.random() * a.options.length)][0]]),
    ),
  );
  currentName = 'New combination';
  updateControls();
  renderStudio();
};
$('resetStudio').onclick = () => {
  current = { ...BASE };
  currentName = 'Reference button';
  $('buttonText').value = 'Continue';
  studioState = 'default';
  updateControls();
  stateBar('studioStates', studioState, s => {
    cancelOperationDemo();
    studioState = s;
    renderStudio();
  });
  renderStudio();
};
$('stageSelect').onchange = () => renderStudio();
$('saveCurrent').onclick = () => saveSelection(current, currentName);
$('downloadRecipe').onclick = () =>
  download(
    JSON.stringify(exportedRecipe(), null, 2),
    'button-design-recipe.json',
    'application/json;charset=utf-8',
  );
$('downloadButton').onclick = () =>
  download(standaloneButton(), 'selected-button.html', 'text/html;charset=utf-8');
$('useStudioStates').onclick = () => {
  behaviorConfig = { ...current };
  renderBehavior();
  toast(currentName + ' design applied to the states.');
};
$('clearSaved').onclick = () => {
  selected = [];
  persist();
  renderGallery();
  renderCompare();
  toast('Comparison selections cleared.');
};
$('mathVisual').onclick = () => {
  mathKeys = new Set(AXES.filter(a => a.group === 'Appearance').map(a => a.key));
  renderMath();
};
$('mathAll').onclick = () => {
  mathKeys = new Set(AXES.map(a => a.key));
  renderMath();
};
function buildAdvanced() {
  const controls = document.querySelector('.controls'),
    details = element('details');
  details.append(element('summary', '', 'Custom colors'));
  const colorLabel = element('label', 'advanced-toggle'),
    colorCheck = element('input');
  colorCheck.type = 'checkbox';
  colorCheck.id = 'customColorsOn';
  colorLabel.append(colorCheck, document.createTextNode('Use custom colors'));
  details.append(colorLabel);
  const colorGrid = element('div', 'color-controls');
  for (const [key, label] of [
    ['bg', 'Surface'],
    ['fg', 'Text'],
    ['edge', 'Border'],
  ]) {
    const row = element('label', '', label),
      input = element('input');
    input.type = 'color';
    input.id = 'color-' + key;
    input.setAttribute('aria-label', 'Custom ' + label.toLocaleLowerCase('tr-TR') + ' color');
    input.oninput = () => applyColors();
    row.append(input);
    colorGrid.append(row);
  }
  colorCheck.onchange = () => applyColors();
  details.append(colorGrid);
  controls.insertBefore(details, controls.querySelector('.control-buttons'));
  const mobile = element('div', 'mobile-live');
  mobile.id = 'mobileStudioPreview';
  mobile.setAttribute('aria-label', 'Live button preview for narrow screens');
  $('panel-studio').append(mobile);
}
function syncAdvanced() {
  if (!$('customColorsOn')) return;
  const p = paletteFor(current),
    colors = current.customColors || { bg: p.color, fg: solidText(p.color), edge: p.dark };
  $('customColorsOn').checked = !!current.customColors;
  for (const key of ['bg', 'fg', 'edge']) $('color-' + key).value = colors[key];
}
function applyColors() {
  if ($('customColorsOn').checked)
    current.customColors = Object.fromEntries(
      ['bg', 'fg', 'edge'].map(key => [key, $('color-' + key).value]),
    );
  else delete current.customColors;
  currentName = 'Custom combination';
  renderStudio();
}
document.addEventListener(
  'click',
  event => {
    const b = event.target.closest('.btx[aria-disabled="true"]');
    if (b) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true,
);
document.documentElement.dataset.motion = 'on';
document.addEventListener('atlas:localechange', () => {
  renderMath();
  const button = $('liveButton');
  if (button && !$('panel-studio').hidden) updatePreviewReadout(button);
});
buildControls();
buildAdvanced();
syncAdvanced();
renderDecisions();
renderHero();
renderFilters();
renderGallery();
renderPrimitives();
renderStudio();
renderBehavior();
renderCompare();
renderMath();
persist();
if (typeof IntersectionObserver !== 'undefined') {
  const observer = new IntersectionObserver(
    entries => {
      const item = entries[0];
      $('mobileStudioPreview').hidden = item.isIntersecting;
    },
    { threshold: 0.15 },
  );
  observer.observe($('liveStage'));
}
stateBar('galleryStates', galleryState, s => {
  galleryState = s;
  renderGallery();
});
stateBar('studioStates', studioState, s => {
  cancelOperationDemo();
  studioState = s;
  renderStudio();
});
stateBar('compareStates', compareState, s => {
  compareState = s;
  renderCompare();
});
window.addEventListener('blur', cancelHeldDemoKeys);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) cancelHeldDemoKeys();
});
window.addEventListener('resize', () => {
  const b = $('liveButton');
  if (b && $('panel-studio').hidden === false) updatePreviewReadout(b);
});

initializeLocale();
