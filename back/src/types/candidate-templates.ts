import { TitleProfessionalType, SkillLevel, SkillsAssessment } from './candidate.types';

export interface CandidateTemplate {
    tp_type: TitleProfessionalType;
    has_english_level: boolean;
    available_sectors: string[];
    available_expected_skills: string[];
    default_skills_assessment: SkillsAssessment[];
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
];

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
];

const COMMERCIAL_EXPECTED_SKILLS = [
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
];

const ADMIN_EXPECTED_SKILLS = [
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
];

function toSkillsAssessment(competences: string[]): SkillsAssessment[] {
    return competences.map((competence) => ({ competence, level: SkillLevel.NE }));
}

export const CANDIDATE_TEMPLATES: Record<TitleProfessionalType, CandidateTemplate> = {
    [TitleProfessionalType.CC]: {
        tp_type: TitleProfessionalType.CC,
        has_english_level: false,
        available_sectors: COMMERCIAL_SECTORS,
        available_expected_skills: COMMERCIAL_EXPECTED_SKILLS,
        default_skills_assessment: toSkillsAssessment([
            'Assurer une veille professionnelle et commerciale',
            "Mettre en \u0153uvre un plan d\u2019actions commerciales et organiser son activit\u00e9",
            'Mettre en \u0153uvre la d\u00e9marche de prospection',
            'Analyser ses performances commerciales et en rendre compte',
            "Repr\u00e9senter l\u2019entreprise et contribuer \u00e0 la valorisation de son image",
            "Conseiller le client en conduisant l\u2019entretien de vente",
            'Assurer le suivi de ses ventes',
            "Fid\u00e9liser en consolidant l\u2019exp\u00e9rience client",
        ]),
    },

    [TitleProfessionalType.SA]: {
        tp_type: TitleProfessionalType.SA,
        has_english_level: false,
        available_sectors: ADMIN_SECTORS,
        available_expected_skills: ADMIN_EXPECTED_SKILLS,
        default_skills_assessment: toSkillsAssessment([
            'Produire des documents professionnels courants',
            'Communiquer des informations par \u00e9crit',
            'Assurer la tra\u00e7abilit\u00e9 et la conservation des informations',
            'Accueillir un visiteur et transmettre des informations oralement',
            "Planifier et organiser les activit\u00e9s de l\u2019\u00e9quipe",
            "Assurer l\u2019administration des achats et des ventes",
            "R\u00e9pondre aux demandes d\u2019information des clients et traiter les r\u00e9clamations courantes",
            "\u00c9laborer et actualiser des tableaux de suivi de l\u2019activit\u00e9 commerciale",
            'Assurer le suivi administratif courant du personnel',
        ]),
    },

    [TitleProfessionalType.AD]: {
        tp_type: TitleProfessionalType.AD,
        has_english_level: true,
        available_sectors: ADMIN_SECTORS,
        available_expected_skills: ADMIN_EXPECTED_SKILLS,
        default_skills_assessment: toSkillsAssessment([
            "Organiser et suivre sur le plan op\u00e9rationnel les activit\u00e9s de l\u2019\u00e9quipe de direction en fran\u00e7ais et en anglais",
            'Concevoir des outils de pilotage et pr\u00e9senter des informations chiffr\u00e9es de gestion',
            'Optimiser les processus administratifs',
            "Assurer l\u2019interface orale entre l\u2019\u00e9quipe de direction et les interlocuteurs internes et externes en fran\u00e7ais et en anglais",
            'Conduire une veille informationnelle et en diffuser le contenu',
            'Pr\u00e9parer, coordonner et suivre un projet',
            'Organiser un \u00e9v\u00e9nement',
            'Mettre en \u0153uvre une action de communication en fran\u00e7ais et en anglais',
        ]),
    },

    [TitleProfessionalType.NTC]: {
        tp_type: TitleProfessionalType.NTC,
        has_english_level: true,
        available_sectors: COMMERCIAL_SECTORS,
        available_expected_skills: COMMERCIAL_EXPECTED_SKILLS,
        default_skills_assessment: toSkillsAssessment([
            'Assurer une veille commerciale',
            "Concevoir et organiser un plan d\u2019actions commerciales",
            'Prospecter un secteur d\u00e9fini',
            'Analyser ses performances, \u00e9laborer et mettre en \u0153uvre des actions correctives',
            "Repr\u00e9senter l\u2019entreprise et valoriser son image",
            'Concevoir une proposition technique et commerciale',
            'N\u00e9gocier une solution technique et commerciale',
            'R\u00e9aliser le bilan, ajuster son activit\u00e9 commerciale et rendre compte',
            'Optimiser la gestion de la relation client',
        ]),
    },

    [TitleProfessionalType.REM]: {
        tp_type: TitleProfessionalType.REM,
        has_english_level: true,
        available_sectors: COMMERCIAL_SECTORS,
        available_expected_skills: COMMERCIAL_EXPECTED_SKILLS,
        default_skills_assessment: toSkillsAssessment([
            "G\u00e9rer la cha\u00eene d\u2019approvisionnement de l\u2019\u00e9tablissement marchand",
            "Piloter l\u2019offre commerciale de l\u2019\u00e9tablissement marchand",
            "B\u00e2tir et d\u00e9velopper l\u2019exp\u00e9rience client",
            "Contribuer aux orientations strat\u00e9giques de l\u2019enseigne",
            "Établir et pr\u00e9senter les pr\u00e9visionnels de l\u2019\u00e9tablissement marchand",
            "Analyser les performances de l\u2019\u00e9tablissement marchand et d\u00e9finir les actions correctives",
            "Piloter les processus de recrutement et d\u2019int\u00e9gration des salari\u00e9s de l\u2019\u00e9tablissement marchand",
            'Optimiser la performance collective des \u00e9quipes et la performance individuelle des salari\u00e9s',
        ]),
    },
};
