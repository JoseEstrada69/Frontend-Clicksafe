// La API manda fechas ISO 8601 en UTC; se muestran en hora de la Ciudad de México.

const LOCALE = 'es-MX';
const TIME_ZONE = 'America/Mexico_City';

const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  dateStyle: 'medium',
});

const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  dateStyle: 'medium',
  timeStyle: 'short',
});

const numberFormat = new Intl.NumberFormat(LOCALE);

function parse(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(iso: string): string {
  const date = parse(iso);
  return date ? dateFormat.format(date) : '—';
}

export function formatDateTime(iso: string): string {
  const date = parse(iso);
  return date ? dateTimeFormat.format(date) : '—';
}

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

// Meses de GET /admin/stats ("YYYY-MM"): la API los agrupa en UTC, así que se
// formatean en UTC. Convertirlos a hora de CDMX mostraría el mes anterior.
const monthFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
});
const monthShortFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: 'UTC',
  month: 'short',
  year: '2-digit',
});

function parseMonth(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return new Date(Date.UTC(Number(match[1]), month - 1, 1));
}

/** "2026-10" → "octubre de 2026". */
export function formatMonth(value: string): string {
  const date = parseMonth(value);
  return date ? monthFormat.format(date) : value;
}

/** "2026-10" → "oct 26" (para el eje de la gráfica). */
export function formatMonthShort(value: string): string {
  const date = parseMonth(value);
  return date ? monthShortFormat.format(date).replace('.', '') : value;
}
