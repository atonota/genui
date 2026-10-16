import { useI18n } from './useI18n';
import { Select, Switch, type SelectProps } from 'antd';
import { useId, useRef, useState, type ComponentRef } from 'react';
import AtlasProvider from './AtlasProvider';
import { TweakerSettings } from './AtlasTweaker';
import AtlasPill, { AtlasPillColorScope } from './AtlasPill';
import { normalizeSearch } from '../i18n';
import { selectedLabel } from './selectedLabel';
import DataEntryCatalog, { DataEntryGrid } from './DataEntryCatalog';
import ExamplePreview from './ExamplePreview';
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
  // Preview presentation only; values and the department flow keep their own owners.
  const [clearable, setClearable] = useState(true);
  const [searchable, setSearchable] = useState(true);
  const [tagDisplay, setTagDisplay] = useState<'all' | 'responsive'>('all');
  const settingsId = useId();
  const maxTagCount = tagDisplay === 'responsive' ? 'responsive' : undefined;
  const filteredSearch: SelectProps['showSearch'] = searchable
    ? {
        optionFilterProp: 'label',
        filterOption: (input, option) =>
          normalizeSearch(String(option?.label ?? '')).includes(normalizeSearch(input)),
      }
    : false;
  const single = (
    <div className={documentation ? 'example-block' : undefined}>
      <label htmlFor="select-single">{t('Team')}</label>
      <Select
        variant="filled"
        id="select-single"
        options={options}
        labelRender={selectedLabel(options)}
        defaultValue="design"
        allowClear={clearable}
        showSearch={searchable ? { optionFilterProp: 'label' } : false}
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
          maxTagCount={maxTagCount}
          showSearch={filteredSearch}
          tagRender={pillTags ? renderPill(() => multiple.current?.focus()) : undefined}
          onChange={pillTags ? setMultipleValues : undefined}
          value={pillTags ? multipleValues : undefined}
          options={options}
          labelRender={selectedLabel(options)}
          defaultValue={pillTags ? undefined : ['design', 'engineering']}
          allowClear={clearable}
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
          maxTagCount={maxTagCount}
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
  // Tags keep search on: typing is how a new tag is entered.
  const settings = documentation ? (
    <TweakerSettings title="Select settings">
      <div className="atlas-tweaker-token">
        <label htmlFor={`${settingsId}clearable`}>{t('Clearable')}</label>
        <Switch
          id={`${settingsId}clearable`}
          checked={clearable}
          onChange={checked => setClearable(checked)}
        />
      </div>
      <div className="atlas-tweaker-token">
        <label htmlFor={`${settingsId}searchable`}>{t('Searchable')}</label>
        <Switch
          id={`${settingsId}searchable`}
          checked={searchable}
          onChange={checked => setSearchable(checked)}
        />
      </div>
      <div className="atlas-tweaker-token">
        <label htmlFor={`${settingsId}tag-display`}>{t('Selected values')}</label>
        <Select
          id={`${settingsId}tag-display`}
          value={tagDisplay}
          options={[
            { value: 'all', label: t('Show every value') },
            { value: 'responsive', label: t('Fit to field width') },
          ]}
          onChange={(next: string) => setTagDisplay(next === 'responsive' ? 'responsive' : 'all')}
        />
      </div>
    </TweakerSettings>
  ) : null;
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined}>
      {settings}
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
                <ExamplePreview
                  id="select-department-choice"
                  title={t('Select or create a department')}
                >
                  <DataEntryGrid>
                    <DepartmentSelectExample />
                  </DataEntryGrid>
                </ExamplePreview>
              ),
            },
            {
              id: 'single',
              title: t('Single selection'),
              description: t(
                'Compare the filled field with searchable, clearable single selection.',
              ),
              content: (
                <ExamplePreview id="select-single-selection" title={t('Single selection')}>
                  <DataEntryGrid>
                    {filled}
                    {single}
                  </DataEntryGrid>
                </ExamplePreview>
              ),
            },
            {
              id: 'multiple',
              title: t('Multiple selection and tags'),
              description: t(
                'Choose several existing values or create new tags. Each value keeps its own color.',
              ),
              content: (
                <ExamplePreview
                  id="select-multiple-and-tags"
                  title={t('Multiple selection and tags')}
                >
                  <DataEntryGrid>
                    {multipleField}
                    {tagsField}
                  </DataEntryGrid>
                </ExamplePreview>
              ),
            },
            {
              id: 'validation',
              title: t('Validation'),
              description: t('Errors and warnings describe the selection that needs attention.'),
              content: (
                <ExamplePreview id="select-validation-states" title={t('Validation')}>
                  <DataEntryGrid>{validation}</DataEntryGrid>
                </ExamplePreview>
              ),
            },
            {
              id: 'availability',
              title: t('Availability'),
              description: t('Compare empty results, a loading preview and a disabled selection.'),
              content: (
                <ExamplePreview id="select-availability-states" title={t('Availability')}>
                  <DataEntryGrid>
                    {empty}
                    {loading}
                    {disabled}
                  </DataEntryGrid>
                </ExamplePreview>
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
