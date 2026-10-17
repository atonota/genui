function buildFormDropdowns() {
  const grid = $('ff-dropdown-grid');
  const options = [
    { value: 'istanbul', label: 'İstanbul', group: 'Marmara' },
    { value: 'bursa', label: 'Bursa', group: 'Marmara' },
    { value: 'ankara', label: 'Ankara', group: 'Central Anatolia' },
    { value: 'izmir', label: 'İzmir', group: 'Ege' },
    {
      value: 'antalya',
      label: 'Antalya · Currently unavailable',
      disabled: true,
      group: 'Akdeniz',
    },
  ];
  const specs = [
    { id: 'ff-select-single', title: 'Single', label: 'Select a city', value: ['istanbul'] },
    { id: 'ff-select-search', title: 'Searchable', label: 'Search cities', searchable: true },
    {
      id: 'ff-select-multiple',
      title: 'Multiple',
      label: 'Multiple cities',
      multiple: true,
      value: ['istanbul', 'ankara'],
    },
    {
      id: 'ff-select-search-multiple',
      title: 'Searchable multiple',
      label: 'Search and select cities',
      searchable: true,
      multiple: true,
    },
    {
      id: 'ff-select-clearable',
      title: 'Clearable',
      label: 'Preferred city',
      value: ['izmir'],
      clearable: true,
    },
    { id: 'ff-select-grouped', title: 'Grouped', label: 'City by region', grouped: true },
    {
      id: 'ff-select-empty',
      title: 'Empty results',
      label: 'Available city',
      options: [],
      help: 'Example: no options are available yet.',
    },
    {
      id: 'ff-select-loading',
      title: 'Loading',
      label: 'Loading cities',
      disabled: true,
      loading: true,
      help: 'Static loading example; no network request is made.',
    },
    {
      id: 'ff-select-readonly',
      title: 'Read only',
      label: 'Fixed city',
      readOnly: true,
      value: ['bursa'],
      help: 'Selection is preserved; this example cannot be changed.',
    },
    {
      id: 'ff-select-disabled',
      title: 'Disabled',
      label: 'Disabled selection',
      disabled: true,
      value: ['ankara'],
      help: 'This example is unavailable.',
    },
    {
      id: 'ff-select-invalid',
      title: 'Error',
      label: 'Required city',
      invalid: true,
      help: 'Error: select a city.',
    },
    {
      id: 'ff-select-warning',
      title: 'Warning',
      label: 'City to verify',
      value: ['izmir'],
      help: 'Warning: this selection needs further verification.',
    },
  ];
  const add = (spec, surface) => {
    const sample = formSample(spec.title),
      helpId = spec.id + '-help';
    if (surface) sample.dataset.surface = surface;
    const controller = GenUXDropdowns.create({
      ...spec,
      descriptionId: helpId,
      options: spec.options || (spec.grouped ? options : options.map(({ group, ...item }) => item)),
      value: spec.value || [],
      placeholder: 'Choose an option',
      onChange(values) {
        const status = $(helpId);
        if (!spec.help)
          status.textContent = values.length
            ? values.length + ' selections made.'
            : 'No selection yet.';
      },
    });
    controller.root.setAttribute('data-i18n', '');
    formDropdowns.push(controller);
    sample.append(
      controller.root,
      formHelp(helpId, spec.help || 'Navigate the cities, skipping the disabled option.'),
    );
    if (spec.loading) {
      const spinner = element('span', 'ff-spinner');
      spinner.setAttribute('aria-hidden', 'true');
      sample.append(spinner);
      controller.root.setAttribute('aria-busy', 'true');
    }
    if (spec.id === 'ff-select-warning') sample.style.setProperty('--ff-help', 'var(--ff-warning)');
    grid.append(sample);
  };
  for (const spec of specs) add(spec);
  for (const [value, title] of FORM_EXPERIMENTS.surfaces)
    add(
      { id: 'ff-select-' + value, title: title + ' / Surface', label: title + ' selection' },
      value,
    );
}
