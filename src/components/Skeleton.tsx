import styles from './Skeleton.module.css';

interface SkeletonProps {
  /** Número de renglones de relleno. */
  lines?: number;
  label?: string;
}

/** Estado "cargando": bloques grises con la forma aproximada del contenido. */
export function Skeleton({ lines = 3, label = 'Cargando…' }: SkeletonProps) {
  return (
    <div className={styles.skeleton} aria-busy="true">
      <span className="visually-hidden" role="status">
        {label}
      </span>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={styles.line} aria-hidden="true" />
      ))}
    </div>
  );
}
