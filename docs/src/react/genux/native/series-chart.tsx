import GenUXChart, { type GenUXChartSeries } from '../../GenUXChart';
import type { NativeAdapterProps } from '../../../genux/native-contract';

/** Data arrives parsed by the series-chart schema; the chart owns legend, bars and table. */
export default function GenUXSeriesChart({ data }: NativeAdapterProps) {
  return (
    <GenUXChart
      title={data.title as string}
      description={typeof data.description === 'string' ? data.description : undefined}
      categories={data.categories as string[]}
      series={data.series as unknown as GenUXChartSeries[]}
    />
  );
}
