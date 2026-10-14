// URLs que llegan en los reportes (CLAUDE.md 7.3 y 7.5).
//
// Las URLs reportadas son, por definición, posibles sitios de estafa o
// phishing. Aquí solo se ANALIZAN: nunca se cargan (ni iframe, ni img, ni
// fetch) y solo se abren tras confirmar, con noopener/noreferrer.

export type UrlWarning = 'credentials' | 'idn' | 'ip' | 'insecure';

export interface ReportedUrlInfo {
  /** URL normalizada por el navegador; solo http(s). */
  href: string;
  /**
   * Dominio tal como lo resuelve el navegador. Un dominio internacional sale
   * en punycode (xn--…), no con las letras que imitan a otro sitio.
   */
  hostname: string;
  warnings: UrlWarning[];
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Analiza una URL reportada. Devuelve null si no es una URL absoluta http(s)
 * (por ejemplo `javascript:alert(1)` o `data:text/html,...`): esas nunca se
 * pueden abrir.
 */
export function parseReportedUrl(raw: string): ReportedUrlInfo | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname) return null;

  const warnings: UrlWarning[] = [];
  // https://mercadolibre.com.mx@estafa.com en realidad va a estafa.com
  if (url.username || url.password) warnings.push('credentials');
  // Letras de otros alfabetos que imitan a un dominio conocido (homógrafos)
  if (url.hostname.split('.').some((label) => label.startsWith('xn--'))) {
    warnings.push('idn');
  }
  if (IPV4.test(url.hostname) || url.hostname.startsWith('[')) {
    warnings.push('ip');
  }
  if (url.protocol === 'http:') warnings.push('insecure');

  return { href: url.href, hostname: url.hostname, warnings };
}

export const URL_WARNING_TEXT: Record<UrlWarning, string> = {
  credentials:
    'La dirección incluye texto antes de "@": el sitio real es el que aparece después.',
  idn: 'El dominio usa caracteres internacionales que pueden imitar a otro sitio.',
  ip: 'La dirección usa una IP en lugar de un nombre de dominio.',
  insecure: 'El sitio no usa conexión cifrada (http).',
};

/** Abre una URL reportada ya validada, sin dar acceso al panel. */
export function openReportedUrl(info: ReportedUrlInfo): void {
  // noopener: la página abierta no puede controlar la pestaña del panel
  // (reverse tabnabbing). noreferrer: no sabe desde dónde se abrió.
  window.open(info.href, '_blank', 'noopener,noreferrer');
}

// Evidencias: la API manda rutas firmadas de MISMO origen,
// /api/v1/evidences/{id}?exp={unix}&sig={hex}. Cualquier otra cosa (otro
// dominio, //host, rutas con "..", esquemas) se rechaza.
const EVIDENCE_PATH = /^\/api\/v1\/evidences\/\d+(\?[A-Za-z0-9=&]*)?$/;

export function isSafeEvidenceUrl(raw: string): boolean {
  return EVIDENCE_PATH.test(raw);
}
