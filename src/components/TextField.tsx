'use client';

import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './TextField.module.css';

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Texto de ayuda debajo del campo. */
  hint?: ReactNode;
  /** Mensaje de error del campo (se anuncia a lectores de pantalla). */
  error?: string;
  /** Contenido a la derecha del campo, por ejemplo el botón de mostrar. */
  trailing?: ReactNode;
}

export function TextField({
  label,
  hint,
  error,
  trailing,
  className,
  ...inputProps
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.control}>
        <input
          {...inputProps}
          id={id}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        {trailing}
      </div>
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
