import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';
import { ApiError, MESSAGES, toApiError } from '@/lib/errors';

const config = { headers: {} } as InternalAxiosRequestConfig;

function httpError(status: number, data?: unknown): AxiosError {
  return new AxiosError('fail', 'ERR_BAD_RESPONSE', config, null, {
    status,
    data,
    statusText: '',
    headers: {},
    config,
  });
}

describe('toApiError', () => {
  it.each([
    [400, MESSAGES.badRequest],
    [403, MESSAGES.forbidden],
    [404, MESSAGES.notFound],
    [409, MESSAGES.conflict],
    [429, MESSAGES.tooManyRequests],
    [500, MESSAGES.server],
    [503, MESSAGES.server],
    [418, MESSAGES.unknown],
  ])('estado %i → mensaje propio', (status, message) => {
    expect(toApiError(httpError(status)).userMessage).toBe(message);
  });

  it.each([
    ['CAPTCHA_INVALID', 'No pudimos verificar la solicitud. Inténtalo de nuevo.'],
    ['INVALID_CODE', 'Código incorrecto o expirado.'],
    ['PASSWORD_WEAK', 'Esa contraseña es muy común. Elige otra.'],
    ['OWN_REPORT', 'No puedes revisar un reporte que tú creaste.'],
    ['REPORT_NOT_EDITABLE', 'Este reporte ya fue revisado por otro administrador.'],
    ['CATALOG_INACTIVE', 'Ese elemento del catálogo está desactivado.'],
  ])('code %s tiene prioridad sobre el estado', (code, message) => {
    const error = toApiError(httpError(400, { statusCode: 400, code }));
    expect(error.code).toBe(code);
    expect(error.userMessage).toBe(message);
  });

  it('sin respuesta del servidor → mensaje de conexión y status null', () => {
    const error = toApiError(new AxiosError('timeout', 'ECONNABORTED', config));
    expect(error.status).toBeNull();
    expect(error.userMessage).toBe(MESSAGES.network);
  });

  it('descarta un requestId o code con caracteres raros', () => {
    const error = toApiError(
      httpError(500, { code: '<img src=x>', requestId: '<script>alert(1)</script>' }),
    );
    expect(error.code).toBeUndefined();
    expect(error.requestId).toBeUndefined();
  });

  it('solo los 5xx muestran el código de soporte', () => {
    const body = { requestId: 'abc-123' };
    expect(toApiError(httpError(500, body)).supportCode).toBe('abc-123');
    expect(toApiError(httpError(403, body)).supportCode).toBeUndefined();
  });

  it('cualquier otro error → mensaje genérico', () => {
    const error = toApiError(new Error('TypeError interno'));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.userMessage).toBe(MESSAGES.unknown);
  });
});
