import { chartDataProblem, type GenUXChartSeries } from '../../react/GenUXChart';
import {
  assertId,
  nativeRecord,
  type NativeDefinition,
  type NativePayload,
} from '../native-contract';

const maxCategories = 24;
const maxSeries = 8;
const maxTitle = 160;
const maxDescription = 400;
const maxName = 80;

const boundedText = (value: unknown, limit: number, label: string): string => {
  if (typeof value !== 'string' || value.trim() === '' || value.length > limit)
    throw new Error(`${label} is invalid.`);
  return value;
};

/** Read-only grouped bars; every value must already pass the shared chart data check. */
export const definition: NativeDefinition = {
  name: 'GenUXSeriesChart',
  readOnly: true,
  parse(input) {
    const data = nativeRecord(
      input,
      ['title', 'description', 'categories', 'series'],
      ['title', 'categories', 'series'],
    );
    boundedText(data.title, maxTitle, 'Chart title');
    if (data.description !== undefined)
      boundedText(data.description, maxDescription, 'Chart description');
    const { categories, series } = data;
    if (!Array.isArray(categories) || categories.length > maxCategories)
      throw new Error('Chart categories are invalid.');
    for (const category of categories) boundedText(category, maxName, 'Chart category');
    if (!Array.isArray(series) || series.length > maxSeries)
      throw new Error('Chart series are invalid.');
    for (const item of series) {
      if (!item || typeof item !== 'object' || Array.isArray(item))
        throw new Error('Chart series are invalid.');
      for (const key of Object.keys(item))
        if (!['id', 'label', 'values'].includes(key))
          throw new Error(`Chart series property ${key} is not approved.`);
      assertId(item.id, 'Chart series ID');
      boundedText(item.label, maxName, 'Chart series label');
    }
    const problem = chartDataProblem(
      categories as string[],
      series as unknown as GenUXChartSeries[],
    );
    if (problem) throw new Error(problem);
    return data;
  },
};

export const sample: NativePayload = {
  title: 'Requests by quarter',
  description: 'Support and billing requests opened each quarter.',
  categories: ['Q1', 'Q2', 'Q3'],
  series: [
    { id: 'support', label: 'Support', values: [12, 18, 9] },
    { id: 'billing', label: 'Billing', values: [4, 7, 11] },
  ],
};
