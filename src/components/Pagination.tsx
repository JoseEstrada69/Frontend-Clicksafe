import { Button } from './Button';
import styles from './Pagination.module.css';

interface PaginationProps {
  /** Página actual, empezando en 1. */
  page: number;
  limit: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, limit, total, onChange }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  return (
    <nav className={styles.pagination} aria-label="Paginación">
      <Button
        variant="secondary"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Anterior
      </Button>
      <span aria-live="polite">
        Página {page} de {pages}
      </span>
      <Button
        variant="secondary"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Siguiente
      </Button>
    </nav>
  );
}
