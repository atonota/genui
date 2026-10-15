import { useId, type CSSProperties } from 'react';
import { useI18n } from './useI18n';

export type AtlasChartSeries = { id: string; label: string; values: number[] };

export type AtlasChartProps = {
  title: string;
  categories: string[];
  series: AtlasChartSeries[];
  description?: string;
};

/** Fill and pattern pairs; later series reuse them and keep their own legend label. */
const seriesStyleCount = 4;

const isChartValue = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

// Percentages keep SVG text at its CSS size; a viewBox would scale labels below 14px.
const percent = (value: number) => `${Number(value.toFixed(3))}%`;

/** English reason the data cannot be drawn, or undefined when every value is usable. */
export function chartDataProblem(
  categories: readonly string[],
  series: readonly AtlasChartSeries[],
): string | undefined {
  if (categories.length === 0 || series.length === 0) {
    return 'Add at least one category and one series.';
  }
  if (categories.some(category => typeof category !== 'string' || category.trim() === '')) {
    return 'Every category needs a name.';
  }
  const ids = new Set<string>();
  for (const item of series) {
    if (typeof item.id !== 'string' || item.id.trim() === '' || ids.has(item.id)) {
      return 'Every series needs a unique id.';
    }
    ids.add(item.id);
    if (typeof item.label !== 'string' || item.label.trim() === '') {
      return 'Every series needs a name.';
    }
    if (!Array.isArray(item.values) || item.values.length !== categories.length) {
      return 'Every series needs one value for each category.';
    }
    if (!item.values.every(isChartValue)) {
      return 'Values must be finite numbers of zero or more.';
    }
  }
  return undefined;
}

function PatternMark({ style }: { style: number }) {
  if (style === 1) {
    return <path className="atlas-chart-pattern-line" d="M-2 2L2-2M0 8L8 0M6 10L10 6" />;
  }
  if (style === 2) return <circle className="atlas-chart-pattern-dot" cx="4" cy="4" r="1.5" />;
  if (style === 3) return <path className="atlas-chart-pattern-line" d="M0 0L8 8M8 0L0 8" />;
  return null;
}

/** Grouped bars on one zero-based scale, a patterned legend and the full data table. */
export default function AtlasChart({ title, categories, series, description }: AtlasChartProps) {
  const { t, locale } = useI18n();
  // useId characters can break url(#id) references, so keep only safe ones.
  const id = `atlas-chart-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const problem = chartDataProblem(categories, series);
  if (problem) {
    return (
      <div
        className="atlas-chart atlas-chart-unavailable"
        role="alert"
        data-chart-state="unavailable"
      >
        <p className="atlas-chart-title">{title}</p>
        <p>{t('Chart data unavailable')}</p>
        <p className="atlas-chart-description">{t(problem)}</p>
      </div>
    );
  }
  const format = new Intl.NumberFormat(locale);
  // All series share one scale from zero; all-zero data keeps a safe unit range.
  const largest = Math.max(...series.flatMap(item => item.values));
  const scaleMax = largest > 0 ? largest : 1;
  const groupWidth = 100 / categories.length;
  const barSlot = (groupWidth * 0.8) / series.length;
  const titleId = `${id}-title`;
  const descriptionId = description ? `${id}-description` : undefined;
  const tableId = `${id}-table`;
  const fill = (index: number) => `url(#${id}-pattern-${index})`;
  const layout = {
    '--atlas-chart-categories': String(categories.length),
    '--atlas-chart-bars': String(categories.length * (series.length + 1)),
  } as CSSProperties;
  return (
    <figure
      className="atlas-chart"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-chart-state="ready"
      style={layout}
    >
      <figcaption className="atlas-chart-caption">
        <span id={titleId} className="atlas-chart-title">
          {title}
        </span>
        {description && (
          <span id={descriptionId} className="atlas-chart-description">
            {description}
          </span>
        )}
      </figcaption>
      <ul className="atlas-chart-legend" aria-label={t('Legend')}>
        {series.map((item, index) => (
          <li key={item.id} className="atlas-chart-legend-item">
            <svg className="atlas-chart-swatch" aria-hidden="true" focusable="false">
              <rect
                className="atlas-chart-bar"
                data-series-style={index % seriesStyleCount}
                width="100%"
                height="100%"
                fill={fill(index)}
              />
            </svg>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
      <div
        className="atlas-chart-plot-scroll"
        role="group"
        tabIndex={0}
        aria-label={t('Chart bars. Values are listed in the table.')}
      >
        <div className="atlas-chart-plot">
          <svg className="atlas-chart-svg" aria-hidden="true" focusable="false">
            <defs>
              {series.map((item, index) => (
                <pattern
                  key={item.id}
                  id={`${id}-pattern-${index}`}
                  data-series-style={index % seriesStyleCount}
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                >
                  <rect className="atlas-chart-pattern-base" width="8" height="8" />
                  <PatternMark style={index % seriesStyleCount} />
                </pattern>
              ))}
            </defs>
            <line className="atlas-chart-gridline" x1="0" x2="100%" y1="0" y2="0" />
            <line className="atlas-chart-gridline" x1="0" x2="100%" y1="50%" y2="50%" />
            {categories.map((_, column) =>
              series.map((item, index) => {
                const value = item.values[column]!;
                const height = (value / scaleMax) * 100;
                const start = column * groupWidth + groupWidth * 0.1 + index * barSlot;
                return (
                  <g key={`${item.id}-${column}`} data-series-style={index % seriesStyleCount}>
                    <rect
                      className="atlas-chart-bar"
                      x={percent(start + barSlot * 0.1)}
                      y={percent(100 - height)}
                      width={percent(barSlot * 0.8)}
                      height={percent(height)}
                      fill={fill(index)}
                    />
                    <text
                      className="atlas-chart-value"
                      x={percent(start + barSlot / 2)}
                      y={percent(100 - height)}
                      dy="-0.4em"
                      textAnchor="middle"
                    >
                      {format.format(value)}
                    </text>
                  </g>
                );
              }),
            )}
            <line className="atlas-chart-baseline" x1="0" x2="100%" y1="100%" y2="100%" />
          </svg>
          <ol className="atlas-chart-categories" aria-hidden="true">
            {categories.map((category, column) => (
              <li key={column}>{category}</li>
            ))}
          </ol>
        </div>
      </div>
      <div
        className="atlas-chart-table-scroll"
        role="region"
        tabIndex={0}
        aria-labelledby={tableId}
      >
        <table className="atlas-chart-table">
          <caption id={tableId}>{t('{title} values', { title })}</caption>
          <thead>
            <tr>
              <th scope="col">{t('Category')}</th>
              {series.map(item => (
                <th key={item.id} scope="col" className="atlas-chart-numeric">
                  {item.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((category, column) => (
              <tr key={column}>
                <th scope="row">{category}</th>
                {series.map(item => (
                  <td key={item.id} className="atlas-chart-numeric">
                    {format.format(item.values[column]!)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
