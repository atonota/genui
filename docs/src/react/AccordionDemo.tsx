import AtlasProvider from './AtlasProvider';
import { AccordionExamples } from './AccordionExamples';
export default function AccordionDemo({ documentation = false }: { documentation?: boolean } = {}) {
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined}>
      <AccordionExamples />
    </AtlasProvider>
  );
}
