import { api } from './api';
import type { Me } from './types';

// Una función tipada por endpoint. Los componentes llaman a estas funciones,
// nunca a api.get/post directamente. Se completa en cada fase conforme el
// contrato (docs/openapi.json) documente los endpoints.

/** GET /me — datos del usuario autenticado. */
export async function getMe(signal?: AbortSignal): Promise<Me> {
  const { data } = await api.get<Me>('/me', { signal });
  return data;
}

/** POST /auth/logout — revoca la sesión actual en el servidor (204). */
export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}
