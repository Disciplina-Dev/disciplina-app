import { Outlet } from 'react-router-dom'
import PublicLegalFooter from './PublicLegalFooter'

/**
 * Encadre les portails accessibles par lien signé (`/public/*`, `/booking/*`)
 * afin d'y adjoindre les mentions légales exigées (RGPD.md, Faille 15).
 *
 * Route de layout plutôt qu'un montage page par page : les portails comportent
 * plusieurs branches de rendu (chargement, erreur, lien expiré, succès) et le
 * pied de page doit apparaître dans toutes.
 */
export default function PublicPortalLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Outlet />
      <PublicLegalFooter />
    </div>
  )
}
