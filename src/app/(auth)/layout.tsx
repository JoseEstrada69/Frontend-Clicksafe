import styles from './auth.module.css';

// Pantallas sin sesión (login, 2FA, recuperar contraseña): sin barra lateral
export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return <main className={styles.main}>{children}</main>;
}
