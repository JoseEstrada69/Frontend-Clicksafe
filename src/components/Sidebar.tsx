'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useId, useState } from 'react';
import { Logo } from './Logo';
import styles from './Sidebar.module.css';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/reportes', label: 'Reportes' },
  { href: '/comentarios', label: 'Comentarios' },
  { href: '/usuarios', label: 'Usuarios' },
  { href: '/catalogos', label: 'Catálogos' },
  { href: '/bitacora', label: 'Bitácora' },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === '/'
    ? pathname === '/'
    : pathname === href || pathname.startsWith(`${href}/`);
}

interface SidebarProps {
  adminName: string;
  /** Contadores junto a los enlaces (por ejemplo, reportes pendientes). */
  counts?: Partial<Record<string, number | null>>;
  signingOut: boolean;
  onSignOut: () => void;
}

export function Sidebar({
  adminName,
  counts = {},
  signingOut,
  onSignOut,
}: SidebarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <Link href="/" className={styles.brand}>
          <Logo />
          <span>ClickSafe · Admin</span>
        </Link>
        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? 'Cerrar menú' : 'Menú'}
        </button>
      </div>

      <div
        id={menuId}
        className={`${styles.menu} ${menuOpen ? styles.menuOpen : ''}`}
      >
        <nav aria-label="Secciones del panel">
          <ul className={styles.links}>
            {LINKS.map(({ href, label }) => {
              const active = isActive(pathname, href);
              const count = counts[href];
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`${styles.link} ${active ? styles.active : ''}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    {label}
                    {typeof count === 'number' && count > 0 && (
                      <span className={styles.count}>
                        {count > 99 ? '99+' : count}
                        <span className="visually-hidden"> pendientes</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={styles.account}>
          <p className={styles.adminName}>{adminName}</p>
          <Link
            href="/cuenta"
            className={`${styles.link} ${isActive(pathname, '/cuenta') ? styles.active : ''}`}
            aria-current={isActive(pathname, '/cuenta') ? 'page' : undefined}
            onClick={() => setMenuOpen(false)}
          >
            Mi cuenta
          </Link>
          <button
            type="button"
            className={styles.signOut}
            onClick={onSignOut}
            disabled={signingOut}
          >
            {signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </div>
      </div>
    </aside>
  );
}
