'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CodeField } from '@/components/CodeField';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TextField } from '@/components/TextField';
import { createAdmin } from '@/lib/admin-api';
import { toApiError } from '@/lib/errors';
import { isEmail } from '@/lib/password';
import panel from '../../panel.module.css';
import styles from './nuevo.module.css';

interface FieldErrors {
  nombre?: string;
  correo?: string;
  totp?: string;
}

const SUCCESS =
  'Administrador creado. Le enviamos un correo para que defina su contraseña y configure su verificación en dos pasos.';

function validate(nombre: string, correo: string, totp: string): FieldErrors {
  const errors: FieldErrors = {};
  if (nombre.length < 1 || nombre.length > 100) {
    errors.nombre = 'El nombre debe tener de 1 a 100 caracteres.';
  }
  if (!isEmail(correo)) errors.correo = 'Escribe un correo válido.';
  if (!/^\d{6}$/.test(totp)) errors.totp = 'Escribe los 6 dígitos de tu app de autenticación.';
  return errors;
}

/** W10 · Nuevo administrador. */
export default function NewAdminPage() {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  // El código TOTP del admin que crea: solo en este campo, se manda en UNA
  // petición y se borra después, salga bien o mal. Nunca se guarda en
  // sessionStorage, contexto, avisos ni logs.
  const [totp, setTotp] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validate(nombre.trim(), correo.trim(), totp);
    setFieldErrors(errors);
    setError('');
    setSuccess('');
    if (Object.keys(errors).length === 0) setConfirming(true);
  }

  async function create() {
    if (sending) return;
    setSending(true);
    setError('');
    try {
      await createAdmin({ nombre: nombre.trim(), correo: correo.trim(), totp });
      setNombre('');
      setCorreo('');
      setSuccess(SUCCESS);
    } catch (e) {
      setError(toApiError(e).userMessage);
    } finally {
      // El código ya se usó (o falló): nunca se reutiliza ni se conserva
      setTotp('');
      setConfirming(false);
      setSending(false);
    }
  }

  function cancel() {
    setConfirming(false);
  }

  return (
    <>
      <p className={styles.back}>
        <Link href="/usuarios">← Volver a usuarios</Link>
      </p>
      <header className={panel.pageHeader}>
        <h1>Nuevo administrador</h1>
      </header>

      <Card className={styles.card}>
        <div aria-live="polite">
          {success && <p className={styles.success}>{success}</p>}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>

        <form className={styles.form} onSubmit={review} noValidate>
          <TextField
            label="Nombre"
            name="nombre"
            autoComplete="off"
            maxLength={100}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            error={fieldErrors.nombre}
            required
          />
          <TextField
            label="Correo"
            name="correo"
            type="email"
            inputMode="email"
            // Es el correo de OTRA persona: que el navegador no lo autocomplete
            autoComplete="off"
            maxLength={254}
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            error={fieldErrors.correo}
            required
          />
          <CodeField
            label="Tu código de autenticación"
            name="totp"
            value={totp}
            onChange={setTotp}
            length={6}
            hint="Por seguridad, confirma tu identidad con el código actual de tu app de autenticación."
            error={fieldErrors.totp}
          />
          <div>
            <Button type="submit" disabled={sending}>
              Crear administrador
            </Button>
          </div>
        </form>
      </Card>

      <ConfirmDialog
        open={confirming}
        title="¿Crear un administrador?"
        confirmLabel="Crear administrador"
        loading={sending}
        onConfirm={create}
        onCancel={cancel}
      >
        <p>
          Se creará una cuenta de <strong>administrador</strong> para:
        </p>
        <p className={styles.summary}>
          {nombre.trim()} · {correo.trim()}
        </p>
        <p>
          Tendrá acceso completo al panel. Recibirá un correo para definir su
          contraseña y configurar su verificación en dos pasos.
        </p>
      </ConfirmDialog>
    </>
  );
}
