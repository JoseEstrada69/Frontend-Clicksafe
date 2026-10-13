import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatNumber } from '@/lib/format';

describe('format.ts (hora de la Ciudad de México)', () => {
  it('convierte de UTC a la hora de la Ciudad de México', () => {
    // 03:00 UTC del 13 de octubre = 21:00 del 12 de octubre en CDMX (UTC-6)
    const text = formatDateTime('2026-10-13T03:00:00.000Z');
    expect(text).toMatch(/12/);
    expect(text).toMatch(/21:00|9:00/);
    expect(formatDate('2026-10-13T03:00:00.000Z')).toMatch(/12/);
  });

  it('una fecha inválida se muestra como guion', () => {
    expect(formatDate('no-es-fecha')).toBe('—');
    expect(formatDateTime('')).toBe('—');
  });

  it('números con separador de miles de es-MX', () => {
    expect(formatNumber(12345)).toBe('12,345');
  });
});
