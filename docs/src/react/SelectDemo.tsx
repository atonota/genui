import { useI18n } from './useI18n';
import { Select, type SelectProps } from 'antd';
import { useRef, useState, type ComponentRef } from 'react';
import AtlasProvider from './AtlasProvider';
import AtlasPill, { AtlasPillColorScope } from './AtlasPill';
import { normalizeSearch } from '../i18n';
import { selectedLabel } from './selectedLabel';
import DataEntryCatalog, { DataEntryGrid } from './DataEntryCatalog';
import DepartmentSelectExample from './DepartmentSelectExample';

const classNames = { popup: { root: 'atlas-select-popup' } };
const renderPill =
  (focus: () => void): NonNullable<SelectProps['tagRender']> =>
  ({ label, value, closable, disabled, onClose }) => (
    <AtlasPill
      colorKey={String(value)}
      closable={closable}
      disabled={disabled}
      onClose={event => {
        onClose?.(event);
        if (!event.defaultPrevented && !disabled) focus();
      }}
      onMouseDown={event => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
      }}
    >
      {label}
    </AtlasPill>
  );

export function WebSelectDemo({ documentation = false }: { documentation?: boolean } = {}) {
  return <SelectDemo pillTags documentation={documentation} />;
}

export default function SelectDemo({
  pillTags = false,
  documentation = false,
}: { pillTags?: boolean; documentation?: boolean } = {}) {
  const { t } = useI18n();
  const options = [
    { value: 'design', label: t('Design') },
    { value: 'engineering', label: t('Engineering') },
    { value: 'operations', label: t('Operations') },
    { value: 'archived', label: t('Archived'), disabled: true },
  ];
  const tagOptions = options.slice(0, 3);

  const multiple = useRef<ComponentRef<typeof Select>>(null);
  const tags = useRef<ComponentRef<typeof Select>>(null);
  const [multipleValues, setMultipleValues] = useState(['design', 'engineering']);
  const [tagValues, setTagValues] = useState<string[]>([]);
  const single = (
    <div className={documentation ? 'example-block' : undefined}>
      <label htmlFor="select-single">{t('Team')}</label>
      <Select
        variant="filled"
        id="select-single"
        options={options}
        labelRender={selectedLabel(options)}
        defaultValue="design"
        allowClear
        showSearch={{ optionFilterProp: 'label' }}
        classNames={classNames}
      />
    </div>
  );
  const multipleField = (
    <div className={documentation ? 'example-block' : undefined}>
      <label htmlFor="select-multiple">{t('Teams')}</label>
      <AtlasPillColorScope values={multipleValues}>
        <Select
          variant="filled"
          id="select-multiple"
          ref={multiple}
          mode="multiple"
          showSearch={{
            optionFilterProp: 'label',
            filterOption: (input, option) =>
              normalizeSearch(String(option?.label ?? '')).includes(normalizeSearch(input)),
          }}
          tagRender={pillTags ? renderPill(() => multiple.current?.focus()) : undefined}
          onChange={pillTags ? setMultipleValues : undefined}
          value={pillTags ? multipleValues : undefined}
          options={options}
          labelRender={selectedLabel(options)}
          defaultValue={pillTags ? undefined : ['design', 'engineering']}
          allowClear
          classNames={classNames}
        />
      </AtlasPillColorScope>
    </div>
  );
  const tagsField = (
    <div className={documentation ? 'example-block' : undefined}>
      <label htmlFor="select-tags">{t('Tags')}</label>
      <AtlasPillColorScope values={tagValues}>
        <Select
          variant="filled"
          id="select-tags"
          ref={tags}
          mode="tags"
          showSearch={{
            optionFilterProp: 'label',
            filterOption: (input, option) =>
              normalizeSearch(String(option?.label ?? '')).includes(normalizeSearch(input)),
          }}
          tagRender={pillTags ? renderPill(() => tags.current?.focus()) : undefined}
          onChange={pillTags ? setTagValues : undefined}
          value={pillTags ? tagValues : undefined}
          options={tagOptions}
          labelRender={selectedLabel(tagOptions)}
          placeholder={t('Enter a new tag')}
          classNames={classNames}
        />
      </AtlasPillColorScope>
    </div>
  );
  const filled = (
    <div className={documentation ? 'example-block' : undefined}>
      <label htmlFor="select-filled">{t('Filled')}</label>
      <Select
        id="select-filled"
        variant="filled"
        options={options}
        labelRender={selectedLabel(options)}
        defaultValue="design"
        classNames={classNames}
      />
    </div>
  );
  const empty = (
    <div className={documentation ? 'example-block' : undefined}>
      <label htmlFor="select-empty">{t('Empty list')}</label>
      <Select
        variant="filled"
        id="select-empty"
        options={[]}
        notFoundContent={t('No results found')}
        classNames={classNames}
      />
    </div>
  );
  const loading = (
    <div className={documentation ? 'example-block' : undefined}>
      <label htmlFor="select-loading">{t('Loading preview')}</label>
      <Select
        variant="filled"
        id="select-loading"
        loading
        placeholder={t('Loading')}
        classNames={classNames}
      />
    </div>
  );
  const disabled = (
    <div className={documentation ? 'example-block' : undefined}>
      <label htmlFor="select-disabled">{t('Disabled')}</label>
      <Select
        variant="filled"
        id="select-disabled"
        options={options}
        labelRender={selectedLabel(options)}
        disabled
        value="design"
        classNames={classNames}
      />
    </div>
  );
  const validation = (
    <>
      {(['error', 'warning'] as const).map(status => (
        <div key={status} className={documentation ? 'example-block' : undefined}>
          <label htmlFor={`select-${status}`}>
            {status === 'error' ? t('Invalid selection') : t('Needs review')}
          </label>
          <Select
            variant="filled"
            id={`select-${status}`}
            status={status}
            aria-invalid={status === 'error' ? true : undefined}
            options={options}
            labelRender={selectedLabel(options)}
            defaultValue="design"
            aria-describedby={`select-${status}-help`}
            classNames={classNames}
          />
          <p id={`select-${status}-help`}>{t('Check the selection.')}</p>
        </div>
      ))}
    </>
  );
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined}>
      {documentation ? (
        <DataEntryCatalog
          slug="select"
          title={t('Select')}
          sections={[
            {
              id: 'department-choice',
              title: t('Select or create a department'),
              description: t(
                'Search existing departments or create one for this example. Clearing stays available at all times.',
              ),
              content: (
                <DataEntryGrid>
                  <DepartmentSelectExample />
                </DataEntryGrid>
              ),
            },
            {
              id: 'single',
              title: t('Single selection'),
              description: t(
                'Compare the filled field with searchable, clearable single selection.',
              ),
              content: (
                <DataEntryGrid>
                  {filled}
                  {single}
                </DataEntryGrid>
              ),
            },
            {
              id: 'multiple',
              title: t('Multiple selection and tags'),
              description: t(
                'Choose several existing values or create new tags. Each value keeps its own color.',
              ),
              content: (
                <DataEntryGrid>
                  {multipleField}
                  {tagsField}
                </DataEntryGrid>
              ),
            },
            {
              id: 'validation',
              title: t('Validation'),
              description: t('Errors and warnings describe the selection that needs attention.'),
              content: <DataEntryGrid>{validation}</DataEntryGrid>,
            },
            {
              id: 'availability',
              title: t('Availability'),
              description: t('Compare empty results, a loading preview and a disabled selection.'),
              content: (
                <DataEntryGrid>
                  {empty}
                  {loading}
                  {disabled}
                </DataEntryGrid>
              ),
            },
          ]}
        />
      ) : (
        <div className="pattern-stack">
          <section className="example-block">
            <h3 className="variant-heading">{t('Single and multiple selection')}</h3>
            {single}
            {multipleField}
            {tagsField}
          </section>
          <section className="example-block">
            <h3 className="variant-heading">{t('Field surface')}</h3>
            {filled}
          </section>
          <section className="example-block">
            <h3 className="variant-heading">{t('States')}</h3>
            {validation}
            {empty}
            {loading}
            {disabled}
          </section>
        </div>
      )}
    </AtlasProvider>
  );
}
