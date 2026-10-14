import axios, {
  AxiosError,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios';
import { vi } from 'vitest';

export type FakeReply = { status: number; data?: unknown } | 'network';
export type FakeHandler = (
  config: InternalAxiosRequestConfig,
) => FakeReply | Promise<FakeReply>;

/** Adapter de axios que responde con `handler` en vez de ir a la red. */
export function fakeAdapter(handler: FakeHandler): AxiosAdapter {
  return async (config) => {
    const reply = await handler(config);
    if (reply === 'network') {
      throw new AxiosError('Network Error', 'ERR_NETWORK', config);
    }
    const response = {
      data: reply.data,
      status: reply.status,
      statusText: '',
      headers: {},
      config,
    };
    if (reply.status >= 400) {
      throw new AxiosError(
        'Request failed',
        'ERR_BAD_RESPONSE',
        config,
        null,
        response,
      );
    }
    return response;
  };
}

/** sessionStorage en memoria (en Node no existe `window`). */
export function stubSessionStorage(): Map<string, string> {
  const data = new Map<string, string>();
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    },
  });
  return data;
}

/**
 * Instala el adapter falso y carga módulos de src/lib desde cero, para que
 * cada prueba empiece sin sesión ni refresco pendiente. `api.ts` copia el
 * adapter de axios.defaults al crearse, por eso se importa después.
 */
export async function loadWithFakeApi(handler: FakeHandler) {
  axios.defaults.adapter = fakeAdapter(handler);
  vi.resetModules();
  const api = await import('@/lib/api');
  const session = await import('@/lib/session');
  const adminApi = await import('@/lib/admin-api');
  const errors = await import('@/lib/errors');
  const authFlow = await import('@/lib/auth-flow');
  return {
    ...api,
    ...session,
    ...adminApi,
    ...authFlow,
    ApiError: errors.ApiError,
  };
}
