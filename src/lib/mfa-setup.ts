// Validación de lo que manda /auth/2fa/setup antes de mostrarlo.
// Aunque viene de nuestra API, el QR termina en un atributo `src` y la clave
// en pantalla: solo se aceptan si tienen exactamente la forma esperada
// (CLAUDE.md 7.3: nada de datos sin validar en `src`).

/** Solo una imagen PNG en Base64; nunca `javascript:` ni otros esquemas. */
export function safeQrDataUrl(value: string): string | null {
  return /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
    ? value
    : null;
}

/**
 * Clave para captura manual: el parámetro `secret` de la URI
 * `otpauth://totp/...`, en Base32. Devuelve null si la URI no es válida.
 */
export function totpSecretFromUri(uri: string): string | null {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return null;
  }
  if (url.protocol !== 'otpauth:') return null;
  const secret = url.searchParams.get('secret')?.toUpperCase() ?? '';
  return /^[A-Z2-7]{16,128}=*$/.test(secret) ? secret.replace(/=+$/, '') : null;
}

/** "JBSWY3DPEHPK3PXP" → "JBSW Y3DP EHPK 3PXP" (más fácil de copiar a mano). */
export function groupSecret(secret: string): string {
  return secret.replace(/(.{4})(?=.)/g, '$1 ');
}
