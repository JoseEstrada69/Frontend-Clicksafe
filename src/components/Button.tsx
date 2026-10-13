import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Mientras es true, el botón se deshabilita (evita dobles envíos). */
  loading?: boolean;
  /** Texto mientras carga, por ejemplo "Verificando…". */
  loadingText?: string;
}

export function Button({
  variant = 'primary',
  loading = false,
  loadingText,
  disabled,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[styles.button, styles[variant], className]
        .filter(Boolean)
        .join(' ')}
    >
      {loading && loadingText ? loadingText : children}
    </button>
  );
}
