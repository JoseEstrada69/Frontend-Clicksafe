'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBanner } from '@/components/ErrorBanner';
import { FlashMessage } from '@/components/FlashMessage';
import { Skeleton } from '@/components/Skeleton';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useSession } from '@/hooks/useSession';
import { getFlaggedComments, moderateComment } from '@/lib/admin-api';
import { toApiError } from '@/lib/errors';
import { setFlash } from '@/lib/flash';
import { formatDateTime, formatNumber } from '@/lib/format';
import { COMMENT_STATE_LABEL, FLAG_REASON_LABEL } from '@/lib/labels';
import type { FlaggedComment, ModerateCommentBody } from '@/lib/types';
import panel from '../panel.module.css';
import styles from './comentarios.module.css';

type Action = ModerateCommentBody['accion'];

// Lo que hace cada acción según el contrato (PATCH /admin/comments/:id).
const ACTION_TEXT: Record<Action, { title: string; body: string; label: string; done: string }> = {
  confirmar: {
    title: '¿Confirmar el ocultamiento?',
    body: 'El comentario quedará oculto para todos, sus denuncias se marcarán como resueltas y se avisará a su autor.',
    label: 'Confirmar ocultamiento',
    done: 'Comentario ocultado. Se avisó a su autor.',
  },
  restaurar: {
    title: '¿Restaurar el comentario?',
    body: 'El comentario volverá a ser visible y sus denuncias se marcarán como resueltas. No se avisará a nadie.',
    label: 'Restaurar',
    done: 'Comentario restaurado.',
  },
};

/** W08 · Moderación de comentarios. */
export default function CommentsPage() {
  const { refreshCounters } = useSession();
  const comments = useApiQuery((signal) => getFlaggedComments(signal), [], {
    isEmpty: (list) => list.length === 0,
  });
  const [pending, setPending] = useState<{ comment: FlaggedComment; accion: Action } | null>(
    null,
  );
  const [sending, setSending] = useState(false);
  // El aviso de error vive en la página: al recargar, las tarjetas se desmontan
  const [error, setError] = useState('');

  async function confirm() {
    if (!pending || sending) return;
    setSending(true);
    setError('');
    try {
      await moderateComment(pending.comment.id, pending.accion);
      setFlash(ACTION_TEXT[pending.accion].done);
    } catch (e) {
      const apiError = toApiError(e);
      setError(apiError.userMessage);
    }
    // Siempre se vuelve a pedir la cola: no se edita a mano antes de que el
    // servidor confirme (y si otro admin ya lo moderó, se ve el estado real).
    setPending(null);
    setSending(false);
    refreshCounters();
    comments.reload();
  }

  const text = pending ? ACTION_TEXT[pending.accion] : null;

  return (
    <>
      <header className={panel.pageHeader}>
        <h1>Comentarios</h1>
      </header>

      <FlashMessage />
      <div aria-live="assertive">
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>

      {comments.status === 'loading' && <Skeleton lines={6} label="Cargando comentarios…" />}
      {comments.status === 'error' && comments.error && (
        <ErrorBanner error={comments.error} onRetry={comments.reload} />
      )}
      {comments.status === 'empty' && (
        <EmptyState
          title="No hay comentarios por moderar."
          description="Aquí aparecen los comentarios ocultos automáticamente o con denuncias pendientes."
        />
      )}
      {comments.status === 'success' && comments.data && (
        <ul className={styles.list}>
          {comments.data.map((comment) => (
            <li key={comment.id}>
              <CommentCard
                comment={comment}
                disabled={sending}
                onAction={(accion) => setPending({ comment, accion })}
              />
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pending !== null}
        title={text?.title ?? ''}
        confirmLabel={text?.label ?? ''}
        danger={pending?.accion === 'confirmar'}
        loading={sending}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      >
        <p>{text?.body}</p>
      </ConfirmDialog>
    </>
  );
}

interface CommentCardProps {
  comment: FlaggedComment;
  disabled: boolean;
  onAction: (accion: Action) => void;
}

function CommentCard({ comment, disabled, onAction }: CommentCardProps) {
  const denuncias = comment.totalDenuncias === 1 ? 'denuncia' : 'denuncias';

  return (
    <article className={styles.card} aria-labelledby={`comentario-${comment.id}`}>
      <header className={styles.cardHeader}>
        <h2 id={`comentario-${comment.id}`} className={styles.state}>
          {COMMENT_STATE_LABEL[comment.estado]}
        </h2>
        <span className={styles.count}>
          {formatNumber(comment.totalDenuncias)} {denuncias}
        </span>
      </header>

      {/* Texto de un usuario: siempre como texto plano (React lo escapa) */}
      <blockquote className={styles.content}>{comment.contenido}</blockquote>

      {comment.denuncias.length > 0 && (
        <section aria-label="Denuncias pendientes">
          <h3 className={styles.flagsTitle}>Denuncias pendientes</h3>
          <ul className={styles.flags}>
            {comment.denuncias.map((denuncia, index) => (
              <li key={`${denuncia.fecha}-${index}`} className={styles.flag}>
                <p className={styles.flagHead}>
                  <span className={styles.reason}>{FLAG_REASON_LABEL[denuncia.motivo]}</span>
                  <span className={styles.flagDate}>{formatDateTime(denuncia.fecha)}</span>
                </p>
                {/* Texto de quien denunció: texto plano, igual que el comentario */}
                {denuncia.detalle ? (
                  <p className={styles.flagDetail}>{denuncia.detalle}</p>
                ) : (
                  <p className={styles.flagNoDetail}>Sin detalle.</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <dl className={styles.meta}>
        <div>
          <dt>Autor</dt>
          <dd>
            {comment.autor.nombre} · <span className={styles.email}>{comment.autor.correo}</span>
          </dd>
        </div>
        <div>
          <dt>Publicado</dt>
          <dd>{formatDateTime(comment.fechaCreacion)}</dd>
        </div>
        <div>
          <dt>Reporte</dt>
          <dd>
            <Link href={`/reportes/${comment.reporteId}`}>Ver reporte #{comment.reporteId}</Link>
          </dd>
        </div>
      </dl>

      <div className={styles.actions}>
        <Button variant="danger" disabled={disabled} onClick={() => onAction('confirmar')}>
          Confirmar ocultamiento
        </Button>
        <Button variant="secondary" disabled={disabled} onClick={() => onAction('restaurar')}>
          Restaurar
        </Button>
      </div>
    </article>
  );
}
