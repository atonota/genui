import GenUXProvider from './GenUXProvider';
import { FormExamples } from './FormExamples';
export default function FormDemo({ documentation = false }: { documentation?: boolean } = {}) {
  return (
    <GenUXProvider appearance={documentation ? 'docs' : undefined}>
      <FormExamples documentation={documentation} />
    </GenUXProvider>
  );
}
