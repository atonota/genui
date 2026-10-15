import AtlasProvider from './AtlasProvider';
import ListyBasicPatterns from './ListyBasicPatterns';
import ListyControlPatterns from './ListyControlPatterns';
import ListyReorderPattern from './ListyReorderPattern';
import ListyDataPatterns from './ListyDataPatterns';
import { useI18n } from './useI18n';
import '../styles/atlas-listy.css';

function ListyExamples() {
  const { t } = useI18n();
  return (
    <div className="atlas-listy-demo atlas-listy-patterns">
      <p className="atlas-listy-demo-intro">
        {t(
          'Every pattern renders native Listy with the shared Atlas row. The central Listy surface role in the Tweaker switches all lists between inset and outlined, and the shared size profile sets compact rows to 32, 40 or 48 px.',
        )}
      </p>
      <ListyBasicPatterns />
      <ListyControlPatterns />
      <ListyReorderPattern />
      <ListyDataPatterns />
    </div>
  );
}

/** Sixteen local Listy patterns; surface and size come from central roles, data stays local. */
export default function ListyDemo({ documentation = false }: { documentation?: boolean }) {
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined} sizeFamily="pill">
      <ListyExamples />
    </AtlasProvider>
  );
}
