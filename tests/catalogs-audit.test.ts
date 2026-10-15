import type { InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUDIT_ACTION_LABEL,
  auditActionLabel,
  auditResourceLabel,
  dateRangeToIso,
  formatAuditDetail,
  redactDetail,
} from '@/lib/audit';
import { MESSAGES, type ApiError } from '@/lib/errors';
import { loadWithFakeApi, stubSessionStorage } from './helpers/fake-api';

const SESSION = { accessToken: 'acc', refreshToken: 'ref', expiresIn: 900 };

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

describe('Prueba 3 · cargar bitácora con filtros', () => {
  const PAGE = {
    items: [
      {
        id: '101',
        fecha: '2026-10-14T18:00:00.000Z',
        idUsuario: 7,
        usuario: { nombre: 'Admin Demo', correo: 'admin@demo.clicksafe.local' },
        accion: 'reporte_revisado',
        resultado: 'exito',
        recursoTipo: 'Reporte',
        recursoId: 29,
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        detalle: { decision: 'validado' },
      },
    ],
    page: 2,
    limit: 25,
    total: 26,
  };

  it('éxito: manda los parámetros correctos y devuelve la página', async () => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return { status: 200, data: PAGE };
    });
    lib.setSession(SESSION);
    const range = dateRangeToIso('2026-10-01', '2026-10-14');

    const result = await lib.getAuditLog({
      page: 2,
      limit: 25,
      accion: '  reporte_revisado  ',
      usuario: 7,
      ...range,
    });

    expect(calls[0].url).toBe('/admin/audit-log');
    expect(calls[0].params).toEqual({
      page: 2,
      limit: 25,
      accion: 'reporte_revisado',
      usuario: 7,
      desde: '2026-10-01T06:00:00.000Z',
      hasta: '2026-10-15T05:59:59.999Z',
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].usuario?.nombre).toBe('Admin Demo');
    expect(result.total).toBe(26);
  });

  it('sin filtros solo manda page y limit', async () => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return { status: 200, data: { ...PAGE, items: [] } };
    });
    lib.setSession(SESSION);

    await lib.getAuditLog({ page: 1, limit: 25, accion: '   ', usuario: 0 });

    expect(calls[0].params).toEqual({ page: 1, limit: 25 });
  });

  it('fallo: sin conexión → mensaje de conexión', async () => {
    const lib = await loadWithFakeApi(() => 'network');
    lib.setSession(SESSION);

    const error = (await lib.getAuditLog({ page: 1, limit: 25 }).catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(lib.ApiError);
    expect(error.status).toBeNull();
    expect(error.userMessage).toBe('No hay conexión con el servidor. Inténtalo de nuevo.');
  });
});

describe('audit.ts', () => {
  it('convierte los días de la CDMX (UTC−6) a ISO en UTC', () => {
    expect(dateRangeToIso('2026-03-10', '2026-03-10')).toEqual({
      desde: '2026-03-10T06:00:00.000Z',
      hasta: '2026-03-11T05:59:59.999Z',
    });
    expect(dateRangeToIso('', '')).toEqual({ desde: undefined, hasta: undefined });
    expect(dateRangeToIso('10/03/2026', 'x')).toEqual({ desde: undefined, hasta: undefined });
  });

  it('oculta datos sensibles del detalle, también anidados', () => {
    const redacted = redactDetail({
      decision: 'validado',
      password: 'secreta123',
      nested: { refreshToken: 'abc', codigo: '123456', ok: 1 },
      list: [{ totp: '492817' }, { motivo: 'spam' }],
    });
    expect(redacted).toEqual({
      decision: 'validado',
      password: '[oculto]',
      nested: { refreshToken: '[oculto]', codigo: '[oculto]', ok: 1 },
      list: [{ totp: '[oculto]' }, { motivo: 'spam' }],
    });
    const text = formatAuditDetail({ captcha: 'xyz', mfaToken: 'jwt', sig: 'f00' }) ?? '';
    for (const secret of ['xyz', 'jwt', 'f00']) expect(text).not.toContain(secret);
  });

  it('el detalle se convierte en texto (JSON), nunca en HTML', () => {
    const text = formatAuditDetail({ nota: '<img src=x onerror=alert(1)>' });
    expect(text).toContain('"nota": "<img src=x onerror=alert(1)>"');
    expect(formatAuditDetail(null)).toBeNull();
    expect(formatAuditDetail({})).toBeNull();
  });

  it('las 18 acciones del backend (AuditAction) tienen nombre en español', () => {
    // Copia de la lista cerrada de api/src/audit/audit-action.type.ts
    const BACKEND_ACTIONS = [
      'login',
      'cuenta_bloqueada',
      'logout',
      'refresh_reuso_detectado',
      'registro',
      'correo_verificado',
      'password_recuperacion_solicitada',
      'password_cambiada',
      '2fa_activado',
      '2fa_fallo',
      'reporte_revisado',
      'comentario_moderado',
      'usuario_suspendido',
      'usuario_reactivado',
      'admin_creado',
      'catalogo_modificado',
      'evidencia_eliminada',
      'password_cambio_fallo',
    ];
    expect(Object.keys(AUDIT_ACTION_LABEL).sort()).toEqual([...BACKEND_ACTIONS].sort());
    for (const action of BACKEND_ACTIONS) {
      expect(auditActionLabel(action)).not.toBe(action);
    }
  });

  it('nombres en español para las acciones conocidas; las demás, su código', () => {
    expect(auditActionLabel('reporte_revisado')).toBe('Reporte revisado');
    expect(auditActionLabel('accion_nueva')).toBe('accion_nueva');
    expect(auditResourceLabel('Reporte', 29)).toBe('Reporte #29');
    expect(auditResourceLabel(null, null)).toBe('—');
  });
});

describe('W11 · catálogos', () => {
  const PLATFORMS = [
    { id: 1, nombre: 'Facebook', esOtra: false, activa: true },
    { id: 9, nombre: 'Otra', esOtra: true, activa: true },
  ];

  it('lista plataformas y categorías (activas e inactivas)', async () => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return config.url === '/admin/platforms'
        ? { status: 200, data: PLATFORMS }
        : { status: 200, data: [{ id: 2, nombre: 'Phishing', descripcion: null, activa: false }] };
    });
    lib.setSession(SESSION);

    const platforms = await lib.getAdminPlatforms();
    const categories = await lib.getAdminCategories();

    expect(platforms.find((p) => p.esOtra)?.nombre).toBe('Otra');
    expect(categories[0].activa).toBe(false);
    expect(calls.map((c) => c.url)).toEqual(['/admin/platforms', '/admin/categories']);
  });

  it('agregar y editar mandan solo los campos del contrato', async () => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return { status: config.method === 'post' ? 201 : 200, data: PLATFORMS[0] };
    });
    lib.setSession(SESSION);

    await lib.createPlatform({ nombre: 'TikTok Shop' });
    await lib.updateCategory(2, { nombre: 'Phishing', descripcion: 'Suplantación' });
    await lib.updatePlatform(1, { activa: false });

    expect([calls[0].method, calls[0].url, bodyOf(calls[0])]).toEqual([
      'post',
      '/admin/platforms',
      { nombre: 'TikTok Shop' },
    ]);
    expect([calls[1].method, calls[1].url, bodyOf(calls[1])]).toEqual([
      'patch',
      '/admin/categories/2',
      { nombre: 'Phishing', descripcion: 'Suplantación' },
    ]);
    expect(bodyOf(calls[2])).toEqual({ activa: false });
  });

  it('no existe ninguna función para borrar catálogos', async () => {
    const lib = await loadWithFakeApi(() => ({ status: 200, data: [] }));
    const names = Object.keys(lib).filter((name) => /delete|remove/i.test(name));
    expect(names).toEqual(['deleteEvidence']);
  });

  it.each([
    ['crear plataforma', (lib: Awaited<ReturnType<typeof loadWithFakeApi>>) => lib.createPlatform({ nombre: 'Facebook' })],
    ['renombrar categoría', (lib: Awaited<ReturnType<typeof loadWithFakeApi>>) => lib.updateCategory(2, { nombre: 'Phishing' })],
  ])('nombre duplicado al %s (409 CATALOG_NAME_TAKEN) → mensaje claro', async (_, action) => {
    const lib = await loadWithFakeApi(() => ({
      status: 409,
      data: { statusCode: 409, code: 'CATALOG_NAME_TAKEN', message: 'Duplicate entry for key nombre' },
    }));
    lib.setSession(SESSION);

    const error = (await action(lib).catch((e: unknown) => e)) as ApiError;

    expect(error.code).toBe('CATALOG_NAME_TAKEN');
    expect(error.userMessage).toBe('Ya existe un elemento con ese nombre.');
    expect(error.message).not.toContain('Duplicate');
  });

  it('desactivar "Otra" rechazado por la API (400) → mensaje propio, no el del servidor', async () => {
    const lib = await loadWithFakeApi(() => ({
      status: 400,
      data: { statusCode: 400, message: 'No puedes desactivar la plataforma "Otra"' },
    }));
    lib.setSession(SESSION);

    const error = (await lib.updatePlatform(9, { activa: false }).catch((e: unknown) => e)) as ApiError;

    expect(error.userMessage).toBe(MESSAGES.badRequest);
  });
});
