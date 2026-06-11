import type { Company, CompanyWithSalePerson, SalePerson, Entreprise, EntrepriseStatus, CompanyInput } from '@/types/entreprise'

export function toEntreprise(company: Company, salePerson: SalePerson | null): Entreprise {
  const isStatusOnly = ['Oui', 'Non', 'À Réfléchir'].includes(company.conclusion || '');
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
    conclusion: isStatusOnly ? '' : company.conclusion,
    status: (isStatusOnly ? company.conclusion : 'À Réfléchir') as EntrepriseStatus,
    date_insertion: new Date().toISOString().split('T')[0],
    date_relance: company.relanceDate ?? null,
    type_relance: company.relanceType ?? null,
    relance_template_id: company.relanceTemplateId ?? null,
  }
}

export function toEntrepriseFromCompanyWithSalePerson(data: CompanyWithSalePerson): Entreprise {
  return toEntreprise(data.company, data.salePerson)
}

export function toCompany(entreprise: Partial<Entreprise>): CompanyInput {
  return {
    userID: entreprise.proprietaire_id ? Number(entreprise.proprietaire_id) : 1,
    name: entreprise.nom_commercial || '',
    phone: entreprise.telephone || null,
    email: entreprise.email || null,
    address: entreprise.adresse || '',
    sector: entreprise.secteur || '',
    mainActivity: entreprise.metier || null,
    siret: entreprise.siret || '',
    idcc: entreprise.idcc || null,
    ape: null,
    notes: entreprise.note || null,
    conclusion: entreprise.conclusion || entreprise.status || 'À Réfléchir',
    relanceDate: entreprise.date_relance || null,
    relanceType: entreprise.type_relance ?? null,
    relanceTemplateId: entreprise.relance_template_id || null,
  };
};
