import GenUXProvider from './GenUXProvider';
import ListyBasicPatterns from './ListyBasicPatterns';
import ListyControlPatterns from './ListyControlPatterns';
import ListyReorderPattern from './ListyReorderPattern';
import ListyDataPatterns from './ListyDataPatterns';
import { useI18n } from './useI18n';
import '../styles/genux-listy.css';

function ListyExamples() {
  const { t } = useI18n();
  return (
    <div className="genux-listy-demo genux-listy-patterns">
      <p className="genux-listy-demo-intro">
        {t(
          'Every pattern renders native Listy with the shared GenUX row. The central Listy surface role in the Tweaker switches all lists between inset and outlined, and the shared size profile sets compact rows to 32, 40 or 48 px.',
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
    <GenUXProvider appearance={documentation ? 'docs' : undefined} sizeFamily="pill">
      <ListyExamples />
    </GenUXProvider>
  );
}
