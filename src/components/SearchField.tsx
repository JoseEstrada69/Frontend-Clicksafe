'use client';

import { useId, useState, type FormEvent } from 'react';
import { Button } from './Button';
import styles from './SearchField.module.css';

interface SearchFieldProps {
  label: string;
  placeholder?: string;
  maxLength: number;
  /** Se llama al enviar (Enter o botón), no en cada tecla. */
  onSearch: (value: string) => void;
}

/**
 * Búsqueda que se aplica al enviar: evita una petición por tecla. El valor
 * vive en el estado de React; el padre decide qué hacer (nunca en la URL).
 */
export function SearchField({ label, placeholder, maxLength, onSearch }: SearchFieldProps) {
  const id = useId();
  const [value, setValue] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(value.trim().slice(0, maxLength));
  }

  function clear() {
    setValue('');
    onSearch('');
  }

  return (
    <form role="search" className={styles.form} onSubmit={submit}>
      <label htmlFor={id} className="visually-hidden">
        {label}
      </label>
      <input
        id={id}
        type="search"
        className={styles.input}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        onChange={(event) => setValue(event.target.value.slice(0, maxLength))}
      />
      <Button type="submit">Buscar</Button>
      {value && (
        <Button variant="secondary" onClick={clear}>
          Limpiar
        </Button>
      )}
    </form>
  );
}
