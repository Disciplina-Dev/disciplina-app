import { TitleProfessionalType, SchoolLevel, SkillLevel } from '@/types/candidate'

export interface SchoolLevelOption {
  value: SchoolLevel
  label: string
}

export interface SkillOption {
  competence: string
  level: SkillLevel
}

export interface CandidateTemplate {
  hasEnglishLevel: boolean
  schoolLevels: SchoolLevelOption[]
  availableSectors: string[]
  availableExpectedSkills: string[]
  defaultSkillsAssessment: SkillOption[]
}

const COMMERCIAL_SECTORS = [
  'Boulangerie',
  'Station de service',
  'Mode/Textile (Bijoux/Cosmétique)',
  'Téléphonie/Audio/Vidéo',
  'Libre service/Alimentation',
  'Restauration',
  'Automobile',
  'Immobilier',
  'Assurance',
  'Animaux',
  'Sport',
  'Enfant',
  'Bazar',
]

const ADMIN_SECTORS = [
  'BTP',
  'Association',
  'Médical',
  'Téléphonie/Audio/Vidéo',
  'Energie',
  'Commerce',
  'Automobile',
  'Import/Export',
  'Social',
]

const COMMERCIAL_SKILLS = [
  'Accueil physique',
  'Accueil téléphonique',
  'Encaissement',
  'Mise en place des rayons',
  'Gestion de stock',
  'Bonne orthographe',
  'Bonne élocution',
  'Autonomie',
  'Polyvalence',
  'Gestion du stress',
  'Rapidité',
]

const ADMIN_SKILLS = [
  'Bonne orthographe',
  'Bonne élocution',
  'Gestion des plannings',
  'Traitement des mails et appels',
  'Connaissances en comptabilité',
  'Connaissances en ressources humaines',
  'Connaissances en gestion de paie',
  'Compte rendu / Synthèse',
  'Devis / Factures / Bons de commandes',
  'Autonomie',
  'Polyvalence',
  'Gestion du stress',
  'Rapidité',
]

function ne(competences: string[]): SkillOption[] {
  return competences.map((competence) => ({ competence, level: SkillLevel.NE }))
}

export const CANDIDATE_TEMPLATES: Record<TitleProfessionalType, CandidateTemplate> = {
  [TitleProfessionalType.CC]: {
    hasEnglishLevel: false,
    schoolLevels: [
      { value: SchoolLevel.CAP_BEP_WITH_1Y_EXP, label: "CAP / BEP avec 1 an d'expérience professionnelle" },
      { value: SchoolLevel.PREMIERE_TERMINALE, label: 'Classe de première / terminale' },
      { value: SchoolLevel.BAC_PLUS, label: 'BAC et plus' },
    ],
    availableSectors: COMMERCIAL_SECTORS,
    availableExpectedSkills: COMMERCIAL_SKILLS,
    defaultSkillsAssessment: ne([
      'Assurer une veille professionnelle et commerciale',
      "Mettre en œuvre un plan d'actions commerciales et organiser son activité",
      'Mettre en œuvre la démarche de prospection',
      'Analyser ses performances commerciales et en rendre compte',
      "Représenter l'entreprise et contribuer à la valorisation de son image",
      "Conseiller le client en conduisant l'entretien de vente",
      'Assurer le suivi de ses ventes',
      "Fidéliser en consolidant l'expérience client",
    ]),
  },

  [TitleProfessionalType.SA]: {
    hasEnglishLevel: false,
    schoolLevels: [
      { value: SchoolLevel.CAP_BEP_WITH_1Y_EXP, label: "CAP / BEP avec 1 an d'expérience professionnelle" },
      { value: SchoolLevel.PREMIERE_TERMINALE, label: 'Classe de première / terminale' },
      { value: SchoolLevel.BAC_PLUS, label: 'BAC et plus' },
    ],
    availableSectors: ADMIN_SECTORS,
    availableExpectedSkills: ADMIN_SKILLS,
    defaultSkillsAssessment: ne([
      'Produire des documents professionnels courants',
      'Communiquer des informations par écrit',
      'Assurer la traçabilité et la conservation des informations',
      'Accueillir un visiteur et transmettre des informations oralement',
      "Planifier et organiser les activités de l'équipe",
      "Assurer l'administration des achats et des ventes",
      "Répondre aux demandes d'information des clients et traiter les réclamations courantes",
      "Élaborer et actualiser des tableaux de suivi de l'activité commerciale",
      'Assurer le suivi administratif courant du personnel',
    ]),
  },

  [TitleProfessionalType.AD]: {
    hasEnglishLevel: true,
    schoolLevels: [
      {
        value: SchoolLevel.PREMIERE_TERMINALE_WITH_1Y_EXP,
        label: "Première / terminale avec 1 an d'expérience professionnelle",
      },
      { value: SchoolLevel.BAC, label: 'BAC' },
      { value: SchoolLevel.BAC_PLUS_2_PLUS, label: 'BAC + 2 et plus' },
    ],
    availableSectors: ADMIN_SECTORS,
    availableExpectedSkills: ADMIN_SKILLS,
    defaultSkillsAssessment: ne([
      "Organiser et suivre sur le plan opérationnel les activités de l'équipe de direction en français et en anglais",
      'Concevoir des outils de pilotage et présenter des informations chiffrées de gestion',
      'Optimiser les processus administratifs',
      "Assurer l'interface orale entre l'équipe de direction et les interlocuteurs internes et externes en français et en anglais",
      'Conduire une veille informationnelle et en diffuser le contenu',
      'Préparer, coordonner et suivre un projet',
      'Organiser un événement',
      'Mettre en œuvre une action de communication en français et en anglais',
    ]),
  },

  [TitleProfessionalType.NTC]: {
    hasEnglishLevel: true,
    schoolLevels: [
      {
        value: SchoolLevel.PREMIERE_TERMINALE_WITH_1Y_EXP,
        label: "Première / terminale avec 1 an d'expérience professionnelle",
      },
      { value: SchoolLevel.BAC, label: 'BAC' },
      { value: SchoolLevel.BAC_PLUS_2_PLUS, label: 'BAC + 2 et plus' },
    ],
    availableSectors: COMMERCIAL_SECTORS,
    availableExpectedSkills: COMMERCIAL_SKILLS,
    defaultSkillsAssessment: ne([
      'Assurer une veille commerciale',
      "Concevoir et organiser un plan d'actions commerciales",
      'Prospecter un secteur défini',
      'Analyser ses performances, élaborer et mettre en œuvre des actions correctives',
      "Représenter l'entreprise et valoriser son image",
      'Concevoir une proposition technique et commerciale',
      'Négocier une solution technique et commerciale',
      'Réaliser le bilan, ajuster son activité commerciale et rendre compte',
      'Optimiser la gestion de la relation client',
    ]),
  },

  [TitleProfessionalType.REM]: {
    hasEnglishLevel: true,
    schoolLevels: [
      { value: SchoolLevel.BAC_WITH_1Y_EXP, label: "BAC avec 1 an d'expérience professionnelle" },
      { value: SchoolLevel.BAC_PLUS_2, label: 'BAC + 2' },
      { value: SchoolLevel.BAC_PLUS_3_PLUS, label: 'BAC + 3 et plus' },
    ],
    availableSectors: COMMERCIAL_SECTORS,
    availableExpectedSkills: COMMERCIAL_SKILLS,
    defaultSkillsAssessment: ne([
      "Gérer la chaîne d'approvisionnement de l'établissement marchand",
      "Piloter l'offre commerciale de l'établissement marchand",
      "Bâtir et développer l'expérience client",
      "Contribuer aux orientations stratégiques de l'enseigne",
      "Établir et présenter les prévisionnels de l'établissement marchand",
      "Analyser les performances de l'établissement marchand et définir les actions correctives",
      "Piloter les processus de recrutement et d'intégration des salariés de l'établissement marchand",
      'Optimiser la performance collective des équipes et la performance individuelle des salariés',
    ]),
  },
}

export const TP_TYPE_LABELS: Record<TitleProfessionalType, string> = {
  [TitleProfessionalType.CC]: 'Conseiller Commercial',
  [TitleProfessionalType.SA]: 'Secrétaire Assistant',
  [TitleProfessionalType.AD]: 'Assistant de Direction',
  [TitleProfessionalType.NTC]: 'Négociateur Technico-Commercial',
  [TitleProfessionalType.REM]: "Responsable d'Établissement Marchand",
}

export const SKILL_LEVEL_LABELS: Record<SkillLevel, string> = {
  [SkillLevel.A]: 'Acquis',
  [SkillLevel.ECA]: "En cours d'acquisition",
  [SkillLevel.NA]: 'Non acquis',
  [SkillLevel.NE]: 'Non évalué',
}

export const DISCOVERY_SOURCE_LABELS = {
  SOCIAL_MEDIA: 'Réseaux sociaux',
  FRANCE_TRAVAIL: 'France Travail',
  MISSION_LOCALE: 'Mission Locale',
  WORD_OF_MOUTH: 'Bouche à oreille',
  KOANN: 'Koann',
  OTHER: 'Autres',
}

export const TRAINING_SITE_LABELS = {
  NORD_SAINTE_MARIE: 'DISCIPLINA Nord – HUB Lizine, Sainte-Marie',
  OUEST_SAINT_PAUL: 'DISCIPLINA Ouest – Lizine Savanna, Saint-Paul',
  SUD_SAINT_PIERRE: 'DISCIPLINA Sud – Lizine Grand Bois, Saint-Pierre',
}
