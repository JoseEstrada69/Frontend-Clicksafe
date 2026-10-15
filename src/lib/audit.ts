// Bitácora de auditoría (W12): lógica sin React para poder probarla.

// ---------- Nombres de las acciones ----------
// Lista cerrada del backend (`AuditAction` en api/src/audit/audit-action.type.ts;
// el OpenAPI declara `accion` como string libre). Si el backend agrega una
// acción nueva, se muestra con su código tal cual (como texto) hasta
// agregarla aquí.
export const AUDIT_ACTION_LABEL: Readonly<Record<string, string>> = {
  login: 'Inicio de sesión',
  cuenta_bloqueada: 'Cuenta bloqueada por intentos fallidos',
  logout: 'Cierre de sesión',
  refresh_reuso_detectado: 'Reuso de sesión detectado (posible robo)',
  registro: 'Registro de usuario',
  correo_verificado: 'Correo verificado',
  password_recuperacion_solicitada: 'Recuperación de contraseña solicitada',
  password_cambiada: 'Contraseña cambiada',
  password_cambio_fallo: 'Cambio de contraseña fallido',
  '2fa_activado': 'Verificación en dos pasos activada',
  '2fa_fallo': 'Código de verificación incorrecto',
  reporte_revisado: 'Reporte revisado',
  comentario_moderado: 'Comentario moderado',
  usuario_suspendido: 'Usuario suspendido',
  usuario_reactivado: 'Usuario reactivado',
  admin_creado: 'Administrador creado',
  catalogo_modificado: 'Catálogo modificado',
  evidencia_eliminada: 'Evidencia eliminada',
};

export function auditActionLabel(accion: string): string {
  return AUDIT_ACTION_LABEL[accion] ?? accion;
}

// ---------- Rango de fechas ----------
// Los <input type="date"> dan días "YYYY-MM-DD" en hora de la Ciudad de
// México; la API espera ISO 8601. Desde 2022 la CDMX no cambia de horario:
// siempre es UTC−6.
const CDMX_OFFSET = '-06:00';
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function toIso(day: string, time: string): string | undefined {
  if (!DAY.test(day)) return undefined;
  const date = new Date(`${day}T${time}${CDMX_OFFSET}`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Inicio del día `desde` y final del día `hasta`, en hora de la CDMX. */
export function dateRangeToIso(
  desde: string,
  hasta: string,
): { desde?: string; hasta?: string } {
  return {
    desde: desde ? toIso(desde, '00:00:00.000') : undefined,
    hasta: hasta ? toIso(hasta, '23:59:59.999') : undefined,
  };
}

// ---------- Detalle ----------
// El detalle es un objeto libre. Si alguna vez trajera algo sensible
// (contraseñas, tokens, códigos, firmas…), no se muestra: se reemplaza por
// "[oculto]". Se muestra como texto plano (JSON), nunca como HTML.
const SENSITIVE_KEY =
  /pass|contrase|token|secret|secreto|codigo|code|totp|otp|captcha|hash|authorization|cookie|sig|firma|refresh|mfa/i;
const MAX_DEPTH = 6;

export function redactDetail(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[…]';
  if (Array.isArray(value)) return value.map((item) => redactDetail(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key) ? '[oculto]' : redactDetail(item, depth + 1),
      ]),
    );
  }
  return value;
}

/** Detalle listo para mostrar como texto, o null si no hay. */
export function formatAuditDetail(detail: Record<string, unknown> | null): string | null {
  if (!detail || Object.keys(detail).length === 0) return null;
  return JSON.stringify(redactDetail(detail), null, 2);
}

/** "Reporte #29", "Evidencia #3"… o "—". */
export function auditResourceLabel(
  recursoTipo: string | null,
  recursoId: number | null,
): string {
  if (!recursoTipo) return '—';
  return recursoId !== null ? `${recursoTipo} #${recursoId}` : recursoTipo;
}
