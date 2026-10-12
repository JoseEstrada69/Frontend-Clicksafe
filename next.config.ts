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

const nextConfig: NextConfig = {
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
