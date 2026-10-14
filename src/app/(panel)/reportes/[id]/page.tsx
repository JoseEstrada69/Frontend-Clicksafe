'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { AnonymousTag } from '@/components/AnonymousTag';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorBanner } from '@/components/ErrorBanner';
import { EvidenceGallery } from '@/components/EvidenceGallery';
import { ReportedUrl } from '@/components/ReportedUrl';
import { Skeleton } from '@/components/Skeleton';
import { StatusBadge } from '@/components/StatusBadge';
import { TextArea } from '@/components/TextArea';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useSession } from '@/hooks/useSession';
import { deleteEvidence, getAdminReport } from '@/lib/admin-api';
import { ApiError } from '@/lib/errors';
import { setFlash } from '@/lib/flash';
import { formatDateTime, formatNumber } from '@/lib/format';
import { platformLabel, REPORT_STATE_LABEL } from '@/lib/labels';
import { submitReview } from '@/lib/review';
import type { AdminReportDetail, ReviewDecision } from '@/lib/types';
import panel from '../../panel.module.css';
import styles from './detalle.module.css';

const COMMENT_MAX = 500; // ReviewReportDto.comentario (docs/openapi.json)
// Tras una recarga por firma vencida, no volver a recargar antes de 1 min
const IMAGE_RELOAD_COOLDOWN_MS = 60_000;

/** El id de la ruta solo se usa si es un entero positivo. */
function parseId(value: string | string[] | undefined): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/.test(value)) return null;
  return Number(value);
}

/** W07 · Detalle y revisión de un reporte. */
export default function ReportDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseId(params.id);

  const report = useApiQuery(
    (signal) =>
      id === null
        ? Promise.reject(new ApiError({ status: 404 }))
        : getAdminReport(id, signal),
    [id],
  );

  // Las URLs de las evidencias están firmadas por 15 min: si una imagen falla,
  // se pide el reporte otra vez para obtener URLs nuevas, una vez por minuto
  // como máximo (sin bucles si la imagen falla por otra razón).
  const lastImageReload = useRef(0);
  function onImageError(): boolean {
    const now = Date.now();
    if (now - lastImageReload.current < IMAGE_RELOAD_COOLDOWN_MS) return false;
    lastImageReload.current = now;
    report.reload();
    return true;
  }

  // Aviso cuando otro admin se adelantó en la revisión. Vive AQUÍ, fuera del
  // detalle: al recargar, el detalle se desmonta y un aviso guardado dentro
  // se perdería. Va ligado al id para no aparecer en otro reporte.
  const [staleNotice, setStaleNotice] = useState<{ id: number; message: string } | null>(
    null,
  );
  function onStale(message: string) {
    if (id === null) return;
    setStaleNotice({ id, message });
    report.reload();
  }

  return (
    <>
      <p className={styles.back}>
        <Link href="/reportes">← Volver a reportes</Link>
      </p>
      <div aria-live="assertive">
        {staleNotice && staleNotice.id === id && (
          <div className={styles.staleNotice} role="alert">
            <p>{staleNotice.message}</p>
            <button
              type="button"
              className={styles.dismiss}
              onClick={() => setStaleNotice(null)}
              aria-label="Cerrar aviso"
            >
              ×
            </button>
          </div>
        )}
      </div>
      {report.status === 'loading' && <Skeleton lines={8} label="Cargando reporte…" />}
      {report.status === 'error' && report.error && (
        <ErrorBanner
          error={report.error}
          onRetry={report.error.status === 404 ? undefined : report.reload}
        />
      )}
      {report.status === 'success' && report.data && (
        <ReportDetail
          report={report.data}
          onChanged={report.reload}
          onStale={onStale}
          onImageError={onImageError}
        />
      )}
    </>
  );
}

interface ReportDetailProps {
  report: AdminReportDetail;
  onChanged: () => void;
  /** Otro admin ya lo revisó: mostrar el aviso y recargar. */
  onStale: (message: string) => void;
  onImageError: () => boolean;
}

function ReportDetail({ report, onChanged, onStale, onImageError }: ReportDetailProps) {
  async function removeEvidence(evidenceId: number) {
    await deleteEvidence(report.id, evidenceId);
    // Volver a pedir: no se edita la lista antes de que el servidor confirme
    onChanged();
  }

  return (
    <article className={styles.layout}>
      <header className={`${panel.pageHeader} ${styles.header}`}>
        <h1 className={styles.title}>{report.titulo}</h1>
        <StatusBadge estado={report.estado} />
      </header>

      <dl className={styles.meta}>
        <div>
          <dt>Plataforma</dt>
          <dd>{platformLabel(report)}</dd>
        </div>
        <div>
          <dt>Categoría</dt>
          <dd>{report.categoria.nombre}</dd>
        </div>
        <div>
          <dt>Creado</dt>
          <dd>{formatDateTime(report.fechaCreacion)}</dd>
        </div>
        <div>
          <dt>Actualizado</dt>
          <dd>{formatDateTime(report.fechaActualizacion)}</dd>
        </div>
        <div>
          <dt>Likes</dt>
          <dd>{formatNumber(report.totalLikes)}</dd>
        </div>
        <div>
          <dt>Comentarios</dt>
          <dd>{formatNumber(report.totalComentarios)}</dd>
        </div>
      </dl>

      <Card title="Autor">
        {/* Dato sensible (CLAUDE.md 7.6): solo aquí y en la cola */}
        <p className={styles.author}>
          <span className={styles.authorName}>{report.autor.nombre}</span>
          {report.anonimo && <AnonymousTag />}
        </p>
        <p className={styles.email}>{report.autor.correo}</p>
      </Card>

      <Card title="Descripción">
        <p className={styles.description}>{report.descripcion}</p>
      </Card>

      <Card title="Publicación reportada">
        <ReportedUrl url={report.urlPublicacion} />
      </Card>

      <Card title="Evidencias">
        <EvidenceGallery
          evidencias={report.evidencias}
          onRemove={removeEvidence}
          onImageError={onImageError}
        />
      </Card>

      {report.revision ? (
        <Card title="Revisión">
          <dl className={styles.meta}>
            <div>
              <dt>Decisión</dt>
              <dd>{REPORT_STATE_LABEL[report.revision.decision]}</dd>
            </div>
            <div>
              <dt>Fecha</dt>
              <dd>{formatDateTime(report.revision.fecha)}</dd>
            </div>
          </dl>
          <p className={styles.description}>
            {report.revision.comentario ?? 'Sin comentario.'}
          </p>
        </Card>
      ) : report.estado === 'pendiente' ? (
        report.esMio ? (
          <Card title="Revisión">
            <p className={styles.notice}>No puedes revisar un reporte que tú creaste.</p>
          </Card>
        ) : (
          <ReviewPanel reportId={report.id} onStale={onStale} />
        )
      ) : null}
    </article>
  );
}

const CONFIRM_TEXT: Record<ReviewDecision, { title: string; body: string; label: string }> = {
  validado: {
    title: '¿Validar como fraude?',
    body: 'El reporte quedará como «Fraude validado» y se avisará a su autor. Esta decisión no se puede cambiar.',
    label: 'Validar fraude',
  },
  rechazado: {
    title: '¿Rechazar el reporte?',
    body: 'El reporte quedará como «No validado» y se avisará a su autor. Esta decisión no se puede cambiar.',
    label: 'Rechazar',
  },
};

function ReviewPanel({
  reportId,
  onStale,
}: {
  reportId: number;
  onStale: (message: string) => void;
}) {
  const router = useRouter();
  const { refreshCounters } = useSession();
  const [comentario, setComentario] = useState('');
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    if (!decision || sending) return;
    setSending(true);
    setError('');
    const result = await submitReview(reportId, decision, comentario);
    if (result.ok) {
      setFlash(
        decision === 'validado'
          ? 'Reporte validado como fraude.'
          : 'Reporte marcado como no validado.',
      );
      refreshCounters();
      router.push('/reportes');
      return;
    }
    setDecision(null);
    if (result.stale) {
      // Otro admin se adelantó: el aviso lo muestra la página (este panel se
      // desmonta al recargar) y el detalle pasa a mostrar el estado real.
      refreshCounters();
      onStale(result.message);
      return;
    }
    setError(result.message);
    setSending(false);
  }

  const text = decision ? CONFIRM_TEXT[decision] : null;

  return (
    <Card title="Revisión">
      <div className={styles.review}>
        <TextArea
          label="Comentario (opcional)"
          hint="El autor del reporte lo verá junto con la decisión."
          value={comentario}
          onChange={setComentario}
          maxLength={COMMENT_MAX}
          disabled={sending}
        />
        <div aria-live="polite">
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>
        <div className={styles.actions}>
          <Button variant="danger" onClick={() => setDecision('validado')} disabled={sending}>
            Validar fraude
          </Button>
          <Button variant="secondary" onClick={() => setDecision('rechazado')} disabled={sending}>
            Rechazar
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={decision !== null}
        title={text?.title ?? ''}
        confirmLabel={text?.label ?? ''}
        danger={decision === 'validado'}
        loading={sending}
        onConfirm={confirm}
        onCancel={() => setDecision(null)}
      >
        <p>{text?.body}</p>
      </ConfirmDialog>
    </Card>
  );
}
