// Cierre de sesión por inactividad (CLAUDE.md 7.1): 15 minutos sin
// interacción cierran la sesión; un minuto antes se avisa. Un panel de admin
// abierto y desatendido en una computadora del laboratorio es un riesgo real.
//
// Lógica pura (sin DOM): el hook useIdleLogout la conecta a los eventos.

export const IDLE_TIMEOUT_MS = 15 * 60_000;
export const IDLE_WARNING_MS = 60_000;

export interface IdleTimerOptions {
  timeoutMs?: number;
  /** Cuánto antes del cierre se avisa. */
  warningMs?: number;
  onWarn: () => void;
  onTimeout: () => void;
  now?: () => number;
}

export interface IdleTimer {
  /** Hubo actividad: vuelve a contar desde cero (salvo con el aviso visible). */
  activity: () => void;
  /** "Seguir conectado": quita el aviso y vuelve a contar. */
  stayConnected: () => void;
  /**
   * Revisa si ya se pasó la hora (al volver a la pestaña o despertar el
   * equipo, cuando los temporizadores del navegador pudieron atrasarse).
   */
  check: () => void;
  stop: () => void;
}

export function createIdleTimer({
  timeoutMs = IDLE_TIMEOUT_MS,
  warningMs = IDLE_WARNING_MS,
  onWarn,
  onTimeout,
  now = Date.now,
}: IdleTimerOptions): IdleTimer {
  let deadline = 0;
  let warning = false;
  let finished = false;
  let warnTimer: ReturnType<typeof setTimeout> | undefined;
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

  function clearTimers() {
    clearTimeout(warnTimer);
    clearTimeout(timeoutTimer);
  }

  function finish() {
    if (finished) return;
    finished = true;
    clearTimers();
    onTimeout();
  }

  function warn() {
    if (finished || warning) return;
    warning = true;
    onWarn();
  }

  function restart() {
    if (finished) return;
    clearTimers();
    warning = false;
    deadline = now() + timeoutMs;
    warnTimer = setTimeout(warn, timeoutMs - warningMs);
    timeoutTimer = setTimeout(finish, timeoutMs);
  }

  restart();

  return {
    activity() {
      // Con el aviso visible hay que confirmar con el botón: mover el mouse
      // por accidente no debe bastar.
      if (!warning) restart();
    },
    stayConnected: restart,
    check() {
      if (finished) return;
      const left = deadline - now();
      if (left <= 0) finish();
      else if (left <= warningMs) warn();
    },
    stop() {
      finished = true;
      clearTimers();
    },
  };
}
