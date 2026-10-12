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

## Scripts

| Comando         | Qué hace                                    |
|-----------------|---------------------------------------------|
| `npm run dev`   | servidor de desarrollo en el puerto 3001    |
| `npm run build` | compilación de producción                   |
| `npm start`     | sirve la compilación en el puerto 3001      |
| `npm run lint`  | ESLint                                      |
| `npm test`      | pruebas unitarias con Vitest                |

## Pendientes conocidos

- **`npm audit` reporta 5 vulnerabilidades altas** en `braces`
  ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)),
  que llega a través de `eslint-config-next` → `@next/eslint-plugin-next` →
  `fast-glob` → `micromatch`. Solo afecta herramientas de desarrollo (ESLint):
  `npm audit --omit=dev` reporta 0 vulnerabilidades, así que no llega al
  sitio. No hay versión corregida de `braces`, y `npm audit fix --force`
  bajaría `eslint-config-next` a la 14, incompatible con Next 16, por lo que
  **no se debe ejecutar**. Se resuelve en la Fase 6.
