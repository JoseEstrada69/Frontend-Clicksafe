import Link from 'next/link';
import { formatNumber } from '@/lib/format';
import styles from './StatCard.module.css';

interface StatCardProps {
  label: string;
  value: number;
  /** Si se da, la tarjeta completa es un enlace. */
  href?: string;
  tone?: 'default' | 'pending' | 'validated' | 'rejected';
}

export function StatCard({ label, value, href, tone = 'default' }: StatCardProps) {
  const content = (
    <>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{formatNumber(value)}</span>
    </>
  );
  const className = `${styles.card} ${styles[tone]}`;
  return href ? (
    <Link href={href} className={`${className} ${styles.link}`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
