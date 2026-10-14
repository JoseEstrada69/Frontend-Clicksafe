'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { PasswordField } from '@/components/PasswordField';
import { TextField } from '@/components/TextField';
import { startLogin } from '@/lib/auth-flow';
import { withCaptcha } from '@/lib/captcha';
import { MESSAGES, toApiError, type ApiError } from '@/lib/errors';
import { isEmail } from '@/lib/password';
import { getLoginNotice, subscribeLoginNotice } from '@/lib/session';
import styles from '../auth.module.css';

type Phase = 'idle' | 'captcha' | 'sending';

interface FieldErrors {
  correo?: string;
  password?: string;
}

// 401 y 403 dan SIEMPRE el mismo mensaje: el servidor tampoco distingue
// contraseña incorrecta, cuenta bloqueada o suspendida, para no darle pistas
// a quien intenta adivinar cuentas.
function loginErrorMessage(error: ApiError): string {
  if (error.status === 401 || error.status === 403) {
    return MESSAGES.wrongCredentials;
  }
  return error.userMessage;
}

function validate(correo: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!correo) errors.correo = 'Escribe tu correo.';
  else if (!isEmail(correo)) errors.correo = 'Escribe un correo válido.';
  if (!password) errors.password = 'Escribe tu contraseña.';
  else if (password.length > 128) {
    errors.password = 'La contraseña no puede tener más de 128 caracteres.';
  }
  return errors;
}

/** W01 · Iniciar sesión (CLAUDE.md 7.4). */
export default function LoginPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Avisos como "Tu sesión expiró…": viven en memoria del navegador. En el
  // servidor no existen (tercer argumento) y así no hay diferencias al hidratar.
  const notice = useSyncExternalStore(
    subscribeLoginNotice,
    getLoginNotice,
    () => null,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phase !== 'idle') return;

    const form = new FormData(event.currentTarget);
    const correo = String(form.get('correo') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const errors = validate(correo, password);
    setFieldErrors(errors);
    setError('');
    if (errors.correo || errors.password) return;

    try {
      const outcome = await withCaptcha(
        (captcha) => startLogin(correo, password, captcha),
        {
          onSolving: () => setPhase('captcha'),
          onSending: () => setPhase('sending'),
        },
      );
      if (outcome === 'verify') {
        router.push('/login/verificar');
        return;
      }
      if (outcome === 'setup') {
        router.push('/login/configurar-2fa');
        return;
      }
      setError(MESSAGES.adminOnly);
    } catch (e) {
      setError(loginErrorMessage(toApiError(e)));
    }
    setPhase('idle');
  }

  return (
    <div className={styles.panel}>
      <Logo size="large" />
      <h1>ClickSafe</h1>
      <p className={styles.subtitle}>Panel de administración</p>

      <div aria-live="polite" className={styles.noticeRegion}>
        {notice && !error && <p className={styles.notice}>{notice}</p>}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextField
          label="Correo"
          name="correo"
          type="email"
          autoComplete="username"
          inputMode="email"
          maxLength={254}
          error={fieldErrors.correo}
          required
        />
        <PasswordField
          label="Contraseña"
          name="password"
          autoComplete="current-password"
          // Para iniciar sesión no se exige el mínimo: lo decide el servidor
          minLength={1}
          error={fieldErrors.password}
          required
        />
        <Button
          type="submit"
          className={styles.submit}
          loading={phase !== 'idle'}
          loadingText={phase === 'captcha' ? 'Verificando…' : 'Iniciando sesión…'}
        >
          Iniciar sesión
        </Button>
      </form>

      <div className={styles.links}>
        <Link href="/recuperar">¿Olvidaste tu contraseña?</Link>
      </div>
    </div>
  );
}
