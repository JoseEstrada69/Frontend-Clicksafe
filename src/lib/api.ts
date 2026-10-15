import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { ApiError, MESSAGES, toApiError } from './errors';
import {
  accessTokenExpiresSoon,
  endSession,
  getAccessToken,
  getRefreshToken,
  setSession,
} from './session';
import type { Tokens } from './types';

// Ruta relativa: mismo origen que el panel. next.config.ts (rewrites) la
// reenvía al backend, así que no hace falta habilitar CORS en la API.
export const API_URL = '/api/v1';
const TIMEOUT_MS = 20_000;

// ---------- Cliente ----------
// Los componentes no lo usan directo: todo pasa por src/lib/admin-api.ts.

export const api = axios.create({
  baseURL: API_URL,
  timeout: TIMEOUT_MS,
  // Sin cookies: la sesión viaja solo en el header Authorization
  withCredentials: false,
});

// ---------- Envío: el Bearer en cada petición ----------

declare module 'axios' {
  interface AxiosRequestConfig {
    /**
     * Token explícito para esta petición en lugar del access token de la
     * sesión: el mfaToken en /auth/2fa/setup y /enable, o el token de un
     * usuario normal que se revoca de inmediato (CLAUDE.md 7.4).
     */
    authToken?: string;
    /**
     * Un 401 de esta petición NO significa "sesión vencida": no se refresca
     * el token ni se reintenta. Hoy lo usa PATCH /me/password, para que un
     * reintento nunca vuelva a enviar la contraseña actual.
     */
    skipAuthRefresh?: boolean;
  }
}

api.interceptors.request.use((config) => {
  // Se recalcula en cada intento: tras un refresco, el reintento lleva el token nuevo
  const token = config.authToken ?? getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---------- Refresco compartido ----------
// Si varias peticiones reciben 401 a la vez, todas esperan la MISMA
// renovación. Si cada una renovara por su cuenta, la segunda mandaría un
// refresh token ya rotado y el backend lo tomaría como robo (reuso) y
// revocaría toda la sesión.

let refreshing: Promise<void> | null = null;

export function refreshSession(): Promise<void> {
  refreshing ??= runRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function runRefresh(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    endSession(null);
    throw new ApiError({ status: 401 });
  }
  try {
    // axios "pelón": esta petición no pasa por los interceptores de `api`,
    // así que un 401 aquí no dispara otro refresco ni se reintenta.
    const { data } = await axios.post<Tokens>(
      `${API_URL}/auth/refresh`,
      { refreshToken },
      { timeout: TIMEOUT_MS, withCredentials: false },
    );
    setSession(data);
  } catch (e) {
    const error = toApiError(e);
    // El servidor rechazó el refresh token: la sesión terminó. Si no
    // respondió (caído) o pidió esperar (429, 5xx), la sesión se conserva y
    // solo se muestra el error.
    if (error.status === 400 || error.status === 401) {
      endSession(MESSAGES.sessionExpired);
    }
    throw error;
  }
}

/**
 * Renueva el access token ANTES de una petición que no debe reintentarse
 * (`skipAuthRefresh`), si vence en menos de 1 minuto. Si la renovación
 * falla, lanza el error y la petición no se envía.
 */
export async function ensureFreshToken(): Promise<void> {
  if (getAccessToken() && accessTokenExpiresSoon()) {
    await refreshSession();
  }
}

// ---------- Respuesta: 401 → refresco → un reintento ----------

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const original =
      error instanceof AxiosError
        ? (error.config as RetriableConfig | undefined)
        : undefined;
    const is401 = error instanceof AxiosError && error.response?.status === 401;
    const isAuthRoute = original?.url?.startsWith('/auth/') ?? false;

    if (
      !is401 ||
      !original ||
      original._retry ||
      isAuthRoute ||
      original.skipAuthRefresh
    ) {
      throw toApiError(error);
    }

    original._retry = true;
    await refreshSession();
    // Si el reintento falla, vuelve a pasar por aquí y sale como ApiError
    return api(original);
  },
);
