'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Qué va a pasar exactamente si se confirma. */
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Acciones destructivas (rechazar, suspender, quitar…) van en rojo. */
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmación para acciones destructivas o sensibles (CLAUDE.md 7.6), con el
 * <dialog> nativo: atrapa el foco, se cierra con Esc y bloquea el fondo.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancelar',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Esc: lo decide el padre, y no se cierra con una petición en curso
        event.preventDefault();
        if (!loading) onCancel();
      }}
    >
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      <div className={styles.body}>{children}</div>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          onClick={onConfirm}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
