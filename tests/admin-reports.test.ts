import type { InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MESSAGES, type ApiError } from '@/lib/errors';
import { loadWithFakeApi, stubSessionStorage } from './helpers/fake-api';

const SESSION = { accessToken: 'acc', refreshToken: 'ref', expiresIn: 900 };

function report(id: number) {
  return {
    id,
    titulo: `Reporte ${id}`,
    descripcion: 'Descripción de prueba con más de veinte caracteres.',
    urlPublicacion: 'https://tienda-falsa.example/oferta',
    plataforma: { id: 1, nombre: 'Facebook' },
    plataformaOtra: null,
    categoria: { id: 2, nombre: 'Producto no entregado' },
    estado: 'pendiente',
    anonimo: id % 2 === 0,
    autor: { nombre: 'Ana', correo: 'ana@example.com' },
    totalLikes: 3,
    evidencias: [],
    fechaCreacion: '2026-10-01T12:00:00.000Z',
    fechaActualizacion: '2026-10-01T12:00:00.000Z',
  };
}

let calls: InternalAxiosRequestConfig[];

beforeEach(() => {
  stubSessionStorage();
  calls = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Prueba 1 · cargar estadísticas del dashboard', () => {
  const STATS = {
    porPlataforma: [
      { plataforma: 'Facebook', total: 5 },
      { plataforma: 'Otra', total: 2 },
    ],
    porCategoria: [{ categoria: 'Producto no entregado', total: 7 }],
    porEstado: [
      { estado: 'pendiente', total: 3 },
      { estado: 'validado', total: 3 },
      { estado: 'rechazado', total: 1 },
    ],
    porMes: [
      { mes: '2026-09', total: 2 },
      { mes: '2026-10', total: 5 },
    ],
  };

  it('éxito: devuelve los datos agrupados tal como los manda la API', async () => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return { status: 200, data: STATS };
    });
    lib.setSession(SESSION);

    const stats = await lib.getAdminStats();

    expect(calls[0].url).toBe('/admin/stats');
    expect(stats.porPlataforma.find((p) => p.plataforma === 'Otra')?.total).toBe(2);
    expect(stats.porEstado.reduce((sum, e) => sum + e.total, 0)).toBe(7);
    expect(stats.porMes.map((m) => m.mes)).toEqual(['2026-09', '2026-10']);
  });

  it('fallo: un 500 sale como ApiError con el mensaje propio', async () => {
    const lib = await loadWithFakeApi(() => ({
      status: 500,
      data: { statusCode: 500, message: 'TypeORM error', requestId: 'abc-123' },
    }));
    lib.setSession(SESSION);

    const error = (await lib.getAdminStats().catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(lib.ApiError);
    expect(error.userMessage).toBe(MESSAGES.server);
    expect(error.userMessage).toBe('Algo salió mal de nuestro lado. Inténtalo más tarde.');
  });
});

describe('Prueba 2 · cargar cola de reportes pendientes', () => {
  it('éxito: manda page/limit/estado y devuelve 3 reportes pendientes', async () => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return {
        status: 200,
        data: { items: [report(1), report(2), report(3)], page: 1, limit: 20, total: 3 },
      };
    });
    lib.setSession(SESSION);

    const page = await lib.getAdminReports({ page: 1, limit: 20, estado: 'pendiente' });

    expect(calls[0].url).toBe('/admin/reports');
    expect(calls[0].params).toEqual({ page: 1, limit: 20, estado: 'pendiente' });
    expect(page.items.length).toBe(3);
    expect(page.items.every((r) => r.estado === 'pendiente')).toBe(true);
  });

  it('pestaña "Todos": manda estado=todos (la API quita el filtro)', async () => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return {
        status: 200,
        data: {
          items: [report(1), { ...report(2), estado: 'validado' }, { ...report(3), estado: 'rechazado' }],
          page: 1,
          limit: 20,
          total: 3,
        },
      };
    });
    lib.setSession(SESSION);

    const page = await lib.getAdminReports({ page: 1, limit: 20, estado: 'todos' });

    expect(calls[0].params).toEqual({ page: 1, limit: 20, estado: 'todos' });
    expect(new Set(page.items.map((r) => r.estado))).toEqual(
      new Set(['pendiente', 'validado', 'rechazado']),
    );
  });

  it('fallo: un 403 da "No tienes permiso para hacer esto."', async () => {
    const lib = await loadWithFakeApi(() => ({ status: 403 }));
    lib.setSession(SESSION);

    const error = (await lib
      .getAdminReports({ page: 1, limit: 20, estado: 'pendiente' })
      .catch((e: unknown) => e)) as ApiError;

    expect(error.userMessage).toBe('No tienes permiso para hacer esto.');
  });
});

describe('detalle y revisión (W07)', () => {
  it('pide el detalle por id, con esMio y totalComentarios', async () => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return {
        status: 200,
        data: { ...report(7), revision: null, esMio: false, totalComentarios: 4 },
      };
    });
    lib.setSession(SESSION);

    const detail = await lib.getAdminReport(7);

    expect(calls[0].url).toBe('/admin/reports/7');
    expect(detail.esMio).toBe(false);
    expect(detail.totalComentarios).toBe(4);
  });

  it('detalle inexistente → 404 con mensaje propio', async () => {
    const lib = await loadWithFakeApi(() => ({ status: 404 }));
    lib.setSession(SESSION);

    const error = (await lib.getAdminReport(999999).catch((e: unknown) => e)) as ApiError;

    expect(error.userMessage).toBe('No encontramos lo que buscas. Puede que ya no exista.');
  });

  it('el review manda {decision, comentario} sin espacios sobrantes', async () => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return { status: 200, data: { message: 'ok' } };
    });
    lib.setSession(SESSION);

    await lib.reviewReport(7, 'validado', '  Se confirmó con la tienda.  ');

    expect(calls[0].url).toBe('/admin/reports/7/review');
    expect(JSON.parse(String(calls[0].data))).toEqual({
      decision: 'validado',
      comentario: 'Se confirmó con la tienda.',
    });
  });

  it('un comentario vacío no se manda (es opcional)', async () => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return { status: 200, data: { message: 'ok' } };
    });
    lib.setSession(SESSION);

    await lib.reviewReport(7, 'rechazado', '   ');

    expect(JSON.parse(String(calls[0].data))).toEqual({ decision: 'rechazado' });
  });

  it.each([
    [403, 'OWN_REPORT', 'No puedes revisar un reporte que tú creaste.'],
    [400, 'REPORT_NOT_EDITABLE', 'Este reporte ya fue revisado por otro administrador.'],
  ])('error %i %s → mensaje propio', async (status, code, message) => {
    const lib = await loadWithFakeApi(() => ({ status, data: { statusCode: status, code } }));
    lib.setSession(SESSION);

    const error = (await lib.reviewReport(7, 'validado').catch((e: unknown) => e)) as ApiError;

    expect(error.code).toBe(code);
    expect(error.userMessage).toBe(message);
  });

  it('submitReview: revisión aceptada → ok', async () => {
    const lib = await loadWithFakeApi(() => ({ status: 200, data: { message: 'ok' } }));
    lib.setSession(SESSION);

    expect(await lib.submitReview(7, 'validado', 'Confirmado')).toEqual({ ok: true });
  });

  it('submitReview: otro admin se adelantó (400 REPORT_NOT_EDITABLE) → stale con el mensaje propio', async () => {
    // Lo que responde el backend al segundo POST (admin.service.ts reviewReport)
    const lib = await loadWithFakeApi(() => ({
      status: 400,
      data: {
        statusCode: 400,
        error: 'Bad Request',
        message: 'El reporte ya fue revisado.',
        requestId: '5b1e2c2a-1234-4a5b-8c9d-0e1f2a3b4c5d',
        code: 'REPORT_NOT_EDITABLE',
      },
    }));
    lib.setSession(SESSION);

    const result = await lib.submitReview(7, 'rechazado');

    expect(result).toEqual({
      ok: false,
      stale: true,
      message: 'Este reporte ya fue revisado por otro administrador.',
    });
  });

  it('submitReview: reporte propio (403 OWN_REPORT) → error, pero no stale', async () => {
    const lib = await loadWithFakeApi(() => ({
      status: 403,
      data: { statusCode: 403, code: 'OWN_REPORT' },
    }));
    lib.setSession(SESSION);

    expect(await lib.submitReview(7, 'validado')).toEqual({
      ok: false,
      stale: false,
      message: 'No puedes revisar un reporte que tú creaste.',
    });
  });

  it('submitReview: sin conexión → error de conexión, no stale', async () => {
    const lib = await loadWithFakeApi(() => 'network');
    lib.setSession(SESSION);

    expect(await lib.submitReview(7, 'validado')).toEqual({
      ok: false,
      stale: false,
      message: MESSAGES.network,
    });
  });

  it('quitar evidencia llama a DELETE con los dos ids', async () => {
    const lib = await loadWithFakeApi((config) => {
      calls.push(config);
      return { status: 204 };
    });
    lib.setSession(SESSION);

    await lib.deleteEvidence(7, 3);

    expect(calls[0].method).toBe('delete');
    expect(calls[0].url).toBe('/admin/reports/7/evidences/3');
  });
});

describe('aviso del panel (flash)', () => {
  it('se borra al cerrar la sesión: no le aparece al siguiente admin', async () => {
    const lib = await loadWithFakeApi(() => ({ status: 204 }));
    const flash = await import('@/lib/flash');
    lib.setSession(SESSION);
    flash.setFlash('Reporte validado como fraude.');

    lib.endSession(null);

    expect(flash.getFlash()).toBeNull();
  });
});
