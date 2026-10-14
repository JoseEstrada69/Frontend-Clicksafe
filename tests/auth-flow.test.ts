import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MESSAGES } from '@/lib/errors';
import { loadWithFakeApi, stubSessionStorage } from './helpers/fake-api';
import type { InternalAxiosRequestConfig } from 'axios';

const TOKENS = { accessToken: 'acc', refreshToken: 'ref', expiresIn: 900 };

let storage: Map<string, string>;
let calls: InternalAxiosRequestConfig[];

beforeEach(() => {
  storage = stubSessionStorage();
  calls = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const bodyOf = (config: InternalAxiosRequestConfig) =>
  JSON.parse(String(config.data)) as Record<string, unknown>;
const callTo = (path: string) => calls.find((c) => c.url === path);

describe('startLogin (W01)', () => {
  it('admin con 2FA → mfaToken solo en memoria y paso "verify"', async () => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return { status: 200, data: { mfaRequired: true, mfaToken: 'mfa-1' } };
    });

    const outcome = await lib.startLogin('admin@example.com', 'secreta123', 'cap');

    expect(outcome).toBe('verify');
    expect(bodyOf(calls[0])).toEqual({
      correo: 'admin@example.com',
      password: 'secreta123',
      captcha: 'cap',
    });
    expect(lib.getPendingMfa()).toMatchObject({ token: 'mfa-1', step: 'verify' });
    expect(lib.getAccessToken()).toBeNull();
    expect(storage.size).toBe(0);
  });

  it('admin sin 2FA → paso "setup"', async () => {
    const lib = await loadWithFakeApi(() => ({
      status: 200,
      data: { mfaSetupRequired: true, mfaToken: 'mfa-2' },
    }));

    expect(await lib.startLogin('a@b.mx', 'x', 'cap')).toBe('setup');
    expect(lib.getPendingMfa()).toMatchObject({ token: 'mfa-2', step: 'setup' });
  });

  it('usuario normal → revoca SU sesión con su propio token y no guarda nada', async () => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return config.url === '/auth/login'
        ? { status: 200, data: TOKENS }
        : { status: 204 };
    });

    const outcome = await lib.startLogin('user@example.com', 'secreta123', 'cap');

    expect(outcome).toBe('not-admin');
    const logout = callTo('/auth/logout');
    expect(logout?.headers.Authorization).toBe('Bearer acc');
    expect(lib.getAccessToken()).toBeNull();
    expect(storage.size).toBe(0);
    expect(lib.getPendingMfa()).toBeNull();
  });

  it('usuario normal aunque el logout falle → igual no guarda nada', async () => {
    const lib = await loadWithFakeApi((config) =>
      config.url === '/auth/login' ? { status: 200, data: TOKENS } : 'network',
    );

    expect(await lib.startLogin('u@e.mx', 'x', 'cap')).toBe('not-admin');
    expect(lib.getAccessToken()).toBeNull();
    expect(storage.size).toBe(0);
  });

  it('401 en el login no dispara el refresco de sesión', async () => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return { status: 401 };
    });

    await expect(lib.startLogin('a@b.mx', 'mala', 'cap')).rejects.toMatchObject({
      status: 401,
    });
    expect(calls.map((c) => c.url)).toEqual(['/auth/login']);
  });
});

describe('completeVerify (W02)', () => {
  it('manda {mfaToken, codigo}, guarda la sesión y olvida el mfaToken', async () => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return { status: 200, data: TOKENS };
    });
    lib.startPendingMfa('mfa-1', 'verify');

    await lib.completeVerify('123456');

    expect(bodyOf(calls[0])).toEqual({ mfaToken: 'mfa-1', codigo: '123456' });
    expect(lib.getAccessToken()).toBe('acc');
    expect(storage.get('clicksafe.refreshToken')).toBe('ref');
    expect(lib.getPendingMfa()).toBeNull();
  });

  it('con el mfaToken vencido (5 min) no llama a la API y da MFA_EXPIRED', async () => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return { status: 200, data: TOKENS };
    });
    lib.startPendingMfa('mfa-1', 'verify', Date.now() - lib.MFA_TOKEN_TTL_MS - 1);

    const error = await lib.completeVerify('123456').catch((e: unknown) => e);

    expect(error).toMatchObject({ code: 'MFA_EXPIRED', userMessage: MESSAGES.mfaExpired });
    expect(calls).toHaveLength(0);
    expect(lib.getPendingMfa()).toBeNull();
  });

  it('sin verificación pendiente (se recargó la página) → MFA_EXPIRED', async () => {
    const lib = await loadWithFakeApi(() => ({ status: 200, data: TOKENS }));
    await expect(lib.completeVerify('123456')).rejects.toMatchObject({
      code: 'MFA_EXPIRED',
    });
  });

  it('código incorrecto → 401 y el mfaToken se conserva para reintentar', async () => {
    const lib = await loadWithFakeApi(() => ({ status: 401 }));
    lib.startPendingMfa('mfa-1', 'verify');

    await expect(lib.completeVerify('000000')).rejects.toMatchObject({ status: 401 });
    expect(lib.getPendingMfa()?.token).toBe('mfa-1');
    expect(lib.getAccessToken()).toBeNull();
  });
});

describe('configurar 2FA (W03)', () => {
  const SETUP = {
    otpauthUri: 'otpauth://totp/ClickSafe:a@b.mx?secret=JBSWY3DPEHPK3PXP&issuer=ClickSafe',
    qrCodeDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
  };

  it('setup y enable mandan el mfaToken como Bearer', async () => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return config.url === '/auth/2fa/setup'
        ? { status: 200, data: SETUP }
        : { status: 200, data: { message: 'ok' } };
    });
    lib.startPendingMfa('mfa-setup', 'setup');

    await lib.loadMfaSetup();
    await lib.completeSetup('123456');

    expect(callTo('/auth/2fa/setup')?.headers.Authorization).toBe('Bearer mfa-setup');
    const enable = callTo('/auth/2fa/enable');
    expect(enable?.headers.Authorization).toBe('Bearer mfa-setup');
    expect(bodyOf(enable as InternalAxiosRequestConfig)).toEqual({ codigo: '123456' });
  });

  it('pide /auth/2fa/setup una sola vez aunque se llame dos veces (StrictMode)', async () => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return { status: 200, data: SETUP };
    });
    lib.startPendingMfa('mfa-setup', 'setup');

    const [first, second] = await Promise.all([lib.loadMfaSetup(), lib.loadMfaSetup()]);

    expect(first).toEqual(second);
    expect(calls.filter((c) => c.url === '/auth/2fa/setup')).toHaveLength(1);
  });

  it('después de enable pasa a "verify" con el mismo token y avisa esperar un código nuevo', async () => {
    const lib = await loadWithFakeApi(() => ({ status: 200, data: { message: 'ok' } }));
    lib.startPendingMfa('mfa-setup', 'setup');

    await lib.completeSetup('123456');

    expect(lib.getPendingMfa()).toMatchObject({
      token: 'mfa-setup',
      step: 'verify',
      afterSetup: true,
    });
    expect(lib.getAccessToken()).toBeNull();
  });
});
