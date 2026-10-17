import { useI18n } from './useI18n';
import { Select } from 'antd';
import { useId, useRef, useState, type ComponentRef } from 'react';
import GenUXButton from './GenUXButton';
import { normalizeSearch } from '../i18n';
import { selectedLabel } from './selectedLabel';

const classNames = { popup: { root: 'genux-select-popup' } };
// Created IDs use the `custom-department-` prefix, so this key never collides.
const CREATE_VALUE = 'create-department';

type Department = { value: string; label: string };

/** Local-only department choice: search, select, create and clear. Nothing is saved. */
export default function DepartmentSelectExample() {
  const { t } = useI18n();
  const id = useId();
  const selectId = `${id}-department`;
  const noteId = `${id}-department-note`;
  const select = useRef<ComponentRef<typeof Select>>(null);
  const created = useRef(0);
  const [custom, setCustom] = useState<Department[]>([]);
  const [value, setValue] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState('');

  const departments: Department[] = [
    { value: 'design', label: t('Design') },
    { value: 'engineering', label: t('Engineering') },
    { value: 'operations', label: t('Operations') },
    { value: 'marketing', label: t('Marketing') },
    ...custom,
  ];
  const name = query.trim();
  const needle = normalizeSearch(name);
  const match = (label: string) => normalizeSearch(label) === needle;
  const existing = name ? departments.find(item => match(item.label)) : undefined;
  const visible = departments.filter(item => normalizeSearch(item.label).includes(needle));
  const options =
    name && !existing
      ? [...visible, { value: CREATE_VALUE, label: t('Create “{name}”', { name }) }]
      : visible;
  const selected = departments.find(item => item.value === value);

  const choose = (next: string) => {
    if (next === CREATE_VALUE) {
      if (!name) return;
      if (existing) {
        setValue(existing.value);
      } else {
        created.current += 1;
        const department = { value: `custom-department-${created.current}`, label: name };
        setCustom(items => [...items, department]);
        setValue(department.value);
      }
    } else {
      setValue(next);
    }
    setQuery('');
  };

  const clear = () => {
    setValue(undefined);
    setQuery('');
    select.current?.focus();
  };

  return (
    <div className="example-block" data-department-select>
      <label htmlFor={selectId}>{t('Department')}</label>
      <Select<string>
        variant="filled"
        id={selectId}
        ref={select}
        aria-label={t('Department')}
        aria-describedby={noteId}
        value={value}
        options={options}
        labelRender={selectedLabel(departments)}
        placeholder={t('Search or create a department')}
        showSearch={{ searchValue: query, onSearch: setQuery, filterOption: false }}
        onSelect={choose}
        classNames={classNames}
      />
      <p id={noteId}>
        {t('New departments exist only in this example. Nothing is saved to a server.')}
      </p>
      <output data-department-result aria-live="polite">
        {selected
          ? t('Selected department: {name}', { name: selected.label })
          : t('No department selected')}
      </output>
      <GenUXButton
        fill="outline"
        text={t('Clear department')}
        disabled={value === undefined && query === ''}
        onClick={clear}
      />
    </div>
  );
}
