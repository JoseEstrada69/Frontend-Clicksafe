import styles from './UserStatusBadge.module.css';

/** "Activo" / "Suspendido". */
export function UserStatusBadge({ activo }: { activo: boolean }) {
  return (
    <span className={`${styles.badge} ${activo ? styles.active : styles.suspended}`}>
      {activo ? 'Activo' : 'Suspendido'}
    </span>
  );
}
