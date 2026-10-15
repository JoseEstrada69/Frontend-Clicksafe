import { api, ensureFreshToken } from './api';
import { ApiError, MESSAGES, toApiError } from './errors';
import type {
  AdminCategory,
  AdminPlatform,
  AuditLogEntry,
  AuditLogQuery,
  CreateCategoryBody,
  CreatePlatformBody,
  UpdateCategoryBody,
  UpdatePlatformBody,
  AdminReport,
  AdminReportDetail,
  AdminReportsQuery,
  AdminStats,
  AdminUser,
  AdminUsersQuery,
  CreateAdminBody,
  FlaggedComment,
  GenericMessage,
  ModerateCommentBody,
  Page,
  ReviewDecision,
  ReviewReportBody,
  UpdateUserStatusBody,
  CaptchaChallenge,
  ChangePasswordBody,
  ForgotPasswordBody,
  LoginBody,
  LoginResponse,
  Me,
  MfaSetup,
  MfaVerifyBody,
  ResetPasswordBody,
  Tokens,
  UpdateMeBody,
} from './types';

// Una función tipada por endpoint (docs/openapi.json). Los componentes llaman
// a estas funciones, nunca a api.get/post directamente.

// ---------- Autenticación ----------

/** GET /auth/captcha — reto ALTCHA. */
export async function getCaptchaChallenge(): Promise<CaptchaChallenge> {
  const { data } = await api.get<CaptchaChallenge>('/auth/captcha');
  return data;
}

/** POST /auth/login — tokens (usuario normal) o reto de 2FA (admin). */
export async function login(body: LoginBody): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', body);
  return data;
}

/** POST /auth/2fa/setup — con el mfaToken como Bearer. */
export async function setup2fa(mfaToken: string): Promise<MfaSetup> {
  const { data } = await api.post<MfaSetup>('/auth/2fa/setup', undefined, {
    authToken: mfaToken,
  });
  return data;
}

/** POST /auth/2fa/enable — con el mfaToken como Bearer. No devuelve tokens. */
export async function enable2fa(mfaToken: string, codigo: string): Promise<void> {
  await api.post(
    '/auth/2fa/enable',
    { codigo },
    { authToken: mfaToken },
  );
}

/** POST /auth/2fa/verify — el mfaToken va en el body. */
export async function verify2fa(body: MfaVerifyBody): Promise<Tokens> {
  const { data } = await api.post<Tokens>('/auth/2fa/verify', body);
  return data;
}

/** POST /auth/forgot-password — responde 202 genérico exista o no el correo. */
export async function forgotPassword(body: ForgotPasswordBody): Promise<void> {
  await api.post('/auth/forgot-password', body);
}

/** POST /auth/reset-password. */
export async function resetPassword(body: ResetPasswordBody): Promise<void> {
  await api.post('/auth/reset-password', body);
}

/**
 * POST /auth/logout — revoca la sesión actual en el servidor (204). Con
 * `accessToken` revoca esa sesión en lugar de la guardada.
 */
export async function logout(accessToken?: string): Promise<void> {
  await api.post('/auth/logout', undefined, { authToken: accessToken });
}

/** POST /auth/logout-all — revoca todas las sesiones del usuario (204). */
export async function logoutAll(): Promise<void> {
  await api.post('/auth/logout-all');
}

// ---------- Dashboard y reportes ----------

/** GET /admin/stats. */
export async function getAdminStats(signal?: AbortSignal): Promise<AdminStats> {
  const { data } = await api.get<AdminStats>('/admin/stats', { signal });
  return data;
}

/** GET /admin/reports — cola de revisión (por defecto, pendientes). */
export async function getAdminReports(
  query: AdminReportsQuery,
  signal?: AbortSignal,
): Promise<Page<AdminReport>> {
  const { data } = await api.get<Page<AdminReport>>('/admin/reports', {
    params: query,
    signal,
  });
  return data;
}

/** GET /admin/reports/:id — detalle con autor real y evidencias firmadas. */
export async function getAdminReport(
  id: number,
  signal?: AbortSignal,
): Promise<AdminReportDetail> {
  const { data } = await api.get<AdminReportDetail>(`/admin/reports/${id}`, {
    signal,
  });
  return data;
}

/**
 * POST /admin/reports/:id/review. El comentario se recorta y, si queda
 * vacío, no se manda (es opcional; máx. 500).
 */
export async function reviewReport(
  id: number,
  decision: ReviewDecision,
  comentario?: string,
): Promise<void> {
  const body: ReviewReportBody = { decision };
  const text = comentario?.trim();
  if (text) body.comentario = text;
  await api.post<GenericMessage>(`/admin/reports/${id}/review`, body);
}

/** DELETE /admin/reports/:id/evidences/:evidenceId (204). */
export async function deleteEvidence(
  reportId: number,
  evidenceId: number,
): Promise<void> {
  await api.delete(`/admin/reports/${reportId}/evidences/${evidenceId}`);
}

// ---------- Catálogos (sin DELETE: no se borran) ----------

/** GET /admin/platforms — activas e inactivas. */
export async function getAdminPlatforms(signal?: AbortSignal): Promise<AdminPlatform[]> {
  const { data } = await api.get<AdminPlatform[]>('/admin/platforms', { signal });
  return data;
}

/** POST /admin/platforms (201). */
export async function createPlatform(body: CreatePlatformBody): Promise<AdminPlatform> {
  const { data } = await api.post<AdminPlatform>('/admin/platforms', body);
  return data;
}

/** PATCH /admin/platforms/:id — nombre y/o activa. La API no deja desactivar "Otra". */
export async function updatePlatform(
  id: number,
  body: UpdatePlatformBody,
): Promise<AdminPlatform> {
  const { data } = await api.patch<AdminPlatform>(`/admin/platforms/${id}`, body);
  return data;
}

/** GET /admin/categories — activas e inactivas. */
export async function getAdminCategories(signal?: AbortSignal): Promise<AdminCategory[]> {
  const { data } = await api.get<AdminCategory[]>('/admin/categories', { signal });
  return data;
}

/** POST /admin/categories (201). */
export async function createCategory(body: CreateCategoryBody): Promise<AdminCategory> {
  const { data } = await api.post<AdminCategory>('/admin/categories', body);
  return data;
}

/** PATCH /admin/categories/:id — nombre, descripción y/o activa. */
export async function updateCategory(
  id: number,
  body: UpdateCategoryBody,
): Promise<AdminCategory> {
  const { data } = await api.patch<AdminCategory>(`/admin/categories/${id}`, body);
  return data;
}

// ---------- Bitácora (solo lectura) ----------

/**
 * GET /admin/audit-log — paginada y filtrable. Solo se mandan los filtros
 * con valor; `accion` se recorta a 60 caracteres (contrato).
 */
export async function getAuditLog(
  query: AuditLogQuery,
  signal?: AbortSignal,
): Promise<Page<AuditLogEntry>> {
  const params: AuditLogQuery = { page: query.page, limit: query.limit };
  const accion = query.accion?.trim().slice(0, 60);
  if (accion) params.accion = accion;
  if (query.usuario && Number.isInteger(query.usuario) && query.usuario > 0) {
    params.usuario = query.usuario;
  }
  if (query.desde) params.desde = query.desde;
  if (query.hasta) params.hasta = query.hasta;
  const { data } = await api.get<Page<AuditLogEntry>>('/admin/audit-log', {
    params,
    signal,
  });
  return data;
}

// ---------- Mi cuenta ----------

/** GET /me — datos del usuario autenticado. */
export async function getMe(signal?: AbortSignal): Promise<Me> {
  const { data } = await api.get<Me>('/me', { signal });
  return data;
}

/** PATCH /me — cambia el nombre. */
export async function updateMe(body: UpdateMeBody): Promise<Me> {
  const { data } = await api.patch<Me>('/me', body);
  return data;
}

/**
 * PATCH /me/password (204). Contraseña actual incorrecta → 400
 * INVALID_CURRENT_PASSWORD. Como defensa, un 401 aquí tampoco dispara el
 * refresco ni un reintento: reintentar sería volver a enviar la contraseña
 * actual sin que el admin lo pidiera. Para que un token vencido no haga
 * fallar el cambio, se renueva ANTES de enviar si vence en menos de 1 minuto.
 */
export async function changePassword(body: ChangePasswordBody): Promise<void> {
  // Si la renovación falla, la contraseña no se envía
  await ensureFreshToken();
  await api.patch('/me/password', body, { skipAuthRefresh: true });
}

// ---------- Moderación de comentarios ----------

/** GET /admin/comments/flagged — ocultos automáticamente o con denuncias pendientes. */
export async function getFlaggedComments(
  signal?: AbortSignal,
): Promise<FlaggedComment[]> {
  const { data } = await api.get<FlaggedComment[]>('/admin/comments/flagged', {
    signal,
  });
  return data;
}

/** PATCH /admin/comments/:id — `confirmar` (oculto_admin) o `restaurar` (visible). */
export async function moderateComment(
  id: number,
  accion: ModerateCommentBody['accion'],
): Promise<void> {
  const body: ModerateCommentBody = { accion };
  await api.patch(`/admin/comments/${id}`, body);
}

// ---------- Usuarios ----------

export const USER_SEARCH_MAX = 100;

/** Búsqueda: sin espacios sobrantes y nunca más de 100 caracteres (contrato). */
export function normalizeUserSearch(q: string): string {
  return q.trim().slice(0, USER_SEARCH_MAX);
}

/** GET /admin/users — paginado, búsqueda por nombre o correo. */
export async function getAdminUsers(
  query: AdminUsersQuery,
  signal?: AbortSignal,
): Promise<Page<AdminUser>> {
  const params: AdminUsersQuery = { page: query.page, limit: query.limit };
  const q = normalizeUserSearch(query.q ?? '');
  if (q) params.q = q;
  const { data } = await api.get<Page<AdminUser>>('/admin/users', {
    params,
    signal,
  });
  return data;
}

/** PATCH /admin/users/:id/status (204). Suspender cierra sus sesiones. */
export async function updateUserStatus(id: number, activo: boolean): Promise<void> {
  const body: UpdateUserStatusBody = { activo };
  await api.patch(`/admin/users/${id}/status`, body);
}

// ---------- Administradores ----------

/**
 * POST /admin/admins (201). `totp` es el código ACTUAL del admin que crea
 * (reautenticación). Va solo en esta petición: no se guarda en ningún lado.
 * - TOTP incorrecto → 400 INVALID_TOTP.
 * - Correo repetido → 409 EMAIL_TAKEN.
 * - 401 → la cuenta del admin está bloqueada o no tiene 2FA: mensaje
 *   genérico (no "Tu sesión expiró", ni detalles del bloqueo).
 * Nunca refresca ni reintenta (reintentar reenviaría el código y contaría
 * otro intento fallido); el token se renueva antes si está por vencer.
 */
export async function createAdmin(body: CreateAdminBody): Promise<AdminUser> {
  await ensureFreshToken();
  try {
    const { data } = await api.post<AdminUser>('/admin/admins', body, {
      skipAuthRefresh: true,
    });
    return data;
  } catch (e) {
    const error = toApiError(e);
    if (error.status === 401) {
      throw new ApiError({
        status: 401,
        requestId: error.requestId,
        userMessage: MESSAGES.createAdminUnavailable,
      });
    }
    throw error;
  }
}
