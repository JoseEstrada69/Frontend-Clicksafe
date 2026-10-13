import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy, proxy } from '@/proxy';

function cspFor(path: string): string {
  const response = proxy(new NextRequest(`http://localhost:3001${path}`));
  return response.headers.get('Content-Security-Policy') ?? '';
}

function nonceOf(csp: string): string | undefined {
  return /'nonce-([^']+)'/.exec(csp)?.[1];
}

describe('CSP (src/proxy.ts)', () => {
  it('cada petición recibe un nonce distinto', () => {
    const first = nonceOf(cspFor('/login'));
    const second = nonceOf(cspFor('/login'));
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(first).not.toBe(second);
  });

  it('el nonce de scripts y estilos es el mismo dentro de una respuesta', () => {
    const csp = cspFor('/');
    const nonce = nonceOf(csp);
    expect(csp).toContain(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`);
    expect(csp).toContain(`style-src 'self' 'nonce-${nonce}'`);
  });

  it('producción: directivas estrictas, sin unsafe-eval ni unsafe-inline', () => {
    const csp = buildContentSecurityPolicy('abc', false);
    for (const directive of [
      "default-src 'self'",
      "img-src 'self' blob: data:",
      "font-src 'self'",
      "connect-src 'self'",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ]) {
      expect(csp).toContain(directive);
    }
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).not.toContain('unsafe-inline');
  });

  it("desarrollo: agrega 'unsafe-eval' y no fuerza https", () => {
    const csp = buildContentSecurityPolicy('abc', true);
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain('upgrade-insecure-requests');
    expect(csp).not.toContain('unsafe-inline');
  });
});
