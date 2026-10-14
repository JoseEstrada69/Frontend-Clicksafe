import { useId } from 'react';
import { barLength, countAxis, truncateLabel, type ChartDatum } from '@/lib/chart';
import { formatNumber } from '@/lib/format';
import styles from './BarChart.module.css';

interface BarChartProps {
  title: string;
  /** Resumen en una frase para lectores de pantalla. */
  description: string;
  data: ChartDatum[];
  orientation: 'vertical' | 'horizontal';
  /** Encabezado de la columna de etiquetas en la tabla "Ver datos". */
  labelHeader: string;
}

// Medidas en unidades del viewBox: el SVG se escala al ancho disponible.
const WIDTH = 640;

/**
 * Gráfica de barras en SVG hecho a mano (sin librerías). Todo es texto
 * escapado por React y atributos SVG; los colores salen de clases con tokens,
 * así que no necesita estilos inline (CSP). Incluye <title>/<desc> y una
 * tabla alternativa accesible en "Ver datos".
 */
export function BarChart({
  title,
  description,
  data,
  orientation,
  labelHeader,
}: BarChartProps) {
  const id = useId();
  const axis = countAxis(data.map((d) => d.value));

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>{title}</figcaption>
      {orientation === 'vertical' ? (
        <VerticalBars id={id} title={title} description={description} data={data} axis={axis} />
      ) : (
        <HorizontalBars id={id} title={title} description={description} data={data} axis={axis} />
      )}
      <details className={styles.details}>
        <summary>Ver datos</summary>
        <table className={styles.table}>
          <caption className="visually-hidden">{title}</caption>
          <thead>
            <tr>
              <th scope="col">{labelHeader}</th>
              <th scope="col" className={styles.numeric}>
                Reportes
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((datum) => (
              <tr key={datum.label}>
                <th scope="row">{datum.label}</th>
                <td className={styles.numeric}>{formatNumber(datum.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

interface BarsProps {
  id: string;
  title: string;
  description: string;
  data: ChartDatum[];
  axis: ReturnType<typeof countAxis>;
}

function VerticalBars({ id, title, description, data, axis }: BarsProps) {
  const height = 260;
  const margin = { top: 16, right: 8, bottom: 36, left: 44 };
  const plotWidth = WIDTH - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const band = plotWidth / Math.max(1, data.length);
  const barWidth = Math.min(48, band * 0.6);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      className={styles.svg}
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
    >
      <title id={`${id}-title`}>{title}</title>
      <desc id={`${id}-desc`}>{description}</desc>
      {axis.ticks.map((tick) => {
        const y = margin.top + plotHeight - barLength(tick, axis.max, plotHeight);
        return (
          <g key={tick} aria-hidden="true">
            <line x1={margin.left} x2={WIDTH - margin.right} y1={y} y2={y} className={styles.grid} />
            <text x={margin.left - 8} y={y} className={styles.tick} textAnchor="end" dominantBaseline="middle">
              {formatNumber(tick)}
            </text>
          </g>
        );
      })}
      {data.map((datum, index) => {
        const length = barLength(datum.value, axis.max, plotHeight);
        const center = margin.left + band * index + band / 2;
        return (
          <g key={datum.label}>
            <rect
              x={center - barWidth / 2}
              y={margin.top + plotHeight - length}
              width={barWidth}
              height={length}
              rx={3}
              className={`${styles.bar} ${styles[datum.tone ?? 'default']}`}
            >
              <title>{`${datum.label}: ${formatNumber(datum.value)}`}</title>
            </rect>
            <text
              x={center}
              y={height - margin.bottom + 18}
              className={styles.label}
              textAnchor="middle"
              aria-hidden="true"
            >
              {truncateLabel(datum.shortLabel ?? datum.label, 12)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function HorizontalBars({ id, title, description, data, axis }: BarsProps) {
  const row = 34;
  const labelWidth = 170;
  const valueWidth = 56;
  const height = Math.max(row, data.length * row) + 8;
  const plotWidth = WIDTH - labelWidth - valueWidth;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      className={styles.svg}
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
    >
      <title id={`${id}-title`}>{title}</title>
      <desc id={`${id}-desc`}>{description}</desc>
      {data.map((datum, index) => {
        const y = index * row + 4;
        const length = barLength(datum.value, axis.max, plotWidth);
        return (
          <g key={datum.label}>
            <text
              x={labelWidth - 10}
              y={y + row / 2}
              className={styles.label}
              textAnchor="end"
              dominantBaseline="middle"
              aria-hidden="true"
            >
              {truncateLabel(datum.shortLabel ?? datum.label, 22)}
            </text>
            <rect
              x={labelWidth}
              y={y + 6}
              width={length}
              height={row - 12}
              rx={3}
              className={`${styles.bar} ${styles[datum.tone ?? 'default']}`}
            >
              <title>{`${datum.label}: ${formatNumber(datum.value)}`}</title>
            </rect>
            <text
              x={labelWidth + length + 8}
              y={y + row / 2}
              className={styles.value}
              dominantBaseline="middle"
              aria-hidden="true"
            >
              {formatNumber(datum.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
