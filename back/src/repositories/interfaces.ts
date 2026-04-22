export interface SalePersonsRow {
  id: number;
  email: string;
  name: string;
}

export interface CompaniesRow {
  id: number;
  sale_person_id: number | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  sector: string | null;
  main_activity: string | null;
  siret: string | null;
  idcc: string | null;
  ape: string | null;
  notes: string | null;
  conclusion: string | null;
}

export interface AnalyseBesoinRow {
  id: number;
  token: string;
  entreprise_id: number;
  sale_person_id: number | null;
  campus: 'Nord' | 'Ouest' | 'Sud';
  statut: 'brouillon' | 'envoyee' | 'validee' | 'signee' | 'archivee';
  raison_sociale: string | null;
  siret: string | null;
  adresse_siege: string | null;
  code_postal: string | null;
  commune: string | null;
  rl_nom: string | null;
  rl_fonction: string | null;
  rl_telephone: string | null;
  rl_email: string | null;
  rr_same_as_rl: number;
  rr_nom: string | null;
  rr_fonction: string | null;
  rr_telephone: string | null;
  rr_email: string | null;
  presentation_activite: string | null;
  nb_postes: number | null;
  localisation_poste: string | null;
  domaine: 'Secretariat' | 'Vente' | null;
  intitule_poste: string | null;
  missions: string | null;
  autres_missions: string | null;
  profils_recherches: string | null;
  competences: string | null;
  commentaires: string | null;
  niveau_formation: string | null;
  permis: string | null;
  experience: string | null;
  age_exige: string | null;
  methode_recrutement: string | null;
  pmsmp: string | null;
  jours_formation: string | null;
  fait_a: string | null;
  fait_le: Date | string | null;
  is_signed: number;
  yousign_procedure_id: string | null;
  pdf_url: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}