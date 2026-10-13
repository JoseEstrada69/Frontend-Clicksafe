'use client';

import { useState } from 'react';
import { TextField, type TextFieldProps } from './TextField';
import styles from './PasswordField.module.css';

interface PasswordFieldProps extends Omit<TextFieldProps, 'type' | 'trailing'> {
  /** "current-password" o "new-password", para el gestor de contraseñas. */
  autoComplete: 'current-password' | 'new-password';
}

/** Contraseña de 8 a 128 caracteres, con botón mostrar/ocultar (CLAUDE.md 7.4). */
export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      minLength={8}
      maxLength={128}
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          className={styles.toggle}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? 'Ocultar' : 'Mostrar'}
          <span className="visually-hidden"> contraseña</span>
        </button>
      }
    />
  );
}
