import AtlasProvider from './AtlasProvider';
import AtlasChart from './AtlasChart';
import { useI18n } from './useI18n';

function WeeklyActivity() {
  const { t } = useI18n();
  return (
    <section className="atlas-chart-demo">
      <h3>{t('Planned and completed work')}</h3>
      <AtlasChart
        title={t('Weekly activity')}
        description={t(
          'Tasks planned and completed each day. Both series share one scale that starts at zero.',
        )}
        categories={[t('Mon'), t('Tue'), t('Wed')]}
        series={[
          { id: 'planned', label: t('Planned'), values: [10, 15, 12] },
          { id: 'completed', label: t('Completed'), values: [8, 12, 11] },
        ]}
      />
    </section>
  );
}

/** Weekly activity as grouped bars with a legend and the complete value table. */
export default function ChartDemo({ documentation = false }: { documentation?: boolean }) {
  return (
    <AtlasProvider appearance={documentation ? 'docs' : undefined}>
      <WeeklyActivity />
    </AtlasProvider>
  );
}
