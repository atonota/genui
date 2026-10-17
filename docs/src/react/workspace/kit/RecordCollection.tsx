import { useState } from 'react';
import { Select } from 'antd';
import GenUXButton from '../../GenUXButton';
import GenUXPagination from '../../GenUXPagination';
import { useI18n } from '../../useI18n';
import { presentFieldValue, queryKitRecords } from '../../../data/field-kit';
import { selectedLabel } from '../../selectedLabel';
import StateSurface from './StateSurface';
import {
  GroupNavigator,
  groupMemberships,
  scopeGroupRecords,
  ProjectionPicker,
  QueryBar,
  SavedViewSettings,
  type GroupDefinition,
  type SavedView,
} from './CollectionTools';
import ViewAdapter from './ViewAdapters';
import {
  isReadableSurface,
  type FieldDefinition,
  type RecordCollectionProps,
  type RecordIdentity,
} from './contracts';
import { collectionPage } from '../../../data/collection-kit';

export type RecordCollectionOptions<R extends RecordIdentity> = RecordCollectionProps<R> & {
  smartGroups?: readonly GroupDefinition<R>[];
  activeGroupId?: string | null;
  onActiveGroupIdChange?: (id: string | null) => void;
};
function fieldGroups<R extends RecordIdentity>(
  records: readonly R[],
  field: FieldDefinition<R>,
  locale: string,
  translate: (message: string) => string,
): GroupDefinition<R>[] {
  const valueKey = (record: R) => {
    const state = field.availability?.(record);
    return state && state.state !== 'available'
      ? 'unavailable'
      : JSON.stringify({
          value: field.getValue(record),
          currency: typeof field.currency === 'function' ? field.currency(record) : field.currency,
          unit: typeof field.unit === 'function' ? field.unit(record) : field.unit,
        });
  };
  const keys = [...new Set(records.map(valueKey))];
  return keys.map(key => {
    const first = records.find(record => valueKey(record) === key)!;
    return {
      id: field.key + '::' + key,
      label: presentFieldValue(first, field, locale, translate).text,
      kind: 'exclusive',
      matches: record => valueKey(record) === key,
    };
  });
}
export function RecordCollection<R extends RecordIdentity>(props: RecordCollectionOptions<R>) {
  const { t, locale } = useI18n();
  const [localGroupId, setLocalGroupId] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [localPage, setLocalPage] = useState(1);
  const changePage = (page: number) => {
    if (props.onPageChange) props.onPageChange(page);
    else setLocalPage(page);
  };
  const changeQuery = (query: typeof props.query) => {
    changePage(1);
    props.onQueryChange(query);
  };
  const activeGroupId =
    props.activeGroupId !== undefined
      ? props.activeGroupId
      : props.group?.activeGroupId !== undefined
        ? props.group.activeGroupId
        : localGroupId;
  const matching = isReadableSurface(props.state)
    ? queryKitRecords(props.records, props.fields, props.query, locale)
    : [];
  const groupField = props.fields.find(field => field.key === props.group?.fieldKey);
  const groups =
    props.groups ??
    props.smartGroups ??
    (groupField ? fieldGroups(matching, groupField, locale, t) : []);
  const memberships = groupMemberships(matching, groups);
  const scoped = groups.length
    ? scopeGroupRecords(matching, memberships.groups, activeGroupId)
    : matching;
  const page = collectionPage(scoped, props.page ?? localPage, props.pageSize);
  const hiddenChecked = props.checkedIds.filter(
    id => !scoped.some(record => record.id === id),
  ).length;
  const chooseGroup = (id: string | null) => {
    changePage(1);
    if (props.onActiveGroupIdChange) props.onActiveGroupIdChange(id);
    else if (props.onGroupChange)
      props.onGroupChange({ ...(props.group ?? { fieldKey: null }), activeGroupId: id });
    else setLocalGroupId(id);
  };
  const viewOptions = [
    { value: 'table', label: t('Table') },
    { value: 'list', label: t('List') },
    { value: 'cards', label: t('Cards') },
    { value: 'board', label: t('Board') },
    { value: 'calendar', label: t('Month calendar') },
    { value: 'timeline', label: t('Event timeline') },
    { value: 'gantt', label: t('Gantt date spans') },
    { value: 'tree', label: t('Hierarchy') },
  ].filter(
    option =>
      (!props.supportedViews ||
        props.supportedViews.includes(option.value as NonNullable<typeof props.view>)) &&
      (option.value !== 'tree' || !!props.parentId) &&
      (option.value !== 'board' ||
        !!props.fields.find(
          field =>
            field.key === (props.boardFieldKey ?? props.group?.fieldKey) || field.kind === 'choice',
        )) &&
      (option.value !== 'gantt' ||
        (!!props.fields.find(
          field => field.key === props.startFieldKey && ['date', 'datetime'].includes(field.kind),
        ) &&
          !!props.fields.find(
            field => field.key === props.endFieldKey && ['date', 'datetime'].includes(field.kind),
          ))) &&
      (!['calendar', 'timeline'].includes(option.value) ||
        !!props.fields.find(
          field => field.key === props.dateFieldKey && ['date', 'datetime'].includes(field.kind),
        )),
  );
  const groupOptions = [
    { value: '', label: t('No exclusive grouping') },
    ...props.fields
      .filter(field => field.key !== 'id' && field.kind !== 'multiline')
      .map(field => ({ value: field.key, label: t(field.label) })),
  ];
  const settings: SavedView = {
    version: 1,
    name: 'Current view',
    query: props.query,
    projection: props.projection,
    group: { ...(props.group ?? { fieldKey: null }), activeGroupId },
    view: props.view ?? 'table',
  };
  const load = (saved: SavedView) => {
    if (!viewOptions.some(option => option.value === saved.view))
      return 'This view is not available for the supplied fields.';
    if (!props.onViewChange && saved.view !== (props.view ?? 'table'))
      return 'This collection does not allow changing its view.';
    if (!props.onGroupChange && saved.group.fieldKey !== (props.group?.fieldKey ?? null))
      return 'This collection does not allow changing its grouping.';
    changeQuery(saved.query);
    props.onProjectionChange(saved.projection);
    props.onGroupChange?.(saved.group);
    props.onViewChange?.(saved.view);
    if (props.onActiveGroupIdChange) props.onActiveGroupIdChange(saved.group.activeGroupId ?? null);
    else if (!props.onGroupChange) setLocalGroupId(saved.group.activeGroupId ?? null);
  };
  const state =
    (props.state && props.state.kind !== 'ready' ? props.state : undefined) ??
    (props.records.length === 0
      ? { kind: 'empty' as const }
      : scoped.length === 0
        ? {
            kind: 'no-match' as const,
            message: 'No records match this query and group scope.',
            recoveryLabel: 'Clear query and group scope',
            onRecover: () => {
              changeQuery({ search: '', filters: [], sort: [] });
              chooseGroup(null);
            },
          }
        : { kind: 'ready' as const });
  // True first use: nothing supplied and no query or group scope that recovery must clear.
  const firstUse =
    props.records.length === 0 &&
    state.kind === 'empty' &&
    !props.query.search.trim() &&
    props.query.filters.length === 0 &&
    props.query.sort.length === 0 &&
    !activeGroupId;
  return (
    <section className="kit-collection" aria-label={t(props.title ?? 'Record collection')}>
      <h3>{t(props.title ?? 'Record collection')}</h3>
      {!firstUse && (
        <>
          <QueryBar fields={props.fields} query={props.query} onQueryChange={changeQuery} />
          <div className="kit-collection-controls">
            {props.onViewChange && (
              <label>
                {t('Collection presentation')}
                <Select
                  value={props.view ?? 'table'}
                  options={[...viewOptions]}
                  labelRender={selectedLabel([...viewOptions])}
                  onChange={value => props.onViewChange?.(value as NonNullable<typeof props.view>)}
                />
              </label>
            )}
            {props.onGroupChange && !props.groups && !props.smartGroups && (
              <label>
                {t('Group records by')}
                <Select
                  value={props.group?.fieldKey ?? ''}
                  options={groupOptions}
                  labelRender={selectedLabel(groupOptions)}
                  onChange={fieldKey => {
                    props.onGroupChange?.({ fieldKey: fieldKey || null, activeGroupId: null });
                    if (!props.onGroupChange) setLocalGroupId(null);
                  }}
                />
              </label>
            )}
          </div>
          <p role="status">
            {t('{visible} of {total} records in the current scope', {
              visible: scoped.length,
              total: props.records.length,
            })}
            {' · '}
            {t('{count} checked records', { count: props.checkedIds.length })}
          </p>
          {hiddenChecked > 0 && (
            <p>
              {t('{count} checked records are outside the current scope', {
                count: hiddenChecked,
              })}
            </p>
          )}
        </>
      )}
      {props.activeId && !scoped.some(record => record.id === props.activeId) && (
        <p>
          {t(
            'The inspected record is outside the current scope. Its identity and draft are retained.',
          )}
        </p>
      )}
      {!firstUse && (
        <>
          <GenUXButton
            fill="text"
            aria-expanded={toolsOpen}
            text={t('View settings')}
            onClick={() => setToolsOpen(value => !value)}
          />
          <div
            className="kit-tools-disclosure workspace-disclosure"
            data-open={toolsOpen}
            aria-hidden={!toolsOpen}
            inert={!toolsOpen}
          >
            <div className="workspace-disclosure-clip">
              <ProjectionPicker
                fields={props.fields}
                projection={props.projection}
                onChange={props.onProjectionChange}
              />
              <SavedViewSettings fields={props.fields} settings={settings} onLoad={load} />
            </div>
          </div>
        </>
      )}
      {props.bulkActions && isReadableSurface(state) && (
        <section
          className="kit-collection-bulk"
          aria-label={t('Collection bulk actions')}
          aria-busy={props.operation?.kind === 'pending'}
        >
          <fieldset
            disabled={props.operation?.kind === 'pending' || props.operation?.kind === 'unknown'}
            inert={props.operation?.kind === 'pending' || props.operation?.kind === 'unknown'}
          >
            <legend>{t('Actions for checked records')}</legend>
            {props.bulkActions}
          </fieldset>
        </section>
      )}
      {props.bulkActions &&
        (props.operation?.kind === 'pending' || props.operation?.kind === 'unknown') && (
          <p role="status">
            {t('Bulk actions are locked while the operation is pending or unknown.')}
          </p>
        )}
      {props.operation?.message && <p role="status">{t(props.operation.message)}</p>}
      <div className="kit-collection-layout">
        {!firstUse && groups.length > 0 && (
          <GroupNavigator
            records={matching}
            groups={groups}
            activeId={activeGroupId}
            onChange={chooseGroup}
            translateLabels={!!(props.groups ?? props.smartGroups)}
          />
        )}
        <div className="kit-collection-results">
          <StateSurface state={state}>
            <ViewAdapter {...props} records={page.records} onQueryChange={changeQuery} />
            <GenUXPagination
              current={page.page}
              total={scoped.length}
              pageSize={page.size}
              onChange={changePage}
              showSizeChanger={false}
              showQuickJumper
              label={t('Collection pages')}
            />
            <p>
              {t(
                'Client-side pages render at most {count} loaded records. This does not fetch remote pages or virtualize rows.',
                { count: page.size },
              )}
            </p>
          </StateSurface>
        </div>
      </div>
    </section>
  );
}
export default RecordCollection;
