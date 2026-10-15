import AtlasChart, { type AtlasChartSeries } from '../../AtlasChart';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import '../../../styles/atlas-chart.css';

/** Data arrives parsed by the series-chart schema; the chart owns legend, bars and table. */
export default function AtlasSeriesChart({ data }: NativeAdapterProps) {
  return (
    <AtlasChart
      title={data.title as string}
      description={typeof data.description === 'string' ? data.description : undefined}
      categories={data.categories as string[]}
      series={data.series as unknown as AtlasChartSeries[]}
    />
  );
}
