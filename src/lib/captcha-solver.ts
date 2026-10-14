import type { CaptchaChallenge } from './types';

// Resolución del reto ALTCHA (proof-of-work, CLAUDE.md 7.7): buscar `n` en
// 0…maxnumber tal que hex(SHA-256(salt + n)) === challenge. Para una persona
// cuesta menos de un segundo; para un bot que prueba miles de contraseñas
// cuesta ese trabajo en CADA intento, y el servidor acepta cada reto una sola vez.
//
// Sin DOM ni React: lo usa el Web Worker y se puede probar en Node.

export interface CaptchaSolution {
  number: number;
  /** Milisegundos que tardó en resolverse. */
  took: number;
}

// Límite sano: un reto con un maxnumber enorme congelaría el equipo
const MAX_SEARCH = 10_000_000;
// Se calculan varios hashes en paralelo para aprovechar Web Crypto
const BATCH_SIZE = 1_000;

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

async function sha256Hex(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}

/** Devuelve la solución, o `null` si el reto no es válido o no tiene solución. */
export async function solveChallenge(
  challenge: CaptchaChallenge,
): Promise<CaptchaSolution | null> {
  const { algorithm, salt, maxnumber } = challenge;
  if (
    algorithm !== 'SHA-256' ||
    !Number.isInteger(maxnumber) ||
    maxnumber < 0 ||
    maxnumber > MAX_SEARCH
  ) {
    return null;
  }

  const target = challenge.challenge.toLowerCase();
  const start = Date.now();

  for (let first = 0; first <= maxnumber; first += BATCH_SIZE) {
    const last = Math.min(first + BATCH_SIZE - 1, maxnumber);
    const candidates = Array.from({ length: last - first + 1 }, (_, i) => first + i);
    const hashes = await Promise.all(
      candidates.map((n) => sha256Hex(salt + String(n))),
    );
    const found = hashes.indexOf(target);
    if (found !== -1) {
      return { number: candidates[found], took: Date.now() - start };
    }
  }
  return null;
}
