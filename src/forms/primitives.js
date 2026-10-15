function formSample(title, caption) {
  const sample = element('article', 'ff-sample');
  sample.append(element('h4', '', title));
  if (caption) sample.append(element('p', 'ff-caption', caption));
  return sample;
}
function formHelp(id, text) {
  const node = element('p', 'ff-help', text);
  node.id = id;
  return node;
}
function formIcon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'ff-icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    {
      search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14M15 15l6 6',
      check: 'M4 12l5 5L20 6',
      close: 'M5 5l14 14M19 5L5 19',
      mail: 'M3 5h18v14H3zM3 5l9 7 9-7',
      arrow: 'M5 12h14M13 6l6 6-6 6',
    }[name] || 'M12 4v16M4 12h16',
  );
  svg.append(path);
  return svg;
}
function formAffix(text) {
  return element('span', 'ff-affix', text);
}
function formAction(id, label, action) {
  const b = element('button', 'ff-affix', label);
  b.type = 'button';
  b.id = id;
  b.onclick = action;
  return b;
}
function formInput({
  id,
  label,
  type = 'text',
  value = '',
  placeholder = '',
  help = '',
  status = '',
  disabled = false,
  readOnly = false,
  required = false,
  prefix,
  suffix,
}) {
  const field = element('div', 'ff-field');
  if (status) field.dataset.status = status;
  const name = element('label', 'ff-label', label + (required ? ' · Required' : ''));
  name.htmlFor = id;
  const wrap = element('div', 'ff-control-wrap'),
    input = element(type === 'textarea' ? 'textarea' : 'input', 'ff-control');
  input.id = id;
  if (type !== 'textarea') input.type = type;
  else input.rows = 3;
  input.value = value;
  input.placeholder = placeholder;
  input.disabled = disabled;
  input.readOnly = readOnly;
  input.required = required;
  if (type === 'email') input.autocomplete = 'email';
  else if (type === 'password') input.autocomplete = 'new-password';
  if (status === 'error') input.setAttribute('aria-invalid', 'true');
  if (prefix) wrap.append(prefix);
  wrap.append(input);
  if (suffix) wrap.append(suffix);
  field.append(name, wrap);
  if (help) {
    const helpId = id + '-help';
    input.setAttribute('aria-describedby', helpId);
    field.append(formHelp(helpId, help));
  }
  return { root: field, input, wrap };
}
function setFormFieldStatus(input, status, message) {
  const field = input.closest('.ff-field');
  field.dataset.status = status;
  if (status === 'error') input.setAttribute('aria-invalid', 'true');
  else input.removeAttribute('aria-invalid');
  const help = $(input.id + '-help');
  if (help) help.textContent = message;
}
