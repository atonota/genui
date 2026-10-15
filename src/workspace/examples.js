// Offline workspace experiments. These examples do not create component decisions.
const WORKSPACE_ORDERS = Object.freeze(
  [
    [
      'SP-26-0401',
      'Aster Workshop',
      'pending',
      '2026-10-20',
      1240,
      'Alex Reed',
      'Packaging samples requested.',
    ],
    [
      'SP-26-0402',
      'Birch Studio',
      'approved',
      '2026-10-21',
      860,
      'Sam Lee',
      'Deliver the complete set together.',
    ],
    [
      'SP-26-0403',
      'Cedar Office',
      'shipped',
      '2026-10-22',
      2350,
      'Jordan Vale',
      'Reference delivery example.',
    ],
    [
      'SP-26-0404',
      'Dune Collective',
      'pending',
      '2026-10-23',
      490,
      'Alex Reed',
      'Confirm the fictional sample size.',
    ],
    [
      'SP-26-0405',
      'Elm Works',
      'approved',
      '2026-10-26',
      1780,
      'Sam Lee',
      'One consolidated package.',
    ],
    [
      'SP-26-0406',
      'Fern House',
      'shipped',
      '2026-10-27',
      325,
      'Jordan Vale',
      'No additional instructions.',
    ],
    [
      'SP-26-0407',
      'Grove Design',
      'pending',
      '2026-10-28',
      960,
      'Alex Reed',
      'Include the sample checklist.',
    ],
    [
      'SP-26-0408',
      'Harbor Makers',
      'approved',
      '2026-10-29',
      1525,
      'Sam Lee',
      'Fictional planning record.',
    ],
  ].map(([id, customer, status, due, amount, assignee, note]) =>
    Object.freeze({ id, customer, status, due, amount, assignee, note }),
  ),
);
const workspaceState = {
  profile: 'mobile',
  mobileStage: 'groups',
  group: 'all',
  query: '',
  activeId: null,
  formMode: 'steps',
  formStep: 0,
};
let workspaceLabReady = false;

function buildWorkspaceLab() {
  const mount = $('workspaceExamples'),
    lab = $('workspaceLab');
  if (workspaceLabReady || !mount || !lab) return;
  workspaceLabReady = true;
  const state = workspaceState,
    statusNames = { pending: 'Pending', approved: 'Approved', shipped: 'Shipped' },
    groups = [['all', 'All orders'], ...Object.entries(statusNames)],
    groupButtons = new Map(),
    rowNodes = new Map(),
    fieldErrors = new Map();
  let savedDraft = null,
    formFeedback = '';

  function raw(tag, className, text) {
    return element(tag, className, text, { localize: false });
  }
  function action(id, label, listener, primary = false) {
    const button = primary
      ? buttonFor(BASE, 'default', label, { localizeLabel: true })
      : element('button', 'ws-action', label);
    button.type = 'button';
    button.id = id;
    button.addEventListener('click', listener);
    return button;
  }
  function heading(id, label) {
    const node = element('h4', 'ws-heading', label);
    node.id = id;
    node.tabIndex = -1;
    return node;
  }
  function pane(id, label) {
    const root = element('section', 'ws-pane'),
      content = element('div', 'ws-pane-content'),
      title = heading(id + '-title', label);
    root.id = id;
    root.setAttribute('aria-labelledby', title.id);
    content.append(title);
    root.append(content);
    return { root, content, title };
  }
  function setPaneOpen(node, open) {
    node.dataset.open = String(open);
    node.inert = !open;
    node.setAttribute('aria-hidden', String(!open));
  }
  function visibleOrders() {
    const query = normalizeSearch(state.query);
    return WORKSPACE_ORDERS.filter(
      order =>
        (state.group === 'all' || order.status === state.group) &&
        (!query || normalizeSearch(order.id + ' ' + order.customer).includes(query)),
    );
  }
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T00:00:00.000Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function dateText(value) {
    return validDate(value)
      ? new Intl.DateTimeFormat(getLocale() === 'tr' ? 'tr-TR' : 'en-US', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(value + 'T00:00:00.000Z'))
      : t('No date');
  }
  function moneyText(value) {
    return formatNumber(value, { style: 'currency', currency: 'USD' });
  }

  const profiles = element('div', 'ws-profile-controls');
  profiles.setAttribute('role', 'group');
  profiles.setAttribute('aria-label', 'Example layout');
  const mobileButton = action('ws-mobile', 'Mobile example', () => changeProfile('mobile')),
    desktopButton = action('ws-desktop', 'Desktop example', () => changeProfile('desktop'));
  profiles.append(mobileButton, desktopButton);
  const profileDescription = raw('p', 'ws-caption');
  profileDescription.id = 'ws-profile-description';
  profiles.setAttribute('aria-describedby', profileDescription.id);

  const orderExample = element('article', 'ws-example'),
    orderTitle = element('h3', '', 'Orders workspace'),
    orderCaption = element(
      'p',
      'ws-caption',
      'Eight fictional orders. Explore groups, orders and details; no live service is connected.',
    ),
    orderLayout = element('div', 'ws-order-layout');
  orderTitle.id = 'ws-orders-title';
  orderExample.setAttribute('aria-labelledby', orderTitle.id);
  const groupPane = pane('ws-groups-pane', 'Order groups'),
    listPane = pane('ws-list-pane', 'Orders'),
    detailPane = pane('ws-detail-pane', 'Order details');
  const groupList = element('div', 'ws-group-list');
  groupList.setAttribute('role', 'group');
  groupList.setAttribute('aria-label', 'Filter orders by status');
  for (const [value, label] of groups) {
    const button = action('ws-group-' + value, label, () => {
      state.group = value;
      state.mobileStage = 'list';
      renderOrders();
      renderPanes();
      if (state.profile === 'mobile') search.input.focus();
    });
    button.dataset.wsGroup = value;
    const text = element('span', '', label),
      count = raw('span', 'ws-count');
    button.replaceChildren(text, count);
    groupButtons.set(value, { button, count });
    groupList.append(button);
  }
  groupPane.content.append(groupList);
  const backGroups = action('ws-back-groups', 'Back to groups', () => {
    state.mobileStage = 'groups';
    renderPanes();
    groupButtons.get(state.group).button.focus();
  });
  const search = formInput({
    id: 'ws-search',
    label: 'Search orders',
    type: 'search',
    placeholder: 'Order ID or customer',
  });
  search.input.addEventListener('input', () => {
    state.query = search.input.value;
    renderOrders();
  });
  const resultCount = raw('p', 'ws-caption');
  resultCount.id = 'ws-result-count';
  resultCount.setAttribute('role', 'status');
  search.input.setAttribute('aria-describedby', resultCount.id);
  const tableScroll = element('div', 'ws-table-scroll');
  tableScroll.tabIndex = 0;
  tableScroll.setAttribute('role', 'region');
  tableScroll.setAttribute('aria-label', 'Orders table');
  const table = element('table', 'ws-orders-table');
  table.setAttribute('role', 'table');
  table.append(element('caption', 'ff-sr', 'Fictional orders'));
  const head = element('thead', ''),
    header = element('tr', ''),
    body = element('tbody', '');
  head.setAttribute('role', 'rowgroup');
  body.setAttribute('role', 'rowgroup');
  header.setAttribute('role', 'row');
  const columns = ['Order ID', 'Customer', 'Status', 'Due date', 'Amount'];
  for (const label of columns) {
    const cell = element('th', '', label);
    cell.scope = 'col';
    cell.setAttribute('role', 'columnheader');
    header.append(cell);
  }
  head.append(header);
  for (const order of WORKSPACE_ORDERS) {
    const row = element('tr', 'ws-order-row'),
      open = action('', '', () => openOrder(order.id)),
      cells = columns.map(() => raw('td', ''));
    row.setAttribute('role', 'row');
    open.removeAttribute('id');
    open.dataset.wsOpen = order.id;
    open.setAttribute('data-i18n-ignore', '');
    open.removeAttribute('data-i18n');
    open.textContent = order.id;
    open.classList.add('ws-open-order');
    cells[0].append(open);
    cells[1].textContent = order.customer;
    for (const cell of cells) cell.setAttribute('role', 'cell');
    row.append(...cells);
    rowNodes.set(order.id, { row, open, cells });
    body.append(row);
  }
  table.append(head, body);
  tableScroll.append(table);
  const empty = element('p', 'ws-empty', 'No orders match. Change the group or search.');
  listPane.content.append(backGroups, search.root, resultCount, tableScroll, empty);

  const backList = action('ws-back-list', 'Back to orders', () => {
    state.mobileStage = 'list';
    renderPanes();
    const active = rowNodes.get(state.activeId);
    if (active && !active.row.hidden) active.open.focus();
    else search.input.focus();
  });
  const detailPlaceholder = element('p', 'ws-caption', 'Open an order to inspect its details.'),
    detailContent = element('div', 'ws-detail-content'),
    detailId = raw('p', 'ws-record-id'),
    details = element('dl', 'ws-details'),
    detailValues = new Map();
  detailId.id = 'ws-active-record';
  for (const [key, label] of [
    ['customer', 'Customer'],
    ['status', 'Status'],
    ['due', 'Due date'],
    ['amount', 'Amount'],
    ['assignee', 'Assignee'],
    ['note', 'Notes'],
  ]) {
    const pair = element('div', ''),
      value = raw('dd', '');
    pair.append(element('dt', '', label), value);
    detailValues.set(key, value);
    details.append(pair);
  }
  const recordNav = element('div', 'ws-record-navigation'),
    previousRecord = action('ws-prev-record', 'Previous order', () => adjacentOrder(-1)),
    nextRecord = action('ws-next-record', 'Next order', () => adjacentOrder(1)),
    recordPosition = raw('p', 'ws-caption');
  recordPosition.id = 'ws-record-position';
  recordNav.append(previousRecord, nextRecord);
  detailContent.append(detailId, details, recordPosition, recordNav);
  detailPane.content.append(backList, detailPlaceholder, detailContent);
  orderLayout.append(groupPane.root, listPane.root, detailPane.root);
  orderExample.append(orderTitle, orderCaption, orderLayout);

  const formExample = element('article', 'ws-example'),
    formTitle = element('h3', '', 'Order form'),
    formCaption = element(
      'p',
      'ws-caption',
      'One shared draft: a single page on desktop and two steps on mobile. Saving only displays a local example result.',
    ),
    modeControls = element('div', 'ws-form-modes');
  formTitle.id = 'ws-form-title';
  formExample.setAttribute('aria-labelledby', formTitle.id);
  modeControls.setAttribute('role', 'group');
  modeControls.setAttribute('aria-label', 'Form presentation');
  const singleButton = action('ws-form-single', 'Single page', () => changeFormMode('single')),
    stepsButton = action('ws-form-steps', 'Multiple steps', () => changeFormMode('steps'));
  modeControls.append(singleButton, stepsButton);
  const form = element('form', 'ws-form');
  form.noValidate = true;
  form.setAttribute('aria-labelledby', formTitle.id);
  const stepDescription = raw('p', 'ws-caption');
  stepDescription.id = 'ws-step-description';
  const formSteps = [
      pane('ws-step-1', 'Customer and amount'),
      pane('ws-step-2', 'Schedule and notes'),
    ],
    fields = {
      customer: formInput({
        id: 'ws-customer',
        label: 'Customer',
        required: true,
        placeholder: 'Fictional customer name',
        help: 'Use fictional details in this example.',
      }),
      amount: formInput({
        id: 'ws-amount',
        label: 'Amount',
        type: 'number',
        value: '100',
        required: true,
        help: 'Enter an amount greater than zero in USD.',
      }),
      due: formInput({
        id: 'ws-due',
        label: 'Due date',
        type: 'date',
        value: '2026-10-20',
        required: true,
        help: 'Choose a valid date.',
      }),
      note: formInput({
        id: 'ws-note',
        label: 'Notes',
        type: 'textarea',
        placeholder: 'Optional note',
        help: 'This draft stays in this page until it is reloaded.',
      }),
    };
  fields.amount.input.min = '0.01';
  fields.amount.input.step = '0.01';
  for (const [key, field] of Object.entries(fields)) {
    field.input.setAttribute('data-i18n-ignore', '');
    field.input.removeAttribute('data-i18n');
    field.input.setAttribute('data-i18n-placeholder', '');
    field.input.addEventListener('input', () => {
      if (fieldErrors.has(key)) {
        fieldErrors.delete(key);
        renderFieldFeedback();
      }
      if (formFeedback) {
        formFeedback = '';
        savedDraft = null;
        renderFormFeedback();
      }
    });
  }
  formSteps[0].content.append(fields.customer.root, fields.amount.root);
  formSteps[1].content.append(fields.due.root, fields.note.root);
  const formActions = element('div', 'ws-form-actions'),
    previousStep = action('ws-step-prev', 'Previous step', () => changeStep(0)),
    nextStep = action('ws-step-next', 'Next step', () => changeStep(1), true),
    save = action('ws-save', 'Save example', saveExample, true),
    formStatus = raw('p', 'ws-form-status');
  formStatus.id = 'ws-form-status';
  formStatus.setAttribute('role', 'status');
  formActions.append(previousStep, nextStep, save);
  form.append(stepDescription, ...formSteps.map(step => step.root), formActions, formStatus);
  form.addEventListener('submit', event => {
    event.preventDefault();
    saveExample();
  });
  formExample.append(formTitle, formCaption, modeControls, form);
  mount.append(profiles, profileDescription, orderExample, formExample);

  function focusIfHidden(previous) {
    if (!previous || !lab.contains(previous)) return;
    if (previous.closest('[aria-hidden="true"]')) {
      const formStep = formSteps[state.formStep];
      if (form.contains(previous)) formStep.content.querySelector('input,textarea').focus();
      else if (state.mobileStage === 'groups') groupPane.title.focus();
      else if (state.mobileStage === 'list') search.input.focus();
      else detailPane.title.focus();
    }
  }
  function changeProfile(profile) {
    const focused = document.activeElement;
    state.profile = profile;
    state.formMode = profile === 'mobile' ? 'steps' : 'single';
    const focusedStep = formSteps.findIndex(step => step.root.contains(focused));
    if (state.formMode === 'steps' && focusedStep >= 0) state.formStep = focusedStep;
    renderProfiles();
    renderPanes();
    renderForm();
    focusIfHidden(focused);
  }
  function renderProfiles() {
    lab.dataset.profile = state.profile;
    mobileButton.setAttribute('aria-pressed', String(state.profile === 'mobile'));
    desktopButton.setAttribute('aria-pressed', String(state.profile === 'desktop'));
    profileDescription.textContent = t(
      state.profile === 'mobile'
        ? 'Mobile: choose a group, browse orders, then open details.'
        : 'Desktop: groups, orders and details remain available together.',
    );
  }
  function renderPanes() {
    for (const [stage, node] of [
      ['groups', groupPane.root],
      ['list', listPane.root],
      ['details', detailPane.root],
    ])
      setPaneOpen(node, state.profile === 'desktop' || state.mobileStage === stage);
    backGroups.hidden = state.profile === 'desktop';
    backList.hidden = state.profile === 'desktop';
  }
  function openOrder(id) {
    state.activeId = id;
    state.mobileStage = 'details';
    renderOrders();
    renderPanes();
    detailPane.title.focus();
  }
  function adjacentOrder(direction) {
    const visible = visibleOrders(),
      index = visible.findIndex(order => order.id === state.activeId),
      order = visible[index + direction];
    if (!order || index < 0) return;
    state.activeId = order.id;
    renderOrders();
  }
  function renderOrders() {
    const visible = visibleOrders(),
      visibleIds = new Set(visible.map(order => order.id)),
      focused = document.activeElement;
    let hiddenFocus = false;
    for (const [value, { button, count }] of groupButtons) {
      const total = WORKSPACE_ORDERS.filter(
        order => value === 'all' || order.status === value,
      ).length;
      button.setAttribute('aria-pressed', String(state.group === value));
      count.textContent = formatNumber(total);
    }
    for (const order of WORKSPACE_ORDERS) {
      const { row, open, cells } = rowNodes.get(order.id);
      if (!visibleIds.has(order.id) && row.contains(focused)) hiddenFocus = true;
      row.hidden = !visibleIds.has(order.id);
      row.dataset.active = String(order.id === state.activeId);
      if (order.id === state.activeId) open.setAttribute('aria-current', 'true');
      else open.removeAttribute('aria-current');
      open.setAttribute('aria-label', t('Open order {id}', { id: order.id }));
      for (let index = 0; index < cells.length; index++)
        cells[index].dataset.wsLabel = t(columns[index]);
      cells[2].textContent = t(statusNames[order.status]);
      cells[3].textContent = dateText(order.due);
      cells[4].textContent = moneyText(order.amount);
    }
    resultCount.textContent = t('{count} matching orders', { count: formatNumber(visible.length) });
    empty.hidden = visible.length !== 0;
    if (hiddenFocus) {
      if (listPane.root.dataset.open === 'true') search.input.focus();
      else groupButtons.get(state.group).button.focus();
    }
    const order = WORKSPACE_ORDERS.find(record => record.id === state.activeId);
    detailPlaceholder.hidden = Boolean(order);
    detailContent.hidden = !order;
    if (!order) return;
    detailId.textContent = order.id;
    for (const [key, node] of detailValues)
      node.textContent =
        key === 'status'
          ? t(statusNames[order.status])
          : key === 'due'
            ? dateText(order.due)
            : key === 'amount'
              ? moneyText(order.amount)
              : order[key];
    const position = visible.findIndex(record => record.id === order.id);
    recordPosition.textContent =
      position >= 0
        ? t('Order {position} of {count}', {
            position: formatNumber(position + 1),
            count: formatNumber(visible.length),
          })
        : t('This order is outside the current filter.');
    previousRecord.disabled = position <= 0;
    nextRecord.disabled = position < 0 || position >= visible.length - 1;
  }
  function changeFormMode(mode) {
    const focused = document.activeElement;
    state.formMode = mode;
    const focusedStep = formSteps.findIndex(step => step.root.contains(focused));
    if (mode === 'steps' && focusedStep >= 0) state.formStep = focusedStep;
    renderForm();
    focusIfHidden(focused);
  }
  function changeStep(step) {
    state.formStep = step;
    renderForm();
    formSteps[step].content.querySelector('input,textarea').focus();
  }
  function renderForm() {
    const single = state.formMode === 'single';
    form.dataset.mode = state.formMode;
    singleButton.setAttribute('aria-pressed', String(single));
    stepsButton.setAttribute('aria-pressed', String(!single));
    formSteps.forEach((step, index) => setPaneOpen(step.root, single || state.formStep === index));
    stepDescription.textContent = single
      ? t('All fields on one page')
      : t('Step {step} of {count}', {
          step: formatNumber(state.formStep + 1),
          count: formatNumber(formSteps.length),
        });
    previousStep.hidden = single || state.formStep === 0;
    nextStep.hidden = single || state.formStep !== 0;
    save.hidden = !single && state.formStep !== 1;
    fields.customer.input.placeholder = t('Fictional customer name');
    fields.note.input.placeholder = t('Optional note');
  }
  function renderFieldFeedback() {
    const defaults = {
      customer: 'Use fictional details in this example.',
      amount: 'Enter an amount greater than zero in USD.',
      due: 'Choose a valid date.',
      note: 'This draft stays in this page until it is reloaded.',
    };
    for (const [key, field] of Object.entries(fields)) {
      const error = fieldErrors.get(key);
      setFormFieldStatus(field.input, error ? 'error' : '', t(error || defaults[key]));
    }
  }
  function renderFormFeedback() {
    formStatus.textContent =
      formFeedback === 'saved' && savedDraft
        ? t('Example saved locally for {customer}: {amount}. No server request was made.', {
            customer: savedDraft.customer,
            amount: moneyText(savedDraft.amount),
          })
        : formFeedback === 'invalid'
          ? t('Correct the highlighted fields. Nothing was saved or sent.')
          : '';
  }
  function saveExample() {
    fieldErrors.clear();
    const customer = fields.customer.input.value.trim(),
      amount = Number(fields.amount.input.value),
      due = fields.due.input.value;
    if (!customer) fieldErrors.set('customer', 'Enter a customer name.');
    if (!Number.isFinite(amount) || amount <= 0 || !fields.amount.input.validity.valid)
      fieldErrors.set('amount', 'Enter a finite amount greater than zero.');
    if (!validDate(due)) fieldErrors.set('due', 'Enter a valid due date.');
    renderFieldFeedback();
    if (fieldErrors.size) {
      const key = fieldErrors.keys().next().value;
      state.formStep = ['customer', 'amount'].includes(key) ? 0 : 1;
      formFeedback = 'invalid';
      savedDraft = null;
      renderForm();
      renderFormFeedback();
      fields[key].input.focus();
      return;
    }
    savedDraft = { customer, amount, due, note: fields.note.input.value };
    formFeedback = 'saved';
    renderFormFeedback();
  }

  document.addEventListener('atlas:localechange', () => {
    renderProfiles();
    renderOrders();
    renderForm();
    renderFieldFeedback();
    renderFormFeedback();
  });
  renderProfiles();
  renderOrders();
  renderPanes();
  renderForm();
}
