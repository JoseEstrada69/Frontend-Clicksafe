'use client';

import { useSyncExternalStore } from 'react';
import { Logo } from '@/components/Logo';
import { getLoginNotice, subscribeLoginNotice } from '@/lib/session';
import styles from '../auth.module.css';

// PROVISIONAL (Fase 1): el formulario real (captcha ALTCHA + 2FA) llega en la
// Fase 2. El de la plantilla mandaba {email, password}, que la API no acepta.

export default function LoginPage() {
  // El aviso ("Tu sesión expiró…") vive en memoria del navegador. En el
  // servidor no existe, por eso el tercer argumento devuelve null y React no
  // marca diferencia al hidratar.
  const notice = useSyncExternalStore(
    subscribeLoginNotice,
    getLoginNotice,
    () => null,
  );

  return (
    <div className={styles.panel}>
      <Logo size="large" />
      <h1>ClickSafe</h1>
      <p className={styles.subtitle}>Panel de administración</p>
      <div aria-live="polite" className={styles.noticeRegion}>
        {notice && <p className={styles.notice}>{notice}</p>}
      </div>
      <p className={styles.pending}>
        El inicio de sesión estará disponible en la siguiente fase.
      </p>
    </div>
  );
}
