'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Sidebar } from '@/components/Sidebar';
import { Skeleton } from '@/components/Skeleton';
import { useIdleLogout } from '@/hooks/useIdleLogout';
import { SessionContext } from '@/hooks/useSession';
import { getAdminReports, getFlaggedComments, getMe, logout } from '@/lib/admin-api';
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

  // Cerrar sesión (CLAUDE.md 7.1): revocar en el servidor, borrar access
  // (memoria) y refresh (sessionStorage) y salir de (panel), lo que desmonta
  // y descarta todo el estado de React.
  const closeSession = useCallback(async (notice: string | null) => {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      // Aunque el servidor no responda, la sesión se borra de este navegador
    }
    endSession(notice);
  }, []);

  const signOut = useCallback(() => closeSession(null), [closeSession]);

  const idle = useIdleLogout(state.status === 'ready', () => {
    void closeSession(MESSAGES.idleLogout);
  });

  const replaceMe = useCallback((me: Me) => {
    setState({ status: 'ready', me });
  }, []);

  // Contadores de la barra lateral: reportes pendientes (basta con el `total`
  // de una página de 1 elemento) y comentarios por moderar (la cola no está
  // paginada). Son solo informativos: si fallan, no se muestran.
  const ready = state.status === 'ready';
  const [pendingReports, setPendingReports] = useState<number | null>(null);
  const [flaggedComments, setFlaggedComments] = useState<number | null>(null);
  const [countersVersion, setCountersVersion] = useState(0);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    getAdminReports({ page: 1, limit: 1, estado: 'pendiente' }, controller.signal)
      .then((page) => setPendingReports(page.total))
      .catch(() => undefined);
    getFlaggedComments(controller.signal)
      .then((comments) => setFlaggedComments(comments.length))
      .catch(() => undefined);
    return () => controller.abort();
  }, [ready, countersVersion]);
  const refreshCounters = useCallback(() => setCountersVersion((v) => v + 1), []);

  const session = useMemo(
    () =>
      state.status === 'ready'
        ? { me: state.me, signOut, replaceMe, refreshCounters }
        : null,
    [state, signOut, replaceMe, refreshCounters],
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
          counts={{ '/reportes': pendingReports, '/comentarios': flaggedComments }}
          signingOut={signingOut}
          onSignOut={signOut}
        />
        <main className={styles.content}>{children}</main>
      </div>
      <ConfirmDialog
        open={idle.warning}
        title="¿Sigues ahí?"
        confirmLabel="Seguir conectado"
        cancelLabel="Cerrar sesión"
        onConfirm={idle.stayConnected}
        onCancel={signOut}
      >
        <p>
          Por seguridad, cerraremos tu sesión en 1 minuto por inactividad.
        </p>
      </ConfirmDialog>
    </SessionContext.Provider>
  );
}
