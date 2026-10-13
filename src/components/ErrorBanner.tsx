import type { ApiError } from '@/lib/errors';
import { Button } from './Button';
import styles from './ErrorBanner.module.css';

interface ErrorBannerProps {
  error: ApiError;
  onRetry?: () => void;
}

/** Muestra solo el mensaje propio del ApiError, nunca el del servidor. */
export function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  return (
    <div role="alert" className={styles.banner}>
      <div>
        <p className={styles.message}>{error.userMessage}</p>
        {error.supportCode && (
          <p className={styles.support}>
            Código de soporte: <code>{error.supportCode}</code>
          </p>
        )}
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
