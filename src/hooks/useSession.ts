'use client';

import { createContext, useContext } from 'react';
import type { Me } from '@/lib/types';

export interface SessionContextValue {
  /** El administrador con sesión iniciada. */
  me: Me;
  /** Cierra la sesión en el servidor, limpia los tokens y va al login. */
  signOut: () => Promise<void>;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

/** Datos de la sesión actual. Solo funciona dentro del layout del panel. */
export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession() debe usarse dentro del layout (panel).');
  }
  return value;
}
