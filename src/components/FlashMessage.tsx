'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { clearFlash, getFlash, subscribeFlash } from '@/lib/flash';
import styles from './FlashMessage.module.css';

const AUTO_HIDE_MS = 8_000;

/** Muestra el aviso de éxito pendiente (lib/flash.ts) y lo quita a los 8 s. */
export function FlashMessage() {
  const message = useSyncExternalStore(subscribeFlash, getFlash, () => null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(clearFlash, AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <div aria-live="polite">
      {message && (
        <div className={styles.flash}>
          <p className={styles.text}>{message}</p>
          <button
            type="button"
            className={styles.close}
            onClick={clearFlash}
            aria-label="Cerrar aviso"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
