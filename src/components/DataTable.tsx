'use client';

import type { ReactNode } from 'react';
import styles from './DataTable.module.css';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Columnas numéricas alineadas a la derecha (y sin partirse). */
  numeric?: boolean;
  /**
   * `primary`: la columna principal (por ejemplo el título) recibe el ancho
   * sobrante y nunca queda angosta. `nowrap`: fechas, estados, contadores.
   */
  width?: 'primary' | 'nowrap';
}

function cellClass<T>(column: Column<T>): string | undefined {
  return (
    [
      column.numeric ? styles.numeric : '',
      column.width === 'primary' ? styles.primary : '',
      column.width === 'nowrap' || column.numeric ? styles.nowrap : '',
    ]
      .filter(Boolean)
      .join(' ') || undefined
  );
}

interface DataTableProps<T> {
  /** Descripción de la tabla para lectores de pantalla. */
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  /**
   * Clic en cualquier parte de la fila (comodidad con mouse). La navegación
   * con teclado va en un enlace dentro de la fila.
   */
  onRowClick?: (row: T) => void;
}

/** Tabla semántica con scroll horizontal propio (sin scroll en la página). */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cellClass(column)}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={onRowClick ? styles.clickable : undefined}
              onClick={
                onRowClick
                  ? (event) => {
                      // Si el clic fue en un enlace o botón, que actúe él
                      if ((event.target as HTMLElement).closest('a, button')) return;
                      onRowClick(row);
                    }
                  : undefined
              }
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cellClass(column)}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
