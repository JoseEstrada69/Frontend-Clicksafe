import { EmptyState } from '@/components/EmptyState';
import styles from './panel.module.css';

// PROVISIONAL (Fase 1): el dashboard real (W05) llega en la Fase 3, cuando el
// OpenAPI del backend documente la respuesta de GET /admin/stats.
export default function DashboardPage() {
  return (
    <>
      <header className={styles.pageHeader}>
        <h1>Dashboard</h1>
      </header>
      <EmptyState
        title="Las estadísticas aparecerán aquí."
        description="Esta sección se construye en una fase posterior."
      />
    </>
  );
}
