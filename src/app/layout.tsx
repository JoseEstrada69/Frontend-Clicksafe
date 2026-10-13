import type { Metadata } from 'next';
import { connection } from 'next/server';
import './globals.css';

export const metadata: Metadata = {
  title: 'ClickSafe · Admin',
  description: 'Panel de administración de ClickSafe',
  // Panel privado: que los buscadores no lo indexen
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  // Renderizar en cada petición (no en el build): así Next lee el nonce que
  // src/proxy.ts pone en la CSP de esa petición y lo aplica a sus <script>.
  // Una página generada en el build no tendría nonce y la CSP la bloquearía.
  await connection();

  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
