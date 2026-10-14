'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/Button';
import { CodeField } from '@/components/CodeField';
import { ErrorBanner } from '@/components/ErrorBanner';
import { Logo } from '@/components/Logo';
import { Skeleton } from '@/components/Skeleton';
import { useApiQuery } from '@/hooks/useApiQuery';
import { completeSetup, loadMfaSetup } from '@/lib/auth-flow';
import { MESSAGES, toApiError } from '@/lib/errors';
import { groupSecret, safeQrDataUrl, totpSecretFromUri } from '@/lib/mfa-setup';
import { setLoginNotice } from '@/lib/session';
import styles from '../../auth.module.css';

/** W03 · Configurar 2FA en el primer inicio de sesión (CLAUDE.md 7.4). */
export default function SetupMfaPage() {
  const router = useRouter();
  const setup = useApiQuery(() => loadMfaSetup(), []);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sin verificación pendiente (se recargó la página) o vencida: al login
  const expired = setup.error?.code === 'MFA_EXPIRED';
  useEffect(() => {
    if (!expired) return;
    setLoginNotice(MESSAGES.mfaExpired);
    router.replace('/login');
  }, [expired, router]);

  const qr = setup.data ? safeQrDataUrl(setup.data.qrCodeDataUrl) : null;
  const secret = setup.data ? totpSecretFromUri(setup.data.otpauthUri) : null;

  async function copySecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    if (codigo.length !== 6) {
      setError('Escribe los 6 dígitos de tu app de autenticación.');
      return;
    }
    setError('');
    setSending(true);
    try {
      await completeSetup(codigo);
      // El mismo código no sirve dos veces: /verificar pide uno nuevo
      router.replace('/login/verificar');
      return;
    } catch (e) {
      const apiError = toApiError(e);
      if (apiError.code === 'MFA_EXPIRED') {
        setLoginNotice(MESSAGES.mfaExpired);
        router.replace('/login');
        return;
      }
      setError(apiError.status === 401 ? MESSAGES.wrongTotp : apiError.userMessage);
      setCodigo('');
    }
    setSending(false);
  }

  return (
    <div className={styles.panel}>
      <Logo size="large" />
      <h1>Configura tu verificación en dos pasos</h1>
      <p className={styles.subtitle}>
        Escanea este código con Google Authenticator, Microsoft Authenticator
        o una app similar y escribe el código de 6 dígitos.
      </p>

      {setup.status === 'loading' || expired ? (
        <Skeleton lines={4} label="Generando tu código…" />
      ) : setup.status === 'error' && setup.error ? (
        <ErrorBanner error={setup.error} onRetry={setup.reload} />
      ) : qr && secret ? (
        <>
          {/* <img> con el data: URL validado (CLAUDE.md 7.4). next/image no se
              usa: agrega style="color:transparent", que la CSP (style-src sin
              'unsafe-inline') bloquea. Excepción aprobada por el equipo y
              documentada en docs/seguridad.md. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- CLAUDE.md 7.4 pide <img>; next/image rompe la CSP */}
          <img
            src={qr}
            alt="Código QR para configurar la verificación en dos pasos"
            className={styles.qr}
            width={200}
            height={200}
          />
          <p className={styles.help}>
            ¿No puedes escanearlo? Escribe esta clave en tu app:
          </p>
          <div className={styles.secret}>
            <code>{groupSecret(secret)}</code>
            <Button variant="secondary" onClick={copySecret}>
              {copied ? 'Copiada' : 'Copiar'}
            </Button>
          </div>

          <div aria-live="polite" className={styles.noticeRegion}>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          </div>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <CodeField
              label="Código de 6 dígitos"
              name="codigo"
              value={codigo}
              onChange={setCodigo}
              length={6}
            />
            <Button
              type="submit"
              className={styles.submit}
              loading={sending}
              loadingText="Activando…"
            >
              Activar verificación
            </Button>
          </form>
        </>
      ) : (
        <p className={styles.error} role="alert">
          {MESSAGES.unknown}
        </p>
      )}

      <div className={styles.links}>
        <Link href="/login">Volver a iniciar sesión</Link>
      </div>
    </div>
  );
}
