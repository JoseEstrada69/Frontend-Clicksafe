import { getCaptchaChallenge } from './admin-api';
import type { CaptchaSolution } from './captcha-solver';
import { ApiError, toApiError } from './errors';
import type { CaptchaChallenge } from './types';

// Captcha ALTCHA (CLAUDE.md 7.7): pedir reto → resolverlo en un Web Worker →
// mandar el resultado en Base64 en el campo `captcha` del body.

function captchaError(): ApiError {
  return new ApiError({ status: null, code: 'CAPTCHA_INVALID' });
}

/** Payload que espera el servidor: JSON → Base64. */
export function encodeCaptchaPayload(
  challenge: CaptchaChallenge,
  solution: CaptchaSolution,
): string {
  return btoa(
    JSON.stringify({
      algorithm: challenge.algorithm,
      challenge: challenge.challenge,
      number: solution.number,
      salt: challenge.salt,
      signature: challenge.signature,
      took: solution.took,
    }),
  );
}

function solveInWorker(
  challenge: CaptchaChallenge,
): Promise<CaptchaSolution | null> {
  return new Promise((resolve, reject) => {
    // Next empaqueta el worker como un archivo propio del mismo origen
    // (permitido por worker-src 'self' en la CSP)
    const worker = new Worker(new URL('./captcha.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<CaptchaSolution | null>) => {
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = () => {
      worker.terminate();
      reject(captchaError());
    };
    worker.postMessage(challenge);
  });
}

/** Pide un reto nuevo, lo resuelve y devuelve el valor para el campo `captcha`. */
export async function solveCaptcha(): Promise<string> {
  const challenge = await getCaptchaChallenge();
  const solution = await solveInWorker(challenge);
  if (!solution) throw captchaError();
  return encodeCaptchaPayload(challenge, solution);
}

export interface CaptchaSteps {
  /** Se empieza a resolver el captcha: el botón dice "Verificando…". */
  onSolving?: () => void;
  /** El captcha está listo y se manda la petición. */
  onSending?: () => void;
}

/**
 * Ejecuta `send` con un captcha resuelto. Si el servidor responde
 * CAPTCHA_INVALID (reto vencido o ya usado), reintenta UNA vez con un reto
 * nuevo; si vuelve a fallar, el error sale tal cual.
 */
export async function withCaptcha<T>(
  send: (captcha: string) => Promise<T>,
  steps: CaptchaSteps = {},
  solve: () => Promise<string> = solveCaptcha,
): Promise<T> {
  const attempt = async () => {
    steps.onSolving?.();
    const captcha = await solve();
    steps.onSending?.();
    return send(captcha);
  };
  try {
    return await attempt();
  } catch (e) {
    const error = toApiError(e);
    if (error.code !== 'CAPTCHA_INVALID') throw error;
    return attempt();
  }
}
