'use client';

import { TextField, type TextFieldProps } from './TextField';
import styles from './CodeField.module.css';

interface CodeFieldProps
  extends Omit<TextFieldProps, 'value' | 'onChange' | 'type'> {
  value: string;
  onChange: (value: string) => void;
  /** Número de dígitos: 6 para TOTP, 8 para el código de recuperación. */
  length?: number;
}

/** Campo para códigos numéricos (TOTP, recuperación). Solo acepta dígitos. */
export function CodeField({
  value,
  onChange,
  length = 6,
  ...rest
}: CodeFieldProps) {
  return (
    <TextField
      autoComplete="one-time-code"
      {...rest}
      className={styles.code}
      type="text"
      inputMode="numeric"
      pattern={`[0-9]{${length}}`}
      maxLength={length}
      value={value}
      onChange={(event) =>
        onChange(event.target.value.replace(/\D/g, '').slice(0, length))
      }
    />
  );
}
