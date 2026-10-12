# Agenda de contactos — front

Front en Next.js para la API de la agenda: login, guardado de tokens en
`localStorage`, envío de `Authorization: Bearer` y refresco del access token.

## Correr

1. El backend de la agenda corriendo en <http://localhost:3000>, con
   `app.enableCors();` en su `main.ts`.
2. En esta carpeta:

   ```bash
   npm install
   npm run dev
   ```

3. Abre <http://localhost:3001>.

Si tu API vive en otra dirección, crea `.env.local` con
`NEXT_PUBLIC_API_URL=http://<host>:<puerto>` y reinicia `npm run dev`.

## Dónde está cada cosa

| Archivo                  | Qué hace                                             |
|--------------------------|------------------------------------------------------|
| `src/lib/api.ts`         | tokens, cliente axios, interceptores, login y logout |
| `src/app/login/page.tsx` | formulario de login                                  |
| `src/app/page.tsx`       | página protegida: lista de contactos                 |
