import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MESSAGES, type ApiError } from '@/lib/errors';
import { loadWithFakeApi, stubSessionStorage } from './helpers/fake-api';

const REFRESH_KEY = 'clicksafe.refreshToken';
const ME = {
  nombre: 'Admin',
  correo: 'admin@example.com',
  rol: 'admin',
  fechaRegistro: '2026-01-01T00:00:00.000Z',
  totpActivo: true,
};
const NEW_TOKENS = { accessToken: 'new', refreshToken: 'r2', expiresIn: 900 };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isRefresh = (url?: string) => url?.endsWith('/auth/refresh') ?? false;

let storage: Map<string, string>;

beforeEach(() => {
  storage = stubSessionStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('refresco compartido (api.ts)', () => {
  it('5 errores 401 simultáneos hacen UNA sola llamada a /auth/refresh', async () => {
    let refreshCalls = 0;
    const lib = await loadWithFakeApi(async (config) => {
      if (isRefresh(config.url)) {
        refreshCalls += 1;
        await wait(20);
        return { status: 200, data: NEW_TOKENS };
      }
      await wait(5);
      return config.headers.Authorization === 'Bearer new'
        ? { status: 200, data: ME }
        : { status: 401 };
    });
    lib.setSession({ accessToken: 'old', refreshToken: 'r1', expiresIn: 900 });

    const results = await Promise.all(
      Array.from({ length: 5 }, () => lib.getMe()),
    );

    expect(refreshCalls).toBe(1);
    expect(results).toHaveLength(5);
    expect(results.every((me) => me.nombre === 'Admin')).toBe(true);
    expect(lib.getAccessToken()).toBe('new');
    expect(storage.get(REFRESH_KEY)).toBe('r2');
  });

  it('manda el refresh token guardado en el body de /auth/refresh', async () => {
    let body: unknown;
    const lib = await loadWithFakeApi((config) => {
      if (isRefresh(config.url)) {
        body = JSON.parse(String(config.data));
        return { status: 200, data: NEW_TOKENS };
      }
      return config.headers.Authorization === 'Bearer new'
        ? { status: 200, data: ME }
        : { status: 401 };
    });
    lib.setSession({ accessToken: 'old', refreshToken: 'r1', expiresIn: 900 });

    await lib.getMe();

    expect(body).toEqual({ refreshToken: 'r1' });
  });

  it('si el servidor rechaza el refresh, borra la sesión y avisa "Tu sesión expiró"', async () => {
    const lib = await loadWithFakeApi((config) =>
      isRefresh(config.url) ? { status: 401 } : { status: 401 },
    );
    lib.setSession({ accessToken: 'old', refreshToken: 'r1', expiresIn: 900 });
    const ended = vi.fn();
    lib.onSessionEnd(ended);

    const error = await lib.getMe().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(lib.ApiError);
    expect(lib.getAccessToken()).toBeNull();
    expect(storage.has(REFRESH_KEY)).toBe(false);
    expect(lib.getLoginNotice()).toBe(MESSAGES.sessionExpired);
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('si el servidor no responde al refresh, conserva la sesión y da error de conexión', async () => {
    const lib = await loadWithFakeApi((config) =>
      isRefresh(config.url) ? 'network' : { status: 401 },
    );
    lib.setSession({ accessToken: 'old', refreshToken: 'r1', expiresIn: 900 });

    const error = await lib.getMe().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(lib.ApiError);
    expect((error as ApiError).status).toBeNull();
    expect((error as ApiError).userMessage).toBe(MESSAGES.network);
    expect(storage.get(REFRESH_KEY)).toBe('r1');
    expect(lib.getLoginNotice()).toBeNull();
  });

  it('reintenta la petición original una sola vez', async () => {
    let meCalls = 0;
    let refreshCalls = 0;
    const lib = await loadWithFakeApi((config) => {
      if (isRefresh(config.url)) {
        refreshCalls += 1;
        return { status: 200, data: NEW_TOKENS };
      }
      meCalls += 1;
      return { status: 401 };
    });
    lib.setSession({ accessToken: 'old', refreshToken: 'r1', expiresIn: 900 });

    const error = await lib.getMe().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(lib.ApiError);
    expect(meCalls).toBe(2);
    expect(refreshCalls).toBe(1);
  });

  it('contraseña actual incorrecta (400 INVALID_CURRENT_PASSWORD) → mensaje propio, sin refresco', async () => {
    let refreshCalls = 0;
    let passwordCalls = 0;
    const lib = await loadWithFakeApi((config) => {
      if (isRefresh(config.url)) {
        refreshCalls += 1;
        return { status: 200, data: NEW_TOKENS };
      }
      passwordCalls += 1;
      return {
        status: 400,
        data: {
          statusCode: 400,
          error: 'Bad Request',
          message: 'Contraseña actual incorrecta (INVALID_CURRENT_PASSWORD)',
          requestId: '5b1e2c2a-1234-4a5b-8c9d-0e1f2a3b4c5d',
          code: 'INVALID_CURRENT_PASSWORD',
        },
      };
    });
    lib.setSession({ accessToken: 'old', refreshToken: 'r1', expiresIn: 900 });

    const error = (await lib
      .changePassword({ passwordActual: 'mala', nuevaPassword: 'nueva12345' })
      .catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(lib.ApiError);
    expect(error.status).toBe(400);
    expect(error.code).toBe('INVALID_CURRENT_PASSWORD');
    expect(error.userMessage).toBe('La contraseña actual no es correcta.');
    expect(passwordCalls).toBe(1);
    expect(refreshCalls).toBe(0);
    expect(lib.getAccessToken()).toBe('old');
  });

  it('PATCH /me/password renueva ANTES de enviar si el token vence en menos de 1 minuto', async () => {
    const order: string[] = [];
    let passwordAuth: unknown;
    const lib = await loadWithFakeApi((config) => {
      if (isRefresh(config.url)) {
        order.push('refresh');
        return { status: 200, data: NEW_TOKENS };
      }
      order.push('password');
      passwordAuth = config.headers.Authorization;
      return { status: 204 };
    });
    // Vence en 30 s
    lib.setSession({ accessToken: 'old', refreshToken: 'r1', expiresIn: 30 });

    await lib.changePassword({ passwordActual: 'actual123', nuevaPassword: 'nueva12345' });

    expect(order).toEqual(['refresh', 'password']);
    expect(passwordAuth).toBe('Bearer new');
  });

  it('con el token vigente no renueva antes de enviar', async () => {
    const order: string[] = [];
    const lib = await loadWithFakeApi((config) => {
      order.push(isRefresh(config.url) ? 'refresh' : 'password');
      return { status: 204 };
    });
    lib.setSession({ accessToken: 'old', refreshToken: 'r1', expiresIn: 900 });

    await lib.changePassword({ passwordActual: 'actual123', nuevaPassword: 'nueva12345' });

    expect(order).toEqual(['password']);
  });

  it('si la renovación previa falla, la contraseña NO se envía', async () => {
    const order: string[] = [];
    const lib = await loadWithFakeApi((config) => {
      order.push(isRefresh(config.url) ? 'refresh' : 'password');
      return isRefresh(config.url) ? 'network' : { status: 204 };
    });
    lib.setSession({ accessToken: 'old', refreshToken: 'r1', expiresIn: 30 });

    const error = await lib
      .changePassword({ passwordActual: 'actual123', nuevaPassword: 'nueva12345' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(lib.ApiError);
    expect(order).toEqual(['refresh']);
  });

  it('defensa: un 401 en PATCH /me/password tampoco refresca ni reintenta', async () => {
    let refreshCalls = 0;
    let passwordCalls = 0;
    const lib = await loadWithFakeApi((config) => {
      if (isRefresh(config.url)) {
        refreshCalls += 1;
        return { status: 200, data: NEW_TOKENS };
      }
      passwordCalls += 1;
      return { status: 401 };
    });
    lib.setSession({ accessToken: 'old', refreshToken: 'r1', expiresIn: 900 });

    const error = await lib
      .changePassword({ passwordActual: 'mala', nuevaPassword: 'nueva12345' })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(lib.ApiError);
    expect((error as ApiError).status).toBe(401);
    expect(passwordCalls).toBe(1);
    expect(refreshCalls).toBe(0);
    // La sesión sigue intacta
    expect(lib.getAccessToken()).toBe('old');
    expect(storage.get(REFRESH_KEY)).toBe('r1');
  });

  it('un 401 en rutas /auth/* no dispara el refresco', async () => {
    let refreshCalls = 0;
    const lib = await loadWithFakeApi((config) => {
      if (isRefresh(config.url)) refreshCalls += 1;
      return { status: 401 };
    });
    lib.setSession({ accessToken: 'old', refreshToken: 'r1', expiresIn: 900 });

    await expect(lib.logout()).rejects.toBeInstanceOf(lib.ApiError);
    expect(refreshCalls).toBe(0);
  });
});

describe('cliente api.ts', () => {
  it('agrega el Bearer desde la memoria y usa la ruta relativa /api/v1', async () => {
    let seen: { auth?: unknown; baseURL?: string; url?: string } = {};
    const lib = await loadWithFakeApi((config) => {
      seen = {
        auth: config.headers.Authorization,
        baseURL: config.baseURL,
        url: config.url,
      };
      return { status: 200, data: ME };
    });
    lib.setSession({ accessToken: 'abc', refreshToken: 'r1', expiresIn: 900 });

    await lib.getMe();

    expect(seen).toEqual({ auth: 'Bearer abc', baseURL: '/api/v1', url: '/me' });
  });

  it('nunca expone el message técnico del servidor', async () => {
    const lib = await loadWithFakeApi(() => ({
      status: 500,
      data: {
        statusCode: 500,
        error: 'Internal Server Error',
        message: "QueryFailedError: Unknown column 'x' in table Usuario",
        requestId: '5b1e2c2a-1234-4a5b-8c9d-0e1f2a3b4c5d',
      },
    }));
    lib.setSession({ accessToken: 'abc', refreshToken: 'r1', expiresIn: 900 });

    const error = (await lib.getMe().catch((e: unknown) => e)) as ApiError;

    expect(error.userMessage).toBe(MESSAGES.server);
    expect(error.message).not.toContain('Usuario');
    expect(error.supportCode).toBe('5b1e2c2a-1234-4a5b-8c9d-0e1f2a3b4c5d');
  });

  it('el access token no se guarda en sessionStorage, solo el refresh', async () => {
    const lib = await loadWithFakeApi(() => ({ status: 200 }));
    lib.setSession({ accessToken: 'abc', refreshToken: 'r1', expiresIn: 900 });

    expect([...storage.values()]).toEqual(['r1']);
  });
});
