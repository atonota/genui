function buildFormInputs() {
  const grid = $('ff-input-grid');
  const examples = [
    {
      id: 'ff-text',
      title: 'Text',
      label: 'Full name',
      placeholder: 'Enter your name',
      help: 'The label remains visible; a placeholder does not replace it.',
    },
    {
      id: 'ff-email',
      title: 'Email / validation',
      label: 'Email',
      type: 'email',
      placeholder: 'ornek@example.com',
      help: 'Use the validation button below.',
      required: true,
    },
    {
      id: 'ff-search',
      title: 'Search / clear',
      label: 'Search records',
      type: 'search',
      placeholder: 'Name or keyword',
    },
    {
      id: 'ff-password',
      title: 'Password / visibility',
      label: 'Password',
      type: 'password',
      placeholder: 'Example password',
    },
    {
      id: 'ff-number',
      title: 'Number',
      label: 'Participant count',
      type: 'number',
      value: '3',
      help: 'From 0 to 99. Native number-input behavior is preserved.',
    },
    {
      id: 'ff-textarea',
      title: 'Multiline / counter',
      label: 'Short note',
      type: 'textarea',
      placeholder: 'Enter a note',
      help: '0 / 240 characters',
    },
    {
      id: 'ff-prefix',
      title: 'Leading icon',
      label: 'Contact address',
      placeholder: 'ornek@example.com',
      prefix: formAffix(''),
    },
    {
      id: 'ff-suffix',
      title: 'Trailing affix',
      label: 'Working duration',
      type: 'number',
      value: '8',
      suffix: formAffix('hours'),
    },
    {
      id: 'ff-addon',
      title: 'Prefix',
      label: 'Website',
      placeholder: 'ornek.com',
      prefix: formAffix('https://'),
    },
    { id: 'ff-clearable', title: 'Clearable', label: 'Short title', value: 'New workspace' },
    {
      id: 'ff-required',
      title: 'Required',
      label: 'Project name',
      required: true,
      help: 'Required status is not conveyed by color alone.',
    },
    {
      id: 'ff-readonly',
      title: 'Read only',
      label: 'Reference',
      value: 'GENUX-2026',
      readOnly: true,
      help: 'You can select and copy the text.',
    },
    {
      id: 'ff-disabled',
      title: 'Disabled',
      label: 'Disabled field',
      value: 'Currently unavailable',
      disabled: true,
      help: 'This example cannot be edited.',
    },
    {
      id: 'ff-invalid',
      title: 'Error',
      label: 'Email example',
      value: 'eksik@',
      status: 'error',
      help: 'Enter a valid email address.',
    },
    {
      id: 'ff-warning',
      title: 'Warning',
      label: 'Project name',
      value: 'Project with a similar name',
      status: 'warning',
      help: 'Warning: a record with a similar name exists.',
    },
    {
      id: 'ff-success',
      title: 'Valid',
      label: 'Username',
      value: 'example-user',
      status: 'success',
      help: 'Example status: the username is available.',
    },
    {
      id: 'ff-input-loading',
      title: 'Processing',
      label: 'Value being checked',
      value: 'Example query',
      readOnly: true,
      help: 'Static loading example; no real query is sent.',
    },
  ];
  for (const spec of examples) {
    const sample = formSample(spec.title),
      field = formInput(spec);
    sample.append(field.root);
    grid.append(sample);
    if (spec.id === 'ff-number') {
      field.input.min = '0';
      field.input.max = '99';
    }
    if (spec.id === 'ff-prefix') {
      spec.prefix.append(formIcon('mail'));
      spec.prefix.setAttribute('aria-hidden', 'true');
    }
    if (spec.id === 'ff-search' || spec.id === 'ff-clearable') {
      const clear = formAction(spec.id + '-clear', 'Clear', () => {
        field.input.value = '';
        field.input.dispatchEvent(new Event('input', { bubbles: true }));
        field.input.focus();
      });
      clear.setAttribute('aria-label', spec.label + ' field: clear');
      field.wrap.append(clear);
    }
    if (spec.id === 'ff-password') {
      const toggle = formAction('ff-password-toggle', 'Show', () => {
        const show = field.input.type === 'password';
        field.input.type = show ? 'text' : 'password';
        toggle.textContent = show ? 'Hide' : 'Show';
        toggle.setAttribute('aria-pressed', String(show));
        field.input.focus();
      });
      toggle.setAttribute('aria-label', 'Show password');
      toggle.setAttribute('aria-pressed', 'false');
      field.wrap.append(toggle);
    }
    if (spec.id === 'ff-textarea') {
      field.input.maxLength = 240;
      field.input.oninput = () => {
        $('ff-textarea-help').textContent = field.input.value.length + ' / 240 characters';
      };
    }
    if (spec.id === 'ff-input-loading') {
      field.input.setAttribute('aria-busy', 'true');
      const spinner = element('span', 'ff-affix'),
        shape = element('span', 'ff-spinner');
      shape.setAttribute('aria-hidden', 'true');
      spinner.append(shape);
      field.wrap.append(spinner);
    }
  }
  for (const [value, title] of FORM_EXPERIMENTS.surfaces) {
    const sample = formSample(title + ' / Surface');
    sample.dataset.surface = value;
    sample.append(
      formInput({
        id: 'ff-input-' + value,
        label: title + ' field',
        placeholder: 'Same size, different surface',
      }).root,
    );
    grid.append(sample);
  }
  const validate = buttonFor(BASE, 'default', 'Validate email', { localizeLabel: true });
  validate.id = 'ff-validate';
  validate.onclick = () => {
    const email = $('ff-email'),
      valid = email.validity.valid;
    setFormFieldStatus(
      email,
      valid ? 'success' : 'error',
      valid ? 'The email format is valid.' : 'Enter a valid email address.',
    );
    $('ff-form-status').textContent = valid
      ? 'The email format is valid. No data was sent.'
      : 'The email format is invalid. Correct the field and try again.';
    if (!valid) email.focus();
  };
  $('ff-validation').prepend(validate);
}
