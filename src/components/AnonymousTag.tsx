import styles from './AnonymousTag.module.css';

/**
 * Marca que el autor real que ve el admin NO se muestra al público
 * (CLAUDE.md 7.6): recordatorio de que es un dato sensible.
 */
export function AnonymousTag() {
  return <span className={styles.tag}>Anónimo para el público</span>;
}
