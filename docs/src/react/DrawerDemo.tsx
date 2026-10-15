import AtlasProvider from './AtlasProvider';
import { DrawerExamples } from './DrawerExamples';
import '../styles/atlas-drawer-extensions.css';
export default function DrawerDemo({ documentation = false }: { documentation?: boolean } = {}) {
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined}>
      <DrawerExamples />
    </AtlasProvider>
  );
}
