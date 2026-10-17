import GenUXProvider from './GenUXProvider';
import { AccordionExamples } from './AccordionExamples';
export default function AccordionDemo({ documentation = false }: { documentation?: boolean } = {}) {
  return (
    <GenUXProvider appearance={documentation ? 'docs' : undefined}>
      <AccordionExamples />
    </GenUXProvider>
  );
}
