import axios from 'axios';

// Mensajes propios en español (CLAUDE.md 8.3). Nunca se muestra el `message`
// del servidor: puede traer detalles internos útiles para un atacante
// (nombres de tablas, validaciones, stack traces).

export const MESSAGES = {
  network: 'No hay conexión con el servidor. Inténtalo de nuevo.',
  badRequest: 'Revisa los datos e inténtalo de nuevo.',
  sessionExpired: 'Tu sesión expiró. Inicia sesión de nuevo.',
  forbidden: 'No tienes permiso para hacer esto.',
  notFound: 'No encontramos lo que buscas. Puede que ya no exista.',
  conflict: 'Este elemento cambió mientras lo veías. Recarga la página.',
  tooManyRequests:
    'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
  server: 'Algo salió mal de nuestro lado. Inténtalo más tarde.',
  unknown: 'No se pudo completar la acción.',
  adminOnly: 'Este panel es solo para administradores.',
  // Autenticación (CLAUDE.md 7.4)
  wrongCredentials: 'Correo o contraseña incorrectos.',
  wrongTotp: 'Código incorrecto. Revisa tu app de autenticación.',
  mfaExpired: 'Tu verificación expiró. Inicia sesión de nuevo.',
  waitNewCode: 'Espera a que tu app muestre un código nuevo',
  idleLogout: 'Cerramos tu sesión por inactividad.',
  forgotSent: 'Si el correo está registrado, recibirás un código de 8 dígitos.',
  passwordUpdated: 'Contraseña actualizada. Inicia sesión.',
  captchaInvalid: 'No pudimos verificar la solicitud. Inténtalo de nuevo.',
  // POST /admin/admins → 401 (cuenta bloqueada o sin 2FA): genérico a propósito
  createAdminUnavailable:
    'No pudimos crear el administrador en este momento. Inténtalo más tarde.',
} as const;

const CODE_MESSAGES: Record<string, string> = {
  CAPTCHA_INVALID: MESSAGES.captchaInvalid,
  // Códigos locales (no vienen del servidor)
  MFA_EXPIRED: MESSAGES.mfaExpired,
  INVALID_CODE: 'Código incorrecto o expirado.',
  PASSWORD_WEAK: 'Esa contraseña es muy común. Elige otra.',
  INVALID_CURRENT_PASSWORD: 'La contraseña actual no es correcta.',
  OWN_REPORT: 'No puedes revisar un reporte que tú creaste.',
  REPORT_NOT_EDITABLE: 'Este reporte ya fue revisado por otro administrador.',
  CATALOG_INACTIVE: 'Ese elemento del catálogo está desactivado.',
  // Fase 4 (moderación y usuarios)
  OWN_STATUS: 'No puedes cambiar el estado de tu propia cuenta.',
  LAST_ACTIVE_ADMIN:
    'No se puede suspender: el sistema se quedaría sin administradores activos.',
  EMAIL_TAKEN: 'Ya existe una cuenta con ese correo.',
  COMMENT_NOT_FLAGGED:
    'Este comentario ya fue moderado por otro administrador. Actualizamos la lista.',
  // No dice si fue el código o un bloqueo de la cuenta
  INVALID_TOTP:
    'No pudimos confirmar tu identidad. Escribe el código que muestra ahora tu app de autenticación.',
};

const STATUS_MESSAGES: Record<number, string> = {
  400: MESSAGES.badRequest,
  401: MESSAGES.sessionExpired,
  403: MESSAGES.forbidden,
  404: MESSAGES.notFound,
  409: MESSAGES.conflict,
  429: MESSAGES.tooManyRequests,
};

export class ApiError extends Error {
  /** Código HTTP, o `null` si el servidor no respondió (caído, timeout, sin red). */
  readonly status: number | null;
  readonly code?: string;
  /** Identificador para buscar el error en los logs del backend. */
  readonly requestId?: string;
  /** Mensaje seguro para mostrar al usuario. */
  readonly userMessage: string;
  /** La petición se canceló a propósito (AbortController): no es un error real. */
  readonly canceled: boolean;

  constructor(options: {
    status: number | null;
    code?: string;
    requestId?: string;
    userMessage?: string;
    canceled?: boolean;
  }) {
    const userMessage =
      options.userMessage ?? messageFor(options.status, options.code);
    super(userMessage);
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.userMessage = userMessage;
    this.canceled = options.canceled ?? false;
  }

  /** Solo los 5xx muestran el código de soporte (CLAUDE.md 8.3). */
  get supportCode(): string | undefined {
    return this.status !== null && this.status >= 500
      ? this.requestId
      : undefined;
  }
}

function messageFor(status: number | null, code?: string): string {
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];
  if (status === null) return MESSAGES.network;
  if (status >= 500) return MESSAGES.server;
  return STATUS_MESSAGES[status] ?? MESSAGES.unknown;
}

// Solo letras, números y guiones: el campo viene de la red y se muestra en pantalla
function safeToken(value: unknown, max: number): string | undefined {
  return typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value)
    ? value.slice(0, max)
    : undefined;
}

/** Convierte cualquier error (de axios o no) en un `ApiError`. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (axios.isCancel(error)) {
    return new ApiError({ status: null, canceled: true });
  }
  if (axios.isAxiosError(error)) {
    if (!error.response) return new ApiError({ status: null });
    const body: unknown = error.response.data;
    const fields =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>)
        : {};
    return new ApiError({
      status: error.response.status,
      code: safeToken(fields.code, 64),
      requestId: safeToken(fields.requestId, 64),
    });
  }
  return new ApiError({ status: null, userMessage: MESSAGES.unknown });
}
