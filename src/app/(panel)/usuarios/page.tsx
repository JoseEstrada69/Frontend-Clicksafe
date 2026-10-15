'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { FlashMessage } from '@/components/FlashMessage';
import { Pagination } from '@/components/Pagination';
import { SearchField } from '@/components/SearchField';
import { Skeleton } from '@/components/Skeleton';
import { UserStatusBadge } from '@/components/UserStatusBadge';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useSession } from '@/hooks/useSession';
import { getAdminUsers, updateUserStatus, USER_SEARCH_MAX } from '@/lib/admin-api';
import { toApiError } from '@/lib/errors';
import { setFlash } from '@/lib/flash';
import { formatDate } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/labels';
import type { AdminUser } from '@/lib/types';
import { isSameEmail } from '@/lib/users';
import panel from '../panel.module.css';
import styles from './usuarios.module.css';

const LIMIT = 20;

/** W09 · Usuarios. */
export default function UsersPage() {
  const { me } = useSession();
  // Búsqueda y página en el estado de React: los términos (nombres, correos)
  // no quedan en la URL ni en el historial (CLAUDE.md 7.6).
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<AdminUser | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const users = useApiQuery(
    (signal) => getAdminUsers({ page, limit: LIMIT, q }, signal),
    [page, q],
    { isEmpty: (result) => result.items.length === 0 },
  );

  function search(value: string) {
    setQ(value);
    setPage(1);
  }

  async function confirm() {
    if (!pending || sending) return;
    const suspend = pending.activo;
    setSending(true);
    setError('');
    try {
      await updateUserStatus(pending.id, !suspend);
      setFlash(
        suspend
          ? `Se suspendió la cuenta de ${pending.nombre}.`
          : `Se reactivó la cuenta de ${pending.nombre}.`,
      );
    } catch (e) {
      setError(toApiError(e).userMessage);
    }
    // Se vuelve a pedir la lista: el estado que se muestra es el del servidor
    setPending(null);
    setSending(false);
    users.reload();
  }

  const columns: Column<AdminUser>[] = [
    { key: 'nombre', header: 'Nombre', width: 'primary', render: (user) => user.nombre },
    { key: 'correo', header: 'Correo', render: (user) => user.correo },
    { key: 'rol', header: 'Rol', width: 'nowrap', render: (user) => ROLE_LABEL[user.rol] },
    {
      key: 'registro',
      header: 'Registro',
      width: 'nowrap',
      render: (user) => formatDate(user.fechaRegistro),
    },
    {
      key: 'estado',
      header: 'Estado',
      width: 'nowrap',
      render: (user) => <UserStatusBadge activo={user.activo} />,
    },
    {
      key: 'accion',
      header: 'Acción',
      width: 'nowrap',
      render: (user) => {
        if (isSameEmail(user.correo, me.correo)) {
          return <span className={styles.self}>Tu cuenta</span>;
        }
        return user.activo ? (
          <Button variant="danger" disabled={sending} onClick={() => setPending(user)}>
            Suspender
          </Button>
        ) : (
          <Button variant="secondary" disabled={sending} onClick={() => setPending(user)}>
            Reactivar
          </Button>
        );
      },
    },
  ];

  const suspending = pending?.activo ?? false;

  return (
    <>
      <header className={`${panel.pageHeader} ${styles.header}`}>
        <h1>Usuarios</h1>
        <Link href="/administradores/nuevo" className={styles.newAdmin}>
          Nuevo administrador
        </Link>
      </header>

      <FlashMessage />
      <div aria-live="assertive">
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>

      <SearchField
        label="Buscar usuarios por nombre o correo"
        placeholder="Buscar por nombre o correo"
        maxLength={USER_SEARCH_MAX}
        onSearch={search}
      />

      {users.status === 'loading' && <Skeleton lines={6} label="Cargando usuarios…" />}
      {users.status === 'error' && users.error && (
        <ErrorBanner error={users.error} onRetry={users.reload} />
      )}
      {users.status === 'empty' && (
        <EmptyState
          title={q ? 'No encontramos usuarios con esa búsqueda.' : 'Todavía no hay usuarios.'}
        />
      )}
      {users.status === 'success' && users.data && (
        <>
          <DataTable
            caption="Usuarios de ClickSafe"
            columns={columns}
            rows={users.data.items}
            rowKey={(user) => user.id}
          />
          <Pagination
            page={users.data.page}
            limit={users.data.limit}
            total={users.data.total}
            onChange={setPage}
          />
        </>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={
          suspending ? `¿Suspender a ${pending?.nombre ?? ''}?` : `¿Reactivar a ${pending?.nombre ?? ''}?`
        }
        confirmLabel={suspending ? 'Suspender' : 'Reactivar'}
        danger={suspending}
        loading={sending}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      >
        <p>
          {suspending
            ? 'Se cerrarán todas sus sesiones de inmediato y no podrá iniciar sesión hasta que reactives su cuenta.'
            : 'Podrá volver a iniciar sesión con su contraseña. Sus sesiones anteriores no se recuperan.'}
        </p>
        {pending && <p className={styles.dialogEmail}>{pending.correo}</p>}
      </ConfirmDialog>
    </>
  );
}
