import { useId, useState } from 'react';
import { Select } from 'antd';
import GenUXProvider from './GenUXProvider';
import GenUXChart from './GenUXChart';
import ExamplePreview from './ExamplePreview';
import { TweakerSettings } from './GenUXTweaker';
import { useI18n } from './useI18n';

type SeriesChoice = 'both' | 'planned' | 'completed';

function WeeklyActivity() {
  const { t } = useI18n();
  const seriesId = useId();
  // Presentation only: the local weekly values stay unchanged.
  const [visible, setVisible] = useState<SeriesChoice>('both');
  const series = [
    { id: 'planned', label: t('Planned'), values: [10, 15, 12] },
    { id: 'completed', label: t('Completed'), values: [8, 12, 11] },
  ].filter(item => visible === 'both' || item.id === visible);
  return (
    <ExamplePreview id="chart-weekly-activity" title={t('Planned and completed work')}>
      <section className="genux-chart-demo">
        <h3>{t('Planned and completed work')}</h3>
        <TweakerSettings title="Chart settings">
          <div className="genux-tweaker-option">
            <label htmlFor={seriesId}>{t('Series shown')}</label>
            <Select
              id={seriesId}
              value={visible}
              options={[
                { value: 'both', label: t('Both series') },
                { value: 'planned', label: t('Planned') },
                { value: 'completed', label: t('Completed') },
              ]}
              onChange={(next: SeriesChoice) => setVisible(next)}
            />
          </div>
        </TweakerSettings>
        <GenUXChart
          title={t('Weekly activity')}
          description={
            visible === 'both'
              ? t(
                  'Tasks planned and completed each day. Both series share one scale that starts at zero.',
                )
              : t('Tasks each day on one scale that starts at zero.')
          }
          categories={[t('Mon'), t('Tue'), t('Wed')]}
          series={series}
        />
      </section>
    </ExamplePreview>
  );
}

/** Weekly activity as grouped bars with a legend and the complete value table. */
export default function ChartDemo({ documentation = false }: { documentation?: boolean }) {
  return (
    <GenUXProvider appearance={documentation ? 'docs' : undefined}>
      <WeeklyActivity />
    </GenUXProvider>
  );
}
