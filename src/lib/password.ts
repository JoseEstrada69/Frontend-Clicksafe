// Contraseñas nuevas (CLAUDE.md 7.4): de 8 a 128 caracteres, sin reglas de
// mayúsculas ni símbolos (ASVS ya no las recomienda: empujan a contraseñas
// predecibles como "Password1!"). El servidor rechaza las comunes (PASSWORD_WEAK).

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/** Mensaje del problema, o undefined si la contraseña cumple el largo. */
export function passwordProblem(password: string): string | undefined {
  if (password.length < PASSWORD_MIN) return 'Usa al menos 8 caracteres.';
  if (password.length > PASSWORD_MAX) return 'Usa como máximo 128 caracteres.';
  return undefined;
}

export function isEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+$/.test(value);
}
