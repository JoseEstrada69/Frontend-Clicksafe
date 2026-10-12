# CLAUDE.md — Panel web de administración de ClickSafe

> Este archivo es tu contexto permanente para este repositorio. Léelo completo
> antes de hacer cualquier cosa. Si algo aquí contradice lo que "normalmente"
> harías, **gana este archivo**. Si algo no está cubierto o es ambiguo,
> **pregunta antes de inventar**.

---

## 0. Cómo debes trabajar con nosotros

- **Idioma:** respóndenos siempre en español. El código (componentes,
  funciones, variables, tipos) va en inglés. **Todo el texto visible del
  sitio va en español de México**, con los textos exactos de este archivo
  cuando se indiquen. Los campos del JSON de la API conservan sus nombres
  (`urlPublicacion`, `totalLikes`…): no los traduzcas ni los renombres.
- **Explica lo que haces.** Somos estudiantes del Tec de Monterrey en la
  materia *Integración de seguridad informática en redes y sistemas de
  software*. Al terminar cada paso explica:
  1. qué hiciste y por qué,
  2. cómo funciona (en especial lo nuevo de Next.js / React),
  3. si es un control de seguridad: **qué ataque concreto previene** y cómo
     sería ese ataque si no existiera el control.
- **Trabaja por fases** (sección 11). Al terminar una fase: corre
  `npm run lint`, `npm test` y `npm run build` (sin errores ni warnings),
  resume lo hecho y **espera confirmación** antes de seguir.
- **Este repo parte de una plantilla del curso** (sección 2). Respeta su
  forma de trabajar (Next.js App Router + axios + interceptores en
  `src/lib/api.ts`); la adaptamos y la endurecemos, no la tiramos a la basura.
  Antes de reemplazar un archivo de la plantilla, di qué vas a conservar y qué
  vas a cambiar.
- **Nunca** desactives una validación, una cabecera de seguridad, la CSP o
  una regla de ESLint para "hacer que algo funcione". Si algo choca con este
  archivo, detente y pregunta.
- **Nunca** escribas secretos ni URLs de producción en el código.
- **Dependencias:** la plantilla solo trae `next`, `react`, `react-dom` y
  `axios`. Antes de instalar algo más, dime cuál, para qué, y verifica que
  esté mantenido y sin vulnerabilidades (`npm audit`). Preferimos escribir
  20 líneas a agregar un paquete. Ya están aprobadas solo como
  dependencias de desarrollo: `vitest` y `@vitest/coverage-v8` (pruebas).
- **Next.js 16 cambió cosas** respecto a lo que quizá recuerdas (p. ej.
  `middleware.ts` ahora se llama **`proxy.ts`**, y `next lint` ya no existe).
  La documentación oficial de la versión instalada viene dentro del paquete:
  **`node_modules/next/dist/docs/`**. Consúltala antes de usar una API de
  Next en vez de fiarte de tu memoria.
- El sistema operativo de quien desarrolla puede ser **Windows** o **macOS**:
  los comandos que nos pidas correr deben funcionar en PowerShell y en zsh,
  y los scripts del proyecto deben ser scripts de npm (nada de bash).

---

## 1. Qué es ClickSafe y qué hace este sitio

ClickSafe es una red social para **reportar publicaciones sospechosas de
fraude en tiendas en línea** (lema: *"Consulta antes de comprar"*). Socio
formador: Red por la Ciberseguridad (ONG mexicana). Requisito del curso:
**OWASP ASVS nivel 2**. El sitio será sometido a pruebas de penetración
(**OWASP ZAP**, Nessus, nmap) y a análisis de código estático.

### Piezas del sistema
- **API REST (NestJS + MySQL):** otro repo. Este sitio **solo** habla con ella.
  Su contrato está en su `CLAUDE.md` y en `docs/openapi.json` (sección 6.1).
- **App iOS (SwiftUI):** otro repo, solo para usuarios normales.
- **Este repo — panel web de administración:** **solo para el rol `admin`**.
  Aquí viven todas las pantallas de administrador del mockup de Canva.

### Qué hace un admin (fuente de verdad de reglas: el CLAUDE.md del backend)
1. **Dashboard:** estadísticas de reportes por plataforma (las `es_otra`
   agrupadas como "Otra"), por categoría, por estado y por mes.
2. **Revisar reportes:** cola de reportes `pendiente`; ver detalle, evidencias
   y **autor real aunque sea anónimo**; **validar** o **rechazar** con
   comentario opcional. **Un admin no puede revisar un reporte propio.**
   Puede quitar evidencias que contengan datos personales (en cualquier estado).
3. **Moderar comentarios:** cola de comentarios `oculto_auto` o con denuncias
   sin resolver → **confirmar** (`oculto_admin`) o **restaurar** (`visible`).
4. **Usuarios:** buscar por nombre/correo, **suspender / reactivar**. No a sí
   mismo; el sistema nunca puede quedarse sin admins activos.
5. **Crear administradores:** pide nombre, correo y **un código TOTP actual
   del admin que crea** (re-autenticación). El nuevo admin recibe por correo
   un código de recuperación y define su propia contraseña con "¿Olvidaste tu
   contraseña?"; en su primer inicio de sesión configura su 2FA.
6. **Catálogos** (plataformas y categorías de fraude): alta, edición,
   activar/desactivar. **No se borran.**
7. **Bitácora de auditoría:** consulta paginada con filtros.
8. **Mi cuenta:** ver datos, cambiar nombre y contraseña, cerrar sesión y
   cerrar sesión en todos los dispositivos.

**2FA (TOTP) es obligatorio para todos los admins.** Un usuario normal
**no** puede usar este sitio (sección 7.4).

---

## 2. La plantilla del curso y qué cambia

La plantilla ("Agenda de contactos") trae:

| Archivo | Qué hace en la plantilla | Qué pasa con él |
|---|---|---|
| `src/lib/api.ts` | tokens en `localStorage`, cliente axios, interceptor que agrega `Authorization: Bearer`, refresco 401 → `/auth/refresh` → reintento con una sola promesa compartida (`refreshing ??=`) | **Se conserva la idea** (interceptores + refresco compartido). Se separa en `session.ts`, `api.ts` y `errors.ts` y se endurece (secciones 7 y 8) |
| `src/app/login/page.tsx` | formulario de login `{email, password}` | Se reescribe: el backend espera `{correo, password, captcha}` y para admins responde con el flujo de 2FA |
| `src/app/page.tsx` | lista de contactos | Se reemplaza por el dashboard |
| `src/app/layout.tsx`, `globals.css` | layout mínimo, estilos base | Se conservan como punto de partida y se agregan los tokens de diseño |
| `README.md` | instrucciones de la agenda | Se reescribe para ClickSafe |

Problemas de la plantilla que hay que corregir (explícanos cada uno al
corregirlo, son buen material para el reporte):

1. **`package.json` tiene el script roto `"de v"`** (con espacio) → debe ser
   `"dev": "next dev -p 3001"`. Cambiar también `"name": "proyecto"` por
   `"clicksafe-admin-web"` y agregar `"test": "vitest run"`.
2. **Tokens en `localStorage`:** cualquier script que logre ejecutarse en la
   página (XSS, una dependencia comprometida) los lee y se los lleva, y
   persisten incluso después de cerrar el navegador. → Sección 7.1.
3. **`errorMessage()` muestra el `message` del servidor** al usuario. → Nunca;
   se mapea por `code`/estado a mensajes propios (sección 8.3).
4. **`API_URL` apunta a `http://localhost:3000` sin `/api/v1`** y obliga a
   habilitar CORS en el backend. → Usar `rewrites` (sección 5).
5. `page.tsx` agrega el contacto a la lista **antes** de que el servidor
   responda y no lo revierte si falla, y no valida nada. No copiar ese patrón.
6. Borrar la carpeta `__MACOSX/` (basura del zip de macOS).

---

## 3. Stack (no cambiar sin preguntarnos)

| Tema | Decisión |
|---|---|
| Framework | **Next.js 16.x** (App Router), versión de la plantilla. React 19 |
| Lenguaje | TypeScript `strict` (ya activo en la plantilla). Prohibido `any` |
| HTTP | `axios` (de la plantilla), un solo cliente en `src/lib/api.ts` |
| Estilos | CSS plano: `globals.css` con tokens + **CSS Modules** (`*.module.css`). Sin Tailwind ni librerías de componentes |
| Gráficas | **SVG hecho a mano** (componentes `BarChart` / `LineChart` sencillos). Sin librerías de gráficas |
| Captcha | ALTCHA resuelto con **Web Crypto** (`crypto.subtle.digest`) en un **Web Worker** |
| Fechas | `Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City' })` |
| Lint | ESLint 9 con `eslint-config-next` (de la plantilla) |
| Tests | Vitest |
| Gestor | npm (commitear `package-lock.json`) |
| Node | LTS (mínimo 22) |

### Renderizado
El panel es una **aplicación de cliente**: las páginas del panel son
componentes `'use client'` que piden datos a la API con el token del admin.
**No** uses Server Actions, Route Handlers ni `fetch` desde el servidor de
Next hacia la API (el token vive en el navegador, sección 7.1). El servidor
de Next solo sirve el HTML/JS, aplica la CSP (`proxy.ts`) y reenvía `/api/v1`
al backend (`rewrites`).

---

## 4. Estructura

```
clicksafe-admin-web/
├── CLAUDE.md                 ← este archivo
├── README.md                 ← cómo correrlo (en español)
├── .env.example
├── .gitignore  .gitattributes  .editorconfig
├── next.config.ts            ← rewrites, cabeceras, poweredByHeader: false
├── docs/
│   ├── openapi.json          ← copia del contrato exportado por el backend
│   └── seguridad.md          ← control → ataque que previene → requisito ASVS → archivo
├── src/
│   ├── proxy.ts              ← CSP con nonce por petición (sección 7.2)
│   ├── app/
│   │   ├── layout.tsx        ← <html lang="es-MX">, lee el nonce
│   │   ├── globals.css       ← tokens de diseño (sección 9)
│   │   ├── (auth)/           ← sin barra lateral
│   │   │   ├── login/page.tsx
│   │   │   ├── login/verificar/page.tsx      ← código TOTP
│   │   │   ├── login/configurar-2fa/page.tsx ← QR + primer código
│   │   │   └── recuperar/page.tsx            ← olvidé / restablecer contraseña
│   │   └── (panel)/          ← protegido: layout con guardia de sesión + barra lateral
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
│   │   ├── api.ts            ← cliente axios + interceptores (evolución de la plantilla)
│   │   ├── session.ts        ← tokens (sección 7.1)
│   │   ├── errors.ts         ← ApiError + mensajes en español
│   │   ├── captcha.ts  captcha.worker.ts
│   │   ├── admin-api.ts      ← una función tipada por endpoint
│   │   ├── types.ts          ← tipos de la API (sección 6.3)
│   │   ├── safe-url.ts       ← validación/visualización de URLs reportadas
│   │   ├── idle.ts           ← cierre por inactividad
│   │   └── format.ts         ← fechas, números
│   ├── components/           ← Button, TextField, Card, StatusBadge, DataTable,
│   │                           Pagination, ConfirmDialog, EmptyState, ErrorBanner,
│   │                           Sidebar, BarChart, ReportedUrl, EvidenceGallery…
│   └── hooks/                ← useApiQuery (cargando/contenido/vacío/error), useSession
└── tests/                    ← Vitest (sección 10)
```

- `.gitattributes`: `* text=auto eol=lf` (el equipo mezcla Windows y Mac).
- `.gitignore`: lo de Next (`.next/`, `out/`, `node_modules/`, `coverage/`),
  `.env*` excepto `.env.example`, `.DS_Store`, `__MACOSX/`, `*.pem`, `*.key`.

---

## 5. Conexión con la API (mismo origen)

El backend tiene **CORS deshabilitado** a propósito y en producción el panel
y la API se sirven **en el mismo origen detrás de Nginx**
(`https://<dominio>/` → Next, `https://<dominio>/api/` → NestJS). Para que
desarrollo se parezca a producción:

- El cliente axios usa **`baseURL: '/api/v1'`** (ruta relativa, mismo origen).
- `next.config.ts` reenvía esas rutas al backend:
  ```ts
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${process.env.API_PROXY_TARGET}/api/v1/:path*` }];
  }
  ```
- `.env.example`: `API_PROXY_TARGET=http://localhost:3000` (variable **sin**
  `NEXT_PUBLIC_`: solo la lee el servidor de Next, no llega al navegador).
  Validar al arrancar que exista y sea una URL `http(s)`; si no, fallar con
  un mensaje claro.
- Así **no hace falta habilitar CORS** en el backend (una configuración de
  CORS mal hecha es una vulnerabilidad clásica) y las imágenes de evidencia
  (`/api/v1/evidences/...`) se cargan como mismo origen (`img-src 'self'`).
- **Nunca** pongas en el código la URL del backend ni de producción.
- Panel en `http://localhost:3001`, API en `http://localhost:3000`, Mailpit
  en `http://localhost:8025` (ahí llegan los códigos de recuperación).

---

## 6. Contrato con la API (lo define el backend; no inventar)

### 6.1 Fuente de verdad
- El backend exporta su contrato con `npm run openapi:export` →
  `docs/openapi.json`. **Copia ese archivo a `docs/openapi.json` de este repo**
  y escribe los tipos de `src/lib/types.ts` a partir de él.
- Si una pantalla necesita un endpoint o un campo que **no** existe (por
  ejemplo un `GET /admin/reports/:id` con el autor real), **detente y
  pregunta**: primero se agrega en el backend (otro repo) y luego aquí.
- Si OpenAPI y este archivo no coinciden, gana OpenAPI y nos avisas.

### 6.2 Reglas generales
- JSON en **camelCase**. Fechas ISO 8601 UTC (`...Z`): mostrarlas en hora de
  la Ciudad de México.
- Listados: `{ items, page, limit, total }` → tipo `Page<T>`. `limit` ≤ 50.
- Errores: `{ statusCode, error, message, requestId, code? }`.
- Autenticación: `Authorization: Bearer <accessToken>`.

### 6.3 Endpoints que usa el panel
| Método | Ruta | Uso |
|---|---|---|
| GET | `/auth/captcha` | reto ALTCHA |
| POST | `/auth/login` | `{correo, password, captcha}` → `{mfaRequired, mfaToken}` · `{mfaSetupRequired, mfaToken}` · o `Tokens` (usuario normal → sección 7.4) |
| POST | `/auth/2fa/verify` | `{mfaToken, codigo}` → `Tokens` |
| POST | `/auth/2fa/setup` | con `mfaToken` → `{otpauthUri, qrDataUrl}` (verifica nombres en OpenAPI) |
| POST | `/auth/2fa/enable` | `{codigo}` → activa 2FA (revisa en OpenAPI si además devuelve `Tokens`) |
| POST | `/auth/refresh` | `{refreshToken}` → `Tokens` |
| POST | `/auth/logout` · `/auth/logout-all` | 204 |
| POST | `/auth/forgot-password` | `{correo, captcha}` → 202 genérico |
| POST | `/auth/reset-password` | `{correo, codigo, nuevaPassword, captcha}` |
| GET / PATCH | `/me` | datos propios / `{nombre}` |
| PATCH | `/me/password` | `{passwordActual, nuevaPassword}` |
| GET | `/admin/stats` | dashboard |
| GET | `/admin/reports` | cola; `estado` (default `pendiente`), `page`, `limit`; incluye autor real |
| GET | `/reports/:id` | detalle (evidencias con URL firmada, revisión) |
| POST | `/admin/reports/:id/review` | `{decision: 'validado'\|'rechazado', comentario?}` |
| DELETE | `/admin/reports/:id/evidences/:evidenceId` | quitar evidencia |
| GET | `/admin/comments/flagged` | cola de moderación |
| PATCH | `/admin/comments/:id` | `{accion: 'confirmar'\|'restaurar'}` |
| GET | `/admin/users` | `q`, `page`, `limit` |
| PATCH | `/admin/users/:id/status` | `{activo}` |
| POST | `/admin/admins` | `{nombre, correo, totp}` |
| GET / POST / PATCH | `/admin/platforms` · `/admin/categories` | catálogos (sin DELETE) |
| GET | `/admin/audit-log` | `accion`, `usuario`, `desde`, `hasta`, `page`, `limit` |

Todas las funciones van en `src/lib/admin-api.ts`, tipadas, una por
endpoint. **Los componentes nunca llaman a `api.get/post` directamente.**

---

## 7. Seguridad del sitio (ASVS nivel 2)

### 7.1 Tokens y sesión (V7 Sesiones, V8 Autorización)
- **Access token → solo en memoria** (una variable del módulo `session.ts`).
  Nunca en `localStorage`, cookies escritas desde JS ni en la URL.
- **Refresh token → `sessionStorage`** (no `localStorage`): se borra al
  cerrar la pestaña y no se comparte con otras pestañas. Al recargar la
  página, `session.ts` intenta `POST /auth/refresh` para recuperar la sesión;
  si falla, va al login.
  *Por qué:* cuanto menos tiempo y en menos lugares viva un token, menos
  sirve si alguien lo roba. La defensa principal contra el robo por XSS es
  la CSP (7.2); esto limita el daño si aun así ocurriera.
  *(Alternativa más fuerte, solo si el equipo lo decide: un BFF en Next que
  guarde el refresh en una cookie `HttpOnly`. No la implementes sin que lo
  pidamos.)*
- **Refresco compartido** (idea de la plantilla, se conserva): si varias
  peticiones reciben 401 a la vez, **todas esperan la misma** renovación. Si
  cada una renovara por su cuenta, el backend detectaría *reuso* del refresh
  token y revocaría toda la sesión. La petición de refresh usa axios "pelón"
  (sin interceptores) y nunca se reintenta.
- Si el refresh responde con error → `clearSession()` y al login con el aviso
  **"Tu sesión expiró. Inicia sesión de nuevo."**. Si el servidor no responde
  (caído), no borrar la sesión: mostrar el error de conexión.
- **Cierre por inactividad:** 15 minutos sin interacción (mouse, teclado,
  scroll) → `POST /auth/logout` + limpiar + login con el aviso **"Cerramos tu
  sesión por inactividad."**. Un minuto antes, aviso con botón **"Seguir
  conectado"**. *(Un panel de admin abierto en una computadora del
  laboratorio es un riesgo real.)*
- **Cerrar sesión:** `POST /auth/logout`, borrar access (memoria) y refresh
  (`sessionStorage`), reiniciar el estado de React y `router.replace('/login')`.
- La guardia del layout `(panel)` redirige al login si no hay sesión. Es
  **solo experiencia de usuario**: la autorización real la hace la API
  (`RolesGuard` + 2FA). Nunca confíes en el front para proteger nada.

### 7.2 Content Security Policy y cabeceras (V3 Seguridad del front)
- **CSP con nonce por petición** en `src/proxy.ts`, siguiendo la guía oficial
  `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`:
  ```
  default-src 'self';
  script-src 'self' 'nonce-<n>' 'strict-dynamic';   (+ 'unsafe-eval' SOLO en desarrollo)
  style-src 'self' 'nonce-<n>';
  img-src 'self' blob: data:;      (data: para el QR del 2FA)
  font-src 'self';
  connect-src 'self';
  worker-src 'self' blob:;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests        (solo en producción)
  ```
  El nonce se genera con `crypto.randomUUID()` en cada petición. Las páginas
  quedan con renderizado dinámico (correcto para un panel privado).
  *Qué previene:* XSS. Aunque un atacante lograra inyectar un `<script>`, el
  navegador no lo ejecuta porque no trae el nonce.
  **Evita `style={{...}}`** en componentes (usa CSS Modules); si algo de Next
  exige relajar `style-src`, pregúntanos y documéntalo en `docs/seguridad.md`.
- Cabeceras en `next.config.ts` → `headers()` para todas las rutas:
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`,
  `Cross-Origin-Opener-Policy: same-origin`. Y `poweredByHeader: false`
  (no revelar que es Next.js). HSTS lo pone Nginx en producción.
  *Qué previene:* `frame-ancestors`/`X-Frame-Options` evitan **clickjacking**
  (meter el panel en un iframe invisible y engañar al admin para que haga
  clic en "Validar" o "Suspender"); `no-referrer` evita filtrar rutas
  internas del panel a sitios externos.
- **Comprueba la CSP en el navegador** (consola sin errores de CSP) y con
  `curl -I http://localhost:3001/login`.

### 7.3 Contenido de usuarios (V1 Codificación, XSS)
- React escapa el texto por defecto: **siempre** muestra títulos,
  descripciones, comentarios, nombres y URLs como texto `{valor}`.
- **Prohibido** `dangerouslySetInnerHTML`, `innerHTML`, `eval`,
  `new Function`, interpretar Markdown, o poner datos de usuarios en `href`,
  `src`, `style` o atributos `on*` (salvo 7.5).
- Las URLs de evidencias que manda la API se aceptan solo si empiezan con
  `/api/v1/evidences/` (mismo origen). Si una imagen falla (la firma dura
  15 min), volver a pedir el reporte para obtener URLs nuevas.

### 7.4 Autenticación en el panel (V6)
- **Login:** captcha → `POST /auth/login`.
  - `mfaRequired` → guardar `mfaToken` **solo en memoria** →
    `/login/verificar`.
  - `mfaSetupRequired` → `/login/configurar-2fa`.
  - Si llegan `Tokens` directos, es un **usuario normal**: hacer de inmediato
    `POST /auth/logout` con ese access token (para revocar esa sesión),
    no guardar nada y mostrar **"Este panel es solo para administradores."**
  - 401 → **"Correo o contraseña incorrectos."** (mismo mensaje siempre,
    también si la cuenta está bloqueada o suspendida: el servidor no
    distingue a propósito para no dar pistas a un atacante).
- **Verificar (TOTP):** campo de 6 dígitos (`inputMode="numeric"`,
  `autoComplete="one-time-code"`) → `POST /auth/2fa/verify`. Error →
  "Código incorrecto. Revisa tu app de autenticación." El `mfaToken` dura
  5 min: si expira → volver al login con "Tu verificación expiró. Inicia
  sesión de nuevo."
- **Configurar 2FA:** `POST /auth/2fa/setup` → mostrar el **QR** (`<img>` con
  el `data:` URL) y la clave para captura manual con botón "Copiar".
  Instrucciones: *"Escanea este código con Google Authenticator, Microsoft
  Authenticator o una app similar y escribe el código de 6 dígitos."* →
  `POST /auth/2fa/enable`. Si `enable` no devuelve tokens, pasar a
  `/login/verificar` y avisar **"Espera a que tu app muestre un código nuevo"**
  (el backend no acepta el mismo código TOTP dos veces).
- **Recuperar contraseña** (la usan también los admins nuevos):
  1. correo → captcha → `POST /auth/forgot-password` → siempre:
     *"Si el correo está registrado, recibirás un código de 8 dígitos."*
  2. código + nueva contraseña + confirmar → captcha →
     `POST /auth/reset-password` → "Contraseña actualizada. Inicia sesión."
- **Contraseñas:** mín. 8, máx. 128, **sin** reglas de mayúsculas/símbolos
  (ASVS ya no las recomienda); el servidor rechaza las comunes
  (`PASSWORD_WEAK` → "Esa contraseña es muy común. Elige otra."). Usar
  `autoComplete="new-password"` / `"current-password"` para que el
  administrador de contraseñas del navegador funcione. Botón mostrar/ocultar.
- Botones de envío deshabilitados mientras hay una petición en curso
  (evita dobles envíos).

### 7.5 URLs reportadas (riesgo principal de ClickSafe)
Las URLs de los reportes son, por definición, **posibles sitios de estafa o
phishing**, y el admin las abrirá para verificar. Componente `ReportedUrl`:
- Mostrar el **dominio** destacado (ayuda a ver imitaciones como
  `mercadolibre.com.mx.ofertas-xyz.com`) y la URL completa como **texto**
  monoespaciado, **no** como enlace.
- **"Copiar enlace"** con `navigator.clipboard.writeText`.
- **"Abrir con precaución"** → diálogo: *"⚠️ Este enlace fue reportado como
  posible fraude. No inicies sesión, no descargues archivos y no ingreses
  datos personales ni de pago. Considera abrirlo en una ventana privada.
  ¿Abrir de todos modos?"* → solo si el esquema es `http:`/`https:`
  (validar con `new URL()`), `window.open(url, '_blank', 'noopener,noreferrer')`.
  *Qué previene:* `noopener` impide que la página maliciosa controle la
  pestaña del panel (*reverse tabnabbing*: cambiarla por un login falso de
  ClickSafe); `noreferrer` evita revelarle de dónde vino; validar el esquema
  evita `javascript:` y `data:`.
- **Nunca** cargar esas URLs en un `<iframe>`, `<img>` ni hacer `fetch` a ellas.

### 7.6 Datos sensibles en pantalla
- El autor real de reportes anónimos y los correos de usuarios **solo** se
  muestran donde el admin los necesita (detalle de reporte, usuarios). Marca
  visual: etiqueta "Anónimo para el público".
- **Nada** de `console.log` en el código final (regla de ESLint `no-console`
  en error). Nunca loguear tokens, códigos, contraseñas ni respuestas completas.
- Nada sensible en la URL (ni tokens, ni correos, ni términos de búsqueda de
  usuarios en query strings que queden en el historial: los filtros del
  panel van en estado de React).
- Acciones destructivas o sensibles (rechazar, suspender, confirmar
  ocultamiento, quitar evidencia, desactivar catálogo, crear admin) siempre
  con **diálogo de confirmación** que diga qué va a pasar.

### 7.7 Captcha ALTCHA (`captcha.ts` + `captcha.worker.ts`)
El servidor manda `{algorithm: "SHA-256", challenge, maxnumber, salt, signature}`.
1. En un **Web Worker** (para no congelar la página), buscar `n` en
   `0…maxnumber` tal que `hex(SHA-256(salt + String(n))) === challenge`,
   usando `crypto.subtle.digest`.
2. Payload: `{algorithm, challenge, number: n, salt, signature, took}` →
   `JSON.stringify` → **Base64** → campo `captcha` del body.
3. Si no hay solución → error local `CAPTCHA_INVALID`. Si el servidor
   responde `CAPTCHA_INVALID`, reintentar **una vez** con un reto nuevo.
4. Mientras resuelve, el botón dice **"Verificando…"**.
*Qué previene:* bots que prueban miles de contraseñas contra el login de
administradores. Si el worker da problemas con el bundler, pregúntanos antes
de cambiar de enfoque.

### 7.8 Dependencias y compilación
- `npm audit --audit-level=high` sin hallazgos.
- No exponer *source maps* en producción (es el comportamiento por defecto
  de Next; no lo cambies).
- Las únicas variables `NEXT_PUBLIC_*` permitidas son las que no sean
  secretas (hoy no hace falta ninguna).

---

## 8. Capa de datos en el front

### 8.1 `src/lib/api.ts`
Evolución del de la plantilla:
- `axios.create({ baseURL: '/api/v1', timeout: 20000, withCredentials: false })`.
- Interceptor de petición: agrega el Bearer desde `session.ts` (memoria).
- Interceptor de respuesta: 401 → refresco compartido → reintento **una**
  vez (`_retry`), sin aplicar a rutas `/auth/*`. Todo error sale convertido
  en `ApiError`.

### 8.2 Estados de cada pantalla
Toda pantalla con datos remotos implementa **cargando** (esqueleto),
**contenido**, **vacío** (`EmptyState`) y **error** (`ErrorBanner` con
"Reintentar"). Hook `useApiQuery(fn, deps)` que devuelve
`{ status, data, error, reload }` y cancela con `AbortController` al
desmontar. Listados con paginación (`Pagination`: "Anterior / Siguiente" y
"Página X de Y").
Después de una mutación exitosa, **volver a pedir** los datos; no editar la
lista a mano antes de que el servidor confirme (error de la plantilla).

### 8.3 Errores (`errors.ts`)
`class ApiError { status; code?; requestId?; userMessage }`. Mensajes:

| Caso | Mensaje |
|---|---|
| Sin respuesta / timeout | "No hay conexión con el servidor. Inténtalo de nuevo." |
| 400 sin `code` | "Revisa los datos e inténtalo de nuevo." |
| 403 | "No tienes permiso para hacer esto." |
| 404 | "No encontramos lo que buscas. Puede que ya no exista." |
| 409 | "Este elemento cambió mientras lo veías. Recarga la página." |
| 429 | "Demasiados intentos. Espera un momento e inténtalo de nuevo." |
| 5xx | "Algo salió mal de nuestro lado. Inténtalo más tarde." |
| `CAPTCHA_INVALID` | "No pudimos verificar la solicitud. Inténtalo de nuevo." |
| `INVALID_CODE` | "Código incorrecto o expirado." |
| `PASSWORD_WEAK` | "Esa contraseña es muy común. Elige otra." |
| `OWN_REPORT` | "No puedes revisar un reporte que tú creaste." |
| `REPORT_NOT_EDITABLE` | "Este reporte ya fue revisado por otro administrador." |
| `CATALOG_INACTIVE` | "Ese elemento del catálogo está desactivado." |
| desconocido | "No se pudo completar la acción." |

**Nunca** mostrar el `message` técnico del servidor. Al pie de los errores
5xx se puede mostrar `Código de soporte: {requestId}` (ayuda a buscarlo en
los logs del backend y no revela nada interno).

---

## 9. Diseño

Misma identidad que la app iOS (mockup de Canva): **fondo crema, azul marino
institucional y acentos dorados**; sobrio, mucho espacio en blanco.

### 9.1 Tokens (`globals.css`)
Definirlos como variables CSS en `:root` y redefinirlos con
`@media (prefers-color-scheme: dark)`. **Prohibido** usar colores
hexadecimales sueltos en los componentes.

| Variable | Claro | Oscuro | Uso |
|---|---|---|---|
| `--cs-background` | `#F7F5EF` | `#0B1624` | Fondo |
| `--cs-surface` | `#FFFFFF` | `#16233A` | Tarjetas, tablas, campos |
| `--cs-border` | `#E3E1DA` | `#2A3A52` | Bordes 1 px |
| `--cs-navy` | `#0E2A47` | `#9DB9D8` | Botón principal, títulos, ítem activo |
| `--cs-on-navy` | `#FFFFFF` | `#0B1624` | Texto sobre navy |
| `--cs-sidebar` | `#0E2A47` | `#16233A` | Barra lateral (texto blanco) |
| `--cs-blue` | `#2F5D8A` | `#9DB9D8` | Enlaces, 2.ª serie de gráficas |
| `--cs-gold` | `#C6A15B` | `#D9B872` | Anillo de foco, indicador activo, detalles. **Nunca texto sobre crema** |
| `--cs-text` | `#0E2A47` | `#E8EDF3` | Texto principal |
| `--cs-text-secondary` | `#5F6B76` | `#A7B2BD` | Metadatos, ayudas |
| `--cs-pending-bg` / `-fg` | `#F7ECD9` / `#7A5A1E` | `#3A2C12` / `#E8C98A` | "Pendiente de revisión" |
| `--cs-validated-bg` / `-fg` | `#F9E3E1` / `#B3261E` | `#3A1512` / `#F2B8B2` | "Fraude validado" |
| `--cs-rejected-bg` / `-fg` | `#ECEEF0` / `#4A5561` | `#26303A` / `#C4CCD4` | "No validado" |
| `--cs-danger` | `#B3261E` | `#F2B8B2` | Errores, acciones destructivas |
| `--cs-success` | `#1E6B3A` | `#8FD1A5` | Confirmaciones |

"Validado" = un admin **confirmó el fraude** → rojo, no verde.

### 9.2 Tipografía y medidas
- `font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
  (sin fuentes externas: la CSP solo permite `'self'`).
- Escala en `rem`: título de página 1.75, sección 1.25, cuerpo 1, metadatos
  0.875. URLs en `ui-monospace, monospace`.
- Radios: botones/campos 12 px, tarjetas 14 px, insignias cápsula.
- Espaciado base 8 px. Tarjetas planas con borde, sin sombras fuertes.
- Foco visible siempre: `outline: 2px solid var(--cs-gold)`.

### 9.3 Layout
- **Barra lateral** fija (240 px) con el logo (círculo navy + escudo) y
  "ClickSafe · Admin", y los enlaces: Dashboard · Reportes (con contador de
  pendientes) · Comentarios (contador) · Usuarios · Catálogos · Bitácora.
  Abajo: nombre del admin, "Mi cuenta" y "Cerrar sesión".
- Contenido con ancho máx. 1200 px. En pantallas < 900 px la barra se
  convierte en menú desplegable; sin scroll horizontal (tablas con scroll
  propio).
- Accesibilidad: HTML semántico (`<nav>`, `<main>`, `<table>` con `<th scope>`),
  `<label>` en cada campo, `aria-live` para mensajes, botones de solo ícono
  con `aria-label`, contraste WCAG AA.

### 9.4 Componentes clave
`Button` (primario / secundario / peligro, con estado "cargando"),
`TextField`/`PasswordField`/`CodeField`, `Card`, `StatusBadge` (mismos textos
e íconos que iOS: "Pendiente de revisión", "Fraude validado", "No validado"),
`DataTable`, `Pagination`, `ConfirmDialog` (`<dialog>` nativo), `EmptyState`,
`ErrorBanner`, `Sidebar`, `StatCard`, `BarChart` (SVG, con `<title>` y tabla
alternativa accesible), `ReportedUrl` (7.5), `EvidenceGallery` (miniaturas +
visor ampliado), `AnonymousTag`.

---

## 10. Pantallas

Todo texto de usuarios se muestra como texto plano (7.3).

### W01 · Iniciar sesión (`/login`)
Logo, **"ClickSafe"**, subtítulo **"Panel de administración"**. Correo,
Contraseña, botón **"Iniciar sesión"** ("Verificando…" mientras resuelve el
captcha), enlace **"¿Olvidaste tu contraseña?"**. Comportamiento en 7.4.

### W02 · Verificar código (`/login/verificar`) · W03 · Configurar 2FA (`/login/configurar-2fa`) · W04 · Recuperar (`/recuperar`)
Ver 7.4.

### W05 · Dashboard (`/`)
- Fila de `StatCard`: Total de reportes · Pendientes · Validados · No
  validados (los pendientes enlazan a la cola).
- Gráficas (`GET /admin/stats`): **Reportes por mes** (barras), **por
  plataforma** (barras horizontales, "Otra" agrupada), **por categoría**
  (barras horizontales), **por estado**. Cada una con su tabla alternativa
  ("Ver datos").
- Accesos rápidos: "Revisar reportes pendientes", "Moderar comentarios".

### W06 · Reportes (`/reportes`)
- Filtro por estado (pestañas: Pendientes · Validados · No validados · Todos),
  default Pendientes, ordenados del más antiguo al más nuevo (atender en orden).
- Tabla: Título · Plataforma · Categoría · Autor (nombre + `AnonymousTag` si
  aplica) · Fecha · Likes · Estado → clic abre W07.

### W07 · Detalle y revisión (`/reportes/[id]`)
- Título, `StatusBadge`, plataforma (o nombre de "Otra"), categoría, fechas,
  likes, comentarios.
- **Autor real**: nombre y correo; si es anónimo, etiqueta *"Anónimo para el
  público"*.
- Descripción completa, `ReportedUrl` (7.5), `EvidenceGallery` con botón
  **"Quitar imagen"** por evidencia (confirmación: *"La imagen se eliminará
  permanentemente. Úsalo para imágenes con datos personales."*).
- Si `pendiente`: panel **"Revisión"** con **"Validar fraude"** y
  **"Rechazar"**, comentario opcional (máx. 1000, contador). Confirmación →
  `POST /admin/reports/:id/review` → aviso de éxito → volver a la cola.
  Si el reporte es del propio admin (`esMio`), ocultar los botones y mostrar
  *"No puedes revisar un reporte que tú creaste."*
- Si ya fue revisado: tarjeta con la decisión, comentario y fecha (solo lectura).

### W08 · Moderación de comentarios (`/comentarios`)
- Lista de `GET /admin/comments/flagged`: contenido del comentario, reporte al
  que pertenece (enlace a W07), autor real, número de denuncias y motivos,
  estado (`oculto_auto` → "Oculto automáticamente").
- Acciones: **"Confirmar ocultamiento"** y **"Restaurar"**, ambas con
  confirmación → `PATCH /admin/comments/:id`.

### W09 · Usuarios (`/usuarios`)
- Búsqueda por nombre o correo (máx. 100), tabla: Nombre · Correo · Rol ·
  Registro · Estado (Activo/Suspendido).
- **"Suspender"** / **"Reactivar"** con confirmación (*"Se cerrarán todas sus
  sesiones de inmediato."*). Deshabilitado en la propia fila.
- Botón **"Nuevo administrador"** → W10.

### W10 · Nuevo administrador (`/administradores/nuevo`)
- Nombre, correo y **"Tu código de autenticación"** (6 dígitos) con la ayuda:
  *"Por seguridad, confirma tu identidad con el código actual de tu app de
  autenticación."*
- Éxito: *"Administrador creado. Le enviamos un correo para que defina su
  contraseña y configure su verificación en dos pasos."*

### W11 · Catálogos (`/catalogos`)
- Pestañas **Plataformas** y **Categorías de fraude**. Tabla con nombre (y
  descripción en categorías), estado Activa/Inactiva.
- **"Agregar"** y **"Editar"** en un diálogo; **"Desactivar"/"Activar"** con
  confirmación (*"Ya no aparecerá al crear reportes; los reportes existentes
  la conservan."*). No hay botón de borrar.

### W12 · Bitácora (`/bitacora`)
- Filtros: acción (lista), usuario, rango de fechas. Tabla: Fecha y hora ·
  Acción (con nombre legible en español) · Resultado · Usuario · Recurso · IP.
  Paginada. Solo lectura.

### W13 · Mi cuenta (`/cuenta`)
- Nombre (editable), correo, rol, fecha de registro, "Verificación en dos
  pasos: Activa".
- Cambiar contraseña (actual, nueva, confirmar) → `PATCH /me/password`.
- **"Cerrar sesión en todos los dispositivos"** (confirmación) →
  `POST /auth/logout-all` → login.

---

## 11. Fases

**Fase 0 — Adaptar la plantilla:** limpiar (sección 2), renombrar, arreglar
el script `dev`, `.gitignore`/`.gitattributes`/`.editorconfig`, `rewrites` +
`.env.example`, Vitest instalado, `no-console` en ESLint, README inicial.
`npm run dev` levanta en `:3001` y `npm run lint` pasa.

**Fase 1 — Base de seguridad y diseño:** `proxy.ts` con CSP, cabeceras,
`session.ts`/`api.ts`/`errors.ts`, tipos desde `openapi.json`, tokens de
diseño, componentes base, layout `(panel)` con barra lateral y guardia.

**Fase 2 — Autenticación:** captcha, W01–W04, cierre por inactividad,
cerrar sesión, W13.

**Fase 3 — Dashboard y reportes:** W05, W06, W07 (revisión, evidencias, URL segura).

**Fase 4 — Moderación y usuarios:** W08, W09, W10.

**Fase 5 — Catálogos y bitácora:** W11, W12.

**Fase 6 — Calidad y entrega:**
- **Pruebas unitarias (Vitest)** de requerimientos de **lectura de datos**,
  cada una con escenario **exitoso y fallido** (lo pide el reporte del curso),
  probando las funciones de `admin-api.ts` con axios simulado:

  | # | Prueba | Éxito | Fallo |
  |---|---|---|---|
  | 1 | Cargar estadísticas del dashboard | respuesta válida → datos agrupados correctos | 500 → `ApiError` con "Algo salió mal de nuestro lado…" |
  | 2 | Cargar cola de reportes pendientes | 3 reportes → `items.length === 3`, `estado === 'pendiente'` | 403 → "No tienes permiso para hacer esto." |
  | 3 | Cargar bitácora con filtros | manda los parámetros correctos y devuelve la página | sin conexión → mensaje de conexión |

  Extras recomendadas: `safe-url.ts` rechaza `javascript:alert(1)` y
  `data:text/html,...`; el payload del captcha se arma bien; el refresco
  compartido hace **una sola** llamada a `/auth/refresh` con 5 errores 401
  simultáneos.
- **Escaneo con OWASP ZAP** (baseline) contra `http://localhost:3001` y
  corregir lo que salga; guardar el reporte en `docs/`.
- GitHub Actions: `npm ci`, lint, test, build, `npm audit --audit-level=high`;
  CodeQL; Dependabot (npm y Actions).
- `docs/seguridad.md` (control → ataque → requisito ASVS 5.0 → archivo) y
  README completo (requisitos, `.env.local`, cómo levantar backend + Mailpit +
  panel, cómo entrar con el admin del seed).

---

## 12. Git
- `main` siempre compila. Una rama por fase: `feat/fase-0-plantilla`,
  `feat/auth`, `feat/reportes`… Integrar con Pull Request revisado por otra
  persona del equipo.
- Conventional Commits en español: `feat(auth): verificación TOTP de administradores`.
- Antes de cada commit revisa `git diff --staged` en busca de `.env` o
  secretos. Si se commiteó uno, avísanos de inmediato.
- Nada de `push --force` a `main`.

---

## 13. Cosas que NUNCA debes hacer
- Guardar tokens en `localStorage`, cookies escritas desde JS o en la URL.
- Guardar el `mfaToken` en cualquier almacenamiento (solo memoria).
- Usar `dangerouslySetInnerHTML`, `innerHTML`, `eval` o Markdown con texto de usuarios.
- Hacer clicables las URLs reportadas, abrirlas sin aviso, sin
  `noopener,noreferrer`, o meterlas en `<iframe>`/`<img>`/`fetch`.
- Quitar o relajar la CSP o las cabeceras de seguridad sin preguntarnos.
- Mostrar al usuario el `message` técnico del servidor o stack traces.
- `console.log` en el código final.
- Habilitar CORS en el backend para "arreglar" una petición (usa los `rewrites`).
- Dejar entrar a un usuario normal al panel.
- Confiar en el front para autorizar algo (la API decide).
- Inventar endpoints o campos que no estén en `docs/openapi.json`.
- Agregar dependencias sin preguntar.
- Desactivar `strict` de TypeScript, reglas de ESLint o tests para que algo pase.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
