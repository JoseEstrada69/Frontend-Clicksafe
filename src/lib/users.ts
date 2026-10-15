// GET /me no trae `id`: la fila del propio admin se reconoce por el correo.
// Es solo comunicación en la interfaz; la API rechaza cambiar el estado
// propio (OWN_STATUS) aunque alguien manipule el panel.

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isSameEmail(a: string, b: string): boolean {
  return normalizeEmail(a) === normalizeEmail(b);
}
