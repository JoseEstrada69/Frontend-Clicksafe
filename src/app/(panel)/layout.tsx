'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Sidebar } from '@/components/Sidebar';
import { Skeleton } from '@/components/Skeleton';
import { SessionContext } from '@/hooks/useSession';
import { getMe, logout } from '@/lib/admin-api';
import { refreshSession } from '@/lib/api';
import { MESSAGES, toApiError, type ApiError } from '@/lib/errors';
import {
  endSession,
  getAccessToken,
  getRefreshToken,
  onSessionEnd,
} from '@/lib/session';
import type { Me } from '@/lib/types';
import styles from './panel.module.css';

type GuardState =
  | { status: 'checking' }
  | { status: 'ready'; me: Me }
  | { status: 'error'; error: ApiError };

// Guardia del panel. Es SOLO experiencia de usuario: evita mostrar pantallas
// vacías a quien no tiene sesión. La autorización real la hace la API
// (RolesGuard + 2FA) en cada petición; nada de aquí protege datos.
export default function PanelLayout({ children }: LayoutProps<'/'>) {
  const router = useRouter();
  const [state, setState] = useState<GuardState>({ status: 'checking' });
  const [attempt, setAttempt] = useState(0);
  const [signingOut, setSigningOut] = useState(false);

  // Si la sesión termina en cualquier momento (refresh rechazado, cerrar
  // sesión…), al login. Al salir de (panel) se desmonta y se pierde todo el
  // estado de React de la sesión.
  useEffect(() => onSessionEnd(() => router.replace('/login')), [router]);

  useEffect(() => {
    const controller = new AbortController();

    async function check(): Promise<void> {
      // Al recargar la página el access token (memoria) se pierde: se pide
      // uno nuevo con el refresh token de sessionStorage.
      if (!getAccessToken()) {
        if (!getRefreshToken()) {
          endSession(null);
          return;
        }
        await refreshSession();
      }
      const me = await getMe(controller.signal);
      if (me.rol !== 'admin') {
        await logout().catch(() => undefined);
        endSession(MESSAGES.adminOnly);
        return;
      }
      if (!me.totpActivo) {
        await logout().catch(() => undefined);
        endSession(MESSAGES.sessionExpired);
        return;
      }
      setState({ status: 'ready', me });
    }

    check().catch((e: unknown) => {
      const error = toApiError(e);
      if (controller.signal.aborted || error.canceled) return;
      if (error.status === 401) {
        endSession(MESSAGES.sessionExpired);
        return;
      }
      // Servidor caído, 429 o 5xx: la sesión se conserva y se puede reintentar
      setState({ status: 'error', error });
    });

    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'checking' });
    setAttempt((n) => n + 1);
  }, []);

  const signOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      // Aunque el servidor no responda, la sesión se borra de este navegador
    }
    endSession(null);
  }, []);

  const session = useMemo(
    () => (state.status === 'ready' ? { me: state.me, signOut } : null),
    [state, signOut],
  );

  if (state.status === 'error') {
    return (
      <main className={styles.standalone}>
        <ErrorBanner error={state.error} onRetry={retry} />
      </main>
    );
  }

  if (!session) {
    return (
      <main className={styles.standalone}>
        <Skeleton lines={4} label="Verificando tu sesión…" />
      </main>
    );
  }

  return (
    <SessionContext.Provider value={session}>
      <div className={styles.shell}>
        <Sidebar
          adminName={session.me.nombre}
          signingOut={signingOut}
          onSignOut={signOut}
        />
        <main className={styles.content}>{children}</main>
      </div>
    </SessionContext.Provider>
  );
}
