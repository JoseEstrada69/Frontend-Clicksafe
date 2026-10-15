# Controles de seguridad del panel de administración

Cada control del panel, el ataque concreto que previene, el capítulo de
OWASP ASVS 5.0 al que corresponde y el archivo donde vive, organizado por la
fase en que se agregó (0 a 6).

> **Sobre los requisitos de ASVS:** solo se cita el **capítulo** de ASVS 5.0
> (V1 Encoding and Sanitization, V2 Validation and Business Logic, V3 Web
> Frontend Security, V4 API and Web Service, V6 Authentication, V7 Session
> Management, V8 Authorization, V12 Secure Communication, V13 Configuration,
> V14 Data Protection, V15 Secure Coding and Architecture, V16 Security
> Logging and Error Handling). Los números exactos de requisito (`V3.4.x`…)
> **no se verificaron** contra el documento oficial y por eso no se citan:
> se prefirió no inventar números.
>
> **Recordatorio de responsabilidades:** el panel es una aplicación de
> cliente. La **autorización real la hace la API** en cada petición
> (`RolesGuard` + 2FA); los controles del panel reducen la superficie de
> ataque del navegador del admin y evitan errores, pero no protegen datos por
> sí solos.

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

### Excepción a ESLint: `@next/next/no-img-element`

Única regla desactivada en el proyecto, **línea por línea** (cada `<img>`
lleva su propio `eslint-disable-next-line` con el motivo), con aprobación
del equipo. Lugares:

| Archivo | Imagen | Validación previa |
|---|---|---|
| `src/app/(auth)/login/configurar-2fa/page.tsx` | QR del 2FA (CLAUDE.md 7.4) | `safeQrDataUrl`: solo `data:image/png;base64,…` |
| `src/components/EvidenceGallery.tsx` (miniatura y visor) | Evidencias de reportes (CLAUDE.md 7.3) | `isSafeEvidenceUrl`: solo `/api/v1/evidences/{id}?…` de mismo origen |

- **Por qué:** el CLAUDE.md pide `<img>`. La alternativa que sugiere la
  regla, `next/image`, agrega el atributo `style="color:transparent"`, que
  nuestra CSP bloquea (`style-src` sin `'unsafe-inline'`), y habría que
  relajarla.
- **Por qué es seguro:** la regla es de rendimiento (optimizar imágenes
  remotas), no de seguridad. Todas las imágenes vienen de nuestra API, se
  validan antes de mostrarse y la CSP solo permite `img-src 'self' blob: data:`.

## Fase 3 — Dashboard y reportes

| Control | Ataque que previene | ASVS 5.0 | Archivo |
|---|---|---|---|
| **URL reportada nunca es enlace**: se muestra como texto monoespaciado | Que el admin abra por accidente un sitio de **phishing o malware** con un solo clic, o que un `href` malicioso se ejecute | V3 Web Frontend Security · V1 Encoding and Sanitization | `src/components/ReportedUrl.tsx` |
| **Dominio completo destacado**, calculado por `new URL()` | Imitaciones como `mercadolibre.com.mx.ofertas-xyz.com`: el dominio real queda a la vista | V3 Web Frontend Security | `src/lib/safe-url.ts` |
| Dominios internacionales en **punycode** (`xn--…`) + aviso | **Homógrafos**: `аmazon.com` con "а" cirílica se ve igual a `amazon.com` | V3 Web Frontend Security | `src/lib/safe-url.ts` |
| Aviso de **texto antes de "@"** | `https://mercadolibre.com.mx@estafa.com` parece Mercado Libre pero lleva a `estafa.com` | V3 Web Frontend Security | `src/lib/safe-url.ts` |
| Avisos de **IP** y de **http sin cifrar** | Sitios montados en servidores improvisados; datos que viajarían en claro | V3 Web Frontend Security | `src/lib/safe-url.ts` |
| **"Abrir con precaución"**: diálogo con advertencia, solo `http:`/`https:` (validado con `new URL()` justo antes de abrir) | Abrir `javascript:` o `data:` (que ejecutarían código con el origen del panel o mostrarían una página falsa) | V3 Web Frontend Security · V1 Encoding and Sanitization | `src/components/ReportedUrl.tsx` |
| `window.open(url, '_blank', 'noopener,noreferrer')` | **Reverse tabnabbing**: sin `noopener`, la página de estafa podría cambiar la pestaña del panel por un login falso de ClickSafe; `noreferrer` evita que sepa desde dónde se abrió | V3 Web Frontend Security | `src/lib/safe-url.ts` |
| La URL reportada **nunca** se usa en `<iframe>`, `<img>` ni `fetch` | Que el navegador del admin contacte al sitio de estafa sin que lo decida (rastreo, exploits del navegador) | V3 Web Frontend Security | `src/components/ReportedUrl.tsx` |
| **Evidencias solo de mismo origen**: `/api/v1/evidences/{id}?…`, validado con una expresión estricta (sin `//`, `..`, `%`, esquemas) | Que una URL manipulada en la respuesta cargue imágenes de un servidor del atacante (rastreo del admin) o apunte a otra ruta de la API | V3 Web Frontend Security · V1 Encoding and Sanitization | `src/lib/safe-url.ts`, `src/components/EvidenceGallery.tsx` |
| Firma vencida (15 min) → se pide el reporte otra vez, **una vez por minuto como máximo** | Bucles de peticiones si una imagen falla por otra razón | V2 Validation and Business Logic | `src/app/(panel)/reportes/[id]/page.tsx` |
| **"Quitar imagen"** con confirmación ("…datos personales") y recarga tras la confirmación del servidor | Exposición de **datos personales** en evidencias; borrados accidentales | V14 Data Protection · V2 Validation and Business Logic | `src/components/EvidenceGallery.tsx` |
| **Autor real y correo** solo en la cola y el detalle, con la marca "Anónimo para el público" | Exponer de más la identidad de quien reportó de forma anónima | V14 Data Protection | `src/app/(panel)/reportes/` |
| Revisión con **confirmación** que dice el estado final y que no se puede cambiar | Validar o rechazar por accidente | V2 Validation and Business Logic | `src/app/(panel)/reportes/[id]/page.tsx` |
| Botones ocultos si **`esMio`** (la API también lo impide con `OWN_REPORT`) | Conflicto de interés: un admin validando su propio reporte. El front solo lo comunica; **la API lo hace cumplir** | V8 Authorization | `src/app/(panel)/reportes/[id]/page.tsx` |
| `REPORT_NOT_EDITABLE` → se recarga el reporte | Decisiones sobre un estado viejo cuando otro admin ya lo revisó (condición de carrera; la API lo resuelve de forma atómica) | V2 Validation and Business Logic | `src/app/(panel)/reportes/[id]/page.tsx` |
| Comentario de revisión limitado a **500** caracteres (contrato) y recortado | Entradas enormes; el servidor valida igual | V2 Validation and Business Logic | `src/components/TextArea.tsx`, `src/lib/admin-api.ts` |
| `id` de la ruta validado como entero positivo antes de pedirlo | Peticiones con rutas manipuladas (`/reportes/../admin`) | V1 Encoding and Sanitization | `src/app/(panel)/reportes/[id]/page.tsx` |
| Filtros y página en el estado de React, **no en la URL** | Que queden en el historial o se compartan por accidente | V14 Data Protection | `src/app/(panel)/reportes/page.tsx` |
| Avisos de éxito en memoria y **borrados al cerrar sesión** | Que el siguiente admin en la misma pestaña vea un aviso de otra sesión | V7 Session Management | `src/lib/flash.ts`, `src/lib/session.ts` |
| Títulos, descripciones, nombres y URLs **siempre como texto** (React escapa); `pre-wrap` para saltos de línea | **XSS almacenado**: un reporte con `<script>` en el título o la descripción se ve como texto | V1 Encoding and Sanitization | todas las pantallas |
| Gráficas en **SVG hecho a mano** con atributos y clases (sin `style`) | Permite mantener la CSP estricta sin librerías de terceros (menos superficie de ataque y de dependencias) | V3 Web Frontend Security · V15 Secure Coding and Architecture | `src/components/BarChart.tsx` |

## Fase 4 — Moderación y usuarios

| Control | Ataque que previene | ASVS 5.0 | Archivo |
|---|---|---|---|
| Contenido de comentarios, motivos y datos de usuarios **siempre como texto** (React escapa; `pre-wrap`) | **XSS almacenado**: un comentario con `<img src=x onerror=…>` se ve como texto en el panel del admin, que es justo donde un atacante querría ejecutar código | V1 Encoding and Sanitization | `src/app/(panel)/comentarios/page.tsx` |
| **Confirmación** antes de confirmar ocultamiento, restaurar, suspender, reactivar y crear admin, diciendo qué va a pasar | Acciones sensibles por un clic accidental | V2 Validation and Business Logic | páginas de la Fase 4 |
| Después de cada acción se **vuelve a pedir** la lista (también si falla) | Mostrar un estado que el servidor no confirmó; con `COMMENT_NOT_FLAGGED` (otro admin se adelantó) se ve el estado real | V2 Validation and Business Logic | `comentarios/page.tsx`, `usuarios/page.tsx` |
| Suspender: aviso "**se cerrarán todas sus sesiones de inmediato**" | Que el admin suspenda sin entender que corta el acceso del usuario en ese momento (control de respuesta ante una cuenta comprometida) | V7 Session Management · V8 Authorization | `src/app/(panel)/usuarios/page.tsx` |
| Fila propia sin botones ("Tu cuenta"), reconocida por correo con `GET /me` | Solo comunicación: **la API** rechaza cambiar el estado propio (`OWN_STATUS`) y dejar el sistema sin admins activos (`LAST_ACTIVE_ADMIN`), aunque se manipule el panel | V8 Authorization | `src/lib/users.ts` |
| Búsqueda de usuarios (máx. 100) y página **en el estado de React**, nunca en la URL; se busca al enviar | Que nombres o correos buscados queden en el historial, en logs de proxies o se compartan en un enlace | V14 Data Protection | `src/app/(panel)/usuarios/page.tsx`, `src/components/SearchField.tsx` |
| **Reautenticación con TOTP** para crear administradores | Que alguien con una sesión de admin robada o desatendida cree un admin propio (persistencia del atacante): necesita además el segundo factor del admin | V6 Authentication · V8 Authorization | `src/app/(panel)/administradores/nuevo/page.tsx` |
| El **TOTP** vive solo en el campo, va en **una** petición y se **borra en un `finally`**, salga bien o mal; `ApiError` no conserva el body (prueba) | Que el código quede en memoria, en almacenamiento, en avisos o en logs; reutilización del código | V6 Authentication · V14 Data Protection | `nuevo/page.tsx`, `src/lib/errors.ts` |
| `POST /admin/admins` **sin refresco ni reintento** (`skipAuthRefresh`) y con renovación previa del token | Si un 401 de esta petición se tratara como sesión vencida, el panel renovaría la sesión y **reenviaría el código TOTP**: un intento extra que acerca el bloqueo de la cuenta | V6 Authentication · V7 Session Management | `src/lib/admin-api.ts`, `src/lib/api.ts` |
| TOTP incorrecto (400 `INVALID_TOTP`) → "No pudimos confirmar tu identidad…"; cuenta bloqueada o sin 2FA (401) → "No pudimos crear el administrador en este momento…" | Mensajes claros sin detalles: el 401 no dice si hay un bloqueo ni por qué, y no se confunde con "Tu sesión expiró" | V6 Authentication · V16 Security Logging and Error Handling | `src/lib/admin-api.ts`, `src/lib/errors.ts` |
| **Detalle de las denuncias** como texto plano; la API no manda quién denunció | XSS almacenado a través del texto libre de una denuncia; exponer la identidad de quien denunció | V1 Encoding and Sanitization · V14 Data Protection | `src/app/(panel)/comentarios/page.tsx` |
| Textos de confirmación según el contrato: "confirmar" **avisa al autor**, "restaurar" **no avisa a nadie**; suspender revoca sesiones, reactivar no | Que el admin tome una decisión sin saber a quién notifica o qué sesiones corta | V2 Validation and Business Logic | `comentarios/page.tsx`, `usuarios/page.tsx` |
| Correo del nuevo admin con `autoComplete="off"` | Que el navegador rellene el correo del propio admin en la cuenta nueva | V2 Validation and Business Logic | `nuevo/page.tsx` |
| Mensajes propios para `OWN_STATUS`, `LAST_ACTIVE_ADMIN`, `EMAIL_TAKEN`, `COMMENT_NOT_FLAGGED`, `INVALID_TOTP` | Nunca se muestra el `message` técnico del servidor | V16 Security Logging and Error Handling | `src/lib/errors.ts` |
| Contador de comentarios por moderar en la barra lateral | Que haya contenido dañino oculto automáticamente sin revisar | — (operación) | `src/app/(panel)/layout.tsx` |

## Fase 5 — Catálogos y bitácora

| Control | Ataque que previene | ASVS 5.0 | Archivo |
|---|---|---|---|
| **Catálogos sin borrado**: solo activar/desactivar, y no existe ninguna función de borrado en `admin-api.ts` (prueba) | Que un error o una sesión robada destruya plataformas o categorías usadas por reportes existentes (integridad del historial) | V2 Validation and Business Logic | `src/app/(panel)/catalogos/page.tsx`, `src/lib/admin-api.ts` |
| Plataforma **"Otra" bloqueada** (sin editar ni desactivar) en la interfaz; la API también rechaza desactivarla | Dejar a la app sin la opción "Otra" al crear reportes. El front solo comunica; **la API lo impone** | V8 Authorization · V2 Validation and Business Logic | `src/app/(panel)/catalogos/page.tsx` |
| Confirmación al desactivar/activar con lo que pasa ("Ya no aparecerá al crear reportes…") | Desactivar por accidente | V2 Validation and Business Logic | `src/app/(panel)/catalogos/page.tsx` |
| Nombre 1–100 y descripción ≤ 255 validados antes de enviar; tras guardar se vuelve a pedir la lista | Entradas fuera del contrato; mostrar datos que el servidor no confirmó | V2 Validation and Business Logic | `src/app/(panel)/catalogos/page.tsx` |
| Nombre duplicado (409 `CATALOG_NAME_TAKEN`) → "Ya existe un elemento con ese nombre." | Mostrar el mensaje técnico de la base de datos (por ejemplo `Duplicate entry…`), que revela detalles internos | V16 Security Logging and Error Handling | `src/lib/errors.ts` |
| Acciones de la bitácora con nombre en español (las 18 del backend) | Que el admin malinterprete un evento de seguridad (por ejemplo "Reuso de sesión detectado (posible robo)" o "Cuenta bloqueada…") | V16 Security Logging and Error Handling | `src/lib/audit.ts` |
| **Bitácora de solo lectura** (no hay acciones de escritura) | Que el panel sirva para alterar la evidencia de auditoría | V16 Security Logging and Error Handling | `src/app/(panel)/bitacora/page.tsx` |
| **Detalle de la bitácora como texto plano** (JSON en `<pre>`) | XSS almacenado a través de datos guardados en el detalle o el user-agent (un atacante controla su propio `User-Agent`) | V1 Encoding and Sanitization | `src/app/(panel)/bitacora/page.tsx`, `src/lib/audit.ts` |
| **Datos sensibles ocultos** en el detalle: claves que parezcan contraseña, token, código, TOTP, captcha, hash, firma, cookie… se muestran como `[oculto]`, también anidadas | Que un secreto registrado por error en el backend quede a la vista de cualquier admin o en una captura de pantalla | V14 Data Protection · V16 Security Logging and Error Handling | `src/lib/audit.ts` |
| Filtros (acción ≤ 60, ID de usuario numérico, fechas) en el estado de React; las fechas se convierten a ISO desde la hora de la CDMX | Que los filtros queden en el historial; parámetros fuera del contrato | V14 Data Protection · V2 Validation and Business Logic | `src/app/(panel)/bitacora/page.tsx`, `src/lib/audit.ts` |

## Fase 6 — Calidad, dependencias y CI

| Control | Ataque que previene | ASVS 5.0 | Archivo |
|---|---|---|---|
| **CI en cada push a `main` y cada PR**: `npm ci`, lint, pruebas, build y `npm audit --omit=dev --audit-level=high` | Integrar código que rompe controles probados (CSP, refresco, URLs seguras, TOTP…) o una dependencia de producción vulnerable | V15 Secure Coding and Architecture | `.github/workflows/ci.yml` |
| `npm ci` con `package-lock.json` | **Ataques a la cadena de suministro** por versiones que cambian entre instalaciones: se instala exactamente lo revisado | V15 Secure Coding and Architecture | `.github/workflows/ci.yml` |
| Workflow con `permissions: contents: read` y `persist-credentials: false` | Que un paso comprometido del CI use el token de GitHub para escribir en el repo | V15 Secure Coding and Architecture | `.github/workflows/ci.yml` |
| **Dependabot** semanal (npm y GitHub Actions) | Dependencias o acciones con vulnerabilidades conocidas sin actualizar | V15 Secure Coding and Architecture | `.github/dependabot.yml` |
| **CodeQL** (default setup del repositorio) | Patrones de código inseguros detectados por análisis estático | V15 Secure Coding and Architecture | configuración del repositorio en GitHub |
| Pruebas unitarias de lectura de datos (sección 11) y de los controles (URLs, captcha, refresco, TOTP, bitácora) | Regresiones silenciosas en controles de seguridad | V15 Secure Coding and Architecture | `tests/` |

### `braces` (Dependabot #1, GHSA-vfj7-8cjw-p6xm)

- **Qué es:** *denial of service* por agotamiento de pila con patrones de
  glob muy anidados en `braces`.
- **De dónde viene:** `eslint-config-next` → `@next/eslint-plugin-next` →
  `fast-glob` → `micromatch` → `braces`. Es **solo de desarrollo** (ESLint):
  no se incluye en el sitio (`npm audit --omit=dev` = 0 vulnerabilidades).
- **Por qué no se corrige con `overrides`:** el aviso oficial marca como
  vulnerable `braces <= 3.0.3` con **`first_patched_version: null`** (no existe
  versión corregida) y 3.0.3 es la última publicada. Un `override` solo puede
  forzar una versión existente, y `micromatch`/`fast-glob` (incluso en su
  última versión) dependen de `braces`. `npm audit fix --force` bajaría
  `eslint-config-next` a la 14, incompatible con Next 16.
- **Riesgo real:** bajo. El plugin de ESLint solo procesa patrones de la
  propia configuración del proyecto (no datos de usuarios) y nunca corre en
  producción.
- **Decisión del equipo: riesgo aceptado.** La alerta se cerró en GitHub
  como "riesgo tolerable", tras verificar en la página de la alerta que no
  hay versión corregida. No se usan *forks* de `braces` (meterían un paquete
  de terceros sin revisar: el mismo riesgo de cadena de suministro que se
  busca evitar). Dependabot la reabre si se publica un parche. El CI audita
  con `--omit=dev`, así que no falla por esto.

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

#### Aviso de `connect-src` con `data` (fases 3 y 4)

Revisiones del 14 de octubre de 2026 en Opera GX:

- **Fase 3:** apareció al abrir el detalle de un reporte con evidencias
  (`/reportes/29`) y la pestaña "Todos":
  `Resource "data", Directive connect-src, Source location …/reportes/29:0`.
- **Fase 4:** apareció en `/login/configurar-2fa` (la pantalla del QR).
  **El equipo decodificó la URL `data:` bloqueada: es un *shader*
  FidelityFX-CAS** (un filtro de nitidez de imágenes) **que inyecta el propio
  navegador Opera GX** para mejorar las imágenes de la página. Esto explica
  que aparezca en pantallas con imágenes (evidencias, QR).
- **Origen confirmado: el navegador, no el panel.** En `src/` no hay ninguna
  llamada a `fetch`, `XMLHttpRequest`, `sendBeacon`, `EventSource` ni
  `WebSocket`; la única vía de red es axios con rutas relativas `/api/v1/...`.
- **Corrección a la Fase 3:** en esa fase se atribuyó el aviso a los
  *source maps* incrustados como `data:` en los archivos de desarrollo de
  Next (`next-devtools`, el runtime de Turbopack y el del worker). Esos
  archivos existen en desarrollo y DevTools puede generar avisos parecidos al
  cargarlos, pero la causa comprobada de los avisos observados es la función
  de Opera GX descrita arriba.
- **Producción (`npm run build` + `npm start`, ventana privada sin
  extensiones): el aviso NO aparece**, y la compilación de producción no
  contiene source maps `data:` ni peticiones a `data:` (el único `.map`
  publicado lo genera Turbopack vacío, sin `sources`).
- **Decisión:** no se agrega `data:` a `connect-src`. Permitiría que un
  script inyectado "pidiera" contenido arbitrario. Que la CSP bloquee lo que
  el navegador inyecta en la página es el comportamiento esperado y no afecta
  al panel (las imágenes se ven igual, solo sin el filtro de nitidez).

> En producción el panel se sirve por HTTPS detrás de Nginx. Con
> `npm start` sobre `http://localhost`, algunos navegadores (Safari) aplican
> `upgrade-insecure-requests` también a localhost y no cargan los estilos ni
> los scripts; para probar en local sin HTTPS usa `npm run dev`.
