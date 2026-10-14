import Link from 'next/link';
import { Logo } from '@/components/Logo';
import styles from './not-found.module.css';

// 404 propio: la página por defecto de Next usa atributos style="" que la
// CSP (style-src sin 'unsafe-inline') bloquea.
export default function NotFound() {
  return (
    <main className={styles.main}>
      <Logo size="large" />
      <h1>No encontramos esta página</h1>
      <p className={styles.text}>
        Puede que la dirección esté mal escrita o que la página ya no exista.
      </p>
      <Link href="/">Ir al inicio</Link>
    </main>
  );
}
