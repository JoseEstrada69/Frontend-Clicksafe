// Aviso de éxito que sobrevive a una navegación dentro del panel (por
// ejemplo "Reporte revisado…" al volver a la cola). Vive en memoria, no en
// la URL: no queda en el historial ni se puede falsificar con un enlace.

let flash: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function setFlash(message: string): void {
  flash = message;
  emit();
}

export function clearFlash(): void {
  if (flash === null) return;
  flash = null;
  emit();
}

export function getFlash(): string | null {
  return flash;
}

export function subscribeFlash(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
