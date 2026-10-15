import type { CommentState, FlagReason, ReportState, Rol } from './types';

// Textos visibles para los valores de la API (mismos textos que la app iOS).

export const REPORT_STATE_LABEL: Record<ReportState, string> = {
  pendiente: 'Pendiente de revisión',
  validado: 'Fraude validado',
  rechazado: 'No validado',
};

export const COMMENT_STATE_LABEL: Record<CommentState, string> = {
  visible: 'Visible, con denuncias',
  oculto_auto: 'Oculto automáticamente',
  oculto_admin: 'Oculto por un administrador',
  eliminado: 'Eliminado',
};

export const FLAG_REASON_LABEL: Record<FlagReason, string> = {
  spam: 'Spam',
  acoso: 'Acoso',
  lenguaje_ofensivo: 'Lenguaje ofensivo',
  informacion_personal: 'Información personal',
  otro: 'Otro',
};

export const ROLE_LABEL: Record<Rol, string> = {
  usuario: 'Usuario',
  admin: 'Administrador',
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
