import type { ReactNode } from 'react';
import { useI18n } from './useI18n';

export type DataEntrySection = {
  id: string;
  title: string;
  description: string;
  content: ReactNode;
  headingId?: string;
};

/** Documentation composition only; sample components keep their existing owners. */
export default function DataEntryCatalog({
  slug,
  title,
  sections,
}: {
  slug: string;
  title: string;
  sections: readonly DataEntrySection[];
}) {
  const { t } = useI18n();
  return (
    <div className="pattern-stack data-entry-catalog" data-entry-catalog={slug}>
      <nav aria-label={t('{component} example sections', { component: title })}>
        <ol className="data-entry-navigation">
          {sections.map(section => (
            <li key={section.id}>
              <a href={`#${slug}-examples-${section.id}`}>{section.title}</a>
            </li>
          ))}
        </ol>
      </nav>
      {sections.map(section => {
        const id = `${slug}-examples-${section.id}`;
        const headingId = section.headingId ?? `${id}-title`;
        return (
          <section
            className="data-entry-section"
            id={id}
            key={section.id}
            aria-labelledby={headingId}
          >
            <header>
              <h3 className="variant-heading" id={headingId}>
                {section.title}
              </h3>
              <p>{section.description}</p>
            </header>
            {section.content}
          </section>
        );
      })}
    </div>
  );
}

export function DataEntryGrid({ children }: { children: ReactNode }) {
  return <div className="data-entry-grid">{children}</div>;
}
