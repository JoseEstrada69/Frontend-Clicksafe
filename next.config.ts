import type { NextConfig } from 'next';

// Dirección del backend a la que se reenvía /api/v1/*. Solo la lee el
// servidor de Next (sin prefijo NEXT_PUBLIC_), así que nunca llega al navegador.
function apiProxyTarget(): string {
  const value = process.env.API_PROXY_TARGET;
  let url: URL | null = null;
  try {
    url = value ? new URL(value) : null;
  } catch {
    url = null;
  }
  if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
    throw new Error(
      'API_PROXY_TARGET debe ser una URL http(s), por ejemplo ' +
        'http://localhost:3000. Copia .env.example como .env.local.',
    );
  }
  // Sin la diagonal final para no generar rutas como //api/v1
  return url.origin + url.pathname.replace(/\/+$/, '');
}

// Cabeceras de seguridad para todas las rutas. La CSP no va aquí: necesita
// un nonce distinto en cada petición y la pone src/proxy.ts. HSTS lo pone
// Nginx en producción.
const securityHeaders = [
  // El navegador no "adivina" tipos: un archivo de texto no se ejecuta como script
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Nadie puede meter el panel en un iframe (clickjacking); respaldo de frame-ancestors
  { key: 'X-Frame-Options', value: 'DENY' },
  // No revelar rutas internas del panel a sitios externos
  { key: 'Referrer-Policy', value: 'no-referrer' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  // Una ventana abierta desde el panel no conserva referencia a él
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  // Sin "X-Powered-By: Next.js": no regalar información del stack
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiProxyTarget()}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
