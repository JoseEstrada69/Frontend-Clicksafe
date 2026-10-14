// Tipos de la API de ClickSafe, copiados de docs/openapi.json
// (components.schemas). Solo los que usa el panel de administración; los de
// la app iOS (registro, likes, notificaciones…) no se incluyen.
// Si el contrato cambia, se actualiza primero docs/openapi.json y luego aquí.
// Los nombres de los campos se conservan tal cual: no traducir ni renombrar.

// ---------- Comunes ----------

export type Rol = 'usuario' | 'admin';
export type ReportState = 'pendiente' | 'validado' | 'rechazado';
export type ReviewDecision = 'validado' | 'rechazado';
export type CommentState = 'visible' | 'oculto_auto' | 'oculto_admin' | 'eliminado';
export type FlagReason =
  | 'spam'
  | 'acoso'
  | 'lenguaje_ofensivo'
  | 'informacion_personal'
  | 'otro';

/** Listados paginados: `{ items, page, limit, total }`. `limit` ≤ 50. */
export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

/** Cuerpo de los errores de la API. `message` es técnico: nunca se muestra. */
export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  requestId: string;
  code?: string;
}

/** `GenericMessageResponse`. El texto es del servidor: no se muestra. */
export interface GenericMessage {
  message: string;
}

// ---------- Autenticación ----------

/** `CaptchaChallengeResponse` (GET /auth/captcha): reto ALTCHA. */
export interface CaptchaChallenge {
  algorithm: string;
  challenge: string;
  maxnumber: number;
  salt: string;
  signature: string;
}

/** `TokensResponse`. */
export interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** Vigencia del access token, en segundos. */
  expiresIn: number;
}

/** `MfaChallengeResponse`: respuesta de /auth/login para administradores. */
export interface MfaChallenge {
  mfaRequired?: boolean;
  mfaSetupRequired?: boolean;
  mfaToken: string;
}

/** POST /auth/login responde tokens (usuario normal) o el reto de 2FA (admin). */
export type LoginResponse = Tokens | MfaChallenge;

/** `LoginDto`. */
export interface LoginBody {
  correo: string;
  password: string;
  captcha: string;
}

/** `Setup2faResponse`. */
export interface MfaSetup {
  otpauthUri: string;
  qrCodeDataUrl: string;
}

/** `MfaEnableDto`. */
export interface MfaEnableBody {
  codigo: string;
}

/** `MfaVerifyDto`. */
export interface MfaVerifyBody {
  mfaToken: string;
  codigo: string;
}

/** `ForgotPasswordDto`. */
export interface ForgotPasswordBody {
  correo: string;
  captcha: string;
}

/** `ResetPasswordDto`. `codigo` son 8 dígitos. */
export interface ResetPasswordBody {
  correo: string;
  codigo: string;
  nuevaPassword: string;
  captcha: string;
}

// ---------- Mi cuenta ----------

/** `MeResponse`. */
export interface Me {
  nombre: string;
  correo: string;
  rol: Rol;
  /** ISO 8601 UTC. */
  fechaRegistro: string;
  totpActivo: boolean;
}

/** `UpdateMeDto`. */
export interface UpdateMeBody {
  nombre: string;
}

/** `ChangePasswordDto`. */
export interface ChangePasswordBody {
  passwordActual: string;
  nuevaPassword: string;
}

// ---------- Reportes ----------

export interface IdName {
  id: number;
  nombre: string;
}

/** `ReportRevisionResponse`. */
export interface ReportRevision {
  decision: ReviewDecision;
  comentario: string | null;
  fecha: string;
}

/** `EvidenceRefResponse` / `AdminEvidenceRefResponse`. `url` es firmada y dura 15 min. */
export interface EvidenceRef {
  id: number;
  url: string;
}

/** `ReportResponse` (GET /reports/:id). */
export interface Report {
  id: number;
  titulo: string;
  descripcion: string;
  urlPublicacion: string;
  plataforma: IdName;
  plataformaOtra: string | null;
  categoria: IdName;
  estado: ReportState;
  anonimo: boolean;
  autor: { nombre: string };
  esMio: boolean;
  likedByMe: boolean;
  totalLikes: number;
  totalComentarios: number;
  evidencias: EvidenceRef[];
  revision: ReportRevision | null;
  fechaCreacion: string;
  fechaActualizacion: string;
}

/** `AdminUserRefResponse`: autor real, aunque el reporte o comentario sea anónimo. */
export interface AdminUserRef {
  nombre: string;
  correo: string;
}

/** `AdminReportResponse` (GET /admin/reports). */
export interface AdminReport {
  id: number;
  titulo: string;
  descripcion: string;
  urlPublicacion: string;
  plataforma: IdName;
  plataformaOtra: string | null;
  categoria: IdName;
  estado: ReportState;
  anonimo: boolean;
  autor: AdminUserRef;
  totalLikes: number;
  evidencias: EvidenceRef[];
  fechaCreacion: string;
  fechaActualizacion: string;
}

/** Query de GET /admin/reports. */
export interface AdminReportsQuery {
  page: number;
  limit: number;
  estado?: ReportState;
}

/** `ReviewReportDto`. `comentario` máx. 500. */
export interface ReviewReportBody {
  decision: ReviewDecision;
  comentario?: string;
}

// ---------- Moderación de comentarios ----------

/** `FlaggedCommentResponse` (GET /admin/comments/flagged). */
export interface FlaggedComment {
  id: number;
  contenido: string;
  estado: CommentState;
  totalDenuncias: number;
  autor: AdminUserRef;
  reporteId: number;
  motivos: FlagReason[];
  fechaCreacion: string;
}

/** `ModerateCommentDto`. */
export interface ModerateCommentBody {
  accion: 'confirmar' | 'restaurar';
}

// ---------- Usuarios ----------

/** `AdminUserResponse` (GET /admin/users, POST /admin/admins). */
export interface AdminUser {
  id: number;
  nombre: string;
  correo: string;
  rol: Rol;
  activo: boolean;
  correoVerificado: boolean;
  fechaRegistro: string;
}

/** Query de GET /admin/users. `q` máx. 100. */
export interface AdminUsersQuery {
  page: number;
  limit: number;
  q?: string;
}

/** `UpdateUserStatusDto`. */
export interface UpdateUserStatusBody {
  activo: boolean;
}

/** `CreateAdminDto`. `totp`: código actual del admin que crea (6 dígitos). */
export interface CreateAdminBody {
  nombre: string;
  correo: string;
  totp: string;
}

// ---------- Catálogos ----------

/** `AdminPlatformResponse`. */
export interface AdminPlatform {
  id: number;
  nombre: string;
  esOtra: boolean;
  activa: boolean;
}

/** `CreatePlatformDto`. */
export interface CreatePlatformBody {
  nombre: string;
}

/** `UpdatePlatformDto`. */
export interface UpdatePlatformBody {
  nombre?: string;
  activa?: boolean;
}

/** `AdminCategoryResponse`. */
export interface AdminCategory {
  id: number;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
}

/** `CreateCategoryDto`. `descripcion` máx. 255. */
export interface CreateCategoryBody {
  nombre: string;
  descripcion?: string;
}

/** `UpdateCategoryDto`. */
export interface UpdateCategoryBody {
  nombre?: string;
  descripcion?: string;
  activa?: boolean;
}

// ---------- Estadísticas ----------

/** `AdminStatsResponse` (GET /admin/stats). */
export interface AdminStats {
  porPlataforma: { plataforma: string; total: number }[];
  porCategoria: { categoria: string; total: number }[];
  porEstado: { estado: ReportState; total: number }[];
}

// ---------- Bitácora ----------

/** `AuditLogEntryResponse` (GET /admin/audit-log). */
export interface AuditLogEntry {
  id: string;
  fecha: string;
  idUsuario: number | null;
  accion: string;
  resultado: 'exito' | 'fallo';
  recursoTipo: string | null;
  recursoId: number | null;
  ip: string | null;
  userAgent: string | null;
  detalle: Record<string, unknown> | null;
}

/** Query de GET /admin/audit-log. `desde`/`hasta` en ISO 8601. */
export interface AuditLogQuery {
  page: number;
  limit: number;
  accion?: string;
  usuario?: number;
  desde?: string;
  hasta?: string;
}
