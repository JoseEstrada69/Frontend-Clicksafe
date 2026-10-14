'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PasswordField } from '@/components/PasswordField';
import { TextField } from '@/components/TextField';
import { useSession } from '@/hooks/useSession';
import { changePassword, logoutAll, updateMe } from '@/lib/admin-api';
import { toApiError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { passwordProblem } from '@/lib/password';
import { endSession } from '@/lib/session';
import panel from '../panel.module.css';
import styles from './cuenta.module.css';

type Feedback = { kind: 'success' | 'error'; text: string } | null;

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  return (
    <div aria-live="polite">
      {feedback && (
        <p
          className={feedback.kind === 'success' ? styles.success : styles.error}
          role={feedback.kind === 'error' ? 'alert' : undefined}
        >
          {feedback.text}
        </p>
      )}
    </div>
  );
}

/** W13 · Mi cuenta. */
export default function AccountPage() {
  const { me, replaceMe } = useSession();

  // ---------- Nombre ----------
  const [nombre, setNombre] = useState(me.nombre);
  const [savingName, setSavingName] = useState(false);
  const [nameFeedback, setNameFeedback] = useState<Feedback>(null);

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingName) return;
    const value = nombre.trim();
    if (value.length < 1 || value.length > 100) {
      setNameFeedback({ kind: 'error', text: 'El nombre debe tener de 1 a 100 caracteres.' });
      return;
    }
    setSavingName(true);
    setNameFeedback(null);
    try {
      // Se muestra lo que confirmó el servidor, no lo que se escribió
      const updated = await updateMe({ nombre: value });
      replaceMe(updated);
      setNombre(updated.nombre);
      setNameFeedback({ kind: 'success', text: 'Nombre actualizado.' });
    } catch (e) {
      setNameFeedback({ kind: 'error', text: toApiError(e).userMessage });
    }
    setSavingName(false);
  }

  // ---------- Contraseña ----------
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingPassword) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const passwordActual = String(form.get('passwordActual') ?? '');
    const nuevaPassword = String(form.get('nuevaPassword') ?? '');
    const confirmacion = String(form.get('confirmacion') ?? '');

    const errors: Record<string, string> = {};
    if (!passwordActual) errors.passwordActual = 'Escribe tu contraseña actual.';
    const problem = passwordProblem(nuevaPassword);
    if (problem) errors.nuevaPassword = problem;
    else if (nuevaPassword !== confirmacion) {
      errors.confirmacion = 'Las contraseñas no coinciden.';
    }
    setPasswordErrors(errors);
    setPasswordFeedback(null);
    if (Object.keys(errors).length > 0) return;

    setSavingPassword(true);
    try {
      await changePassword({ passwordActual, nuevaPassword });
      formElement.reset();
      setPasswordFeedback({
        kind: 'success',
        text: 'Contraseña actualizada. Cerramos tus sesiones en otros dispositivos.',
      });
    } catch (e) {
      // INVALID_CURRENT_PASSWORD y PASSWORD_WEAK traen su mensaje en errors.ts
      setPasswordFeedback({ kind: 'error', text: toApiError(e).userMessage });
    }
    setSavingPassword(false);
  }

  // ---------- Cerrar sesión en todos los dispositivos ----------
  const [confirmAll, setConfirmAll] = useState(false);
  const [closingAll, setClosingAll] = useState(false);
  const [allFeedback, setAllFeedback] = useState<Feedback>(null);

  async function closeAllSessions() {
    setClosingAll(true);
    setAllFeedback(null);
    try {
      await logoutAll();
      // Esta sesión también quedó revocada: limpiar y al login
      endSession(null);
    } catch (e) {
      setConfirmAll(false);
      setAllFeedback({ kind: 'error', text: toApiError(e).userMessage });
      setClosingAll(false);
    }
  }

  return (
    <>
      <header className={panel.pageHeader}>
        <h1>Mi cuenta</h1>
      </header>

      <div className={styles.sections}>
        <Card title="Datos">
          <dl className={styles.details}>
            <dt>Correo</dt>
            <dd>{me.correo}</dd>
            <dt>Rol</dt>
            <dd>{me.rol === 'admin' ? 'Administrador' : 'Usuario'}</dd>
            <dt>Fecha de registro</dt>
            <dd>{formatDate(me.fechaRegistro)}</dd>
            <dt>Verificación en dos pasos</dt>
            <dd>{me.totpActivo ? 'Activa' : 'Inactiva'}</dd>
          </dl>

          <form className={styles.form} onSubmit={saveName} noValidate>
            <TextField
              label="Nombre"
              name="nombre"
              autoComplete="name"
              maxLength={100}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
            <FeedbackMessage feedback={nameFeedback} />
            <div>
              <Button type="submit" loading={savingName} loadingText="Guardando…">
                Guardar nombre
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Cambiar contraseña">
          <form className={styles.form} onSubmit={savePassword} noValidate>
            <PasswordField
              label="Contraseña actual"
              name="passwordActual"
              autoComplete="current-password"
              minLength={1}
              error={passwordErrors.passwordActual}
              required
            />
            <PasswordField
              label="Nueva contraseña"
              name="nuevaPassword"
              autoComplete="new-password"
              hint="De 8 a 128 caracteres."
              error={passwordErrors.nuevaPassword}
              required
            />
            <PasswordField
              label="Confirmar contraseña"
              name="confirmacion"
              autoComplete="new-password"
              error={passwordErrors.confirmacion}
              required
            />
            <FeedbackMessage feedback={passwordFeedback} />
            <div>
              <Button
                type="submit"
                loading={savingPassword}
                loadingText="Guardando…"
              >
                Cambiar contraseña
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Sesiones">
          <p className={styles.help}>
            Cierra tu sesión en todas las computadoras y teléfonos donde la
            hayas abierto, incluida esta.
          </p>
          <FeedbackMessage feedback={allFeedback} />
          <Button variant="danger" onClick={() => setConfirmAll(true)}>
            Cerrar sesión en todos los dispositivos
          </Button>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmAll}
        title="¿Cerrar sesión en todos los dispositivos?"
        confirmLabel="Cerrar todas las sesiones"
        danger
        loading={closingAll}
        onConfirm={closeAllSessions}
        onCancel={() => setConfirmAll(false)}
      >
        <p>
          Se cerrarán todas tus sesiones abiertas, incluida esta. Tendrás que
          iniciar sesión de nuevo con tu contraseña y tu código de verificación.
        </p>
      </ConfirmDialog>
    </>
  );
}
