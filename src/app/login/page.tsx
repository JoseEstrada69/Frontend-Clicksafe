'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { errorMessage, login } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    setSending(true);
    try {
      await login(String(form.get('email')), String(form.get('password')));
      router.replace('/');
    } catch (e) {
      setError(errorMessage(e));
      setSending(false);
    }
  }

  return (
    <main>
      <h1>Agenda de contactos</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Correo
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Contraseña
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={sending}>
          {sending ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
