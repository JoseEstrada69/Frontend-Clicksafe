import { NextResponse, type NextRequest } from 'next/server';

// Content Security Policy con nonce por petición (guía oficial de Next 16:
// node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
// Next lee el nonce de esta cabecera y lo pone en sus propios <script>; un
// script inyectado por un atacante no lo trae y el navegador no lo ejecuta.
export function buildContentSecurityPolicy(
  nonce: string,
  isDev: boolean,
): string {
  const directives = [
    "default-src 'self'",
    // 'unsafe-eval' solo en desarrollo: React lo usa para reconstruir las
    // pilas de error en el navegador. En producción no se usa.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'`,
    // data: es para el QR del 2FA, que la API manda como data URL
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (!isDev) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildContentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === 'development',
  );

  // Next extrae el nonce de la CSP de la *petición* al renderizar
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Todo menos la API (la reenvía next.config.ts), los archivos estáticos
      // y el favicon, que no son HTML y no necesitan CSP.
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
