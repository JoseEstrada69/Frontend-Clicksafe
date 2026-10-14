'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from 'react';
import { Button } from '@/components/Button';
import { CodeField } from '@/components/CodeField';
import { Logo } from '@/components/Logo';
import { completeVerify } from '@/lib/auth-flow';
import { MESSAGES, toApiError } from '@/lib/errors';
import {
  getPendingMfa,
  setLoginNotice,
  subscribePendingMfa,
} from '@/lib/session';
import styles from '../../auth.module.css';

/** W02 · Verificar código TOTP (CLAUDE.md 7.4). */
export default function VerifyPage() {
  const router = useRouter();
  // El mfaToken vive solo en memoria: si se recarga la página no existe y
  // hay que volver a iniciar sesión.
  const pending = useSyncExternalStore(
    subscribePendingMfa,
    getPendingMfa,
    () => null,
  );
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!pending && !sending) router.replace('/login');
  }, [pending, sending, router]);

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
      await completeVerify(codigo);
      router.replace('/');
      return;
    } catch (e) {
      const apiError = toApiError(e);
      if (apiError.code === 'MFA_EXPIRED') {
        setLoginNotice(MESSAGES.mfaExpired);
        router.replace('/login');
        return;
      }
      // Código incorrecto, ya usado o cuenta bloqueada: el servidor responde
      // igual (401) para no dar pistas.
      setError(apiError.status === 401 ? MESSAGES.wrongTotp : apiError.userMessage);
      setCodigo('');
    }
    setSending(false);
  }

  return (
    <div className={styles.panel}>
      <Logo size="large" />
      <h1>Verificación en dos pasos</h1>
      <p className={styles.subtitle}>
        Escribe el código de 6 dígitos que muestra tu app de autenticación.
      </p>

      <div aria-live="polite" className={styles.noticeRegion}>
        {pending?.afterSetup && !error && (
          <p className={styles.notice}>{MESSAGES.waitNewCode}</p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <CodeField
          label="Código de verificación"
          name="codigo"
          value={codigo}
          onChange={setCodigo}
          length={6}
          autoFocus
        />
        <Button
          type="submit"
          className={styles.submit}
          loading={sending}
          loadingText="Verificando…"
        >
          Verificar
        </Button>
      </form>

      <div className={styles.links}>
        <Link href="/login">Volver a iniciar sesión</Link>
      </div>
    </div>
  );
}
