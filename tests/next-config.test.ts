import { afterEach, describe, expect, it, vi } from 'vitest';
import nextConfig from '../next.config';

async function apiRewrite() {
  if (!nextConfig.rewrites) throw new Error('next.config.ts no define rewrites');
  const rewrites = await nextConfig.rewrites();
  if (!Array.isArray(rewrites)) throw new Error('Se esperaba un arreglo');
  return rewrites[0];
}

describe('rewrites de /api/v1', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reenvía /api/v1 al backend configurado', async () => {
    vi.stubEnv('API_PROXY_TARGET', 'http://localhost:3000/');
    expect(await apiRewrite()).toEqual({
      source: '/api/v1/:path*',
      destination: 'http://localhost:3000/api/v1/:path*',
    });
  });

  it('falla con un mensaje claro si falta API_PROXY_TARGET', async () => {
    vi.stubEnv('API_PROXY_TARGET', '');
    await expect(apiRewrite()).rejects.toThrow(/API_PROXY_TARGET/);
  });

  it('rechaza esquemas que no son http(s)', async () => {
    vi.stubEnv('API_PROXY_TARGET', 'file:///etc/passwd');
    await expect(apiRewrite()).rejects.toThrow(/API_PROXY_TARGET/);
  });
});
