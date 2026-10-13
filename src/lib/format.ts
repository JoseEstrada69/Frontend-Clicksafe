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
