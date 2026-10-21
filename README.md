# ClickSafe — Panel de administración

Panel web **solo para administradores** de ClickSafe, la red social para
reportar publicaciones sospechosas de fraude en tiendas en línea
(*"Consulta antes de comprar"*). Hecho con Next.js 16 (App Router), React 19
y TypeScript. Socio formador: Red por la Ciberseguridad. Objetivo de
seguridad: OWASP ASVS nivel 2.

El diseño, el modelo de seguridad y las decisiones técnicas están en el
[`MANUAL.md`](MANUAL.md); cada control de seguridad, el ataque que previene y
dónde vive, en [`docs/seguridad.md`](docs/seguridad.md).

## Qué hace

| Pantalla | Ruta |
|---|---|
| Iniciar sesión, verificación en dos pasos (TOTP) y su configuración, recuperar contraseña | `/login`, `/login/verificar`, `/login/configurar-2fa`, `/recuperar` |
| Dashboard con estadísticas | `/` |
| Cola de reportes y detalle con revisión (validar / rechazar) | `/reportes`, `/reportes/[id]` |
| Moderación de comentarios denunciados | `/comentarios` |
| Usuarios (buscar, suspender, reactivar) y nuevo administrador | `/usuarios`, `/administradores/nuevo` |
| Catálogos de plataformas y categorías de fraude | `/catalogos` |
| Bitácora de auditoría | `/bitacora` |
| Mi cuenta | `/cuenta` |

## Requisitos

- **Node.js 22 o superior** (LTS) y npm.
- **Docker Desktop**, para MySQL y Mailpit del backend en desarrollo.
- El repositorio del **backend de ClickSafe** (NestJS + MySQL), con la API en
  <http://localhost:3000>.
- **Mailpit** en <http://localhost:8025>: ahí llegan los códigos de
  recuperación de contraseña (también los de los admins nuevos).
- Una **app de autenticación** (Google Authenticator, Microsoft
  Authenticator…): la verificación en dos pasos es obligatoria para todos los
  admins.

Los comandos de este README funcionan igual en PowerShell (Windows) y en zsh
(macOS).

## Levantar todo en local

### 1. Backend, MySQL y Mailpit

Resumen del README del backend (`Backend-ClickSafe/README.md`); los detalles
y los permisos exactos de la base están ahí. Los comandos son de PowerShell,
como en ese README.

1. **MySQL y Mailpit con Docker**, desde la raíz del repo del backend: copia
   `infra/.env.example` a `infra/.env`, pon un valor aleatorio en
   `MYSQL_ROOT_PASSWORD` y levanta los contenedores:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(24).toString('base64'))"
   docker compose -f infra/docker-compose.yml --env-file infra/.env up -d
   ```

   MySQL queda en `127.0.0.1:3306` y Mailpit en <http://localhost:8025>
   (SMTP en `127.0.0.1:1025`).

2. **Esquema y usuario de mínimo privilegio:** carga
   `database/clicksafe_db.sql` en el contenedor y crea el usuario
   `clicksafe_api` con los `GRANT` que lista el README del backend (la API
   nunca se conecta como root).

3. **API:** en `api/`, instala dependencias y crea su `.env`:

   ```powershell
   cd api
   npm install
   Copy-Item .env.example .env
   ```

   En `api/.env` pon un `JWT_ACCESS_SECRET` aleatorio (mínimo 32
   caracteres), en `DB_PASSWORD` la contraseña de `clicksafe_api`, y en
   `SEED_ADMIN_NOMBRE` / `SEED_ADMIN_CORREO` los datos del primer admin.

4. **Levantar la API y cargar los datos** (dentro de `api/`):

   ```powershell
   npm run start:dev    # API en http://localhost:3000
   npm run seed:admin   # crea el primer admin y muestra su contraseña UNA sola vez
   npm run seed:demo    # datos de ejemplo para el panel (requiere seed:admin antes)
   ```

   `seed:demo` es idempotente (solo crea lo que falta) y nunca corre con
   `NODE_ENV=production`. Crea más de 20 usuarios (uno suspendido), unos 25
   reportes en los 3 estados y en los últimos 12 meses (algunos anónimos y
   con evidencias), el reporte de moderación "[Demo moderación]", un reporte
   con título `<img src=x onerror=alert(1)>`, otro con la URL
   `https://mercadolibre.com.mx@estafa.example` y un segundo admin de demo.

### 2. Panel

En este repositorio:

```sh
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` solo necesita una variable (no es secreta y **nunca** llega al
navegador, porque no lleva el prefijo `NEXT_PUBLIC_`):

```sh
# Dirección del backend; Next reenvía /api/v1/* a esta URL
API_PROXY_TARGET=http://localhost:3000
```

Abre <http://localhost:3001>.

### 3. Cómo entrar

1. `npm run seed:admin` crea el admin con el nombre y correo de
   `SEED_ADMIN_NOMBRE` / `SEED_ADMIN_CORREO` y una **contraseña aleatoria
   de 24 caracteres que se muestra UNA sola vez en la consola** (no se
   escribe en ningún archivo). Cópiala en tu gestor de contraseñas en ese
   momento. Si ya existe cualquier admin, el script no crea ni cambia nada.
2. Inicia sesión en el panel con ese correo y esa contraseña.

   **Si perdiste la contraseña**, usa **"¿Olvidaste tu contraseña?"**: el
   código de 8 dígitos llega a Mailpit y ahí defines una nueva.
3. En el **primer login** el panel pide configurar la verificación en dos
   pasos: muestra un **QR**; escanéalo con tu app de autenticación y escribe
   el código de 6 dígitos.
4. Espera a que la app muestre un **código nuevo** y escríbelo en
   "Verificación en dos pasos". Ya estás dentro.

Las siguientes veces solo se pide el código de la app después de la
contraseña. Un usuario normal (no admin) no puede entrar al panel.

## Despliegue en el laboratorio

Escenario de la demo: el panel corre en una PC con Windows **sin Internet** y
se abre en el navegador de esa misma PC; la API está en otra PC de la red
aislada (por ejemplo `http://192.168.20.10:3000`), por HTTP y sin Nginx.

### Antes de ir

1. En tu PC, con Internet, deja la carpeta lista con las dependencias
   exactas (mismo instalador de Node que en el laboratorio):

   ```powershell
   npm ci
   ```

2. Copia la carpeta completa (incluido `node_modules`) a la PC del
   laboratorio. El build se hace allá (paso 2 de abajo): así queda con la
   dirección correcta de la API y con la ruta de esa PC.

> Recomendado: ensáyalo antes en tu PC con la red desconectada, copiando la
> carpeta a otra ruta y apuntando a una API en otra IP.

### En la PC del laboratorio

Desde la carpeta del panel, en PowerShell:

1. **Dirección de la API** en `.env.local`: solo `http://IP:puerto`,
   **sin** `/api/v1` (el panel lo agrega; con `/api/v1` las rutas quedarían
   duplicadas):

   ```powershell
   Set-Content -Encoding utf8 .env.local "API_PROXY_TARGET=http://192.168.20.10:3000"
   ```

   La dirección queda fijada **al compilar**: si cambia la IP de la API, hay
   que volver a correr el paso 2.

2. **Compilar ahí mismo** (no necesita Internet; se desactiva la telemetría
   de Next para que no intente conectarse):

   ```powershell
   $env:NEXT_TELEMETRY_DISABLED = "1"
   npm run build
   ```

3. **Arrancar solo para esta PC** (escucha en `127.0.0.1`: el panel no queda
   expuesto a la red y Windows no pide abrir el firewall):

   ```powershell
   npx next start -p 3001 -H 127.0.0.1
   ```

4. **Abrir <http://localhost:3001> en Chrome o Edge.** Usa siempre
   `localhost`, nunca la IP de la PC: el navegador solo trata `localhost`
   como contexto seguro, y sin eso no funcionan el captcha (Web Crypto) ni el
   botón "Copiar".

### Requisitos de red

- La PC del panel debe poder llegar a la API (`192.168.20.10:3000`): abre
  ese puerto en el firewall de la PC de la API.
- **No hace falta habilitar CORS en la API.** El navegador solo habla con
  `localhost:3001` y el servidor de Next reenvía `/api/v1` a la API, así que
  CORS debe seguir deshabilitado.

### Avisos para la demo

- **Reloj de la PC de la API (2FA):** el código TOTP depende de la hora. Si
  la PC de la API (sin Internet) tiene el reloj desfasado más de unos 30
  segundos respecto al celular con la app de autenticación, **la
  verificación en dos pasos falla**. Revisa y ajusta su hora al segundo
  antes de la demo.
- **Cierre por inactividad:** tras **15 minutos** sin usar el panel (mouse,
  teclado o scroll) se cierra la sesión; un minuto antes aparece el aviso
  "¿Sigues ahí?" con el botón **"Seguir conectado"**. Es un control de
  seguridad intencional: si se cierra durante la demo, vuelve a iniciar
  sesión.
- **Para mostrar el QR del 2FA** se necesita un admin que todavía no lo haya
  configurado (por ejemplo, el recién creado con `npm run seed:admin` en una
  base limpia; su contraseña solo aparece una vez en la consola).
- **Para validar o rechazar** hace falta un reporte pendiente que no haya
  creado el mismo admin (`npm run seed:demo` los crea).

## Cómo se conecta con la API

El navegador nunca habla directo con el backend. El panel pide todo a
`/api/v1/...` en su mismo origen y Next lo reenvía a `API_PROXY_TARGET`
(ver `rewrites` en [`next.config.ts`](next.config.ts)). En producción Nginx
hace lo mismo. Por eso **no se habilita CORS en el backend**.

El contrato de la API está en [`docs/openapi.json`](docs/openapi.json)
(copia del que exporta el backend con `npm run openapi:export`) y sus tipos en
`src/lib/types.ts`.

## Dónde está cada cosa

| Ruta | Qué hace |
|---|---|
| `src/proxy.ts` | Content Security Policy con nonce por petición |
| `next.config.ts` | rewrites hacia la API y cabeceras de seguridad |
| `src/lib/session.ts` | dónde viven los tokens (memoria y `sessionStorage`) |
| `src/lib/api.ts` | cliente axios, Bearer y refresco compartido del token |
| `src/lib/errors.ts` | `ApiError` y mensajes en español |
| `src/lib/admin-api.ts` | una función tipada por endpoint de la API |
| `src/lib/captcha.ts`, `captcha-solver.ts`, `captcha.worker.ts` | captcha ALTCHA resuelto en un Web Worker |
| `src/lib/auth-flow.ts` | login, verificación y configuración del 2FA |
| `src/lib/idle.ts`, `src/hooks/useIdleLogout.ts` | cierre de sesión por inactividad (15 min) |
| `src/lib/safe-url.ts` | análisis de URLs reportadas y validación de evidencias |
| `src/lib/audit.ts` | bitácora: fechas, nombres de acciones y datos sensibles ocultos |
| `src/lib/chart.ts`, `src/components/BarChart.tsx` | gráficas de barras en SVG hecho a mano |
| `src/components/ReportedUrl.tsx` | URL reportada: copiar o abrir con precaución |
| `src/app/(auth)/` | pantallas sin sesión (login, 2FA, recuperar) |
| `src/app/(panel)/` | pantallas del panel: guardia de sesión y barra lateral |
| `src/components/` | componentes base con CSS Modules |
| `tests/` | pruebas unitarias (Vitest) |
| `.github/` | CI (GitHub Actions) y Dependabot |
| `docs/seguridad.md` | cada control de seguridad y el ataque que previene |

## Scripts

| Comando         | Qué hace                                    |
|-----------------|---------------------------------------------|
| `npm run dev`   | servidor de desarrollo en el puerto 3001    |
| `npm run build` | compilación de producción                   |
| `npm start`     | sirve la compilación en el puerto 3001      |
| `npm run lint`  | ESLint                                      |
| `npm test`      | pruebas unitarias con Vitest                |

## Pruebas

```sh
npm test
```

Las pruebas simulan la API con un *adapter* falso de axios (no necesitan el
backend). Cubren, entre otras:

| # | Requerimiento de lectura de datos | Éxito | Fallo |
|---|---|---|---|
| 1 | Cargar estadísticas del dashboard (`tests/admin-reports.test.ts`) | datos agrupados correctos | 500 → "Algo salió mal de nuestro lado…" |
| 2 | Cargar cola de reportes pendientes (`tests/admin-reports.test.ts`) | 3 reportes pendientes | 403 → "No tienes permiso para hacer esto." |
| 3 | Cargar bitácora con filtros (`tests/catalogs-audit.test.ts`) | manda los parámetros correctos y devuelve la página | sin conexión → mensaje de conexión |

Además: `safe-url` rechaza `javascript:` y `data:`; el payload del captcha;
5 errores 401 simultáneos hacen **una sola** llamada a `/auth/refresh`; el
TOTP de "nuevo administrador" no queda en ningún error; datos sensibles
ocultos en la bitácora.

## Integración continua

Cada push a `main` y cada Pull Request corren en GitHub Actions
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)): `npm ci`, lint,
pruebas, build y `npm audit --omit=dev --audit-level=high`. CodeQL está
activo con el *default setup* del repositorio y Dependabot
([`.github/dependabot.yml`](.github/dependabot.yml)) revisa cada semana npm y
GitHub Actions.

## Lista de verificación final del panel

Con el backend (con `seed:admin` y `seed:demo`), Mailpit y `npm run dev`
corriendo. Usa una ventana privada y ten abierta la consola del navegador:
no debe haber errores de `script-src` (los avisos de `style-src-elem` de las
herramientas de desarrollo de Next y los que inyecta el navegador son
esperados; ver `docs/seguridad.md`).

### Autenticación y sesión

**Iniciar sesión (W01)**

- [ ] Con el correo o la contraseña vacíos aparece el error junto al campo y
      no se envía nada.
- [ ] Al enviar, el botón dice **"Verificando…"** (captcha) y luego
      **"Iniciando sesión…"**; no se puede pulsar dos veces.
- [ ] Con una contraseña incorrecta aparece **"Correo o contraseña
      incorrectos."** (y el mismo mensaje con una cuenta suspendida).
- [ ] Con un usuario **normal** (no admin) aparece **"Este panel es solo para
      administradores."**, no se entra al panel y en la bitácora del backend
      su sesión aparece cerrada (logout).
- [ ] En la pestaña Red, la petición a `/api/v1/auth/login` lleva el campo
      `captcha` y no hay peticiones a otros dominios.

**Configurar 2FA (W03) — admin nuevo o sin 2FA**

- [ ] Se muestra el QR y la clave agrupada de 4 en 4; **"Copiar"** la copia.
- [ ] Al escanear y escribir el código se pasa a "Verificación en dos pasos"
      con el aviso **"Espera a que tu app muestre un código nuevo"**.
- [ ] Recargar la página (F5) en esta pantalla regresa al login (el
      `mfaToken` solo vive en memoria).

**Verificar código (W02)**

- [ ] Un código incorrecto muestra **"Código incorrecto. Revisa tu app de
      autenticación."** y permite reintentar.
- [ ] Con un código correcto se entra al panel y la barra lateral muestra tu
      nombre.
- [ ] Esperar más de 5 minutos en esta pantalla y enviar un código regresa al
      login con **"Tu verificación expiró. Inicia sesión de nuevo."**
- [ ] En DevTools → Application: `sessionStorage` tiene solo
      `clicksafe.refreshToken`; `localStorage` y las cookies no tienen tokens.

**Sesión**

- [ ] Recargar el panel (F5) mantiene la sesión (se renueva con el refresh
      token). Cerrar la pestaña y abrir el panel en otra pide iniciar sesión.
- [ ] **"Cerrar sesión"** lleva al login; con el botón Atrás del navegador no
      se vuelve a ver el panel.
- [ ] Inactividad: para probarlo sin esperar 15 min, cambia temporalmente
      `IDLE_TIMEOUT_MS` en `src/lib/idle.ts` a `2 * 60_000` (no lo commitees).
      Al minuto aparece **"¿Sigues ahí?"**; mover el mouse no lo quita;
      **"Seguir conectado"** sí. Si no se pulsa, se cierra la sesión con
      **"Cerramos tu sesión por inactividad."**

**Recuperar contraseña (W04)**

- [ ] Con cualquier correo (exista o no) aparece **"Si el correo está
      registrado, recibirás un código de 8 dígitos."**
- [ ] El código llega a Mailpit; con un código incorrecto aparece **"Código
      incorrecto o expirado."**; con una contraseña común, **"Esa contraseña
      es muy común. Elige otra."**
- [ ] Si las contraseñas no coinciden o tienen menos de 8 caracteres, se
      avisa sin enviar.
- [ ] Con todo correcto se regresa al login con **"Contraseña actualizada.
      Inicia sesión."**

**Mi cuenta (W13)**

- [ ] Muestra correo, rol "Administrador", fecha de registro y
      "Verificación en dos pasos: Activa".
- [ ] Cambiar el nombre actualiza también la barra lateral.
- [ ] Cambiar la contraseña con la actual incorrecta muestra un error; con la
      correcta, un aviso de éxito.
- [ ] **"Cerrar sesión en todos los dispositivos"** pide confirmación y lleva
      al login; una sesión abierta en otro navegador también se cierra.

### Dashboard y reportes

**Dashboard (W05)**

- [ ] Las 4 tarjetas suman bien; "Pendientes" lleva a la cola.
- [ ] Gráficas por mes (12 meses, los vacíos en 0), plataforma ("Otra"
      agrupada), categoría y estado. "Ver datos" muestra la tabla con los
      mismos números. Al pasar el mouse por una barra se ve su valor.
- [ ] En modo oscuro las gráficas se leen bien.

**Reportes (W06)**

- [ ] La cola muestra primero el reporte más antiguo; las pestañas
      Pendientes / Validados / No validados / Todos filtran ("Todos" mezcla
      los tres estados); la paginación funciona.
- [ ] Un reporte anónimo muestra el nombre del autor con **"Anónimo para el
      público"**.
- [ ] La barra lateral muestra el número de pendientes junto a "Reportes".
- [ ] La URL del navegador no cambia al filtrar o cambiar de página.

**Detalle y revisión (W07)**

- [ ] El reporte de `seed:demo` con título `<img src=x onerror=alert(1)>`
      se ve como texto (en la cola y en el detalle) y no aparece ninguna
      alerta.
- [ ] El detalle muestra el número de comentarios del reporte.
- [ ] La URL reportada **no es clicable**; el dominio aparece grande. En el
      reporte de `seed:demo` con `https://mercadolibre.com.mx@estafa.example`
      aparece el aviso del "@" y el dominio `estafa.example`.
- [ ] **"Abrir con precaución"** muestra el aviso; al aceptar se abre en una
      pestaña nueva. En esa pestaña, en la consola, `window.opener` es `null`.
- [ ] Las evidencias se ven y se amplían. Tras 15 minutos en la página, al
      recargar una imagen se piden URLs nuevas solas.
- [ ] **"Quitar imagen"** pide confirmación y la imagen desaparece después.
- [ ] El comentario no pasa de 500 caracteres (contador).
- [ ] **"Validar fraude"** / **"Rechazar"** piden confirmación; al aceptar se
      vuelve a la cola con el aviso de éxito y el contador baja.
- [ ] Con un reporte creado por el mismo admin aparece **"No puedes revisar
      un reporte que tú creaste."** y no hay botones.
- [ ] Revisar el mismo reporte desde dos navegadores: el segundo ve
      **"Este reporte ya fue revisado por otro administrador."** y el estado
      actualizado.
- [ ] `/reportes/abc` y `/reportes/999999` muestran "No encontramos lo que
      buscas…".

### Moderación y usuarios

**Comentarios (W08)** — datos de demo: los comentarios del reporte
**"[Demo moderación]"** (uno `oculto_auto`, uno visible con denuncias, uno con
`<img src=x onerror=alert(1)>` y uno con una cadena larga sin espacios).

- [ ] La barra lateral muestra el número de comentarios por moderar junto a
      "Comentarios".
- [ ] El comentario con `<img src=x onerror=alert(1)>` se ve como texto y no
      aparece ninguna alerta. La cadena larga se parte sin salirse de la
      tarjeta; las palabras normales no se cortan.
- [ ] Cada tarjeta muestra estado ("Oculto automáticamente" / "Visible, con
      denuncias"), número de denuncias, autor (nombre y correo), fecha y
      "Ver reporte #N" (lleva al detalle de "[Demo moderación]").
- [ ] **"Denuncias pendientes"** lista cada denuncia con su motivo, fecha y
      detalle **como texto** ("Sin detalle." si no tiene). No aparece quién
      denunció.
- [ ] **"Confirmar ocultamiento"** dice que se avisará al autor;
      **"Restaurar"** dice que no se avisará a nadie. Al aceptar aparece el
      aviso de éxito, el comentario sale de la lista y el contador baja.
- [ ] Moderar el mismo comentario desde dos pestañas: la segunda muestra
      "Este comentario ya fue moderado por otro administrador. Actualizamos
      la lista." y la lista actualizada.

**Usuarios (W09)** — datos de demo: 23 usuarios `demo.usuario*`
(`demo.usuario23` suspendido) y el segundo admin
`demo.admin2@demo.clicksafe.local`.

- [ ] La búsqueda por nombre o correo funciona al pulsar "Buscar" (no en cada
      tecla), no pasa de 100 caracteres y **la URL no cambia**.
- [ ] La paginación funciona y "Limpiar" vuelve a la lista completa.
- [ ] Tu propia fila dice "Tu cuenta" y no tiene botones.
- [ ] Buscar `demo.usuario23` lo muestra como **Suspendido** con el botón
      "Reactivar".
- [ ] **"Suspender"** pide confirmación con "Se cerrarán todas sus sesiones
      de inmediato…". Con `demo.admin2` con sesión abierta en otro navegador,
      al suspenderlo su siguiente acción lo saca del panel. **"Reactivar"**
      (que avisa que sus sesiones anteriores no se recuperan) le devuelve el
      acceso.
- [ ] (Opcional) `LAST_ACTIVE_ADMIN` casi no se puede provocar desde el
      panel: quien suspende siempre es un admin activo y no puede
      suspenderse a sí mismo (`OWN_STATUS`). Solo ocurre si dos admins se
      suspenden mutuamente al mismo tiempo (tu cuenta y `demo.admin2`, cada
      uno en su navegador, confirmando a la vez): el segundo debe ver "No se
      puede suspender: el sistema se quedaría sin administradores activos."
      El mensaje está cubierto por las pruebas unitarias.

**Nuevo administrador (W10)**

- [ ] Sin nombre, con un correo inválido o con un código de menos de 6
      dígitos, se avisa junto al campo y no se envía nada.
- [ ] Pide confirmación mostrando nombre y correo.
- [ ] Con un código **incorrecto** aparece "No pudimos confirmar tu
      identidad…", el campo del código queda **vacío** y en la pestaña Red hay
      **una sola** petición a `/api/v1/admin/admins` (sin `/auth/refresh`).
- [ ] Con un código correcto aparece "Administrador creado. Le enviamos un
      correo…", el formulario queda vacío y en Mailpit llega el código de
      recuperación para la cuenta nueva.
- [ ] Con un correo ya registrado (por ejemplo `demo.admin2@demo.clicksafe.local`)
      aparece "Ya existe una cuenta con ese correo." y el código queda vacío.
- [ ] En DevTools → Application no aparece el código en `sessionStorage` ni
      `localStorage`.

### Catálogos y bitácora

**Catálogos (W11)**

- [ ] Pestañas **Plataformas** y **Categorías de fraude**; cada tabla
      muestra activas e inactivas (Activa / Inactiva).
- [ ] La plataforma **"Otra"** aparece como **Fija**, sin botones de editar
      ni desactivar.
- [ ] **"Agregar plataforma"** / **"Agregar categoría"** abren un diálogo; con
      el nombre vacío se avisa sin enviar. Al guardar aparece el aviso y la
      tabla se actualiza.
- [ ] **"Editar"** cambia el nombre (y la descripción en categorías).
- [ ] **"Desactivar"** pide confirmación con "Ya no aparecerá al crear
      reportes; los reportes existentes la conservan." y la fila pasa a
      Inactiva; **"Activar"** la regresa.
- [ ] No existe ningún botón para borrar.
- [ ] Agregar una plataforma con un nombre que ya existe muestra "Ya existe
      un elemento con ese nombre." (cuando el backend publique
      `CATALOG_NAME_TAKEN`; ver "Pendientes").

**Bitácora (W12)**

- [ ] La tabla muestra Fecha y hora · Acción (en español) · Resultado ·
      Usuario (nombre y correo, o "Sin usuario") · Recurso · IP · Detalle;
      está paginada y no tiene acciones de escritura.
- [ ] Después de probar el panel aparecen, con su nombre en español, las
      acciones que hiciste: "Reporte revisado", "Comentario moderado",
      "Usuario suspendido", "Administrador creado", "Catálogo modificado"…
- [ ] Filtrar por acción (por ejemplo `reporte_revisado`), por ID de usuario
      y por rango de fechas cambia los resultados; **la URL no cambia**.
      "Limpiar" quita los filtros.
- [ ] Un rango con "desde" posterior a "hasta" se avisa sin consultar.
- [ ] Los cuatro filtros quedan a la misma altura; "Acción" muestra
      "Todas (elige de la lista)" y despliega las acciones en español.
- [ ] "Ver" abre un diálogo a lo ancho con los datos del evento, el detalle
      como texto (JSON, con scroll si es largo) y el navegador. Se cierra con
      "Cerrar" o Esc. Un intento de login con un correo inexistente aparece
      con "Sin usuario".

### Seguridad general

- [ ] `curl -I http://localhost:3001/login` muestra `content-security-policy`
      con un nonce distinto en cada petición, `x-content-type-options`,
      `x-frame-options: DENY`, `referrer-policy: no-referrer`,
      `permissions-policy`, `cross-origin-opener-policy` y **ninguna**
      `x-powered-by`.
- [ ] Con `npm run build` + `npm start` en una ventana privada sin
      extensiones, la consola no muestra avisos de CSP.
- [ ] DevTools → Application: solo `clicksafe.refreshToken` en
      `sessionStorage`; nada en `localStorage` ni cookies del panel.
- [ ] Una ruta inexistente muestra "No encontramos esta página" con estilos
      (sin avisos de CSP).

## Pendientes conocidos

- **`braces` (Dependabot #1, solo desarrollo) — riesgo aceptado:** `npm
  audit` (sin `--omit=dev`) reporta 5 avisos altos que vienen de una sola
  falla en `braces`, a través de `eslint-config-next` →
  `@next/eslint-plugin-next` → `fast-glob` → `micromatch`. **No existe versión
  corregida** (el aviso oficial marca `<= 3.0.3` con
  `first_patched_version: null`), así que no se puede resolver con
  `overrides`; `npm audit fix --force` bajaría `eslint-config-next` a la 14
  (incompatible con Next 16) y **no se debe ejecutar**. `npm audit
  --omit=dev` reporta 0: no llega al sitio. El equipo cerró la alerta como
  riesgo tolerable; justificación en `docs/seguridad.md`. Dependabot la
  reabre si sale una versión corregida.
- **Catálogos — nombre duplicado:** el panel ya muestra "Ya existe un
  elemento con ese nombre." para un 409 con `code: 'CATALOG_NAME_TAKEN'`,
  pedido al backend. Cuando lo publique, hay que actualizar
  `docs/openapi.json`.
- **Bitácora — lista de acciones:** las 18 acciones se tomaron del tipo
  cerrado `AuditAction` del backend (`api/src/audit/audit-action.type.ts`),
  porque el OpenAPI declara `accion` como texto libre. Conviene que el
  backend la publique como `enum` en el OpenAPI; si agrega una acción nueva,
  el panel la muestra con su código hasta agregarla en `src/lib/audit.ts`.
- **`GET /me` no trae `id`:** en Usuarios la fila propia se reconoce por
  correo. Es solo comunicación; la API rechaza cambiar el estado propio.
- **Filtro `usuario` de la bitácora:** es el ID numérico del usuario.
