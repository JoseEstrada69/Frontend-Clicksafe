# Controles de seguridad del panel de administración

Cada control del panel, el ataque concreto que previene, el capítulo de
OWASP ASVS 5.0 al que corresponde y el archivo donde vive. Se actualiza en
cada fase.

> **Pendiente (Fase 6):** aquí solo se cita el **capítulo** de ASVS 5.0. Los
> números exactos de requisito (por ejemplo `V3.4.x`) se completan en la
> Fase 6 contra el documento oficial, para no citar números de memoria.

## Fase 0 — Plantilla

| Control | Ataque que previene | ASVS 5.0 | Archivo |
|---|---|---|---|
| La API se sirve en el mismo origen con `rewrites`, sin CORS en el backend | Un CORS mal configurado (reflejar cualquier `Origin` con credenciales) deja que una página maliciosa abierta en otra pestaña haga peticiones a la API a nombre del admin y lea las respuestas | V4 API and Web Service · V3 Web Frontend Security | `next.config.ts` |
| `API_PROXY_TARGET` sin prefijo `NEXT_PUBLIC_` y validada como `http(s)` | Filtrar la dirección interna del backend en el JavaScript público; arrancar apuntando a un destino inválido | V13 Configuration | `next.config.ts` |
| `.gitignore` de `.env*`, `*.pem`, `*.key` | Commitear secretos al repositorio, donde quedan en el historial aunque se borren | V13 Configuration | `.gitignore` |
| Regla de ESLint `no-console` en error | Dejar `console.log` con tokens, códigos o respuestas visibles en la consola del navegador (computadoras compartidas, extensiones) | V14 Data Protection · V16 Security Logging and Error Handling | `eslint.config.mjs` |

## Fase 1 — Base de seguridad

| Control | Ataque que previene | ASVS 5.0 | Archivo |
|---|---|---|---|
| **CSP con nonce por petición** (`script-src 'self' 'nonce-…' 'strict-dynamic'`, sin `'unsafe-inline'`) | **XSS**: aunque un atacante logre inyectar `<script>` o un `onerror=` en la página, el navegador no lo ejecuta porque no trae el nonce de esa respuesta (que cambia en cada petición y no se puede adivinar) | V3 Web Frontend Security | `src/proxy.ts` |
| `connect-src 'self'` | Exfiltración: un script inyectado no puede mandar los datos robados (tokens, correos) a un servidor del atacante con `fetch`/XHR | V3 Web Frontend Security | `src/proxy.ts` |
| `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` | Cargar plugins (`<object>`); un `<base href>` inyectado que redirija todas las rutas relativas a otro dominio; un formulario inyectado que mande datos a otro sitio | V3 Web Frontend Security | `src/proxy.ts` |
| `frame-ancestors 'none'` + `X-Frame-Options: DENY` | **Clickjacking**: meter el panel en un iframe invisible y engañar al admin para que haga clic en "Validar" o "Suspender" | V3 Web Frontend Security | `src/proxy.ts`, `next.config.ts` |
| `upgrade-insecure-requests` (solo producción) | Que un recurso se pida por HTTP en claro y alguien en la red lo lea o lo cambie | V12 Secure Communication | `src/proxy.ts` |
| `X-Content-Type-Options: nosniff` | MIME sniffing: que el navegador ejecute como script un archivo servido como texto | V3 Web Frontend Security | `next.config.ts` |
| `Referrer-Policy: no-referrer` | Filtrar rutas internas del panel (por ejemplo `/reportes/123`) a los sitios externos que se abren desde él | V3 Web Frontend Security · V14 Data Protection | `next.config.ts` |
| `Permissions-Policy` (cámara, micrófono, ubicación, pagos desactivados) | Que un script inyectado pida acceso a la cámara o a la ubicación del admin | V3 Web Frontend Security | `next.config.ts` |
| `Cross-Origin-Opener-Policy: same-origin` | Que una ventana abierta desde el panel (o que abrió al panel) conserve una referencia a él y lo manipule | V3 Web Frontend Security | `next.config.ts` |
| `poweredByHeader: false` | Reconocimiento: no anunciar `X-Powered-By: Next.js`, que ayuda a elegir exploits por versión | V13 Configuration | `next.config.ts` |
| Páginas sin indexar (`robots: noindex, nofollow`) | Que el panel de admin aparezca en buscadores y facilite encontrarlo para atacarlo | V13 Configuration | `src/app/layout.tsx` |
| **Access token solo en memoria** | Robo del token desde `localStorage` por XSS o una dependencia comprometida; persistencia del token después de cerrar el navegador | V7 Session Management · V14 Data Protection | `src/lib/session.ts` |
| **Refresh token en `sessionStorage`** (no `localStorage`) | Que la sesión sobreviva al cierre de la pestaña en una computadora compartida y que otras pestañas la compartan | V7 Session Management | `src/lib/session.ts` |
| **Refresco compartido** (una sola llamada a `/auth/refresh` aunque fallen varias peticiones) | Que dos refrescos simultáneos manden un refresh token ya rotado: el backend lo detecta como **reuso** (posible robo) y revoca la sesión | V7 Session Management | `src/lib/api.ts` |
| Refresh rechazado → se borra la sesión y se manda al login; servidor caído → se conserva | Seguir usando una sesión que el servidor ya revocó; cerrar la sesión del admin solo porque la red falló | V7 Session Management | `src/lib/api.ts` |
| Reintento de la petición **una sola vez** y nunca en `/auth/*` | Bucles infinitos de refresco/reintento que saturan la API | V7 Session Management | `src/lib/api.ts` |
| **Mensajes de error propios**, nunca el `message` del servidor | Filtrar detalles internos (tablas, validaciones, stack traces) útiles para un atacante | V16 Security Logging and Error Handling | `src/lib/errors.ts` |
| `requestId` y `code` aceptados solo si son alfanuméricos | Que un valor manipulado en la respuesta se muestre en pantalla tal cual | V1 Encoding and Sanitization | `src/lib/errors.ts` |
| Avisos del login en memoria, no en la URL | Mensajes falsificados por enlace (`/login?mensaje=…`) para engañar al admin, y datos que quedan en el historial | V3 Web Frontend Security · V14 Data Protection | `src/lib/session.ts` |
| Guardia del layout `(panel)` (sesión + `rol === 'admin'`) | Solo **experiencia de usuario**: evita mostrar pantallas vacías. **No es un control de autorización**: la API autoriza cada petición (`RolesGuard` + 2FA) | V8 Authorization (la cumple el backend) | `src/app/(panel)/layout.tsx` |
| Usuario no admin con sesión → `POST /auth/logout` + aviso | Que un usuario normal use el panel; que su sesión quede viva después del rechazo | V8 Authorization | `src/app/(panel)/layout.tsx` |
| Botones deshabilitados durante peticiones (`Button loading`) | Dobles envíos de acciones sensibles | V2 Validation and Business Logic | `src/components/Button.tsx` |
| `ConfirmDialog` para acciones destructivas | Acciones irreversibles por un clic accidental | V2 Validation and Business Logic | `src/components/ConfirmDialog.tsx` |
| Sin `style={{}}` ni colores sueltos: CSS Modules | Permite mantener `style-src` sin `'unsafe-inline'` (un estilo inyectado también puede filtrar datos con selectores CSS) | V3 Web Frontend Security | `src/components/*.module.css` |

## Fase 2 — Autenticación

| Control | Ataque que previene | ASVS 5.0 | Archivo |
|---|---|---|---|
| **Captcha ALTCHA** (proof-of-work con SHA-256 en un Web Worker) en login, olvidé y restablecer contraseña | **Fuerza bruta / credential stuffing**: un bot que prueba miles de contraseñas tiene que gastar cómputo en cada intento, y el servidor acepta cada reto una sola vez y por 5 minutos | V6 Authentication | `src/lib/captcha*.ts` |
| Reintento del captcha **una sola vez** si el servidor responde `CAPTCHA_INVALID` | Bucles de peticiones automáticas contra el login | V6 Authentication | `src/lib/captcha.ts` |
| El solver rechaza algoritmos distintos de SHA-256 y `maxnumber` absurdos | Que un reto manipulado congele la computadora del admin | V2 Validation and Business Logic | `src/lib/captcha-solver.ts` |
| **Mismo mensaje** para contraseña incorrecta, cuenta bloqueada o suspendida ("Correo o contraseña incorrectos.") | **Enumeración de cuentas**: distinguir los casos le diría al atacante qué correos existen o cuáles bloqueó | V6 Authentication | `src/app/(auth)/login/page.tsx` |
| "¿Olvidaste tu contraseña?" responde siempre lo mismo | Enumeración de correos registrados | V6 Authentication | `src/app/(auth)/recuperar/page.tsx` |
| **`mfaToken` solo en memoria**, con vencimiento local de 5 minutos | Que el token intermedio del 2FA quede en almacenamiento del navegador o en la URL y se reutilice; al recargar la página se pierde a propósito | V6 Authentication · V7 Session Management | `src/lib/session.ts` |
| **Usuario normal → `POST /auth/logout` con su propio token** y no se guarda nada | Que un usuario sin rol de admin use el panel; que la sesión que emitió el servidor quede viva | V8 Authorization | `src/lib/auth-flow.ts` |
| `setup`/`enable` mandan el `mfaToken` como Bearer de **esa** petición (`authToken`), sin tocar la sesión | Mezclar el token del 2FA con el de sesión, o reintentar con un token viejo tras un refresco | V7 Session Management | `src/lib/api.ts`, `src/lib/admin-api.ts` |
| `/auth/2fa/setup` se pide **una sola vez** por `mfaToken` | Que una segunda llamada (React StrictMode) cambie el secreto en el servidor y el QR mostrado quede inválido | V6 Authentication | `src/lib/auth-flow.ts` |
| QR aceptado solo si es `data:image/png;base64,…`; clave manual solo si es Base32 de una URI `otpauth:` | Que un valor inesperado termine en un `src` (por ejemplo `javascript:`) o se muestre texto arbitrario | V1 Encoding and Sanitization | `src/lib/mfa-setup.ts` |
| Después de activar el 2FA se pide un **código nuevo** | El servidor no acepta dos veces el mismo código TOTP (**repetición**); el panel lo explica en lugar de fallar | V6 Authentication | `src/app/(auth)/login/verificar/page.tsx` |
| **Cierre por inactividad**: aviso a los 14 min, cierre a los 15 con `POST /auth/logout`; con el aviso visible hay que pulsar "Seguir conectado"; se revisa al volver a la pestaña | **Sesión desatendida** en una computadora compartida (laboratorio): cualquiera que se siente podría validar o rechazar reportes | V7 Session Management | `src/lib/idle.ts`, `src/hooks/useIdleLogout.ts` |
| **Cerrar sesión** revoca en el servidor, borra memoria y `sessionStorage` y desmonta el estado de React | Que la sesión siga válida en el servidor o que queden datos del admin en la página | V7 Session Management | `src/app/(panel)/layout.tsx` |
| **Cerrar sesión en todos los dispositivos** (con confirmación) | Sesiones olvidadas en otras computadoras, o una sesión robada | V7 Session Management | `src/app/(panel)/cuenta/page.tsx` |
| Contraseñas de **8 a 128** caracteres, sin reglas de símbolos; `autoComplete` correcto; botón mostrar/ocultar | Contraseñas predecibles por reglas de composición; permite usar el gestor de contraseñas (contraseñas largas y únicas) | V6 Authentication | `src/lib/password.ts`, `src/components/PasswordField.tsx` |
| Botones deshabilitados con "Verificando…" / "Enviando…" mientras hay una petición | Dobles envíos (dos captchas, dos códigos TOTP gastados) | V2 Validation and Business Logic | páginas de `(auth)` |
| Avisos ("Tu verificación expiró…", "Contraseña actualizada…") en memoria, no en la URL | Mensajes falsificados por enlace para engañar al admin | V3 Web Frontend Security | `src/lib/session.ts` |
| **Página 404 propia** con CSS Modules | La 404 por defecto de Next usa `style=""`, que la CSP bloquea; evita tener que relajar `style-src` | V3 Web Frontend Security | `src/app/not-found.tsx` |
| QR con `<img>` y **no** con `next/image` | `next/image` agrega `style="color:transparent"`, que la CSP bloquea | V3 Web Frontend Security | `src/app/(auth)/login/configurar-2fa/page.tsx` |
| `PATCH /me/password` **sin refresco ni reintento** ante 401 (`skipAuthRefresh`), como defensa | La contraseña actual incorrecta llega como 400 `INVALID_CURRENT_PASSWORD`. Si algún 401 se tratara como sesión vencida, el panel renovaría el token y **volvería a enviar la contraseña actual** (un segundo intento que el admin no hizo) | V6 Authentication · V7 Session Management | `src/lib/api.ts`, `src/lib/admin-api.ts` |
| `PATCH /me/password` **renueva el token antes de enviar** si vence en menos de 1 minuto; si la renovación falla, la contraseña no se envía | Complementa al anterior: como esa petición no se reintenta, se evita que falle solo porque el access token venció justo en ese momento, sin enviar nunca la contraseña dos veces | V7 Session Management | `src/lib/admin-api.ts`, `src/lib/session.ts` |

### Excepción a ESLint: `@next/next/no-img-element` en el QR del 2FA

Única regla desactivada en el proyecto, **solo en una línea** de
`src/app/(auth)/login/configurar-2fa/page.tsx`, con aprobación del equipo.

- **Por qué:** la sección 7.4 del CLAUDE.md pide mostrar el QR con `<img>`.
  La alternativa que sugiere la regla, `next/image`, agrega el atributo
  `style="color:transparent"`, que nuestra CSP bloquea (`style-src` sin
  `'unsafe-inline'`), y habría que relajarla.
- **Por qué es seguro:** la regla es de rendimiento (optimizar imágenes
  remotas), no de seguridad. El QR es un `data:` URL generado por nuestra API
  y se valida antes de mostrarse (`safeQrDataUrl`: solo
  `data:image/png;base64,…`).

## Cómo comprobarlo

```sh
npm run build
npm start
curl -I http://localhost:3001/login
```

Debe mostrar `content-security-policy` con un nonce distinto en cada
petición, las cabeceras de arriba y **ninguna** `X-Powered-By`. En el
navegador, la consola no debe mostrar errores de CSP.

### Avisos de CSP en desarrollo (esperados)

Revisión en el navegador (Opera GX, Chromium), 13 de octubre de 2026:

- **`npm run dev`: 34 bloqueos, todos de `style-src-elem`.** Vienen de
  `devtool-style-inject.js`, `styleTagTransform.js`, `font-styles.tsx` y
  `react-dom-client.production.js`, es decir, de las herramientas de
  desarrollo de Next (indicador y overlay de errores) y de extensiones del
  navegador que intentan insertar `<style>` sin el nonce. **No hay bloqueos
  de `script-src` ni de archivos del panel.**
- **Producción (`npm run build` + `npm start`, ventana privada en Opera GX):
  0 avisos de CSP en `/login`.** Esto confirma que los bloqueos de
  desarrollo venían de las herramientas de Next y de las extensiones, no del
  panel.

**Por qué no se relaja la CSP:** esos estilos no son parte del panel. Las
herramientas de desarrollo de Next no se incluyen en la compilación de
producción, y las extensiones se instalan en cada navegador, no vienen del
sitio. Agregar `'unsafe-inline'` a `style-src` para silenciarlos también
dejaría pasar estilos inyectados por un atacante (que pueden filtrar datos
con selectores CSS), así que el aviso se acepta en desarrollo. Que la CSP
bloquee lo que no trae nonce es justo el comportamiento esperado.

> En producción el panel se sirve por HTTPS detrás de Nginx. Con
> `npm start` sobre `http://localhost`, algunos navegadores (Safari) aplican
> `upgrade-insecure-requests` también a localhost y no cargan los estilos ni
> los scripts; para probar en local sin HTTPS usa `npm run dev`.
