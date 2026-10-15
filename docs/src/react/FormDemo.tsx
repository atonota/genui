import AtlasProvider from './AtlasProvider';
import { FormExamples } from './FormExamples';
export default function FormDemo({ documentation = false }: { documentation?: boolean } = {}) {
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined}>
      <FormExamples documentation={documentation} />
    </AtlasProvider>
  );
}
