function download(content, name, mime) {
  const blob = new Blob([content], { type: mime }),
    url = URL.createObjectURL(blob),
    a = element('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  toast(name + ' download started.');
}
function standaloneButton() {
  const raw = buttonFor(current, 'default', currentText()).outerHTML;
  const escape = s =>
    s.replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const name = escape(currentName),
    text = escape(currentText()),
    theme = document.documentElement.dataset.theme || 'light';
  const css = document.querySelector('style').textContent.split('/* Form denemeleri:')[0];
  return (
    '<!doctype html>\n' +
    iconLicenseMarkup() +
    '\n<html lang="' +
    getLocale() +
    '" data-theme="' +
    theme +
    '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
    name +
    '</title><style>' +
    css +
    '\nbody{min-height:100vh;display:grid;place-items:center;padding:32px}.button-demo{width:min(100%,420px);text-align:center}.button-demo h1{font-size:1.5625rem;letter-spacing:-.5px;margin-bottom:30px}.button-demo .spec-stage{border-radius:14px;min-height:220px}.button-demo p{margin-top:22px;color:var(--muted);font-size:var(--text)}</style></head><body><main class="button-demo"><h1>' +
    name +
    '</h1><div class="spec-stage">' +
    raw +
    '</div><p>' +
    text +
    escape(t(' · Hover, press or focus with the keyboard.')) +
    '</p></main></body></html>'
  );
}
