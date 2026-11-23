const API_BASE = import.meta.env.VITE_API_URL

/**
 * Lien « Ouvrir l'AB dans le Drive » : le backend redirige vers le PDF de l'AB
 * archivé sur le Drive (résolu à la demande pour les AB antérieures au champ
 * `ab_drive_url`). Authentifié par le cookie de session.
 */
export function needsAnalysisAbDriveUrl(id: string): string {
  return `${API_BASE}/api/needs-analysis/${encodeURIComponent(id)}/ab-drive`
}
