'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/Button';
import { CodeField } from '@/components/CodeField';
import { Logo } from '@/components/Logo';
import { PasswordField } from '@/components/PasswordField';
import { TextField } from '@/components/TextField';
import { forgotPassword, resetPassword } from '@/lib/admin-api';
import { withCaptcha } from '@/lib/captcha';
import { MESSAGES, toApiError } from '@/lib/errors';
import { isEmail, passwordProblem } from '@/lib/password';
import { setLoginNotice } from '@/lib/session';
import styles from '../auth.module.css';

type Phase = 'idle' | 'captcha' | 'sending';

const loadingText = (phase: Phase) =>
  phase === 'captcha' ? 'Verificando…' : 'Enviando…';

/**
 * W04 · Recuperar contraseña (CLAUDE.md 7.4). También la usan los admins
 * nuevos para definir su primera contraseña.
 */
export default function RecoverPage() {
  const router = useRouter();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  // El correo vive en el estado de React, nunca en la URL
  const [correo, setCorreo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const steps = {
    onSolving: () => setPhase('captcha'),
    onSending: () => setPhase('sending'),
  };

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phase !== 'idle') return;
    const value = correo.trim();
    if (!isEmail(value)) {
      setFieldErrors({ correo: 'Escribe un correo válido.' });
      return;
    }
    setFieldErrors({});
    setError('');
    try {
      await withCaptcha(
        (captcha) => forgotPassword({ correo: value, captcha }),
        steps,
      );
      // Siempre el mismo mensaje: no revela si el correo está registrado
      setInfo(MESSAGES.forgotSent);
      setStep('reset');
    } catch (e) {
      setError(toApiError(e).userMessage);
    }
    setPhase('idle');
  }

  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phase !== 'idle') return;
    const form = new FormData(event.currentTarget);
    const nuevaPassword = String(form.get('nuevaPassword') ?? '');
    const confirmacion = String(form.get('confirmacion') ?? '');

    const errors: Record<string, string> = {};
    if (codigo.length !== 8) errors.codigo = 'Escribe los 8 dígitos del código.';
    const problem = passwordProblem(nuevaPassword);
    if (problem) errors.nuevaPassword = problem;
    else if (nuevaPassword !== confirmacion) {
      errors.confirmacion = 'Las contraseñas no coinciden.';
    }
    setFieldErrors(errors);
    setError('');
    if (Object.keys(errors).length > 0) return;

    try {
      await withCaptcha(
        (captcha) =>
          resetPassword({ correo: correo.trim(), codigo, nuevaPassword, captcha }),
        steps,
      );
      setLoginNotice(MESSAGES.passwordUpdated);
      router.replace('/login');
      return;
    } catch (e) {
      setError(toApiError(e).userMessage);
    }
    setPhase('idle');
  }

  return (
    <div className={styles.panel}>
      <Logo size="large" />
      <h1>Recuperar contraseña</h1>

      <div aria-live="polite" className={styles.noticeRegion}>
        {info && !error && <p className={styles.notice}>{info}</p>}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>

      {step === 'request' ? (
        <form className={styles.form} onSubmit={requestCode} noValidate>
          <p className={styles.help}>
            Escribe tu correo y te enviaremos un código de 8 dígitos.
          </p>
          <TextField
            label="Correo"
            name="correo"
            type="email"
            autoComplete="username"
            inputMode="email"
            maxLength={254}
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            error={fieldErrors.correo}
            required
          />
          <Button
            type="submit"
            className={styles.submit}
            loading={phase !== 'idle'}
            loadingText={loadingText(phase)}
          >
            Enviar código
          </Button>
        </form>
      ) : (
        <form className={styles.form} onSubmit={reset} noValidate>
          <p className={styles.help}>
            Código enviado a <strong>{correo.trim()}</strong>.
          </p>
          <CodeField
            label="Código de 8 dígitos"
            name="codigo"
            value={codigo}
            onChange={setCodigo}
            length={8}
            error={fieldErrors.codigo}
          />
          <PasswordField
            label="Nueva contraseña"
            name="nuevaPassword"
            autoComplete="new-password"
            hint="De 8 a 128 caracteres."
            error={fieldErrors.nuevaPassword}
            required
          />
          <PasswordField
            label="Confirmar contraseña"
            name="confirmacion"
            autoComplete="new-password"
            error={fieldErrors.confirmacion}
            required
          />
          <Button
            type="submit"
            className={styles.submit}
            loading={phase !== 'idle'}
            loadingText={loadingText(phase)}
          >
            Cambiar contraseña
          </Button>
          <Button
            variant="secondary"
            className={styles.submit}
            disabled={phase !== 'idle'}
            onClick={() => {
              setStep('request');
              setInfo('');
              setError('');
              setCodigo('');
            }}
          >
            Usar otro correo
          </Button>
        </form>
      )}

      <div className={styles.links}>
        <Link href="/login">Volver a iniciar sesión</Link>
      </div>
    </div>
  );
}
