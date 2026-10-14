import { reviewReport } from './admin-api';
import { toApiError } from './errors';
import type { ReviewDecision } from './types';

// Revisión de un reporte (W07), sin React para poder probarla.

export type ReviewResult =
  | { ok: true }
  | {
      ok: false;
      /**
       * Otro admin ya lo revisó (REPORT_NOT_EDITABLE): hay que recargar el
       * detalle para mostrar el estado real.
       */
      stale: boolean;
      /** Mensaje propio para mostrar (nunca el del servidor). */
      message: string;
    };

/**
 * POST /admin/reports/:id/review. La API cambia el estado de forma atómica
 * (solo si sigue `pendiente`); si alguien se adelantó responde 400
 * REPORT_NOT_EDITABLE y el reporte queda como lo dejó el primero.
 */
export async function submitReview(
  reportId: number,
  decision: ReviewDecision,
  comentario?: string,
): Promise<ReviewResult> {
  try {
    await reviewReport(reportId, decision, comentario);
    return { ok: true };
  } catch (e) {
    const error = toApiError(e);
    return {
      ok: false,
      stale: error.code === 'REPORT_NOT_EDITABLE',
      message: error.userMessage,
    };
  }
}
