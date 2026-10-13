// Tipos de la API de ClickSafe, escritos a partir de docs/openapi.json.
//
// El OpenAPI actual describe las respuestas solo con texto (sin esquemas) y
// trae los DTOs vacíos. Aquí están únicamente los tipos cuyos campos aparecen
// en él; los nombres y tipos se confirmaron (solo lectura) en el código del
// backend. Los demás (reportes, usuarios, estadísticas, bitácora, catálogos)
// se agregan cuando el backend complete su OpenAPI. No inventar campos.

/** `RolUsuario` del backend. */
export type Rol = 'usuario' | 'admin';

/** Respuesta de `/auth/2fa/verify`, `/auth/refresh` y de `/auth/login` para usuarios normales. */
export interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** Vigencia del access token, en segundos. */
  expiresIn: number;
}

/** Respuesta de `/auth/login` para administradores. */
export interface MfaChallenge {
  mfaRequired?: true;
  mfaSetupRequired?: true;
  mfaToken: string;
}

export type LoginResponse = Tokens | MfaChallenge;

/** Respuesta de `/auth/2fa/setup`. */
export interface MfaSetup {
  otpauthUri: string;
  qrCodeDataUrl: string;
}

/** Respuesta de `GET /me`. */
export interface Me {
  nombre: string;
  correo: string;
  rol: Rol;
  /** ISO 8601 UTC. */
  fechaRegistro: string;
  totpActivo: boolean;
}

/** Cuerpo de los errores de la API. `message` es técnico: nunca se muestra. */
export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  requestId: string;
  code?: string;
}
