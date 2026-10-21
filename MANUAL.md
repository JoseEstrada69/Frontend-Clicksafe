# Manual técnico — Panel web de administración de ClickSafe

Documentación de referencia del panel de administración: qué es, cómo está
construido, su modelo de seguridad y sus pantallas. Para instalarlo y
levantarlo, ver el [`README.md`](./README.md); para el detalle de cada
control de seguridad frente al ataque que previene, ver
[`docs/seguridad.md`](./docs/seguridad.md).

---

## 1. Qué es ClickSafe y qué hace este panel

ClickSafe es una red social para **reportar publicaciones sospechosas de
fraude en tiendas en línea** (lema: *"Consulta antes de comprar"*). Socio
formador: Red por la Ciberseguridad (ONG mexicana). El proyecto se desarrolló
con el requisito de **OWASP ASVS nivel 2** y se sometió a pruebas de
penetración (OWASP ZAP) y análisis de código estático.

El sistema tiene tres piezas:

- **API REST (NestJS + MySQL):** repositorio aparte. El panel solo se
  comunica con ella; su contrato está en [`docs/openapi.json`](./docs/openapi.json).
- **App iOS (SwiftUI):** repositorio aparte, para usuarios normales.
- **Este repositorio — panel web de administración:** solo para el rol
  `admin`. Contiene todas las pantallas de administrador.

La verificación en dos pasos (TOTP) es obligatoria para todos los
administradores; un usuario normal no puede usar el panel.

### Funciones del administrador

1. **Dashboard:** estadísticas de reportes por plataforma (las "Otra"
   agrupadas), por categoría, por estado y por mes.
2. **Revisar reportes:** cola de reportes pendientes; ver detalle, evidencias
   y el autor real aunque el reporte sea anónimo; validar o rechazar con un
   comentario opcional. Un administrador no puede revisar un reporte propio.
   Puede quitar evidencias que contengan datos personales.
3. **Moderar comentarios:** cola de comentarios ocultos automáticamente o con
   denuncias sin resolver; confirmar el ocultamiento o restaurar.
4. **Usuarios:** buscar por nombre o correo, suspender o reactivar. No a sí
   mismo, y el sistema nunca se queda sin administradores activos.
5. **Crear administradores:** con reautenticación por código TOTP del
   administrador que crea. El nuevo admin recibe por correo un código para
   definir su contraseña y configura su 2FA en el primer inicio de sesión.
6. **Catálogos** (plataformas y categorías de fraude): alta, edición y
   activar/desactivar. No se borran.
7. **Bitácora de auditoría:** consulta paginada con filtros, solo lectura.
8. **Mi cuenta:** ver datos, cambiar nombre y contraseña, cerrar sesión y
   cerrar sesión en todos los dispositivos.

---

## 2. Stack

| Tema | Decisión |
|---|---|
| Framework | Next.js 16.x (App Router), React 19 |
| Lenguaje | TypeScript `strict` (sin `any`) |
| HTTP | `axios`, un solo cliente en `src/lib/api.ts` |
| Estilos | CSS plano: `globals.css` con tokens + CSS Modules (`*.module.css`). Sin Tailwind ni librerías de componentes |
| Gráficas | SVG hecho a mano (`BarChart`). Sin librerías de gráficas |
| Captcha | ALTCHA resuelto con Web Crypto (`crypto.subtle.digest`) en un Web Worker |
| Fechas | `Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City' })` |
| Lint | ESLint 9 con `eslint-config-next` |
| Pruebas | Vitest |
| Gestor | npm (se versiona `package-lock.json`) |
| Node | LTS (mínimo 22) |

### Renderizado

El panel es una **aplicación de cliente**: las páginas son componentes
`'use client'` que piden datos a la API con el token del administrador. No se
usan Server Actions, Route Handlers ni `fetch` desde el servidor de Next
hacia la API (el token vive en el navegador). El servidor de Next solo sirve
el HTML/JS, aplica la CSP (`src/proxy.ts`) y reenvía `/api/v1` al backend
(`rewrites`).

---

## 3. Estructura del proyecto

```
clicksafe-admin-web/
├── MANUAL.md                 ← este documento
├── README.md                 ← cómo instalarlo y levantarlo
├── .env.example
├── next.config.ts            ← rewrites, cabeceras de seguridad, poweredByHeader: false
├── docs/
│   ├── openapi.json          ← copia del contrato exportado por el backend
│   └── seguridad.md          ← control → ataque que previene → requisito ASVS → archivo
├── src/
│   ├── proxy.ts              ← CSP con nonce por petición
│   ├── app/
│   │   ├── layout.tsx        ← <html lang="es-MX">, lee el nonce
│   │   ├── globals.css       ← tokens de diseño
│   │   ├── (auth)/           ← pantallas sin barra lateral
│   │   │   ├── login/page.tsx
│   │   │   ├── login/verificar/page.tsx      ← código TOTP
│   │   │   ├── login/configurar-2fa/page.tsx ← QR + primer código
│   │   │   └── recuperar/page.tsx            ← olvidé / restablecer contraseña
│   │   └── (panel)/          ← protegido: guardia de sesión + barra lateral
│   │       ├── layout.tsx
│   │       ├── page.tsx                      ← Dashboard
│   │       ├── reportes/page.tsx             ← cola de revisión
│   │       ├── reportes/[id]/page.tsx        ← detalle + revisar
│   │       ├── comentarios/page.tsx          ← moderación
│   │       ├── usuarios/page.tsx
│   │       ├── administradores/nuevo/page.tsx
│   │       ├── catalogos/page.tsx            ← pestañas Plataformas / Categorías
│   │       ├── bitacora/page.tsx
│   │       └── cuenta/page.tsx
│   ├── lib/
│   │   ├── api.ts            ← cliente axios + interceptores
│   │   ├── session.ts        ← tokens
│   │   ├── errors.ts         ← ApiError + mensajes en español
│   │   ├── captcha.ts  captcha-solver.ts  captcha.worker.ts
│   │   ├── admin-api.ts      ← una función tipada por endpoint
│   │   ├── auth-flow.ts      ← login, verificación y configuración del 2FA
│   │   ├── types.ts          ← tipos de la API
│   │   ├── safe-url.ts       ← validación/visualización de URLs reportadas
│   │   ├── idle.ts           ← cierre por inactividad
│   │   ├── audit.ts          ← bitácora (acciones, fechas, datos sensibles)
│   │   └── format.ts         ← fechas, números
│   ├── components/           ← Button, TextField, Card, StatusBadge, DataTable,
│   │                           Pagination, ConfirmDialog, EmptyState, ErrorBanner,
│   │                           Sidebar, BarChart, ReportedUrl, EvidenceGallery…
│   └── hooks/                ← useApiQuery, useSession, useIdleLogout
└── tests/                    ← Vitest
```

---

## 4. Conexión con la API (mismo origen)

El backend tiene **CORS deshabilitado** a propósito. En producción el panel y
la API se sirven en el mismo origen detrás de Nginx (`https://<dominio>/` →
Next, `https://<dominio>/api/` → NestJS). Para que desarrollo se parezca a
producción:

- El cliente axios usa `baseURL: '/api/v1'` (ruta relativa, mismo origen).
- `next.config.ts` reenvía esas rutas al backend con `rewrites`, hacia
  `API_PROXY_TARGET`.
- `API_PROXY_TARGET` es una variable **sin** prefijo `NEXT_PUBLIC_`: solo la
  lee el servidor de Next y nunca llega al navegador. Se valida al arrancar
  que sea una URL `http(s)`.

Así no hace falta habilitar CORS en el backend (una configuración de CORS mal
hecha es una vulnerabilidad clásica) y las imágenes de evidencia
(`/api/v1/evidences/...`) se cargan como mismo origen.

---

## 5. Contrato con la API

La fuente de verdad es [`docs/openapi.json`](./docs/openapi.json) (copia del
que exporta el backend). Los tipos de `src/lib/types.ts` se derivan de él.

- JSON en camelCase. Fechas ISO 8601 UTC, mostradas en hora de la Ciudad de
  México.
- Listados: `{ items, page, limit, total }` → tipo `Page<T>`, con `limit` ≤ 50.
- Errores: `{ statusCode, error, message, requestId, code? }`.
- Autenticación: `Authorization: Bearer <accessToken>`.

Cada endpoint tiene una función tipada en `src/lib/admin-api.ts`; los
componentes nunca llaman a `api.get/post` directamente. Endpoints principales:
captcha y autenticación (`/auth/*`), perfil (`/me`), dashboard
(`/admin/stats`), reportes (`/admin/reports`, `/admin/reports/:id`, revisión y
evidencias), moderación (`/admin/comments/*`), usuarios (`/admin/users`,
`/admin/admins`), catálogos (`/admin/platforms`, `/admin/categories`) y
bitácora (`/admin/audit-log`).

---

## 6. Modelo de seguridad (OWASP ASVS nivel 2)

El panel es una aplicación de cliente: la **autorización real la hace la API**
en cada petición (`RolesGuard` + 2FA). Los controles del panel reducen la
superficie de ataque del navegador del administrador y evitan errores, pero
no protegen datos por sí solos. El detalle control → ataque → requisito ASVS
está en [`docs/seguridad.md`](./docs/seguridad.md).

### 6.1 Tokens y sesión

- **Access token solo en memoria** (una variable del módulo `session.ts`).
  Nunca en `localStorage`, cookies escritas desde JS ni en la URL.
- **Refresh token en `sessionStorage`** (no `localStorage`): se borra al
  cerrar la pestaña y no se comparte con otras pestañas. Al recargar la
  página se intenta `POST /auth/refresh` para recuperar la sesión.
- **Refresco compartido:** si varias peticiones reciben 401 a la vez, todas
  esperan la misma renovación. Si cada una renovara por su cuenta, el backend
  detectaría reuso del refresh token y revocaría la sesión. La petición de
  refresh usa axios sin interceptores y nunca se reintenta.
- Si el refresh responde con error, se limpia la sesión y se va al login con
  el aviso "Tu sesión expiró. Inicia sesión de nuevo." Si el servidor no
  responde, la sesión se conserva y solo se muestra el error de conexión.
- **Cierre por inactividad:** 15 minutos sin interacción cierran la sesión; un
  minuto antes aparece el aviso "¿Sigues ahí?" con el botón "Seguir conectado".
- La guardia del layout `(panel)` redirige al login si no hay sesión; es solo
  experiencia de usuario.

### 6.2 Content Security Policy y cabeceras

- **CSP con nonce por petición** en `src/proxy.ts`: `default-src 'self'`,
  `script-src 'self' 'nonce-…' 'strict-dynamic'`, `style-src 'self' 'nonce-…'`,
  `img-src 'self' blob: data:`, `connect-src 'self'`, `worker-src 'self' blob:`,
  `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
  `frame-ancestors 'none'`, más `upgrade-insecure-requests` en producción. El
  nonce se genera con `crypto.randomUUID()` en cada petición. Previene XSS:
  aunque se inyectara un `<script>`, el navegador no lo ejecuta porque no trae
  el nonce.
- **Cabeceras en `next.config.ts`** para todas las rutas:
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`, `Permissions-Policy` (cámara, micrófono,
  ubicación y pagos desactivados), `Cross-Origin-Opener-Policy: same-origin`,
  y `poweredByHeader: false`. HSTS lo pone Nginx en producción.

### 6.3 Contenido de usuarios (XSS)

React escapa el texto por defecto: títulos, descripciones, comentarios,
nombres y URLs se muestran siempre como texto. No se usan
`dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` ni
interpretación de Markdown, y no se ponen datos de usuarios en `href`, `src`,
`style` ni atributos `on*`. Las URLs de evidencias solo se aceptan si son de
mismo origen (`/api/v1/evidences/...`); si una imagen falla (la firma dura 15
minutos), se vuelve a pedir el reporte.

### 6.4 Autenticación del panel

- **Login:** captcha → `POST /auth/login`. Según la respuesta, lleva a
  verificar el código TOTP o a configurar el 2FA. Si llegan tokens directos
  (usuario normal), se cierra esa sesión de inmediato y se muestra "Este
  panel es solo para administradores." Un 401 siempre da el mismo mensaje
  ("Correo o contraseña incorrectos.") para no dar pistas.
- **Verificar y configurar 2FA:** el `mfaToken` vive solo en memoria y dura 5
  minutos; el QR se muestra como `<img>` con el `data:` URL validado.
- **Recuperar contraseña:** dos pasos (correo → código + contraseña nueva),
  con captcha en ambos y mensajes genéricos que no revelan si el correo existe.
- **Contraseñas:** de 8 a 128 caracteres, sin reglas de mayúsculas o símbolos
  (ASVS ya no las recomienda); el servidor rechaza las comunes.

### 6.5 URLs reportadas

Las URLs de los reportes son, por definición, posibles sitios de estafa o
phishing. El componente `ReportedUrl`:

- Muestra el dominio destacado (ayuda a ver imitaciones como
  `mercadolibre.com.mx.ofertas-xyz.com`) y la URL completa como texto
  monoespaciado, nunca como enlace.
- "Copiar enlace" con `navigator.clipboard`.
- "Abrir con precaución": diálogo de advertencia; solo abre esquemas
  `http:`/`https:` (validados con `new URL()`) con
  `window.open(url, '_blank', 'noopener,noreferrer')`. `noopener` evita el
  reverse tabnabbing; `noreferrer` evita revelar de dónde vino.
- Nunca se cargan en `<iframe>`, `<img>` ni con `fetch`.

### 6.6 Datos sensibles

El autor real de reportes anónimos y los correos de usuarios solo se muestran
donde el administrador los necesita, con la etiqueta "Anónimo para el
público". No hay `console.log` en el código final (regla ESLint `no-console`
en error). Nada sensible viaja en la URL: los filtros de búsqueda viven en el
estado de React. Las acciones destructivas o sensibles siempre piden
confirmación.

### 6.7 Captcha ALTCHA

El servidor manda un reto proof-of-work. En un Web Worker (para no congelar la
página) se busca `n` tal que `hex(SHA-256(salt + n)) === challenge`; el
resultado se codifica en Base64 y se envía en el campo `captcha`. Previene que
bots prueben miles de contraseñas contra el login.

### 6.8 Dependencias y compilación

`npm audit --omit=dev` sin hallazgos de producción. No se exponen source maps
en producción. Las únicas variables `NEXT_PUBLIC_*` permitidas son las que no
sean secretas.

---

## 7. Capa de datos en el front

- **`src/lib/api.ts`:** `axios.create({ baseURL: '/api/v1', timeout: 20000 })`;
  interceptor de petición que agrega el Bearer desde `session.ts`; interceptor
  de respuesta que ante 401 hace refresco compartido y reintenta una sola vez
  (sin aplicar a rutas `/auth/*`). Todo error sale convertido en `ApiError`.
- **Estados de pantalla:** cada pantalla con datos remotos implementa
  cargando (esqueleto), contenido, vacío (`EmptyState`) y error (`ErrorBanner`
  con "Reintentar"), vía el hook `useApiQuery`, que cancela con
  `AbortController` al desmontar. Tras una mutación exitosa se vuelven a pedir
  los datos; no se edita la lista a mano antes de que el servidor confirme.
- **Errores (`errors.ts`):** `ApiError` nunca muestra el `message` técnico del
  servidor; se mapea por `code`/estado a mensajes propios en español.

| Caso | Mensaje |
|---|---|
| Sin respuesta / timeout | "No hay conexión con el servidor. Inténtalo de nuevo." |
| 400 sin `code` | "Revisa los datos e inténtalo de nuevo." |
| 403 | "No tienes permiso para hacer esto." |
| 404 | "No encontramos lo que buscas. Puede que ya no exista." |
| 409 | "Este elemento cambió mientras lo veías. Recarga la página." |
| 429 | "Demasiados intentos. Espera un momento e inténtalo de nuevo." |
| 5xx | "Algo salió mal de nuestro lado. Inténtalo más tarde." |

Los errores 5xx pueden mostrar `Código de soporte: {requestId}` para
buscarlos en los logs del backend.

---

## 8. Diseño

Misma identidad que la app iOS: fondo crema, azul marino institucional y
acentos dorados; sobrio, con mucho espacio en blanco. Los colores se definen
como variables CSS en `:root` en `globals.css` y se redefinen para modo
oscuro con `@media (prefers-color-scheme: dark)`; los componentes usan solo
esas variables, nunca colores hexadecimales sueltos.

- **Tipografía:** `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
  (sin fuentes externas, por la CSP). URLs en `ui-monospace`.
- **Medidas:** radios de 12 px (controles) y 14 px (tarjetas); espaciado base
  8 px; foco visible siempre con `outline: 2px solid var(--cs-gold)`.
- **Layout:** barra lateral fija de 240 px; contenido con ancho máximo de
  1200 px; en pantallas menores a 900 px la barra se vuelve un menú
  desplegable y las tablas tienen scroll propio (sin scroll horizontal de la
  página).
- **Accesibilidad:** HTML semántico (`<nav>`, `<main>`, `<table>` con
  `<th scope>`), `<label>` en cada campo, `aria-live` para mensajes, botones
  de solo ícono con `aria-label`, contraste WCAG AA.
- **"Validado"** significa que un administrador confirmó el fraude, por eso se
  muestra en rojo, no en verde.

Componentes clave: `Button`, `TextField` / `PasswordField` / `CodeField`,
`Card`, `StatusBadge`, `DataTable`, `Pagination`, `ConfirmDialog` (`<dialog>`
nativo), `EmptyState`, `ErrorBanner`, `Sidebar`, `StatCard`, `BarChart` (SVG
con `<title>` y tabla alternativa accesible), `ReportedUrl`, `EvidenceGallery`
y `AnonymousTag`.

---

## 9. Pantallas

Todo el texto de usuarios se muestra como texto plano.

| Código | Ruta | Descripción |
|---|---|---|
| W01 | `/login` | Iniciar sesión (correo, contraseña, captcha) |
| W02 | `/login/verificar` | Verificar código TOTP de 6 dígitos |
| W03 | `/login/configurar-2fa` | Configurar 2FA (QR + primer código) |
| W04 | `/recuperar` | Olvidé / restablecer contraseña |
| W05 | `/` | Dashboard: `StatCard` y gráficas (por mes, plataforma, categoría, estado) con tabla alternativa |
| W06 | `/reportes` | Cola de reportes con pestañas por estado (Pendientes · Validados · No validados · Todos) |
| W07 | `/reportes/[id]` | Detalle, autor real, `ReportedUrl`, evidencias y panel de revisión |
| W08 | `/comentarios` | Moderación: confirmar ocultamiento o restaurar |
| W09 | `/usuarios` | Buscar, suspender y reactivar; acceso a crear administrador |
| W10 | `/administradores/nuevo` | Nuevo administrador con reautenticación TOTP |
| W11 | `/catalogos` | Plataformas y categorías: agregar, editar, activar/desactivar |
| W12 | `/bitacora` | Bitácora de auditoría con filtros, solo lectura |
| W13 | `/cuenta` | Mi cuenta: nombre, contraseña, cerrar sesión en todos los dispositivos |

---

## 10. Proceso de desarrollo

El panel se construyó por fases, cada una en su rama e integrada con Pull
Request:

0. **Adaptar la plantilla** del curso (Next.js + axios): limpieza, scripts,
   `rewrites`, Vitest, regla `no-console`.
1. **Base de seguridad y diseño:** CSP (`proxy.ts`), cabeceras, `session.ts` /
   `api.ts` / `errors.ts`, tipos, tokens de diseño, componentes base y layout
   del panel con guardia.
2. **Autenticación:** captcha, W01–W04, cierre por inactividad, W13.
3. **Dashboard y reportes:** W05, W06, W07.
4. **Moderación y usuarios:** W08, W09, W10.
5. **Catálogos y bitácora:** W11, W12.
6. **Calidad y entrega:** pruebas unitarias (Vitest), escaneo con OWASP ZAP,
   CI en GitHub Actions (lint, test, build, `npm audit`), CodeQL y Dependabot,
   `docs/seguridad.md` y README completos.

### Convenciones de Git

- `main` siempre compila. Una rama por fase; integración con Pull Request.
- Conventional Commits en español (p. ej. `feat(auth): verificación TOTP`).

### Pruebas

Vitest con un *adapter* de axios simulado (no necesitan el backend). Cubren
los requerimientos de lectura de datos con escenario exitoso y fallido
(estadísticas, cola de reportes, bitácora con filtros) y los controles de
seguridad (URLs seguras, captcha, refresco compartido, manejo del TOTP,
ocultamiento de datos sensibles en la bitácora).

---

## 11. Reglas de seguridad que no deben relajarse

Estas invariantes sostienen el nivel ASVS 2; cambiarlas reintroduce
vulnerabilidades conocidas:

- No guardar tokens en `localStorage`, cookies escritas desde JS ni en la URL;
  el `mfaToken` vive solo en memoria.
- No usar `dangerouslySetInnerHTML`, `innerHTML`, `eval` ni Markdown con texto
  de usuarios.
- No hacer clicables las URLs reportadas, ni abrirlas sin aviso o sin
  `noopener,noreferrer`, ni meterlas en `<iframe>`/`<img>`/`fetch`.
- No quitar ni relajar la CSP ni las cabeceras de seguridad.
- No mostrar al usuario el `message` técnico del servidor ni stack traces.
- No dejar `console.log` en el código final.
- No habilitar CORS en el backend (se usan los `rewrites`).
- No dejar entrar a un usuario normal al panel ni confiar en el front para
  autorizar (la API decide).
- No inventar endpoints ni campos fuera de `docs/openapi.json`.
- No desactivar `strict` de TypeScript, reglas de ESLint ni pruebas para que
  algo pase.
