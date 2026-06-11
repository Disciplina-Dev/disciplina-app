export const formatErrorMessage = (errorMsg: string, siret?: string | null): string => {
  if (errorMsg.includes("Duplicate entry") && errorMsg.includes("companies.siret")) {
    const extractedSiret = siret || errorMsg.match(/'(\d+)'/)?.[1] || "";
    return `Cette entreprise (SIRET ${extractedSiret}) existe déjà dans le portefeuille. Vous pouvez la retrouver en utilisant la barre de "Recherche SIRET" en haut à droite de la page.`;
  }
  if (errorMsg.includes("siret must be 14 characters") || errorMsg.includes("SIRET must be 14 characters")) {
    return "Le SIRET doit faire exactement 14 chiffres.";
  }
  if (errorMsg.includes("Unauthorized") || errorMsg.includes("Forbidden")) {
    return "Session expirée ou droits insuffisants. Veuillez vous reconnecter.";
  }
  return errorMsg;
};
