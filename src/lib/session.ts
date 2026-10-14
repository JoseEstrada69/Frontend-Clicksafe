import type { Tokens } from './types';

// Dónde vive cada token (CLAUDE.md 7.1):
// - access token: solo en esta variable del módulo (memoria). Nunca en
//   localStorage, cookies escritas desde JS ni la URL.
// - refresh token: en sessionStorage. Se borra al cerrar la pestaña y no se
//   comparte con otras pestañas; al recargar se usa para pedir uno nuevo.
// Cuanto menos tiempo y en menos lugares viva un token, menos sirve si lo
// roban. La defensa principal contra el robo (XSS) es la CSP de src/proxy.ts.

const REFRESH_KEY = 'clicksafe.refreshToken';

let accessToken: string | null = null;
/** Cuándo vence el access token (ms desde epoch), según `expiresIn`. */
let accessExpiresAt: number | null = null;

// sessionStorage no existe al renderizar en el servidor, y el navegador puede
// bloquearlo (modo privado, políticas): en ese caso se trata como vacío.
function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  try {
    return storage()?.getItem(REFRESH_KEY) ?? null;
  } catch {
    return null;
  }
}

export function setSession(tokens: Tokens): void {
  accessToken = tokens.accessToken;
  accessExpiresAt = Date.now() + tokens.expiresIn * 1000;
  try {
    storage()?.setItem(REFRESH_KEY, tokens.refreshToken);
  } catch {
    // Sin almacenamiento la sesión dura hasta recargar la página
  }
  setLoginNotice(null);
  clearPendingMfa();
}

/**
 * El access token vence dentro de `marginMs` (o ya venció). Sirve para
 * renovarlo ANTES de una petición que no debe reintentarse.
 */
export function accessTokenExpiresSoon(
  marginMs: number = 60_000,
  now: number = Date.now(),
): boolean {
  return accessExpiresAt !== null && accessExpiresAt - now <= marginMs;
}

export function clearSession(): void {
  accessToken = null;
  accessExpiresAt = null;
  try {
    storage()?.removeItem(REFRESH_KEY);
  } catch {
    // Nada que borrar
  }
  clearPendingMfa();
}

// ---------- Verificación en dos pasos pendiente ----------
// El mfaToken que da /auth/login a un admin vive SOLO aquí, en memoria
// (CLAUDE.md 7.4). Si se recarga la página se pierde y hay que volver a
// iniciar sesión: es a propósito. Dura 5 minutos en el servidor; el
// vencimiento local sirve para avisar "Tu verificación expiró…" sin esperar
// un 401 que el servidor no distingue de un código incorrecto.

export const MFA_TOKEN_TTL_MS = 5 * 60_000;

export type MfaStep = 'verify' | 'setup';

export interface PendingMfa {
  readonly token: string;
  readonly step: MfaStep;
  readonly expiresAt: number;
  /** Se acaba de activar el 2FA: hay que esperar un código TOTP nuevo. */
  readonly afterSetup: boolean;
}

let pendingMfa: PendingMfa | null = null;
const mfaListeners = new Set<() => void>();

function setPendingMfaValue(value: PendingMfa | null): void {
  if (pendingMfa === value) return;
  pendingMfa = value;
  mfaListeners.forEach((listener) => listener());
}

export function startPendingMfa(
  token: string,
  step: MfaStep,
  now: number = Date.now(),
): void {
  setPendingMfaValue({
    token,
    step,
    expiresAt: now + MFA_TOKEN_TTL_MS,
    afterSetup: false,
  });
}

/** Después de activar el 2FA se verifica con el MISMO mfaToken. */
export function markMfaSetupDone(): void {
  if (!pendingMfa) return;
  setPendingMfaValue({ ...pendingMfa, step: 'verify', afterSetup: true });
}

/** La verificación pendiente, aunque ya haya vencido (revisar `isMfaExpired`). */
export function getPendingMfa(): PendingMfa | null {
  return pendingMfa;
}

export function isMfaExpired(
  mfa: PendingMfa,
  now: number = Date.now(),
): boolean {
  return now >= mfa.expiresAt;
}

export function clearPendingMfa(): void {
  setPendingMfaValue(null);
}

export function subscribePendingMfa(listener: () => void): () => void {
  mfaListeners.add(listener);
  return () => {
    mfaListeners.delete(listener);
  };
}

// ---------- Fin de sesión ----------
// Cuando la sesión termina fuera de un componente (por ejemplo, el refresco
// falla dentro del interceptor de api.ts), se avisa a quien escuche, que es
// el layout del panel: él limpia el estado de React y lleva al login.

type SessionEndListener = () => void;
const sessionEndListeners = new Set<SessionEndListener>();

export function onSessionEnd(listener: SessionEndListener): () => void {
  sessionEndListeners.add(listener);
  return () => {
    sessionEndListeners.delete(listener);
  };
}

/** Borra los tokens, deja un aviso para el login y avisa a los suscriptores. */
export function endSession(notice: string | null): void {
  clearSession();
  setLoginNotice(notice);
  sessionEndListeners.forEach((listener) => listener());
}

// ---------- Aviso para la pantalla de login ----------
// "Tu sesión expiró…", "Cerramos tu sesión por inactividad.", etc. Vive en
// memoria y no en la URL: así no queda en el historial ni se puede falsificar
// con un enlace (?mensaje=...).

let loginNotice: string | null = null;
const noticeListeners = new Set<() => void>();

/** Deja un aviso para la pantalla de login (por ejemplo, "Contraseña actualizada…"). */
export function setLoginNotice(notice: string | null): void {
  if (loginNotice === notice) return;
  loginNotice = notice;
  noticeListeners.forEach((listener) => listener());
}

export function getLoginNotice(): string | null {
  return loginNotice;
}

export function subscribeLoginNotice(listener: () => void): () => void {
  noticeListeners.add(listener);
  return () => {
    noticeListeners.delete(listener);
  };
}
