let current = safeConfig(PRESETS.find(p => p.name === 'Lower lip').config);
let currentName = 'Lower lip',
  studioState = 'default',
  galleryState = 'default',
  compareState = 'default',
  family = 'All',
  search = '',
  behaviorConfig = { ...current };
let selected = [];
try {
  const data = JSON.parse(localStorage.getItem('buton-atlasi-v1') || '[]');
  if (Array.isArray(data))
    selected = data.slice(0, 4).map((s, i) => ({
      id: 'saved-' + i,
      name: String(s.name || 'Design').slice(0, 70),
      config: safeConfig(s.config),
    }));
} catch {}
let toastTimer;
function toast(message) {
  $('toast').textContent = t(message);
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').hidden = true), 2500);
}
