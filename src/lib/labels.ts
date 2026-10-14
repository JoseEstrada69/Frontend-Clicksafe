import type { ReportState } from './types';

// Textos visibles para los valores de la API (mismos textos que la app iOS).

export const REPORT_STATE_LABEL: Record<ReportState, string> = {
  pendiente: 'Pendiente de revisión',
  validado: 'Fraude validado',
  rechazado: 'No validado',
};

/** Plataforma de un reporte: si es "Otra", se muestra el nombre que escribió el autor. */
export function platformLabel(report: {
  plataforma: { nombre: string };
  plataformaOtra: string | null;
}): string {
  return report.plataformaOtra
    ? `${report.plataforma.nombre}: ${report.plataformaOtra}`
    : report.plataforma.nombre;
}
