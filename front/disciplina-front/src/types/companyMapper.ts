import type { Company, CompanyWithSalePerson, SalePerson, Entreprise, EntrepriseStatus, CompanyInput } from '@/types/entreprise'
import { STATUS_VALUES } from '@/types/entreprise'
import { fullName } from '@/store/authStore'

export function toEntreprise(company: Company, salePerson: SalePerson | null): Entreprise {
  // Legacy rows stored the status in the conclusion column; fall back to it.
  const legacyStatus = (STATUS_VALUES as string[]).includes(company.conclusion || '')
    ? (company.conclusion as EntrepriseStatus)
    : null;
  const status = (STATUS_VALUES as string[]).includes(company.status || '')
    ? (company.status as EntrepriseStatus)
    : legacyStatus ?? 'À Réfléchir';
  return {
    id: String(company.id),
    nom_commercial: company.name,
    proprietaire_contact: null,
    commercial: salePerson ? fullName(salePerson) : null,
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
    conclusion: legacyStatus ? '' : company.conclusion,
    status,
    date_insertion: company.createdAt ?? null,
    date_relance: company.relanceDate ?? null,
    type_relance: company.relanceType ?? null,
    relance_template_id: company.relanceTemplateId ?? null,
    relance_channel: company.relanceChannel ?? null,
  }
}

export function toEntrepriseFromCompanyWithSalePerson(data: CompanyWithSalePerson): Entreprise {
  return toEntreprise(data.company, data.salePerson)
}

export function toCompany(entreprise: Partial<Entreprise>): CompanyInput {
  return {
    // Pas de propriétaire explicite : laisser le back décider (il force le
    // créateur pour COMMERCIAL/RESPONSABLE). Ne jamais envoyer un id en dur,
    // qui casserait la FK companies.user_id → users.id.
    userID: entreprise.proprietaire_id ? Number(entreprise.proprietaire_id) : null,
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
    conclusion: entreprise.conclusion ?? '',
    status: entreprise.status || 'À Réfléchir',
    relanceDate: entreprise.date_relance || null,
    relanceType: entreprise.type_relance ?? null,
    relanceTemplateId: entreprise.relance_template_id || null,
    relanceChannel: entreprise.relance_channel || null,
  };
};
