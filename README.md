# ClickSafe — Panel de administración

Panel web **solo para administradores** de ClickSafe, la red social para
reportar publicaciones sospechosas de fraude en tiendas en línea
(*"Consulta antes de comprar"*). Hecho con Next.js 16 (App Router), React 19
y TypeScript.

> Proyecto en construcción. Las reglas de trabajo, de seguridad y de diseño
> están en [`CLAUDE.md`](CLAUDE.md).

## Requisitos

- Node.js 22 o superior (LTS) y npm.
- La API de ClickSafe (NestJS) corriendo en <http://localhost:3000>.
- Mailpit en <http://localhost:8025>: ahí llegan los códigos de recuperación
  de contraseña.
- Una app de autenticación (Google Authenticator, Microsoft Authenticator…)
  para la verificación en dos pasos, obligatoria para todos los admins.

## Correr en desarrollo

Los comandos funcionan igual en PowerShell (Windows) y en zsh (macOS).

1. Instala las dependencias:

   ```sh
   npm install
   ```

2. Copia `.env.example` como `.env.local` y ajusta `API_PROXY_TARGET` si tu
   backend no está en `http://localhost:3000`.

   ```sh
   cp .env.example .env.local
   ```

3. Levanta el panel:

   ```sh
   npm run dev
   ```

4. Abre <http://localhost:3001>.

## Cómo se conecta con la API

El navegador nunca habla directo con el backend. El panel pide todo a
`/api/v1/...` en su mismo origen y Next lo reenvía a `API_PROXY_TARGET`
(ver `rewrites` en [`next.config.ts`](next.config.ts)). En producción Nginx
hace lo mismo. Por eso **no se habilita CORS en el backend**.

El contrato de la API está en [`docs/openapi.json`](docs/openapi.json)
(copia del que exporta el backend) y sus tipos en `src/lib/types.ts`.

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
| `src/lib/chart.ts`, `src/components/BarChart.tsx` | gráficas de barras en SVG hecho a mano |
| `src/components/ReportedUrl.tsx` | URL reportada: copiar o abrir con precaución |
| `src/app/(auth)/` | pantallas sin sesión (login, 2FA, recuperar) |
| `src/app/(panel)/` | pantallas del panel: guardia de sesión y barra lateral |
| `src/components/` | componentes base con CSS Modules |
| `docs/seguridad.md` | cada control de seguridad y el ataque que previene |

## Scripts

| Comando         | Qué hace                                    |
|-----------------|---------------------------------------------|
| `npm run dev`   | servidor de desarrollo en el puerto 3001    |
| `npm run build` | compilación de producción                   |
| `npm start`     | sirve la compilación en el puerto 3001      |
| `npm run lint`  | ESLint                                      |
| `npm test`      | pruebas unitarias con Vitest                |

## Lista de verificación manual (autenticación)

Con el backend, Mailpit y `npm run dev` corriendo. Usa una ventana privada y
ten abierta la consola del navegador (no debe haber errores de `script-src`).

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

## Lista de verificación manual (dashboard y reportes)

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

- [ ] Crea (desde la app o la API) un reporte con título
      `<img src=x onerror=alert(1)>`: se ve como texto y no aparece ninguna
      alerta.
- [ ] El detalle muestra el número de comentarios del reporte.
- [ ] La URL reportada **no es clicable**; el dominio aparece grande. Con
      `https://mercadolibre.com.mx@ejemplo.com` aparece el aviso del "@" y el
      dominio `ejemplo.com`.
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

## Lista de verificación manual (moderación y usuarios)

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

## Pendientes conocidos

- **`npm audit` reporta 5 vulnerabilidades altas** en `braces`
  ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)),
  que llega a través de `eslint-config-next` → `@next/eslint-plugin-next` →
  `fast-glob` → `micromatch`. Solo afecta herramientas de desarrollo (ESLint):
  `npm audit --omit=dev` reporta 0 vulnerabilidades, así que no llega al
  sitio. No hay versión corregida de `braces`, y `npm audit fix --force`
  bajaría `eslint-config-next` a la 14, incompatible con Next 16, por lo que
  **no se debe ejecutar**. Se resuelve en la Fase 6.
- **`GET /me` no trae `id`:** en Usuarios (W09) la fila propia se reconoce
  por correo. Es solo comunicación; la API rechaza cambiar el estado propio.
- **Bitácora (Fase 5):** cada entrada ya trae `usuario: { nombre, correo }`
  (o `null` si el evento no tiene usuario, por ejemplo un login con un correo
  inexistente); el filtro `usuario` sigue siendo el id numérico.
