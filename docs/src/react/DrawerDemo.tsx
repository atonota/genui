import GenUXProvider from './GenUXProvider';
import { DrawerExamples } from './DrawerExamples';
import '../styles/genux-drawer-extensions.css';
export default function DrawerDemo({ documentation = false }: { documentation?: boolean } = {}) {
  return (
    <GenUXProvider appearance={documentation ? 'docs' : undefined}>
      <DrawerExamples />
    </GenUXProvider>
  );
}
