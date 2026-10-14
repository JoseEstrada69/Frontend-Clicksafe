import {
  enable2fa,
  login,
  logout,
  setup2fa,
  verify2fa,
} from './admin-api';
import { ApiError } from './errors';
import {
  clearPendingMfa,
  getPendingMfa,
  isMfaExpired,
  markMfaSetupDone,
  setSession,
  startPendingMfa,
  type PendingMfa,
} from './session';
import type { LoginResponse, MfaChallenge, MfaSetup } from './types';

// Flujo de inicio de sesión del panel (CLAUDE.md 7.4), sin React para poder
// probarlo. Las páginas de (auth) solo muestran estados y navegan.

export type LoginOutcome = 'verify' | 'setup' | 'not-admin';

function isMfaChallenge(response: LoginResponse): response is MfaChallenge {
  return 'mfaToken' in response;
}

function mfaExpiredError(): ApiError {
  return new ApiError({ status: null, code: 'MFA_EXPIRED' });
}

/**
 * POST /auth/login con un captcha ya resuelto.
 * - Admin con 2FA → guarda el mfaToken en memoria → 'verify'.
 * - Admin sin 2FA configurado → 'setup'.
 * - Tokens directos = usuario normal: se revoca esa sesión en el acto con su
 *   propio access token, no se guarda nada → 'not-admin'.
 */
export async function startLogin(
  correo: string,
  password: string,
  captcha: string,
): Promise<LoginOutcome> {
  const response = await login({ correo, password, captcha });

  if (isMfaChallenge(response)) {
    if (response.mfaRequired) {
      startPendingMfa(response.mfaToken, 'verify');
      return 'verify';
    }
    if (response.mfaSetupRequired) {
      startPendingMfa(response.mfaToken, 'setup');
      return 'setup';
    }
    throw new ApiError({ status: null });
  }

  // Si el logout falla, la sesión del usuario normal igual expira en el
  // servidor; el panel no la guarda en ningún lado.
  await logout(response.accessToken).catch(() => undefined);
  return 'not-admin';
}

/** La verificación pendiente y vigente, o error MFA_EXPIRED. */
function activeMfa(): PendingMfa {
  const pending = getPendingMfa();
  if (!pending || isMfaExpired(pending)) {
    clearPendingMfa();
    throw mfaExpiredError();
  }
  return pending;
}

/** POST /auth/2fa/verify → guarda la sesión completa y olvida el mfaToken. */
export async function completeVerify(codigo: string): Promise<void> {
  const { token } = activeMfa();
  const tokens = await verify2fa({ mfaToken: token, codigo });
  setSession(tokens);
}

// /auth/2fa/setup genera un secreto NUEVO en cada llamada. Si se llamara dos
// veces (React lo hace en desarrollo con StrictMode), el QR mostrado podría
// no ser el que quedó guardado en el servidor. Se comparte una sola petición
// por mfaToken y no se cancela al desmontar.
let setupRequest: { token: string; promise: Promise<MfaSetup> } | null = null;

/** POST /auth/2fa/setup con el mfaToken pendiente (una sola vez por token). */
export function loadMfaSetup(): Promise<MfaSetup> {
  let pending: PendingMfa;
  try {
    pending = activeMfa();
  } catch (e) {
    return Promise.reject(e);
  }
  if (pending.step !== 'setup') return Promise.reject(mfaExpiredError());
  if (setupRequest?.token !== pending.token) {
    const promise = setup2fa(pending.token);
    setupRequest = { token: pending.token, promise };
    promise.catch(() => {
      if (setupRequest?.promise === promise) setupRequest = null;
    });
  }
  return setupRequest.promise;
}

/**
 * POST /auth/2fa/enable. No devuelve tokens: el mismo mfaToken pasa a
 * /auth/2fa/verify con un código TOTP NUEVO (el servidor no acepta dos veces
 * el mismo código).
 */
export async function completeSetup(codigo: string): Promise<void> {
  const { token } = activeMfa();
  await enable2fa(token, codigo);
  setupRequest = null;
  markMfaSetupDone();
}
