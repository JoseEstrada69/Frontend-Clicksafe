import { REPORT_STATE_LABEL } from '@/lib/labels';
import type { ReportState } from '@/lib/types';
import styles from './StatusBadge.module.css';

// Íconos decorativos (el texto ya dice el estado): reloj, alerta y círculo
// tachado, en línea con la app iOS.
const ICONS: Record<ReportState, string> = {
  pendiente: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  validado: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  rechazado: 'M5.6 5.6l12.8 12.8M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
};

/** "Pendiente de revisión" · "Fraude validado" (rojo: fraude confirmado) · "No validado". */
export function StatusBadge({ estado }: { estado: ReportState }) {
  return (
    <span className={`${styles.badge} ${styles[estado]}`}>
      <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true" focusable="false">
        <path d={ICONS[estado]} />
      </svg>
      {REPORT_STATE_LABEL[estado]}
    </span>
  );
}
