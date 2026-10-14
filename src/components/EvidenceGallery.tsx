'use client';

import { useEffect, useRef, useState } from 'react';
import { toApiError } from '@/lib/errors';
import { isSafeEvidenceUrl } from '@/lib/safe-url';
import type { EvidenceRef } from '@/lib/types';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import styles from './EvidenceGallery.module.css';

interface EvidenceGalleryProps {
  evidencias: EvidenceRef[];
  /** Quita la evidencia en el servidor y vuelve a pedir el reporte. */
  onRemove: (evidenceId: number) => Promise<void>;
  /**
   * Una imagen no cargó (la firma dura 15 min). Devuelve true si el padre va
   * a volver a pedir el reporte para obtener URLs nuevas; false si ya lo
   * intentó hace poco (entonces se muestra "Imagen no disponible").
   */
  onImageError: () => boolean;
}

/**
 * Evidencias del reporte (CLAUDE.md 7.3): solo se muestran rutas firmadas
 * de MISMO origen (/api/v1/evidences/…), permitidas por img-src 'self'.
 * Cualquier otra URL no se carga.
 */
export function EvidenceGallery({
  evidencias,
  onRemove,
  onImageError,
}: EvidenceGalleryProps) {
  const [failed, setFailed] = useState<ReadonlySet<number>>(new Set());
  const [viewing, setViewing] = useState<EvidenceRef | null>(null);
  const [removing, setRemoving] = useState<EvidenceRef | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const viewer = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = viewer.current;
    if (!dialog) return;
    if (viewing && !dialog.open) dialog.showModal();
    if (!viewing && dialog.open) dialog.close();
  }, [viewing]);

  function handleError(id: number) {
    if (!onImageError()) {
      setFailed((current) => new Set(current).add(id));
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    setError('');
    try {
      await onRemove(removing.id);
      setRemoving(null);
    } catch (e) {
      setError(toApiError(e).userMessage);
      setRemoving(null);
    }
    setBusy(false);
  }

  if (evidencias.length === 0) {
    return <p className={styles.empty}>Este reporte no tiene imágenes de evidencia.</p>;
  }

  const total = evidencias.length;
  const canShow = (evidence: EvidenceRef) =>
    isSafeEvidenceUrl(evidence.url) && !failed.has(evidence.id);

  return (
    <>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <ul className={styles.grid}>
        {evidencias.map((evidence, index) => {
          const alt = `Evidencia ${index + 1} de ${total}`;
          return (
            <li key={evidence.id} className={styles.item}>
              {canShow(evidence) ? (
                <button
                  type="button"
                  className={styles.thumbButton}
                  onClick={() => setViewing(evidence)}
                  aria-label={`Ampliar ${alt.toLowerCase()}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- CLAUDE.md 7.3 pide <img> de mismo origen; next/image rompe la CSP */}
                  <img
                    src={evidence.url}
                    alt={alt}
                    className={styles.thumb}
                    loading="lazy"
                    decoding="async"
                    onError={() => handleError(evidence.id)}
                  />
                </button>
              ) : (
                <div className={styles.unavailable}>Imagen no disponible</div>
              )}
              <Button variant="danger" onClick={() => setRemoving(evidence)}>
                Quitar imagen
              </Button>
            </li>
          );
        })}
      </ul>

      <dialog
        ref={viewer}
        className={styles.viewer}
        aria-label="Evidencia ampliada"
        onClose={() => setViewing(null)}
      >
        {viewing && canShow(viewing) && (
          // eslint-disable-next-line @next/next/no-img-element -- CLAUDE.md 7.3 pide <img> de mismo origen; next/image rompe la CSP
          <img
            src={viewing.url}
            alt={`Evidencia ${evidencias.indexOf(viewing) + 1} de ${total}, ampliada`}
            className={styles.full}
            onError={() => handleError(viewing.id)}
          />
        )}
        <div className={styles.viewerActions}>
          <Button variant="secondary" onClick={() => setViewing(null)}>
            Cerrar
          </Button>
        </div>
      </dialog>

      <ConfirmDialog
        open={removing !== null}
        title="¿Quitar esta imagen?"
        confirmLabel="Quitar imagen"
        danger
        loading={busy}
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
      >
        <p>
          La imagen se eliminará permanentemente. Úsalo para imágenes con datos
          personales.
        </p>
      </ConfirmDialog>
    </>
  );
}
