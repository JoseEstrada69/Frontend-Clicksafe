import { describe, expect, it } from 'vitest';
import { isSafeEvidenceUrl, parseReportedUrl } from '@/lib/safe-url';

describe('parseReportedUrl (URL reportada, CLAUDE.md 7.5)', () => {
  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(document.cookie)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'ftp://ejemplo.com/archivo',
    '/ruta/relativa',
    '//sin-esquema.com',
    'no es una url',
    '',
  ])('rechaza %j (no se puede abrir)', (raw) => {
    expect(parseReportedUrl(raw)).toBeNull();
  });

  it('acepta https y muestra el dominio completo', () => {
    const info = parseReportedUrl('https://mercadolibre.com.mx.ofertas-xyz.com/item?id=1');
    expect(info?.hostname).toBe('mercadolibre.com.mx.ofertas-xyz.com');
    expect(info?.warnings).toEqual([]);
  });

  it('detecta el truco del usuario antes de "@" (el sitio real es el de después)', () => {
    const info = parseReportedUrl('https://mercadolibre.com.mx@estafa.example/login');
    expect(info?.hostname).toBe('estafa.example');
    expect(info?.warnings).toContain('credentials');
  });

  it('muestra un dominio internacional en punycode y avisa (homógrafos)', () => {
    // "аmazon" con "а" cirílica
    const info = parseReportedUrl('https://аmazon.com/');
    expect(info?.hostname.startsWith('xn--')).toBe(true);
    expect(info?.warnings).toContain('idn');
  });

  it('avisa cuando el sitio es una IP o no usa https', () => {
    expect(parseReportedUrl('http://192.168.0.10/pago')?.warnings).toEqual(
      expect.arrayContaining(['ip', 'insecure']),
    );
  });
});

describe('isSafeEvidenceUrl (evidencias, CLAUDE.md 7.3)', () => {
  it('acepta la ruta firmada de mismo origen que manda la API', () => {
    expect(
      isSafeEvidenceUrl(`/api/v1/evidences/12?exp=1760000000&sig=${'a1'.repeat(32)}`),
    ).toBe(true);
  });

  it.each([
    'https://evil.example/api/v1/evidences/12?exp=1&sig=a',
    '//evil.example/api/v1/evidences/12',
    '/api/v1/evidences/../admin/users',
    '/api/v1/evidences/12/../../admin',
    '/api/v1/evidences/%2e%2e/admin',
    '/api/v1/evidences/abc',
    '/api/v1/reports/1',
    'javascript:alert(1)',
    'data:image/svg+xml,<svg onload=alert(1)>',
    '/api/v1/evidences/12?exp=1&sig=<script>',
  ])('rechaza %j', (raw) => {
    expect(isSafeEvidenceUrl(raw)).toBe(false);
  });
});
