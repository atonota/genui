import * as select from '@zag-js/select';
import * as combobox from '@zag-js/combobox';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';

export const versions = Object.freeze({ select: '1.46.0', combobox: '1.46.0', vanilla: '1.46.0' });

/**
 * Offline headless dropdown adapter for the standalone Atlas preview.
 * Styling belongs to the host's semantic tokens. No React or remote module is used.
 * State transitions, ARIA, navigation, and dismissal are provided by pinned Zag.
 * Append `root` to the document; start is deferred until it is connected.
 */
export function create(config) {
  if (!config || typeof config.id !== 'string' || !config.id.trim()) {
    throw new TypeError('Dropdown için benzersiz bir id gerekir.');
  }
  if (typeof config.label !== 'string' || !config.label.trim()) {
    throw new TypeError('Dropdown için görünür bir etiket gerekir.');
  }
  const doc = config.document || document;
  const options = (config.options || []).map(item => ({
    value: String(item.value), label: String(item.label), disabled: Boolean(item.disabled),
    group: item.group == null ? '' : String(item.group),
  }));
  if (options.some(item => !item.value) || new Set(options.map(item => item.value)).size !== options.length) {
    throw new TypeError('Dropdown option value değerleri boş olmamalı ve benzersiz olmalıdır.');
  }
  const searchable = Boolean(config.searchable);
  const multiple = Boolean(config.multiple);
  const widget = searchable ? combobox : select;
  const collectionOf = items => widget.collection({
    items, itemToValue: item => item.value, itemToString: item => item.label,
    isItemDisabled: item => item.disabled,
  });
  const normalizeValues = values => {
    const next = [...new Set((Array.isArray(values) ? values : []).map(String))]
      .filter(value => options.some(item => item.value === value));
    return multiple ? next : next.slice(0, 1);
  };
  let disabled = Boolean(config.disabled);
  const readOnly = Boolean(config.readOnly);
  let currentValue = normalizeValues(config.value);
  let shownOptions = options;
  let destroyed = false;
  let started = false;
  let machine;
  let unsubscribe;
  let mountObserver;
  let pendingRender = false;
  let pendingValue;
  const spreadCleanups = new Map();
  const ownListeners = [];
  const uniqueId = config.id;
  const propsId = `atlas-dropdown:${uniqueId}`;
  const node = (tag, className, text) => {
    const result = doc.createElement(tag);
    if (className) result.className = className;
    if (text != null) result.textContent = text;
    return result;
  };
  const root = node('div', 'ff-dropdown');
  const label = node('label', 'ff-label', config.label);
  const controlWrap = node('div', 'ff-select-control');
  const control = node(searchable ? 'input' : 'button', 'ff-control');
  const valueText = searchable ? null : node('span', 'ff-choice-text');
  const icon = node('span', 'ff-icon');
  icon.setAttribute('aria-hidden', 'true');
  // Inline SVG has no font, network, or emoji dependency.
  icon.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>';
  const toggle = searchable ? node('button', 'ff-dropdown-trigger ff-icon') : null;
  const clear = config.clearable ? node('button', 'ff-clear', 'Temizle') : null;
  const chips = multiple ? node('div', 'ff-chips') : null;
  const content = node('div', 'ff-menu');
  const optionList = node('div', 'ff-option-list');
  const empty = node('p', 'ff-empty', config.emptyText || 'Sonuç bulunamadı.');
  empty.setAttribute('role', 'status');
  const hiddenControl = searchable ? node('div', 'ff-hidden-values') : node('select', 'ff-hidden-select');
  hiddenControl.hidden = true;
  hiddenControl.setAttribute('aria-hidden', 'true');
  hiddenControl.tabIndex = -1;
  if (!searchable) {
    const blank = node('option');
    blank.value = '';
    hiddenControl.append(blank);
    for (const item of options) {
      const option = node('option', '', item.label);
      option.value = item.value;
      option.disabled = item.disabled;
      hiddenControl.append(option);
    }
  }
  if (searchable) {
    control.type = 'text';
    toggle.type = 'button';
    toggle.append(icon);
    controlWrap.append(control, toggle);
  } else {
    control.type = 'button';
    control.append(valueText, icon);
    controlWrap.append(control);
  }
  if (clear) controlWrap.append(clear);
  root.append(label, controlWrap);
  if (chips) {
    chips.setAttribute('role', 'list');
    chips.setAttribute('aria-label', `${config.label}: seçilenler`);
    root.append(chips);
  }
  content.append(optionList, empty);
  root.append(content, hiddenControl);

  // IDs remain stable across every state, theme, and filtered collection.
  const ids = {
    root: `${uniqueId}-root`, label: `${uniqueId}-label`,
    control: `${uniqueId}-control`, trigger: `${uniqueId}-trigger`,
    input: `${uniqueId}-input`, content: `${uniqueId}-listbox`,
    clearTrigger: `${uniqueId}-clear`, hiddenSelect: `${uniqueId}-native`,
    item: value => `${uniqueId}-option-${encodeURIComponent(value)}`,
  };
  function bind(target, props, className) {
    spreadCleanups.set(target, spreadProps(target, { ...props, class: className }, propsId));
  }
  function listen(target, type, callback) {
    target.addEventListener(type, callback);
    ownListeners.push(() => target.removeEventListener(type, callback));
  }
  function api() { return widget.connect(machine.service, normalizeProps); }
  const optionNodes = new Map();
  const groupNodes = new Map();
  let optionSignature = '';
  function updateOptions(items) {
    if (destroyed) return;
    if (shownOptions.length === items.length && shownOptions.every((item, index) => item === items[index])) return;
    shownOptions = items;
    if (machine) machine.updateProps({ collection: collectionOf(shownOptions) });
    scheduleRender();
  }
  function scheduleRender() {
    if (pendingRender || destroyed) return;
    pendingRender = true;
    queueMicrotask(() => {
      pendingRender = false;
      if (!destroyed) render();
    });
  }
  function renderOptions(nextApi) {
    const visibleValues = new Set(shownOptions.map(item => item.value));
    for (const [value, itemNode] of optionNodes) {
      if (visibleValues.has(value)) continue;
      spreadCleanups.get(itemNode.root)?.();
      spreadCleanups.delete(itemNode.root);
      itemNode.root.remove();
      optionNodes.delete(value);
    }
    for (const item of shownOptions) {
      let itemNode = optionNodes.get(item.value);
      if (!itemNode) {
        const itemRoot = node('div', 'ff-option');
        const text = node('span', 'ff-choice-text', item.label);
        const indicator = node('span', 'ff-option-indicator', '✓');
        indicator.setAttribute('aria-hidden', 'true');
        itemRoot.append(text, indicator);
        itemNode = { root: itemRoot, indicator };
        optionNodes.set(item.value, itemNode);
      }
      bind(itemNode.root, nextApi.getItemProps({ item }), 'ff-option');
      itemNode.indicator.hidden = !nextApi.value.includes(item.value);
    }
    const signature = JSON.stringify(shownOptions.map(item => item.value));
    if (signature !== optionSignature) {
      optionSignature = signature;
      optionList.replaceChildren();
      const renderedGroups = new Set();
      for (const item of shownOptions) {
        const itemNode = optionNodes.get(item.value).root;
        if (!item.group) { optionList.append(itemNode); continue; }
        let group = groupNodes.get(item.group);
        if (!group) {
          const groupRoot = node('div', 'ff-option-group');
          const groupLabel = node('div', 'ff-option-group-label', item.group);
          groupLabel.id = `${uniqueId}-group-${groupNodes.size}`;
          groupRoot.setAttribute('role', 'group');
          groupRoot.setAttribute('aria-labelledby', groupLabel.id);
          group = { root: groupRoot, label: groupLabel };
          groupNodes.set(item.group, group);
        }
        if (!renderedGroups.has(item.group)) {
          group.root.replaceChildren(group.label);
          optionList.append(group.root);
          renderedGroups.add(item.group);
        }
        group.root.append(itemNode);
      }
    }
    empty.hidden = shownOptions.length > 0;
  }
  let chipSignature = '';
  function renderChips(nextApi) {
    if (!chips) return;
    const signature = JSON.stringify([nextApi.value, disabled, readOnly]);
    if (signature === chipSignature) return;
    chipSignature = signature;
    chips.replaceChildren();
    chips.hidden = nextApi.value.length === 0;
    for (const value of nextApi.value) {
      const item = options.find(option => option.value === value);
      if (!item) continue;
      const chip = node('span', 'ff-chip');
      chip.setAttribute('role', 'listitem');
      const text = node('span', 'ff-choice-text', item.label);
      const remove = node('button', 'ff-chip-remove', '×');
      remove.type = 'button';
      remove.disabled = disabled || readOnly;
      remove.setAttribute('aria-label', `${config.label}: ${item.label} seçimini kaldır`);
      remove.addEventListener('click', () => {
        if (disabled || readOnly || destroyed) return;
        // Return focus before rebuilding chips; focus cannot remain on a removed button.
        api().focus();
        api().clearValue(value);
      });
      chip.append(text, remove);
      chips.append(chip);
    }
  }
  function renderHiddenValues(nextApi) {
    if (!searchable) {
      // Native control is display-hidden, never a visible OS menu.
      bind(hiddenControl, { ...nextApi.getHiddenSelectProps(), hidden: true, style: undefined }, 'ff-hidden-select');
      for (const option of hiddenControl.options) option.selected = nextApi.value.includes(option.value);
      return;
    }
    hiddenControl.replaceChildren();
    for (const value of nextApi.value) {
      const input = node('input');
      input.type = 'hidden';
      input.name = config.name || uniqueId;
      input.value = value;
      input.disabled = disabled;
      hiddenControl.append(input);
    }
  }
  function render() {
    const nextApi = api();
    currentValue = [...nextApi.value];
    bind(root, nextApi.getRootProps(), 'ff-dropdown');
    root.dataset.disabled = String(disabled);
    root.dataset.readonly = String(readOnly);
    root.dataset.multiple = String(multiple);
    root.dataset.searchable = String(searchable);
    root.dataset.state = nextApi.open ? 'open' : 'closed';
    bind(label, { ...nextApi.getLabelProps(), for: searchable ? ids.input : ids.trigger }, 'ff-label');
    bind(controlWrap, nextApi.getControlProps(), 'ff-select-control');
    const description = config.descriptionId ? { 'aria-describedby': config.descriptionId } : {};
    if (searchable) {
      bind(control, { ...nextApi.getInputProps(), ...description, name: undefined }, 'ff-control');
      bind(toggle, { ...nextApi.getTriggerProps({ focusable: true }), disabled: disabled || readOnly }, 'ff-dropdown-trigger ff-icon');
    } else {
      bind(control, { ...nextApi.getTriggerProps(), ...description, 'aria-readonly': readOnly || undefined }, 'ff-control');
      valueText.textContent = nextApi.valueAsString || config.placeholder || 'Seçiniz';
    }
    if (clear) {
      bind(clear, { ...nextApi.getClearTriggerProps(), disabled: disabled || readOnly, tabindex: 0 }, 'ff-clear');
    }
    const contentProps = nextApi.getContentProps();
    if (!searchable) {
      const handleKeyDown = contentProps.onkeydown;
      contentProps.onkeydown = event => {
        if (event.key === 'Tab') {
          // This normal-flow list is nonmodal. Zag's default Select handler traps
          // Tab at the listbox edge; permit native Tab/Shift+Tab and close without
          // restoring focus over the browser's next destination.
          machine.send({ type: 'CLOSE', src: 'tab-key', restoreFocus: false });
          return;
        }
        handleKeyDown?.(event);
      };
    }
    bind(content, contentProps, 'ff-menu');
    // Composite mode gives the content the listbox role. The option container is neutral.
    renderOptions(nextApi);
    renderChips(nextApi);
    renderHiddenValues(nextApi);
  }

  const machineProps = {
    id: uniqueId, ids, getRootNode: () => doc,
    collection: collectionOf(options), defaultValue: currentValue,
    disabled, readOnly, invalid: Boolean(config.invalid), required: Boolean(config.required),
    multiple, name: searchable ? undefined : (config.name || uniqueId),
    placeholder: config.placeholder || 'Seçiniz',
    closeOnSelect: !multiple, loopFocus: false,
    translations: { triggerLabel: `${config.label}: seçenekleri aç veya kapat`, clearTriggerLabel: `${config.label}: seçimi temizle` },
    // No positioner is mounted. Open content remains in normal document flow.
    // Zag's placement effect safely exits when its positioner is absent.
    positioning: { listeners: false },
    onValueChange(details) {
      currentValue = [...details.value];
      config.onChange?.([...currentValue]);
      scheduleRender();
    },
    onOpenChange(details) {
      if (details.open && details.reason !== 'input-change') updateOptions(options);
      scheduleRender();
    },
    ...(searchable ? {
      openOnClick: true,
      selectionBehavior: multiple ? 'clear' : 'replace',
      inputBehavior: 'autohighlight', allowCustomValue: false,
      onInputValueChange(details) {
        if (details.reason === 'input-change') {
          const query = details.inputValue.toLocaleLowerCase('tr').trim();
          updateOptions(query ? options.filter(item => item.label.toLocaleLowerCase('tr').includes(query)) : options);
        } else if (!details.inputValue) updateOptions(options);
      },
    } : {}),
  };
  machine = new VanillaMachine(widget.machine, machineProps);
  unsubscribe = machine.subscribe(scheduleRender);
  render();
  function start() {
    if (destroyed || started) return;
    if (!root.isConnected) {
      if (!mountObserver) {
        mountObserver = new doc.defaultView.MutationObserver(start);
        mountObserver.observe(doc.documentElement, { subtree: true, childList: true });
      }
      return;
    }
    mountObserver?.disconnect();
    mountObserver = null;
    started = true;
    machine.start();
    if (pendingValue) {
      api().setValue(pendingValue);
      pendingValue = undefined;
    }
    scheduleRender();
  }
  queueMicrotask(start);

  // Keep reset reliable even if the preview is moved into a form after mounting.
  listen(doc, 'reset', event => {
    if (!event.target.contains(root)) return;
    queueMicrotask(() => {
      if (event.defaultPrevented || destroyed) return;
      api().setValue(normalizeValues(config.value));
      if (searchable) {
        api().setInputValue(multiple ? '' : options.find(item => item.value === config.value?.[0])?.label || '');
      }
    });
  });
  if (searchable) {
    listen(control, 'keydown', event => {
      if (!multiple || disabled || readOnly || event.defaultPrevented || event.isComposing) return;
      if (event.key === 'Backspace' && !control.value && currentValue.length) {
        api().clearValue(currentValue.at(-1));
      }
    });
  }
  return {
    root,
    setValue(values) {
      if (destroyed) return;
      const next = normalizeValues(values);
      if (!started) { pendingValue = next; currentValue = next; return; }
      api().setValue(next);
      if (searchable && !multiple) {
        api().setInputValue(options.find(item => item.value === next[0])?.label || '');
      }
    },
    getValue() { return [...currentValue]; },
    setDisabled(nextDisabled) {
      if (destroyed) return;
      disabled = Boolean(nextDisabled);
      if (disabled && started) api().setOpen(false);
      machine.updateProps({ disabled });
      scheduleRender();
    },
    close() { if (!destroyed && started) api().setOpen(false); },
    destroy() {
      if (destroyed) return;
      if (started) {
        // Stop subscriptions and library dismissal/placement/form observers.
        unsubscribe?.();
        machine.stop();
      } else unsubscribe?.();
      destroyed = true;
      mountObserver?.disconnect();
      ownListeners.forEach(cleanup => cleanup());
      for (const cleanup of spreadCleanups.values()) cleanup();
      spreadCleanups.clear();
    },
  };
}
