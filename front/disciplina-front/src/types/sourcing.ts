import type { CompanyWithSalePerson } from "@/types/entreprise";

export interface SireneAdresse {
  numeroVoie: string | null;
  typeVoie: string | null;
  libelleVoie: string | null;
  codePostal: string | null;
  commune: string | null;
  codeCommune: string | null;
}

export interface SireneEtablissement {
  siren: string;
  nic: string;
  siret: string;
  siegeSocial: boolean;
  etatAdministratif: "A" | "F";
  categorieEntreprise: string | null;
  categorieJuridique: string | null;
  denomination: string | null;
  nomPrenom: string | null;
  adresse: SireneAdresse;
  alreadyExists?: boolean;
}

export interface BlacklistedCompanyInfo {
  name: string | null;
  siret: string | null;
  conclusion: string | null;
}

export interface SirenSearchResult {
  siren: string;
  companiesWithSale: CompanyWithSalePerson[];
  etablissements: SireneEtablissement[];
  blacklisted: BlacklistedCompanyInfo[];
  allBlacklisted: boolean;
  message?: string;
}

export const normalizeSiret = (raw: string): string =>
  (raw || "").replace(/\D/g, "");

export const formatSiret = (digits: string): string => {
  const d = normalizeSiret(digits);
  const parts = [
    d.slice(0, 3),
    d.slice(3, 6),
    d.slice(6, 9),
    d.slice(9, 14),
  ].filter(Boolean);
  return parts.join(" ");
};

export const formatSiren = (digits: string): string => {
  const d = normalizeSiret(digits);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)]
    .filter(Boolean)
    .join(" ");
};

export const displayName = (e: SireneEtablissement): string =>
  (e.denomination || e.nomPrenom || "Établissement").trim();

export const displayCity = (a: SireneAdresse): string => {
  if (!a.commune && !a.codePostal) return "";
  if (a.commune && a.codePostal) return `${a.commune} (${a.codePostal})`;
  return a.commune || a.codePostal || "";
};

export const displayAddress = (a: SireneAdresse): string => {
  const street = [a.numeroVoie, a.typeVoie, a.libelleVoie]
    .filter(Boolean)
    .join(" ")
    .trim();
  const city = displayCity(a);
  return [street, city].filter(Boolean).join(", ");
};
