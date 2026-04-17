import type { Company, CompanyWithSalePerson, SalePerson, Entreprise, EntrepriseStatus, CompanyInput } from '@/types/entreprise'

export function toEntreprise(company: Company, salePerson: SalePerson | null): Entreprise {
  return {
    id: String(company.id),
    nom_commercial: company.name,
    proprietaire_contact: null,
    commercial: salePerson?.name ?? null,
    proprietaire_id: null,
    representant_legal: null,
    telephone: company.phone,
    email: company.email,
    adresse: company.address,
    secteur: company.sector,
    metier: company.mainActivity,
    siret: company.siret,
    idcc: company.idcc,
    note: company.notes,
    conclusion: company.conclusion,
    status: (company.conclusion as EntrepriseStatus) ?? 'À Réfléchir',
    date_insertion: new Date().toISOString().split('T')[0],
    date_relance: '',
  }
}

export function toEntrepriseFromCompanyWithSalePerson(data: CompanyWithSalePerson): Entreprise {
  return toEntreprise(data.company, data.salePerson)
}

export function toCompany(entreprise: Partial<Entreprise>): CompanyInput {
  return {
    salePersonID: entreprise.proprietaire_id || 1,
    name: entreprise.nom_commercial || null,
    phone: entreprise.telephone || null,
    email: entreprise.email || null,
    address: entreprise.adresse || null,
    sector: entreprise.secteur || null,
    mainActivity: entreprise.metier || null,
    siret: entreprise.siret || null,
    idcc: entreprise.idcc || null,
    ape: null,
    notes: entreprise.note || null,
    conclusion: entreprise.conclusion || null
  };
};