function formChoice({
  id,
  label,
  type = 'checkbox',
  name = '',
  checked = false,
  disabled = false,
  mixed = false,
  invalid = false,
}) {
  const root = element('label', 'ff-choice'),
    input = element('input');
  input.id = id;
  input.type = type;
  if (name) input.name = name;
  input.checked = checked;
  input.disabled = disabled;
  input.indeterminate = mixed;
  if (invalid) input.setAttribute('aria-invalid', 'true');
  root.append(input, element('span', 'ff-choice-text', label));
  return { root, input };
}
function buildFormCheckboxes() {
  const grid = $('ff-checkbox-grid');
  for (const [id, title, checked, disabled, mixed] of [
    ['ff-check-off', 'Unchecked', false, false, false],
    ['ff-check-on', 'Checked', true, false, false],
    ['ff-check-mixed', 'Indeterminate', false, false, true],
    ['ff-check-disabled-off', 'Disabled / unchecked', false, true, false],
    ['ff-check-disabled-on', 'Disabled / checked', true, true, false],
  ]) {
    const sample = formSample(title);
    sample.append(formChoice({ id, label: title, checked, disabled, mixed }).root);
    grid.append(sample);
  }
  const group = formSample('Group / select all'),
    fieldset = element('fieldset', 'ff-choice-group');
  fieldset.append(element('legend', '', 'Notification channels'));
  const list = element('div', 'ff-choice-list');
  const all = formChoice({ id: 'ff-check-all', label: 'Select all channels' }),
    email = formChoice({ id: 'ff-check-email', label: 'Email notifications', checked: true }),
    sms = formChoice({ id: 'ff-check-sms', label: 'SMS notifications' }),
    members = [email.input, sms.input];
  const sync = () => {
    const count = members.filter(input => input.checked).length;
    all.input.checked = count === members.length;
    all.input.indeterminate = count > 0 && count < members.length;
  };
  all.input.onchange = () => {
    for (const input of members) input.checked = all.input.checked;
    sync();
  };
  for (const input of members) input.onchange = sync;
  sync();
  list.append(all.root, email.root, sms.root);
  fieldset.append(list);
  group.append(fieldset);
  grid.append(group);
  const error = formSample('Error / consent required'),
    choice = formChoice({ id: 'ff-check-invalid', label: 'I have read the terms', invalid: true });
  choice.input.setAttribute('aria-describedby', 'ff-check-invalid-help');
  choice.input.onchange = () => {
    choice.input.setAttribute('aria-invalid', String(!choice.input.checked));
    $('ff-check-invalid-help').textContent = choice.input.checked
      ? 'Consent selected.'
      : 'Error: consent is required to continue.';
  };
  error.append(
    choice.root,
    formHelp('ff-check-invalid-help', 'Error: consent is required to continue.'),
  );
  error.style.setProperty('--ff-help', 'var(--ff-error)');
  grid.append(error);
}
function buildFormRadios() {
  const grid = $('ff-radio-grid');
  for (const [id, title, layout, segmented, disabled, invalid] of [
    ['standard', 'Vertical group', 'vertical', false, false, false],
    ['horizontal', 'Horizontal group', 'horizontal', false, false, false],
    ['segmented', 'Segmented group', 'horizontal', true, false, false],
    ['disabled', 'Disabled group', 'vertical', false, true, false],
    ['invalid', 'Error / selection required', 'vertical', false, false, true],
  ]) {
    const sample = formSample(title),
      fieldset = element('fieldset', 'ff-choice-group');
    fieldset.append(element('legend', '', 'Notification frequency'));
    const list = element('div', segmented ? 'ff-segmented' : 'ff-choice-list');
    list.dataset.layout = layout;
    for (const [i, label] of ['Immediately', 'Daily', 'Weekly'].entries()) {
      const choice = formChoice({
        id: 'ff-radio-' + id + '-' + i,
        label,
        type: 'radio',
        name: 'ff-radio-group-' + id,
        checked: i === 0 && !invalid,
        disabled,
        invalid,
      });
      if (invalid) {
        choice.input.setAttribute('aria-describedby', 'ff-radio-invalid-help');
        choice.input.onchange = () => {
          for (const node of list.querySelectorAll('input')) node.removeAttribute('aria-invalid');
          $('ff-radio-invalid-help').textContent = 'Notification frequency selected.';
        };
      }
      list.append(choice.root);
    }
    fieldset.append(list);
    sample.append(fieldset);
    if (invalid) {
      sample.append(formHelp('ff-radio-invalid-help', 'Error: select a notification frequency.'));
      sample.style.setProperty('--ff-help', 'var(--ff-error)');
    }
    grid.append(sample);
  }
}
function buildFormSwitches() {
  const grid = $('ff-switch-grid');
  for (const [id, title, checked, disabled, busy, icon] of [
    ['ff-switch-basic', 'Off', false, false, false, false],
    ['ff-switch-on', 'On', true, false, false, false],
    ['ff-switch-text', 'With text', false, false, false, false],
    ['ff-switch-icon', 'With icon', true, false, false, true],
    ['ff-switch-disabled-off', 'Disabled / off', false, true, false, false],
    ['ff-switch-disabled-on', 'Disabled / on', true, true, false, false],
    ['ff-switch-loading', 'Operation pending', true, true, true, false],
  ]) {
    const sample = formSample(title),
      label = element('label', 'ff-toggle'),
      input = element('input', 'ff-sr'),
      track = element('span', 'ff-switch-track'),
      name = element('span', 'ff-choice-text', 'Automatic sync'),
      state = element('span', 'ff-toggle-state');
    input.type = 'checkbox';
    input.id = id;
    input.setAttribute('role', 'switch');
    input.checked = checked;
    input.disabled = disabled;
    state.id = id + '-state';
    name.id = id + '-label';
    input.setAttribute('aria-labelledby', name.id);
    input.setAttribute('aria-describedby', state.id);
    track.setAttribute('aria-hidden', 'true');
    if (busy) input.setAttribute('aria-busy', 'true');
    const update = () => {
      state.replaceChildren();
      if (busy) {
        const spinner = element('span', 'ff-spinner');
        spinner.setAttribute('aria-hidden', 'true');
        state.append(spinner, document.createTextNode(' Bekliyor'));
      } else {
        if (icon) state.append(formIcon(input.checked ? 'check' : 'close'));
        state.append(document.createTextNode(input.checked ? 'On' : 'Off'));
      }
    };
    input.onchange = update;
    update();
    label.append(input, track, name, state);
    sample.append(label);
    grid.append(sample);
  }
}
