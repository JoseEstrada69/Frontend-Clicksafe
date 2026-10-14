// Escalas para las gráficas SVG hechas a mano (sin librerías).

export interface ChartDatum {
  /** Etiqueta completa (tabla "Ver datos" y <title> de la barra). */
  label: string;
  /** Etiqueta corta para el eje, por ejemplo "oct 26". */
  shortLabel?: string;
  value: number;
  /** Variante de color (por ejemplo, el estado del reporte). */
  tone?: 'default' | 'pending' | 'validated' | 'rejected';
}

export interface Axis {
  /** Valor máximo del eje, "redondo" y ≥ al mayor dato. */
  max: number;
  /** Marcas del eje, de 0 a `max`. */
  ticks: number[];
}

/** Paso "redondo" (1, 2 o 5 × 10ⁿ) para unas `target` marcas. Solo enteros. */
function niceStep(max: number, target: number): number {
  const raw = max / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return Math.max(1, Math.ceil(factor * magnitude));
}

/** Eje para conteos (enteros ≥ 0). Con todo en 0 devuelve un eje de 0 a 1. */
export function countAxis(values: number[], target = 4): Axis {
  const largest = Math.max(0, ...values.filter(Number.isFinite));
  if (largest === 0) return { max: 1, ticks: [0, 1] };
  const step = niceStep(largest, target);
  const max = Math.ceil(largest / step) * step;
  const ticks: number[] = [];
  for (let tick = 0; tick <= max; tick += step) ticks.push(tick);
  return { max, ticks };
}

/** Largo de una barra en unidades del SVG (nunca negativo ni NaN). */
export function barLength(value: number, axisMax: number, length: number): number {
  if (!Number.isFinite(value) || value <= 0 || axisMax <= 0) return 0;
  return (Math.min(value, axisMax) / axisMax) * length;
}

/** Recorta etiquetas largas para el eje; el texto completo va en <title>. */
export function truncateLabel(label: string, max: number): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}
