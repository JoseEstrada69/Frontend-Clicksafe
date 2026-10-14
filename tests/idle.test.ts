import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIdleTimer, IDLE_TIMEOUT_MS, IDLE_WARNING_MS } from '@/lib/idle';

const MINUTE = 60_000;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function setup() {
  const onWarn = vi.fn();
  const onTimeout = vi.fn();
  const timer = createIdleTimer({ onWarn, onTimeout });
  return { timer, onWarn, onTimeout };
}

describe('cierre por inactividad (idle.ts)', () => {
  it('usa 15 minutos con aviso 1 minuto antes', () => {
    expect(IDLE_TIMEOUT_MS).toBe(15 * MINUTE);
    expect(IDLE_WARNING_MS).toBe(MINUTE);
  });

  it('avisa a los 14 minutos y cierra a los 15', () => {
    const { onWarn, onTimeout } = setup();

    vi.advanceTimersByTime(14 * MINUTE - 1);
    expect(onWarn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onWarn).toHaveBeenCalledTimes(1);
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(MINUTE);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('la actividad reinicia la cuenta', () => {
    const { timer, onWarn, onTimeout } = setup();

    vi.advanceTimersByTime(10 * MINUTE);
    timer.activity();
    vi.advanceTimersByTime(10 * MINUTE);

    expect(onWarn).not.toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('con el aviso visible, mover el mouse no basta: hay que pulsar "Seguir conectado"', () => {
    const { timer, onTimeout } = setup();

    vi.advanceTimersByTime(14 * MINUTE);
    timer.activity();
    vi.advanceTimersByTime(MINUTE);

    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('"Seguir conectado" quita el aviso y vuelve a contar 15 minutos', () => {
    const { timer, onWarn, onTimeout } = setup();

    vi.advanceTimersByTime(14 * MINUTE + 30_000);
    timer.stayConnected();
    vi.advanceTimersByTime(14 * MINUTE - 1);

    expect(onWarn).toHaveBeenCalledTimes(1);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('al volver a la pestaña tras dormir el equipo, cierra si ya pasó la hora', () => {
    let now = 0;
    const onTimeout = vi.fn();
    // Reloj manual: los temporizadores no avanzan (equipo dormido)
    const timer = createIdleTimer({ onWarn: vi.fn(), onTimeout, now: () => now });

    now = 20 * MINUTE;
    timer.check();

    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('stop() cancela todo (al cerrar sesión o salir del panel)', () => {
    const { timer, onWarn, onTimeout } = setup();
    timer.stop();
    vi.advanceTimersByTime(30 * MINUTE);
    expect(onWarn).not.toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
