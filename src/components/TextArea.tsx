'use client';

import { useId } from 'react';
import styles from './TextArea.module.css';

interface TextAreaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  hint?: string;
  disabled?: boolean;
  rows?: number;
}

/** Área de texto con contador de caracteres ("120 / 500"). */
export function TextArea({
  label,
  value,
  onChange,
  maxLength,
  hint,
  disabled,
  rows = 4,
}: TextAreaProps) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <textarea
        id={id}
        className={styles.textarea}
        value={value}
        maxLength={maxLength}
        rows={rows}
        disabled={disabled}
        aria-describedby={`${id}-count`}
        onChange={(event) => onChange(event.target.value.slice(0, maxLength))}
      />
      <div className={styles.footer}>
        <span>{hint}</span>
        <span id={`${id}-count`}>
          {value.length} / {maxLength}
          <span className="visually-hidden"> caracteres</span>
        </span>
      </div>
    </div>
  );
}
