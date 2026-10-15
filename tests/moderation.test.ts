import type { InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MESSAGES, toApiError, type ApiError } from '@/lib/errors';
import { COMMENT_STATE_LABEL, FLAG_REASON_LABEL, ROLE_LABEL } from '@/lib/labels';
import { isSameEmail } from '@/lib/users';
import { loadWithFakeApi, stubSessionStorage } from './helpers/fake-api';

const SESSION = { accessToken: 'acc', refreshToken: 'ref', expiresIn: 900 };
const NEW_TOKENS = { accessToken: 'new', refreshToken: 'ref2', expiresIn: 900 };
const TOTP = '492817';

let calls: InternalAxiosRequestConfig[];

beforeEach(() => {
  stubSessionStorage();
  calls = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const bodyOf = (config: InternalAxiosRequestConfig) =>
  JSON.parse(String(config.data)) as Record<string, unknown>;
const isRefresh = (config: InternalAxiosRequestConfig) =>
  config.url?.endsWith('/auth/refresh') ?? false;

describe('W08 · moderación de comentarios', () => {
  const FLAGGED = [
    {
      id: 4,
      contenido: '<img src=x onerror=alert(1)>',
      estado: 'oculto_auto',
      totalDenuncias: 3,
      autor: { nombre: 'Luis', correo: 'luis@example.com' },
      reporteId: 29,
      motivos: ['spam', 'acoso', 'spam'],
      denuncias: [
        { motivo: 'spam', detalle: '<script>alert("detalle")</script>', fecha: '2026-10-11T10:00:00.000Z' },
        { motivo: 'acoso', detalle: null, fecha: '2026-10-11T11:00:00.000Z' },
        { motivo: 'spam', detalle: 'Publica lo mismo en todos los reportes', fecha: '2026-10-12T09:00:00.000Z' },
      ],
      fechaCreacion: '2026-10-10T12:00:00.000Z',
    },
  ];

  it('carga la cola y conserva contenido y detalles tal cual (se muestran como texto)', async () => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return { status: 200, data: FLAGGED };
    });
    lib.setSession(SESSION);

    const comments = await lib.getFlaggedComments();

    expect(calls[0].url).toBe('/admin/comments/flagged');
    expect(comments).toHaveLength(1);
    expect(comments[0].contenido).toBe('<img src=x onerror=alert(1)>');
    expect(comments[0].denuncias).toHaveLength(3);
    expect(comments[0].denuncias[0].detalle).toBe('<script>alert("detalle")</script>');
    expect(comments[0].denuncias[1].detalle).toBeNull();
    // Sin datos de quién denunció
    expect(Object.keys(comments[0].denuncias[0]).sort()).toEqual(['detalle', 'fecha', 'motivo']);
  });

  it.each(['confirmar', 'restaurar'] as const)('"%s" manda {accion} al comentario', async (accion) => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return { status: 204 };
    });
    lib.setSession(SESSION);

    await lib.moderateComment(4, accion);

    expect(calls[0].method).toBe('patch');
    expect(calls[0].url).toBe('/admin/comments/4');
    expect(bodyOf(calls[0])).toEqual({ accion });
  });

  it('ya moderado por otro admin (409 COMMENT_NOT_FLAGGED) → mensaje propio', async () => {
    const lib = await loadWithFakeApi(() => ({
      status: 409,
      data: { statusCode: 409, code: 'COMMENT_NOT_FLAGGED', message: 'detalle técnico' },
    }));
    lib.setSession(SESSION);

    const error = (await lib.moderateComment(4, 'confirmar').catch((e: unknown) => e)) as ApiError;

    expect(error.userMessage).toBe(
      'Este comentario ya fue moderado por otro administrador. Actualizamos la lista.',
    );
  });
});

describe('W09 · usuarios', () => {
  const PAGE = {
    items: [
      {
        id: 1,
        nombre: 'Ana',
        correo: 'ana@example.com',
        rol: 'usuario',
        activo: true,
        correoVerificado: true,
        fechaRegistro: '2026-01-01T00:00:00.000Z',
      },
    ],
    page: 1,
    limit: 20,
    total: 1,
  };

  it('manda la búsqueda recortada, con page y limit', async () => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return { status: 200, data: PAGE };
    });
    lib.setSession(SESSION);

    await lib.getAdminUsers({ page: 2, limit: 20, q: '  ana@example.com  ' });

    expect(calls[0].url).toBe('/admin/users');
    expect(calls[0].params).toEqual({ page: 2, limit: 20, q: 'ana@example.com' });
  });

  it('nunca manda más de 100 caracteres, y una búsqueda vacía no manda q', async () => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return { status: 200, data: PAGE };
    });
    lib.setSession(SESSION);

    await lib.getAdminUsers({ page: 1, limit: 20, q: 'x'.repeat(150) });
    await lib.getAdminUsers({ page: 1, limit: 20, q: '   ' });

    expect(String(calls[0].params.q)).toHaveLength(100);
    expect(calls[1].params).toEqual({ page: 1, limit: 20 });
  });

  it.each([
    [false, 'suspender'],
    [true, 'reactivar'],
  ])('activo=%s (%s) manda {activo}', async (activo) => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return { status: 204 };
    });
    lib.setSession(SESSION);

    await lib.updateUserStatus(1, activo);

    expect(calls[0].url).toBe('/admin/users/1/status');
    expect(bodyOf(calls[0])).toEqual({ activo });
  });

  it.each([
    ['OWN_STATUS', 'No puedes cambiar el estado de tu propia cuenta.'],
    ['LAST_ACTIVE_ADMIN', 'No se puede suspender: el sistema se quedaría sin administradores activos.'],
  ])('400 %s → mensaje propio', async (code, message) => {
    const lib = await loadWithFakeApi(() => ({ status: 400, data: { statusCode: 400, code } }));
    lib.setSession(SESSION);

    const error = (await lib.updateUserStatus(1, false).catch((e: unknown) => e)) as ApiError;

    expect(error.userMessage).toBe(message);
  });

  it('reconoce la propia fila por correo, sin importar mayúsculas ni espacios', () => {
    expect(isSameEmail(' Admin@ClickSafe.mx ', 'admin@clicksafe.mx')).toBe(true);
    expect(isSameEmail('admin@clicksafe.mx', 'otro@clicksafe.mx')).toBe(false);
  });
});

describe('W10 · nuevo administrador', () => {
  const BODY = { nombre: 'Nueva Admin', correo: 'nueva@clicksafe.mx', totp: TOTP };
  const CREATED = {
    id: 9,
    nombre: 'Nueva Admin',
    correo: 'nueva@clicksafe.mx',
    rol: 'admin',
    activo: true,
    correoVerificado: false,
    fechaRegistro: '2026-10-14T00:00:00.000Z',
  };

  it('manda {nombre, correo, totp} y devuelve el admin creado', async () => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return { status: 201, data: CREATED };
    });
    lib.setSession(SESSION);

    const admin = await lib.createAdmin(BODY);

    expect(calls[0].url).toBe('/admin/admins');
    expect(bodyOf(calls[0])).toEqual(BODY);
    expect(admin.rol).toBe('admin');
  });

  it('TOTP incorrecto (400 INVALID_TOTP) → mensaje claro, una sola petición', async () => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return { status: 400, data: { statusCode: 400, code: 'INVALID_TOTP' } };
    });
    lib.setSession(SESSION);

    const error = (await lib.createAdmin(BODY).catch((e: unknown) => e)) as ApiError;

    expect(error.code).toBe('INVALID_TOTP');
    expect(error.userMessage).toBe(
      'No pudimos confirmar tu identidad. Escribe el código que muestra ahora tu app de autenticación.',
    );
    expect(calls).toHaveLength(1);
  });

  it('401 (cuenta bloqueada o sin 2FA) → mensaje genérico, SIN refresco ni reintento (no reenvía el código)', async () => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return isRefresh(config) ? { status: 200, data: NEW_TOKENS } : { status: 401 };
    });
    lib.setSession(SESSION);

    const error = (await lib.createAdmin(BODY).catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(401);
    expect(error.userMessage).toBe(
      'No pudimos crear el administrador en este momento. Inténtalo más tarde.',
    );
    // Ni "Tu sesión expiró" ni detalles del bloqueo
    expect(error.userMessage).not.toBe(MESSAGES.sessionExpired);
    expect(calls.filter(isRefresh)).toHaveLength(0);
    expect(calls.filter((c) => c.url === '/admin/admins')).toHaveLength(1);
    // La sesión sigue intacta
    expect(lib.getAccessToken()).toBe('acc');
  });

  it('renueva el token ANTES de enviar si está por vencer', async () => {
    const order: string[] = [];
    let auth: unknown;
    const lib = await loadWithFakeApi((config) => {
      if (isRefresh(config)) {
        order.push('refresh');
        return { status: 200, data: NEW_TOKENS };
      }
      order.push('create');
      auth = config.headers.Authorization;
      return { status: 201, data: CREATED };
    });
    lib.setSession({ ...SESSION, expiresIn: 30 });

    await lib.createAdmin(BODY);

    expect(order).toEqual(['refresh', 'create']);
    expect(auth).toBe('Bearer new');
  });

  it('correo ya registrado (409 EMAIL_TAKEN) → mensaje propio', async () => {
    const lib = await loadWithFakeApi(() => ({ status: 409, data: { statusCode: 409, code: 'EMAIL_TAKEN' } }));
    lib.setSession(SESSION);

    const error = (await lib.createAdmin(BODY).catch((e: unknown) => e)) as ApiError;

    expect(error.userMessage).toBe('Ya existe una cuenta con ese correo.');
  });

  it.each([
    ['400 INVALID_TOTP', { status: 400, data: { code: 'INVALID_TOTP' } }],
    ['401', { status: 401 }],
    ['500', { status: 500, data: { requestId: 'abc-123' } }],
    ['sin conexión', 'network' as const],
  ])('el error (%s) no conserva el código TOTP en ningún campo', async (_, reply) => {
    const lib = await loadWithFakeApi(() => reply);
    lib.setSession(SESSION);

    const error = await lib.createAdmin(BODY).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(lib.ApiError);
    const serialized = JSON.stringify({ ...(error as object), message: (error as Error).message });
    expect(serialized).not.toContain(TOTP);
    expect(String((error as Error).stack ?? '')).not.toContain(TOTP);
  });
});

describe('errors.ts · códigos nuevos de la Fase 4', () => {
  it.each([
    ['OWN_STATUS', 400],
    ['LAST_ACTIVE_ADMIN', 400],
    ['EMAIL_TAKEN', 409],
    ['COMMENT_NOT_FLAGGED', 409],
    ['INVALID_TOTP', 400],
  ])('%s tiene mensaje propio (no el genérico)', (code, status) => {
    const error = toApiError(
      Object.assign(new Error('x'), {
        isAxiosError: true,
        response: { status, data: { code } },
      }),
    );
    expect(error.userMessage).not.toBe(MESSAGES.unknown);
    expect(error.userMessage).not.toBe(MESSAGES.badRequest);
    expect(error.userMessage).not.toBe(MESSAGES.conflict);
  });
});

describe('labels.ts', () => {
  it('todos los estados, motivos y roles tienen texto en español', () => {
    for (const label of [
      ...Object.values(COMMENT_STATE_LABEL),
      ...Object.values(FLAG_REASON_LABEL),
      ...Object.values(ROLE_LABEL),
    ]) {
      expect(label.trim().length).toBeGreaterThan(0);
    }
    expect(COMMENT_STATE_LABEL.oculto_auto).toBe('Oculto automáticamente');
  });
});
