'use client';

import Link from 'next/link';
import { BarChart } from '@/components/BarChart';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Skeleton } from '@/components/Skeleton';
import { StatCard } from '@/components/StatCard';
import { useApiQuery } from '@/hooks/useApiQuery';
import { getAdminStats } from '@/lib/admin-api';
import type { ChartDatum } from '@/lib/chart';
import { formatMonth, formatMonthShort } from '@/lib/format';
import { REPORT_STATE_LABEL } from '@/lib/labels';
import type { AdminStats, ReportState } from '@/lib/types';
import panel from './panel.module.css';
import styles from './dashboard.module.css';

const STATE_TONE: Record<ReportState, ChartDatum['tone']> = {
  pendiente: 'pending',
  validado: 'validated',
  rechazado: 'rejected',
};

const STATES: ReportState[] = ['pendiente', 'validado', 'rechazado'];

function countFor(stats: AdminStats, estado: ReportState): number {
  return stats.porEstado.find((entry) => entry.estado === estado)?.total ?? 0;
}

/** W05 · Dashboard. */
export default function DashboardPage() {
  const stats = useApiQuery((signal) => getAdminStats(signal), []);

  return (
    <>
      <header className={panel.pageHeader}>
        <h1>Dashboard</h1>
      </header>

      {stats.status === 'loading' && <Skeleton lines={6} label="Cargando estadísticas…" />}
      {stats.status === 'error' && stats.error && (
        <ErrorBanner error={stats.error} onRetry={stats.reload} />
      )}
      {stats.status === 'success' && stats.data && <Dashboard stats={stats.data} />}
    </>
  );
}

function Dashboard({ stats }: { stats: AdminStats }) {
  const total = STATES.reduce((sum, estado) => sum + countFor(stats, estado), 0);

  return (
    <div className={styles.layout}>
      <section aria-label="Resumen" className={styles.cards}>
        <StatCard label="Total de reportes" value={total} />
        <StatCard
          label="Pendientes"
          value={countFor(stats, 'pendiente')}
          href="/reportes"
          tone="pending"
        />
        <StatCard label="Validados" value={countFor(stats, 'validado')} tone="validated" />
        <StatCard label="No validados" value={countFor(stats, 'rechazado')} tone="rejected" />
      </section>

      <nav aria-label="Accesos rápidos" className={styles.shortcuts}>
        <Link href="/reportes" className={styles.shortcut}>
          Revisar reportes pendientes
        </Link>
        <Link href="/comentarios" className={styles.shortcut}>
          Moderar comentarios
        </Link>
      </nav>

      {total === 0 ? (
        <EmptyState
          title="Todavía no hay reportes."
          description="Las gráficas aparecerán cuando los usuarios empiecen a reportar."
        />
      ) : (
        <div className={styles.charts}>
          <div className={styles.wide}>
            <BarChart
              title="Reportes por mes"
              description={`Reportes creados en los últimos ${stats.porMes.length} meses.`}
              orientation="vertical"
              labelHeader="Mes"
              data={stats.porMes.map((entry) => ({
                label: formatMonth(entry.mes),
                shortLabel: formatMonthShort(entry.mes),
                value: entry.total,
              }))}
            />
          </div>
          <BarChart
            title="Reportes por plataforma"
            description="Número de reportes en cada plataforma; las plataformas no listadas se agrupan en «Otra»."
            orientation="horizontal"
            labelHeader="Plataforma"
            data={stats.porPlataforma.map((entry) => ({
              label: entry.plataforma,
              value: entry.total,
            }))}
          />
          <BarChart
            title="Reportes por categoría"
            description="Número de reportes en cada categoría de fraude."
            orientation="horizontal"
            labelHeader="Categoría"
            data={stats.porCategoria.map((entry) => ({
              label: entry.categoria,
              value: entry.total,
            }))}
          />
          <BarChart
            title="Reportes por estado"
            description="Reportes pendientes, validados como fraude y no validados."
            orientation="horizontal"
            labelHeader="Estado"
            data={STATES.map((estado) => ({
              label: REPORT_STATE_LABEL[estado],
              value: countFor(stats, estado),
              tone: STATE_TONE[estado],
            }))}
          />
        </div>
      )}
    </div>
  );
}
