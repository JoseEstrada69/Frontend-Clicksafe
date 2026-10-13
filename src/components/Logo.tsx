import styles from './Logo.module.css';

interface LogoProps {
  size?: 'small' | 'large';
}

/** Círculo navy con escudo (identidad de ClickSafe). Decorativo. */
export function Logo({ size = 'small' }: LogoProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={`${styles.logo} ${styles[size]}`}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="24" cy="24" r="24" className={styles.circle} />
      <path
        d="M24 10 13 14v8.5c0 7 4.7 13.3 11 15.5 6.3-2.2 11-8.5 11-15.5V14L24 10Z"
        className={styles.shield}
      />
      <path d="m19 24 3.5 3.5L29.5 20" className={styles.check} />
    </svg>
  );
}
