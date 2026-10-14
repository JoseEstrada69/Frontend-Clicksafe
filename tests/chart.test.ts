import { describe, expect, it } from 'vitest';
import { barLength, countAxis, truncateLabel } from '@/lib/chart';
import { formatMonth, formatMonthShort } from '@/lib/format';

describe('chart.ts (gráficas SVG)', () => {
  it('redondea el máximo del eje hacia arriba con pasos de 1, 2 o 5', () => {
    expect(countAxis([37])).toEqual({ max: 40, ticks: [0, 10, 20, 30, 40] });
    expect(countAxis([3, 7])).toEqual({ max: 8, ticks: [0, 2, 4, 6, 8] });
    expect(countAxis([1]).max).toBe(1);
  });

  it('con todo en 0 da un eje válido (sin dividir entre 0)', () => {
    expect(countAxis([0, 0, 0])).toEqual({ max: 1, ticks: [0, 1] });
    expect(countAxis([])).toEqual({ max: 1, ticks: [0, 1] });
  });

  it('el largo de la barra es proporcional y nunca negativo ni NaN', () => {
    expect(barLength(20, 40, 200)).toBe(100);
    expect(barLength(0, 40, 200)).toBe(0);
    expect(barLength(-5, 40, 200)).toBe(0);
    expect(barLength(Number.NaN, 40, 200)).toBe(0);
    expect(barLength(5, 0, 200)).toBe(0);
  });

  it('recorta etiquetas largas', () => {
    expect(truncateLabel('Mercado Libre México', 10)).toBe('Mercado L…');
    expect(truncateLabel('Amazon', 10)).toBe('Amazon');
  });
});

describe('formatMonth (meses de /admin/stats, agrupados en UTC)', () => {
  it('formatea "YYYY-MM" en español sin correrse al mes anterior', () => {
    expect(formatMonth('2026-10')).toMatch(/octubre/);
    expect(formatMonth('2026-10')).toMatch(/2026/);
    expect(formatMonth('2026-01')).toMatch(/enero/);
    expect(formatMonthShort('2026-10')).toMatch(/oct/);
  });

  it('un valor inesperado se muestra tal cual (como texto)', () => {
    expect(formatMonth('2026-13')).toBe('2026-13');
    expect(formatMonth('octubre')).toBe('octubre');
  });
});
