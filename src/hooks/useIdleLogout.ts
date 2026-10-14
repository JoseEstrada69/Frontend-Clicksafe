'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createIdleTimer, type IdleTimer } from '@/lib/idle';

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'wheel',
] as const;

// mousemove y scroll disparan decenas de eventos por segundo
const THROTTLE_MS = 1_000;

/**
 * Activa el cierre por inactividad mientras `enabled` sea true. Devuelve si
 * hay que mostrar el aviso y la acción del botón "Seguir conectado".
 */
export function useIdleLogout(enabled: boolean, onTimeout: () => void) {
  const [warning, setWarning] = useState(false);
  const timerRef = useRef<IdleTimer | null>(null);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  });

  useEffect(() => {
    if (!enabled) return;

    const timer = createIdleTimer({
      onWarn: () => setWarning(true),
      onTimeout: () => {
        setWarning(false);
        onTimeoutRef.current();
      },
    });
    timerRef.current = timer;

    let last = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - last < THROTTLE_MS) return;
      last = now;
      timer.activity();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') timer.check();
    };

    ACTIVITY_EVENTS.forEach((type) =>
      window.addEventListener(type, onActivity, { passive: true }),
    );
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      timer.stop();
      timerRef.current = null;
      ACTIVITY_EVENTS.forEach((type) =>
        window.removeEventListener(type, onActivity),
      );
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);

  const stayConnected = useCallback(() => {
    setWarning(false);
    timerRef.current?.stayConnected();
  }, []);

  return { warning, stayConnected };
}
