'use client';

import { useState } from 'react';
import {
  openReportedUrl,
  parseReportedUrl,
  URL_WARNING_TEXT,
} from '@/lib/safe-url';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import styles from './ReportedUrl.module.css';

/**
 * URL reportada (CLAUDE.md 7.5): posible sitio de estafa o phishing.
 * - Nunca es un enlace: dominio destacado + URL completa como texto.
 * - "Copiar enlace" y "Abrir con precaución" (con aviso, solo http/https,
 *   noopener + noreferrer).
 * - Nunca se carga en iframe, img ni fetch.
 */
export function ReportedUrl({ url }: { url: string }) {
  const info = parseReportedUrl(url);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState<'ok' | 'error' | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied('ok');
    } catch {
      setCopied('error');
    }
  }

  function open() {
    setConfirming(false);
    // Se vuelve a validar justo antes de abrir
    if (info) openReportedUrl(info);
  }

  return (
    <div className={styles.box}>
      <p className={styles.domainLabel}>Dominio</p>
      <p className={styles.domain}>{info ? info.hostname : 'Dirección no válida'}</p>

      <p className={styles.domainLabel}>URL completa</p>
      <p className={styles.url}>{url}</p>

      {info && info.warnings.length > 0 && (
        <ul className={styles.warnings}>
          {info.warnings.map((warning) => (
            <li key={warning}>{URL_WARNING_TEXT[warning]}</li>
          ))}
        </ul>
      )}
      {!info && (
        <p className={styles.invalid}>
          No es una dirección web (http o https), así que no se puede abrir.
        </p>
      )}

      <div className={styles.actions}>
        <Button variant="secondary" onClick={copy}>
          Copiar enlace
        </Button>
        <Button
          variant="danger"
          onClick={() => setConfirming(true)}
          disabled={!info}
        >
          Abrir con precaución
        </Button>
        <span aria-live="polite" className={styles.copied}>
          {copied === 'ok' && 'Enlace copiado.'}
          {copied === 'error' && 'No se pudo copiar. Selecciona el texto y cópialo.'}
        </span>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Abrir enlace reportado"
        confirmLabel="Abrir de todos modos"
        danger
        onConfirm={open}
        onCancel={() => setConfirming(false)}
      >
        <p>
          ⚠️ Este enlace fue reportado como posible fraude. No inicies sesión,
          no descargues archivos y no ingreses datos personales ni de pago.
          Considera abrirlo en una ventana privada. ¿Abrir de todos modos?
        </p>
        {info && <p className={styles.dialogDomain}>{info.hostname}</p>}
      </ConfirmDialog>
    </div>
  );
}
