import { useEffect, useId, useRef, useState } from 'react';
import { Checkbox, Select } from 'antd';
import Input from '../../GenUXInput';
import GenUXButton from '../../GenUXButton';
import { selectedLabel } from '../../selectedLabel';
import { FieldEditor } from './Fields';
import { useI18n } from '../../useI18n';
import type {
  FieldDefinition,
  FilterClause,
  ProjectionState,
  QueryState,
  RecordIdentity,
} from './contracts';
import {
  FILTER_LABELS,
  fieldOperators,
  filterHasNoValue as noValue,
  validateFilterDraft,
  groupMemberships,
  parseSavedView,
  projectedFields,
  type GroupDefinition,
  type SavedView,
} from '../../../data/collection-kit';
export {
  FILTER_LABELS,
  fieldOperators,
  validateFilterDraft,
  groupMemberships,
  scopeGroupRecords,
  parseSavedView,
} from '../../../data/collection-kit';
export type { GroupDefinition, RecordGroup, SavedView } from '../../../data/collection-kit';

export type FilterBuilderProps<R extends RecordIdentity> = {
  fields: readonly FieldDefinition<R>[];
  filters: readonly FilterClause[];
  onChange: (filters: readonly FilterClause[]) => void;
  errors?: Readonly<Record<string, string>>;
  onDraftError?: (id: string, error: string | null) => void;
  resetKey?: number;
};
export function FilterBuilder<R extends RecordIdentity>({
  fields,
  filters,
  onChange,
  errors = {},
  onDraftError,
  resetKey,
}: FilterBuilderProps<R>) {
  const { t } = useI18n();
  const prefix = useId();
  const replace = (id: string, next: FilterClause) => {
    const previous = filters.find(filter => filter.id === id);
    if (previous?.fieldKey !== next.fieldKey || previous.operator !== next.operator)
      onDraftError?.(id, null);
    onChange(filters.map(filter => (filter.id === id ? next : filter)));
  };
  const fieldOptions = fields.map(field => ({
    value: field.key,
    label: t(field.label),
    disabled: fieldOperators(field).length === 0,
  }));
  return (
    <fieldset className="kit-filter-builder">
      <legend>{t('Filter conditions')}</legend>
      <p>{t('All applied conditions must match. Draft conditions do not change the results.')}</p>
      {filters.map((filter, index) => {
        const field = fields.find(item => item.key === filter.fieldKey);
        const operators = field ? fieldOperators(field) : [];
        const operatorOptions = operators.map(value => ({ value, label: t(FILTER_LABELS[value]) }));

        return (
          <div className="kit-filter-row" key={filter.id}>
            <label>
              {t('Filter field {number}', { number: index + 1 })}
              <Select
                value={filter.fieldKey}
                options={fieldOptions}
                labelRender={selectedLabel(fieldOptions)}
                onChange={key => {
                  const next = fields.find(item => item.key === key);
                  if (!next || !fieldOperators(next).length) return;
                  replace(filter.id, {
                    id: filter.id,
                    fieldKey: key,
                    operator: fieldOperators(next)[0],
                    value: null,
                  });
                }}
              />
            </label>
            <label>
              {t('Filter operator {number}', { number: index + 1 })}
              <Select
                value={filter.operator}
                options={operatorOptions}
                labelRender={selectedLabel(operatorOptions)}
                onChange={operator =>
                  replace(filter.id, {
                    ...filter,
                    operator,
                    value: noValue(operator) ? undefined : filter.value,
                  })
                }
              />
            </label>
            {!noValue(filter.operator) && field && (
              <div data-filter-value>
                <FieldEditor
                  field={{ ...field, label: t('Filter value {number}', { number: index + 1 }) }}
                  context="filter"
                  value={filter.value ?? null}
                  error={errors[filter.id]}
                  onDraftError={message => onDraftError?.(filter.id, message)}
                  resetKey={resetKey}
                  onChange={value => replace(filter.id, { ...filter, value })}
                />
              </div>
            )}
            <GenUXButton
              fill="text"
              text={t('Remove filter {number}', { number: index + 1 })}
              onClick={() => {
                onDraftError?.(filter.id, null);
                onChange(filters.filter(item => item.id !== filter.id));
              }}
            />
            {errors[filter.id] && (!field || noValue(filter.operator)) && (
              <p role="alert" className="kit-field-error">
                {t(errors[filter.id])}
              </p>
            )}
          </div>
        );
      })}
      <GenUXButton
        fill="text"
        disabled={!fields.some(field => fieldOperators(field).length)}
        text={t('Add filter')}
        onClick={() => {
          const first = fields.find(field => fieldOperators(field).length);
          if (!first) return;
          let n = filters.length + 1;
          while (filters.some(filter => filter.id === prefix + '-' + n)) n++;
          onChange([
            ...filters,
            {
              id: prefix + '-' + n,
              fieldKey: first.key,
              operator: fieldOperators(first)[0],
              value: null,
            },
          ]);
        }}
      />
    </fieldset>
  );
}
export function SortBuilder<R extends RecordIdentity>({
  fields,
  query,
  onQueryChange,
}: {
  fields: readonly FieldDefinition<R>[];
  query: QueryState;
  onQueryChange: (query: QueryState) => void;
}) {
  const { t } = useI18n();
  return (
    <fieldset className="kit-sort-builder">
      <legend>{t('Sort order')}</legend>
      <p>{t('Earlier criteria take priority. Each criterion has its own direction.')}</p>
      {query.sort.map((sort, index) => {
        const options = fields
          .filter(
            field =>
              field.key === sort.fieldKey || !query.sort.some(item => item.fieldKey === field.key),
          )
          .map(field => ({ value: field.key, label: t(field.label) }));
        return (
          <div className="kit-sort-row" key={index}>
            <label>
              {t('Sort field {number}', { number: index + 1 })}
              <Select
                value={sort.fieldKey}
                options={options}
                labelRender={selectedLabel(options)}
                onChange={fieldKey =>
                  onQueryChange({
                    ...query,
                    sort: query.sort.map((item, n) => (n === index ? { ...item, fieldKey } : item)),
                  })
                }
              />
            </label>
            <label>
              {t('Sort direction {number}', { number: index + 1 })}
              <Select
                value={sort.direction}
                options={[
                  { value: 'asc', label: t('Ascending') },
                  { value: 'desc', label: t('Descending') },
                ]}
                onChange={direction =>
                  onQueryChange({
                    ...query,
                    sort: query.sort.map((item, n) =>
                      n === index ? { ...item, direction } : item,
                    ),
                  })
                }
              />
            </label>
            <GenUXButton
              fill="text"
              text={t('Remove sort {number}', { number: index + 1 })}
              onClick={() =>
                onQueryChange({ ...query, sort: query.sort.filter((_, n) => n !== index) })
              }
            />
          </div>
        );
      })}
      <GenUXButton
        fill="text"
        text={t('Add sort criterion')}
        disabled={query.sort.length >= fields.length}
        onClick={() => {
          const field = fields.find(item => !query.sort.some(sort => sort.fieldKey === item.key));
          if (field)
            onQueryChange({
              ...query,
              sort: [...query.sort, { fieldKey: field.key, direction: 'asc' }],
            });
        }}
      />
    </fieldset>
  );
}
export function QueryBar<R extends RecordIdentity>({
  fields,
  query,
  onQueryChange,
}: {
  fields: readonly FieldDefinition<R>[];
  query: QueryState;
  onQueryChange: (query: QueryState) => void;
}) {
  const { t } = useI18n();
  const [filters, setFilters] = useState<readonly FilterClause[]>(query.filters);
  const [attempted, setAttempted] = useState(false);
  const [inputErrors, setInputErrors] = useState<Record<string, string>>({});
  const [resetKey, setResetKey] = useState(0);
  const appliedSignature = JSON.stringify(query.filters);
  const previousApplied = useRef(appliedSignature);
  useEffect(() => {
    const previous = previousApplied.current;
    setFilters(current =>
      JSON.stringify(current) === previous && !Object.keys(inputErrors).length
        ? query.filters
        : current,
    );
    previousApplied.current = appliedSignature;
    setAttempted(false);
  }, [appliedSignature, query.filters]);
  const errors = { ...validateFilterDraft(filters, fields), ...inputErrors };
  const dirty = JSON.stringify(filters) !== appliedSignature || Object.keys(inputErrors).length > 0;
  return (
    <section className="kit-query-bar" aria-label={t('Collection query')}>
      <label>
        {t('Search records')}
        <Input
          value={query.search}
          onChange={event => onQueryChange({ ...query, search: event.target.value })}
        />
      </label>
      <FilterBuilder
        fields={fields}
        filters={filters}
        onChange={setFilters}
        resetKey={resetKey}
        onDraftError={(id, message) =>
          setInputErrors(previous => {
            if ((previous[id] ?? null) === message) return previous;
            const next = { ...previous };
            if (message) next[id] = message;
            else delete next[id];
            return next;
          })
        }
        errors={attempted ? errors : {}}
      />
      <div className="kit-actions">
        <GenUXButton
          text={t('Apply filters')}
          onClick={() => {
            setAttempted(true);
            if (!Object.keys(errors).length) {
              onQueryChange({ ...query, filters });
              setAttempted(false);
            }
          }}
        />
        <GenUXButton
          fill="text"
          text={t('Discard filter draft')}
          disabled={!dirty}
          onClick={() => {
            setFilters(query.filters);
            setInputErrors({});
            setResetKey(value => value + 1);
            setAttempted(false);
          }}
        />
        <GenUXButton
          fill="text"
          text={t('Clear applied filters')}
          disabled={!query.filters.length}
          onClick={() => onQueryChange({ ...query, filters: [] })}
        />
      </div>
      <p role="status">
        {t(dirty ? 'Filter draft has unapplied changes.' : 'Filters are applied.')}
      </p>
      <SortBuilder fields={fields} query={query} onQueryChange={onQueryChange} />
    </section>
  );
}
export function ProjectionPicker<R extends RecordIdentity>({
  fields,
  projection,
  onChange,
}: {
  fields: readonly FieldDefinition<R>[];
  projection: ProjectionState;
  onChange: (projection: ProjectionState) => void;
}) {
  const { t } = useI18n();
  const selected = projectedFields(fields, projection);
  const ordered = selected.map(field => field.key);
  const move = (index: number, delta: number) => {
    const next = [...ordered],
      target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  return (
    <fieldset className="kit-projection">
      <legend>{t('Visible fields')}</legend>
      <p>{t('Field visibility changes the presentation, not the number of records.')}</p>
      <p>
        {t(
          'Record identity is always shown. Keep at least one data field visible; selected fields retain their order.',
        )}
      </p>
      {fields
        .filter(field => field.key !== 'id')
        .map(field => (
          <Checkbox
            key={field.key}
            checked={ordered.includes(field.key)}
            disabled={ordered.length === 1 && ordered.includes(field.key)}
            onChange={event =>
              onChange(
                event.target.checked
                  ? [...ordered, field.key]
                  : ordered.filter(key => key !== field.key),
              )
            }
          >
            {t(field.label)}
          </Checkbox>
        ))}
      <ol className="kit-projection-order">
        {selected.map((field, index) => (
          <li key={field.key}>
            <span>{t(field.label)}</span>
            <GenUXButton
              fill="text"
              text={t('Move {field} earlier', { field: t(field.label) })}
              disabled={index === 0}
              onClick={() => move(index, -1)}
            />
            <GenUXButton
              fill="text"
              text={t('Move {field} later', { field: t(field.label) })}
              disabled={index === selected.length - 1}
              onClick={() => move(index, 1)}
            />
          </li>
        ))}
      </ol>
    </fieldset>
  );
}
export function GroupNavigator<R extends RecordIdentity>({
  records,
  groups,
  activeId,
  onChange,
  translateLabels = true,
}: {
  records: readonly R[];
  groups: readonly GroupDefinition<R>[];
  activeId: string | null;
  onChange: (id: string | null) => void;
  translateLabels?: boolean;
}) {
  const { t } = useI18n();
  const label = (value: string) => (translateLabels ? t(value) : value);
  const membership = groupMemberships(records, groups);
  const overlapping = groups.some(group => group.kind === 'overlapping');
  return (
    <nav className="kit-group-nav" aria-label={t('Record groups')}>
      <h4>{t('Record groups')}</h4>
      <GenUXButton
        fill="text"
        text={t('All records ({count})', { count: records.length })}
        aria-pressed={activeId === null}
        onClick={() => onChange(null)}
      />
      {membership.groups.map(group => (
        <GenUXButton
          key={group.id}
          fill="text"
          aria-pressed={activeId === group.id}
          text={t('{name} ({count})', { name: label(group.label), count: group.records.length })}
          onClick={() => onChange(group.id)}
        />
      ))}
      <p>
        {t('{unique} unique records; {memberships} group memberships', {
          unique: membership.uniqueCount,
          memberships: membership.membershipCount,
        })}
      </p>
      {overlapping && (
        <p>
          {t('Smart groups can overlap. Membership counts must not be added as a record total.')}
        </p>
      )}
      <p role="status">
        {activeId === null
          ? t('Scope: all matching records.')
          : t('Scope: {name}', {
              name: label(
                groups.find(group => group.id === activeId)?.label ?? t('Unavailable group'),
              ),
            })}
      </p>
    </nav>
  );
}
export function SavedViewSettings<R extends RecordIdentity>({
  fields,
  settings,
  onLoad,
}: {
  fields: readonly FieldDefinition<R>[];
  settings: SavedView;
  onLoad: (settings: SavedView) => string | void;
}) {
  const { t } = useI18n();
  const errorId = useId();
  const [text, setText] = useState('');
  const [saved, setSaved] = useState<SavedView | null>(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const load = (source: string) => {
    const parsed = parseSavedView(source, fields);
    setError(parsed.error ?? '');
    if (parsed.value) {
      const problem = onLoad(parsed.value);
      if (problem) {
        setError(problem);
        setFeedback('');
      } else setFeedback('View settings loaded locally.');
    }
  };
  return (
    <section className="kit-saved-views" aria-label={t('Local view settings')}>
      <h4>{t('Local view settings')}</h4>
      <p>
        {t(
          'These settings contain query, projection, grouping and view only. Records, selection and edit drafts are excluded. No server save is performed.',
        )}
      </p>
      <div className="kit-actions">
        <GenUXButton
          text={t('Save current view locally')}
          onClick={() => {
            setSaved(structuredClone(settings));
            setFeedback('View settings saved for this mounted example.');
            setError('');
          }}
        />
        <GenUXButton
          fill="text"
          text={t('Load saved view')}
          disabled={!saved}
          onClick={() => saved && load(JSON.stringify(saved))}
        />
        <GenUXButton
          fill="text"
          text={t('Export current settings')}
          onClick={() => {
            setText(JSON.stringify(settings, null, 2));
            setError('');
          }}
        />
      </div>
      <label>
        {t('View settings JSON')}
        <Input.TextArea
          value={text}
          rows={6}
          onChange={event => setText(event.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
        />
      </label>
      <GenUXButton
        text={t('Validate and load settings')}
        disabled={!text.trim()}
        onClick={() => load(text)}
      />
      {error && (
        <p id={errorId} role="alert">
          {t(error)}
        </p>
      )}
      {feedback && <p role="status">{t(feedback)}</p>}
    </section>
  );
}
