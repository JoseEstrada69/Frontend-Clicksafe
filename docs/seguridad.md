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
- **Producción (`npm run build` + `npm start`, ventana privada):** pendiente
  de registrar el resultado.

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
