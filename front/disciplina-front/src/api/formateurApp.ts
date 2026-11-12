import { apiJson } from '@/api/httpClient'
import type { FormateurDashboard } from '@/types/formateur'

/**
 * Espace formateur. Le backend résout la fiche à partir de la session : aucun
 * identifiant n'est transmis par le client, un formateur ne peut donc pas
 * demander les données d'un autre intervenant.
 */
export async function fetchFormateurDashboard(): Promise<FormateurDashboard> {
  return apiJson<FormateurDashboard>('/api/formateur/me')
}
