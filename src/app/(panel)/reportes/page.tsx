'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { AnonymousTag } from '@/components/AnonymousTag';
import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { FlashMessage } from '@/components/FlashMessage';
import { Pagination } from '@/components/Pagination';
import { Skeleton } from '@/components/Skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { Tabs } from '@/components/Tabs';
import { useApiQuery } from '@/hooks/useApiQuery';
import { getAdminReports } from '@/lib/admin-api';
import { formatDate, formatNumber } from '@/lib/format';
import { platformLabel } from '@/lib/labels';
import type { AdminReport, AdminReportsFilter } from '@/lib/types';
import panel from '../panel.module.css';
import styles from './reportes.module.css';

const LIMIT = 20;

const TABS: { value: AdminReportsFilter; label: string }[] = [
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'validado', label: 'Validados' },
  { value: 'rechazado', label: 'No validados' },
  { value: 'todos', label: 'Todos' },
];

const EMPTY_TEXT: Record<AdminReportsFilter, string> = {
  pendiente: 'No hay reportes pendientes de revisión.',
  validado: 'No hay reportes validados como fraude.',
  rechazado: 'No hay reportes marcados como no validados.',
  todos: 'Todavía no hay reportes.',
};

const COLUMNS: Column<AdminReport>[] = [
  {
    key: 'titulo',
    header: 'Título',
    width: 'primary',
    render: (report) => (
      <Link href={`/reportes/${report.id}`} className={styles.title}>
        {report.titulo}
      </Link>
    ),
  },
  { key: 'plataforma', header: 'Plataforma', render: platformLabel },
  { key: 'categoria', header: 'Categoría', render: (report) => report.categoria.nombre },
  {
    key: 'autor',
    header: 'Autor',
    render: (report) => (
      <span className={styles.author}>
        {report.autor.nombre}
        {report.anonimo && <AnonymousTag />}
      </span>
    ),
  },
  {
    key: 'fecha',
    header: 'Fecha',
    width: 'nowrap',
    render: (report) => formatDate(report.fechaCreacion),
  },
  {
    key: 'likes',
    header: 'Likes',
    numeric: true,
    render: (report) => formatNumber(report.totalLikes),
  },
  {
    key: 'estado',
    header: 'Estado',
    width: 'nowrap',
    render: (report) => <StatusBadge estado={report.estado} />,
  },
];

/** W06 · Cola de reportes (del más antiguo al más nuevo: lo ordena la API). */
export default function ReportsPage() {
  const router = useRouter();
  const panelId = useId();
  // Filtros en el estado de React, no en la URL (CLAUDE.md 7.6)
  const [estado, setEstado] = useState<AdminReportsFilter>('pendiente');
  const [page, setPage] = useState(1);

  const reports = useApiQuery(
    (signal) => getAdminReports({ page, limit: LIMIT, estado }, signal),
    [page, estado],
    { isEmpty: (result) => result.items.length === 0 },
  );

  function changeTab(next: AdminReportsFilter) {
    setEstado(next);
    setPage(1);
  }

  return (
    <>
      <header className={panel.pageHeader}>
        <h1>Reportes</h1>
      </header>

      <FlashMessage />

      <Tabs
        label="Filtrar reportes por estado"
        tabs={TABS}
        value={estado}
        onChange={changeTab}
        panelId={panelId}
      />

      <div id={panelId} role="tabpanel">
        {reports.status === 'loading' && <Skeleton lines={6} label="Cargando reportes…" />}
        {reports.status === 'error' && reports.error && (
          <ErrorBanner error={reports.error} onRetry={reports.reload} />
        )}
        {reports.status === 'empty' && <EmptyState title={EMPTY_TEXT[estado]} />}
        {reports.status === 'success' && reports.data && (
          <>
            <DataTable
              caption={`Reportes: ${TABS.find((tab) => tab.value === estado)?.label ?? ''}`}
              columns={COLUMNS}
              rows={reports.data.items}
              rowKey={(report) => report.id}
              onRowClick={(report) => router.push(`/reportes/${report.id}`)}
            />
            <Pagination
              page={reports.data.page}
              limit={reports.data.limit}
              total={reports.data.total}
              onChange={setPage}
            />
          </>
        )}
      </div>
    </>
  );
}
