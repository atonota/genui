import { useId, useState, type ReactNode } from 'react';
import AtlasButton from '../../AtlasButton';
import { useI18n } from '../../useI18n';
import { fieldAvailability, presentFieldValue } from '../../../data/field-kit';
import { FieldValue } from './Fields';
import { StateSurface } from './StateSurface';
import { SectionNavigator } from './RecordForm';
import { isReadableSurface, type RecordDisplayProps, type RecordIdentity } from './contracts';

export type ReturnContext = Readonly<{ label: string; onReturn: () => void }>;
export function DetailSectionShell({
  title,
  returnContext,
  children,
  actions,
  headingLevel = 3,
  showHeading = true,
}: {
  title: string;
  returnContext?: ReturnContext;
  children: ReactNode;
  actions?: ReactNode;
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  showHeading?: boolean;
}) {
  const { t } = useI18n();
  const Heading = ('h' + headingLevel) as 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  return (
    <section className="kit-record-display">
      {(showHeading || actions) && (
        <div className="kit-record-heading">
          {showHeading && <Heading>{t(title)}</Heading>}
          {actions}
        </div>
      )}
      {returnContext && (
        <AtlasButton
          fill="text"
          text={t('Back to {context}', { context: t(returnContext.label) })}
          onClick={returnContext.onReturn}
        />
      )}
      {children}
    </section>
  );
}

export function RecordDisplay<R extends RecordIdentity>({
  record,
  fields,
  recordId,
  state = { kind: 'ready' },
  onEdit,
  onClose,
  capability,
  presentation = 'page',
  activeSection,
  onSectionChange,
  title = 'Record details',
  children,
  returnContext,
  headingLevel = 3,
  showHeading = true,
  navigation,
  onOpenRelation,
}: RecordDisplayProps<R>) {
  const { t, locale } = useI18n();
  const id = useId();
  const sections = [...new Set(fields.map(field => field.section ?? 'Record fields'))];
  const [active, setActive] = useState(sections[0] ?? 'Record fields');
  const candidate = activeSection ?? active;
  const selected =
    presentation === 'accordion' && candidate === ''
      ? ''
      : sections.includes(candidate)
        ? candidate
        : (sections[0] ?? 'Record fields');
  const selectSection = (section: string) => {
    if (activeSection === undefined) setActive(section);
    onSectionChange?.(section);
  };
  const exclusive = presentation === 'tabs' || presentation === 'accordion';
  const contentAllowed = record !== null && isReadableSurface(state);
  const resolvedState =
    record === null && state.kind === 'ready' ? { kind: 'not-found' as const } : state;
  const SectionHeading = ('h' + Math.min(headingLevel + 1, 6)) as 'h3' | 'h4' | 'h5' | 'h6';
  const fieldList = (keys = fields) => (
    <dl className="kit-display-fields">
      {keys.map(field => {
        const readable = record && fieldAvailability(record, field).state === 'available';
        const relation =
          readable && field.kind === 'entity' && onOpenRelation
            ? presentFieldValue(record!, field, locale, t)
            : null;
        const entityId = relation?.state === 'value' ? field.getValue(record!) : null;
        return (
          <div key={field.key} data-read-field={field.key}>
            <dt>{t(field.label)}</dt>
            <dd>
              {record &&
                (relation && typeof entityId === 'string' ? (
                  <AtlasButton
                    fill="text"
                    text={relation.text}
                    data-open-relation={field.key}
                    aria-label={t('Open related record {record}', { record: relation.text })}
                    onClick={() =>
                      onOpenRelation?.({
                        recordId: record.id,
                        fieldKey: field.key,
                        entityId,
                        label: relation.text,
                      })
                    }
                  />
                ) : (
                  <FieldValue record={record} field={field} />
                ))}
            </dd>
          </div>
        );
      })}
    </dl>
  );
  return (
    <div
      className="kit-records"
      data-kit-display={record?.id ?? recordId ?? ''}
      data-detail-presentation={presentation}
    >
      <DetailSectionShell
        title={title}
        headingLevel={headingLevel}
        showHeading={showHeading}
        returnContext={returnContext}
        actions={
          <div className="kit-action-row">
            {onEdit && contentAllowed && (
              <AtlasButton
                text={t('Edit record')}
                disabled={capability?.allowed === false}
                aria-describedby={capability?.allowed === false ? id + '-edit-reason' : undefined}
                onClick={() => onEdit(record!.id)}
              />
            )}
            {onClose && <AtlasButton fill="text" text={t('Close record')} onClick={onClose} />}
          </div>
        }
      >
        <StateSurface
          state={resolvedState}
          headingLevel={Math.min(headingLevel + 1, 6) as 3 | 4 | 5 | 6}
        />
        {capability?.allowed === false && (
          <p id={id + '-edit-reason'}>{t(capability.reason ?? 'Editing is not available.')}</p>
        )}
        {contentAllowed && (
          <>
            <p className="kit-caption">{t('Record ID: {id}', { id: record.id })}</p>
            {navigation && (
              <nav className="kit-record-pager" aria-label={t('Record navigation')}>
                <span>{t(navigation.scopeLabel)}</span>
                <span>
                  {t('{position} of {total}', {
                    position: navigation.position,
                    total: navigation.total,
                  })}
                </span>
                <AtlasButton
                  fill="text"
                  text={t('Previous record')}
                  disabled={!navigation.onPrevious || navigation.position <= 1}
                  onClick={navigation.onPrevious}
                />
                <AtlasButton
                  fill="text"
                  text={t('Next record')}
                  disabled={!navigation.onNext || navigation.position >= navigation.total}
                  onClick={navigation.onNext}
                />
              </nav>
            )}
            {presentation === 'page' ? (
              fieldList()
            ) : (
              <>
                {presentation === 'tabs' && (
                  <SectionNavigator
                    sections={sections}
                    activeSection={selected}
                    onSectionChange={selectSection}
                    disabled={activeSection !== undefined && !onSectionChange}
                    tabs
                    showProgress={false}
                    idPrefix={id}
                    label="Detail sections"
                  />
                )}
                {sections.map((section, index) => {
                  const open = !exclusive || section === selected;
                  return (
                    <section key={section} className="kit-form-section">
                      {presentation === 'accordion' && (
                        <SectionHeading>
                          <AtlasButton
                            id={id + '-accordion-' + index}
                            fill="text"
                            aria-expanded={open}
                            aria-controls={id + '-panel-' + index}
                            text={t(section)}
                            disabled={activeSection !== undefined && !onSectionChange}
                            onClick={() => selectSection(open ? '' : section)}
                          />
                        </SectionHeading>
                      )}
                      <div
                        id={id + '-panel-' + index}
                        role={presentation === 'tabs' ? 'tabpanel' : undefined}
                        aria-labelledby={
                          presentation === 'tabs'
                            ? id + '-section-' + index
                            : presentation === 'accordion'
                              ? id + '-accordion-' + index
                              : id + '-heading-' + index
                        }
                        className="kit-disclosure"
                        data-open={open}
                        inert={!open}
                        aria-hidden={!open}
                      >
                        <div className="kit-disclosure-clip">
                          {presentation !== 'accordion' && (
                            <SectionHeading id={id + '-heading-' + index}>
                              {t(section)}
                            </SectionHeading>
                          )}
                          {fieldList(
                            fields.filter(field => (field.section ?? 'Record fields') === section),
                          )}
                        </div>
                      </div>
                    </section>
                  );
                })}
              </>
            )}
            {children}
          </>
        )}
      </DetailSectionShell>
    </div>
  );
}
export default RecordDisplay;
