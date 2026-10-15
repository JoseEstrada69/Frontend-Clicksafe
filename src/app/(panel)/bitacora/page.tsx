'use client';

import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/Button';
import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Pagination } from '@/components/Pagination';
import { Skeleton } from '@/components/Skeleton';
import { useApiQuery } from '@/hooks/useApiQuery';
import { getAuditLog } from '@/lib/admin-api';
import {
  AUDIT_ACTION_LABEL,
  auditActionLabel,
  auditResourceLabel,
  dateRangeToIso,
} from '@/lib/audit';
import { formatDateTime } from '@/lib/format';
import type { AuditLogEntry } from '@/lib/types';
import panel from '../panel.module.css';
import { AuditDetailDialog } from './AuditDetailDialog';
import styles from './bitacora.module.css';

const LIMIT = 25;

interface Filters {
  accion: string;
  usuario: string;
  desde: string;
  hasta: string;
}

const EMPTY_FILTERS: Filters = { accion: '', usuario: '', desde: '', hasta: '' };

/** Columnas de la tabla; "Ver" abre el detalle en un diálogo a lo ancho. */
function buildColumns(onView: (entry: AuditLogEntry) => void): Column<AuditLogEntry>[] {
  return [
  {
    key: 'fecha',
    header: 'Fecha y hora',
    width: 'nowrap',
    render: (entry) => formatDateTime(entry.fecha),
  },
  {
    key: 'accion',
    header: 'Acción',
    render: (entry) => auditActionLabel(entry.accion),
  },
  {
    key: 'resultado',
    header: 'Resultado',
    width: 'nowrap',
    render: (entry) => (
      <span className={entry.resultado === 'exito' ? styles.ok : styles.fail}>
        {entry.resultado === 'exito' ? 'Éxito' : 'Fallo'}
      </span>
    ),
  },
  {
    key: 'usuario',
    header: 'Usuario',
    width: 'primary',
    render: (entry) =>
      entry.usuario ? (
        <span>
          {entry.usuario.nombre}
          <span className={styles.secondary}> · {entry.usuario.correo}</span>
        </span>
      ) : (
        <span className={styles.secondary}>Sin usuario</span>
      ),
  },
  {
    key: 'recurso',
    header: 'Recurso',
    width: 'nowrap',
    render: (entry) => auditResourceLabel(entry.recursoTipo, entry.recursoId),
  },
  {
    key: 'ip',
    header: 'IP',
    width: 'nowrap',
    render: (entry) => <span className={styles.mono}>{entry.ip ?? '—'}</span>,
  },
  {
    key: 'detalle',
    header: 'Detalle',
    width: 'nowrap',
    render: (entry) => (
      <Button
        variant="secondary"
        onClick={() => onView(entry)}
        aria-label={`Ver detalle: ${auditActionLabel(entry.accion)}, ${formatDateTime(entry.fecha)}`}
      >
        Ver
      </Button>
    ),
  },
  ];
}

/** W12 · Bitácora de auditoría (solo lectura). */
export default function AuditLogPage() {
  const formId = useId();
  // Filtros en el estado de React, no en la URL (CLAUDE.md 7.6)
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [filterError, setFilterError] = useState('');
  const [viewing, setViewing] = useState<AuditLogEntry | null>(null);
  const columns = buildColumns(setViewing);

  const log = useApiQuery(
    (signal) => {
      const range = dateRangeToIso(applied.desde, applied.hasta);
      return getAuditLog(
        {
          page,
          limit: LIMIT,
          accion: applied.accion || undefined,
          usuario: applied.usuario ? Number(applied.usuario) : undefined,
          ...range,
        },
        signal,
      );
    },
    [page, applied],
    { isEmpty: (result) => result.items.length === 0 },
  );

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.usuario && !/^[1-9]\d{0,9}$/.test(draft.usuario)) {
      setFilterError('El usuario debe ser un número de identificación (ID) válido.');
      return;
    }
    if (draft.desde && draft.hasta && draft.desde > draft.hasta) {
      setFilterError('La fecha "desde" debe ser anterior o igual a "hasta".');
      return;
    }
    setFilterError('');
    setApplied({ ...draft, accion: draft.accion.trim() });
    setPage(1);
  }

  function clear() {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setFilterError('');
    setPage(1);
  }

  const set = (key: keyof Filters) => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <>
      <header className={panel.pageHeader}>
        <h1>Bitácora</h1>
      </header>

      <form className={styles.filters} onSubmit={apply} noValidate aria-label="Filtros de la bitácora">
        <label className={styles.field}>
          <span>Acción</span>
          <input
            list={`${formId}-acciones`}
            value={draft.accion}
            maxLength={60}
            autoComplete="off"
            // La ayuda va como texto de ejemplo: así no empuja el campo y los
            // cuatro filtros quedan a la misma altura
            placeholder="Todas (elige de la lista)"
            title="Elige una acción de la lista; puedes escribir para buscar."
            onChange={(e) => set('accion')(e.target.value)}
          />
          <datalist id={`${formId}-acciones`}>
            {Object.entries(AUDIT_ACTION_LABEL).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </datalist>
        </label>
        <label className={styles.field}>
          <span>ID de usuario</span>
          <input
            inputMode="numeric"
            value={draft.usuario}
            maxLength={10}
            autoComplete="off"
            onChange={(e) => set('usuario')(e.target.value.replace(/\D/g, ''))}
          />
        </label>
        <label className={styles.field}>
          <span>Desde</span>
          <input type="date" value={draft.desde} onChange={(e) => set('desde')(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Hasta</span>
          <input type="date" value={draft.hasta} onChange={(e) => set('hasta')(e.target.value)} />
        </label>
        <div className={styles.filterActions}>
          <Button type="submit">Filtrar</Button>
          <Button variant="secondary" onClick={clear}>
            Limpiar
          </Button>
        </div>
      </form>
      <div aria-live="polite">
        {filterError && (
          <p className={styles.error} role="alert">
            {filterError}
          </p>
        )}
      </div>

      {log.status === 'loading' && <Skeleton lines={8} label="Cargando bitácora…" />}
      {log.status === 'error' && log.error && (
        <ErrorBanner error={log.error} onRetry={log.reload} />
      )}
      {log.status === 'empty' && <EmptyState title="No hay eventos con esos filtros." />}
      {log.status === 'success' && log.data && (
        <>
          <DataTable
            caption="Eventos de la bitácora de auditoría"
            columns={columns}
            rows={log.data.items}
            rowKey={(entry) => entry.id}
          />
          <Pagination
            page={log.data.page}
            limit={log.data.limit}
            total={log.data.total}
            onChange={setPage}
          />
        </>
      )}

      <AuditDetailDialog entry={viewing} onClose={() => setViewing(null)} />
    </>
  );
}
