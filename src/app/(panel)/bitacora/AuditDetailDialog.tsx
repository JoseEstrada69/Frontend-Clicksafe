'use client';

import { useEffect, useId, useRef } from 'react';
import { Button } from '@/components/Button';
import { auditActionLabel, auditResourceLabel, formatAuditDetail } from '@/lib/audit';
import { formatDateTime } from '@/lib/format';
import type { AuditLogEntry } from '@/lib/types';
import styles from './bitacora.module.css';

interface AuditDetailDialogProps {
  entry: AuditLogEntry | null;
  onClose: () => void;
}

/**
 * Detalle de un evento de la bitácora en un <dialog> nativo, a lo ancho y con
 * scroll propio. Todo se muestra como texto: el detalle como JSON (con los
 * datos sensibles ocultos) y el navegador tal como lo mandó el cliente.
 */
export function AuditDetailDialog({ entry, onClose }: AuditDetailDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (entry && !dialog.open) dialog.showModal();
    if (!entry && dialog.open) dialog.close();
  }, [entry]);

  const detail = entry ? formatAuditDetail(entry.detalle) : null;

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClose={onClose}
    >
      {entry && (
        <>
          <h2 id={titleId} className={styles.dialogTitle}>
            {auditActionLabel(entry.accion)}
          </h2>
          <dl className={styles.dialogMeta}>
            <div>
              <dt>Fecha y hora</dt>
              <dd>{formatDateTime(entry.fecha)}</dd>
            </div>
            <div>
              <dt>Resultado</dt>
              <dd>{entry.resultado === 'exito' ? 'Éxito' : 'Fallo'}</dd>
            </div>
            <div>
              <dt>Usuario</dt>
              <dd>
                {entry.usuario
                  ? `${entry.usuario.nombre} · ${entry.usuario.correo}`
                  : 'Sin usuario'}
              </dd>
            </div>
            <div>
              <dt>Recurso</dt>
              <dd>{auditResourceLabel(entry.recursoTipo, entry.recursoId)}</dd>
            </div>
            <div>
              <dt>IP</dt>
              <dd className={styles.mono}>{entry.ip ?? '—'}</dd>
            </div>
            <div>
              <dt>Código de acción</dt>
              <dd className={styles.mono}>{entry.accion}</dd>
            </div>
          </dl>

          <h3 className={styles.dialogSection}>Detalle</h3>
          {detail ? (
            <pre className={styles.pre}>{detail}</pre>
          ) : (
            <p className={styles.secondary}>Sin detalle.</p>
          )}

          <h3 className={styles.dialogSection}>Navegador</h3>
          <p className={styles.agent}>{entry.userAgent ?? '—'}</p>

          <div className={styles.dialogActions}>
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </>
      )}
    </dialog>
  );
}
