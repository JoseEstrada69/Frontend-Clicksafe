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
  try {
    storage()?.setItem(REFRESH_KEY, tokens.refreshToken);
  } catch {
    // Sin almacenamiento la sesión dura hasta recargar la página
  }
  setLoginNotice(null);
}

export function clearSession(): void {
  accessToken = null;
  try {
    storage()?.removeItem(REFRESH_KEY);
  } catch {
    // Nada que borrar
  }
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

function setLoginNotice(notice: string | null): void {
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
