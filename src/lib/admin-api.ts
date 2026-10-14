import { api, refreshSession } from './api';
import { accessTokenExpiresSoon, getAccessToken } from './session';
import type {
  AdminReport,
  AdminReportDetail,
  AdminReportsQuery,
  AdminStats,
  GenericMessage,
  Page,
  ReviewDecision,
  ReviewReportBody,
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
  if (getAccessToken() && accessTokenExpiresSoon()) {
    // Si la renovación falla, la contraseña no se envía
    await refreshSession();
  }
  await api.patch('/me/password', body, { skipAuthRefresh: true });
}
