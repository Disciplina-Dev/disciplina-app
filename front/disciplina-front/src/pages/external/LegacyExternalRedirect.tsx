import { Navigate, useParams } from "react-router-dom";

// Redirige les anciens liens d'accès externe (/public/*, format des emails envoyés
// avant la migration vers external_access) vers l'entrée d'authentification actuelle.
export default function LegacyExternalRedirect() {
  const { signature = '' } = useParams();
  return <Navigate to={`/external/authenticate?sig=${signature}`} replace />;
}