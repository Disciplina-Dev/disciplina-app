import type { Domaine } from '@/types/ab'

export const POSTES_BY_DOMAINE: Record<Domaine, string[]> = {
  Secretariat: ['Secrétaire Assistante', 'Assistante de Direction'],
  Vente: [
    'Conseiller Commercial',
    'Négociateur',
    'Technico-Commercial',
    "Responsable d'Établissement Marchand",
  ],
}

export const MISSIONS_BY_POSTE: Record<string, string[]> = {
  'Secrétaire Assistante': [
    'Accueil physique et téléphonique',
    'Gestion du courrier entrant et sortant',
    'Rédaction et mise en forme de courriers simples et documents administratifs',
    'Prise de rendez-vous et gestion du planning',
    'Préparation logistique et suivi des réunions (convocations, supports, comptes rendus)',
    'Classement, organisation et archivage des documents',
    'Saisie et mise à jour de données dans les outils bureautiques',
    "Communication interne et externe (mails, notes, transmission d'informations)",
    "Gestion administrative générale en appui de l'activité de l'entreprise",
  ],
  'Assistante de Direction': [
    'Accueil physique et téléphonique',
    'Gestion du courrier entrant et sortant',
    'Rédaction de courriers, e-mails et comptes rendus complexes',
    "Organisation de l'agenda et gestion des priorités de la direction",
    'Prise de rendez-vous et coordination des plannings',
    'Organisation et préparation de réunions stratégiques (convocations, supports, comptes rendus)',
    'Classement, archivage et gestion documentaire',
    "Communication interne et externe (notes, rapports, diffusion d'informations)",
    'Suivi de dossiers confidentiels et sensibles',
    'Utilisation avancée des outils bureautiques (Excel, Word, PowerPoint, etc.)',
    'Réalisation de synthèses, tableaux et reporting pour appuyer la prise de décision',
    'Suivi de projets et coordination transversale entre services',
    "Gestion administrative générale en appui de la direction",
  ],
  'Conseiller Commercial': [
    'Accueil physique, téléphonique et digital (magasin, téléphone, mail, réseaux sociaux)',
    "Identifier les besoins du client par un questionnement adapté et une écoute active",
    "Présenter et mettre en valeur les produits ou services de l'entreprise",
    'Conseiller le client et proposer des solutions adaptées à ses attentes',
    'Argumenter et répondre aux objections du client',
    'Réaliser des ventes et conclure les transactions (commande, encaissement, contrat)',
    'Élaborer des devis et assurer le suivi client',
    'Mettre en place et suivre des actions de prospection (phoning, mailing, terrain, réseaux sociaux)',
    'Participer aux actions de fidélisation (relance client, suivi personnalisé, offres promotionnelles)',
    'Suivre ses ventes et ses objectifs commerciaux',
    "Organiser et valoriser l'espace de vente (mise en rayon, facing, mise en avant produits)",
    "Participer à la mise en œuvre d'actions commerciales et promotionnelles",
    "Suivre les stocks et approvisionnements en lien avec l'activité commerciale",
    "Respecter les règles d'hygiène et de sécurité dans l'espace de vente",
    "Contribuer à la valorisation de l'image de l'entreprise (communication, respect de la politique commerciale, tenue professionnelle)",
  ],
  Négociateur: [
    'Accueil et orientation client (physique, téléphonique, digital)',
    'Rechercher et collecter des informations sur les clients, prospects, marchés et concurrents',
    'Identifier de nouveaux prospects et entrer en contact (téléphone, mail, réseaux sociaux, terrain)',
    "Planifier et préparer les rendez-vous clients (prise de rendez-vous, préparation d'arguments et de supports)",
    "Réaliser des entretiens commerciaux BtoB : présenter les produits/services, écouter les besoins, proposer une solution adaptée",
    'Élaborer des offres commerciales chiffrées en tenant compte des contraintes techniques et budgétaires du client',
    'Négocier les conditions de vente (prix, délais, modalités de livraison, services associés)',
    'Conclure les ventes et formaliser les accords (contrats, devis, bons de commande)',
    'Assurer le suivi client après la vente : relance, accompagnement, résolution de problèmes',
    'Développer la relation de confiance et fidéliser le portefeuille clients',
    "Participer à la mise en œuvre du plan d'actions commerciales (prospection, actions de relance, suivi d'objectifs)",
    "Suivre et analyser ses résultats commerciaux à l'aide d'outils de reporting et proposer des améliorations",
    'Coordonner avec les équipes techniques et logistiques pour assurer la satisfaction client',
    "Respecter les règles d'hygiène, de sécurité et la politique commerciale de l'entreprise",
  ],
  'Technico-Commercial': [
    'Accueil, information et orientation client',
    'Vente de produits et services / négociation commerciale',
    'Élaboration de devis et suivi client',
    'Suivi et fidélisation de la clientèle',
    'Analyse des besoins clients et suivi des objectifs commerciaux',
    "Mise en œuvre d'actions commerciales et promotionnelles",
    "Organisation et valorisation de l'espace de vente",
    'Coordination des équipes techniques, logistiques et commerciales',
    "Encadrement et animation d'équipe",
    'Ouverture et fermeture du point de vente',
    'Analyse des indicateurs de performance commerciale',
    'Suivi budgétaire et optimisation des marges',
    "Gestion administrative et organisationnelle de l'établissement",
    'Communication interne et externe',
    "Respect des règles d'hygiène, de sécurité et de la politique commerciale de l'entreprise",
  ],
}
MISSIONS_BY_POSTE["Responsable d'Établissement Marchand"] =
  MISSIONS_BY_POSTE['Technico-Commercial']

export const ENGAGEMENTS = [
  'Évoluer progressivement en fonction de la montée en compétences',
  'Être adaptées pour rester en cohérence avec le parcours de formation',
  "Faire l'objet de réajustements en accord avec le CFA",
] as const

export const CLAUSE_CONFIDENTIALITE = `Ce document est fourni à titre informatif et ne constitue en aucun cas un engagement obligatoire de la part de l'entreprise.

DISCIPLINA s'engage à respecter la confidentialité des données reçues et garantit que celles-ci ne seront utilisées que dans le cadre du processus de recrutement décrit.

Les informations contenues dans ce document, ainsi que toutes les données échangées (y compris, mais sans s'y limiter, les CV, les lettres de motivation et autres documents personnels transmis), sont strictement confidentielles. Les informations personnelles, notamment les CV, ne peuvent être utilisées à d'autres fins ni être partagées avec des tiers sans le consentement explicite des personnes concernées.

De la même manière, nous demandons aux destinataires de ce document et des données transmises de respecter ces mêmes obligations de confidentialité. Toute utilisation non autorisée des données personnelles, y compris l'utilisation des CV à des fins autres que celles définies dans le cadre de cette collaboration, est formellement interdite et pourrait donner lieu à des sanctions.

Ce texte clarifie que le document n'a pas de caractère contraignant tout en soulignant l'importance de la confidentialité des données, notamment celles relatives aux candidats.`

export interface ContactPersonne {
  nom: string
  fonction: string
  email: string
  tel: string
}

export interface ContactCampus {
  label: string
  adresse: string
  personnes: ContactPersonne[]
}

export const CONTACTS_DOCUMENT: ContactCampus[] = [
  {
    label: 'Fonction centrale',
    adresse: '8 rue Pondichéry, ZI La Mare, 97438 Ste Marie',
    personnes: [
      { nom: 'Lorenzo ENCATASSAMY', fonction: 'Directeur', email: 'direction@disciplina.re', tel: '0693 85 59 91' },
      { nom: 'Daïna VINGUETAMA-PERIANAGOM', fonction: 'Référente qualité, Référent des Personnes en Situation de Handicap et Personne Dédiée à la Mobilité', email: 'vinguetama.qualite@disciplina.re', tel: '0693 83 17 92' },
    ],
  },
  {
    label: 'DISCIPLINA Nord',
    adresse: '8 rue Pondichéry, ZI La Mare, 97438 Ste Marie',
    personnes: [
      { nom: 'Céline BOYER', fonction: 'Chargé de recrutement', email: 'boyer.rh@disciplina.re', tel: '0693 88 80 23' },
      { nom: 'Rachelle ADA VAMIS', fonction: 'Assistante de recrutement', email: 'rachelle.rh@disciplina.re', tel: '0693 06 23 12' },
      { nom: 'Eléanore PLANTE', fonction: 'Assistante de direction', email: 'plante.administration@disciplina.re', tel: '0693 88 80 22' },
      { nom: 'Emmanuelle TAILE', fonction: 'Assistante de gestion en comptabilité', email: 'taile.administration@disciplina.re', tel: '0693 01 29 33' },
      { nom: 'Hayana PAJANIANDY SARALOU', fonction: 'Assistante pédagogique', email: 'pajaniandy.pedagogie@disciplina.re', tel: '0692 40 42 93' },
      { nom: 'Laurène GONZALEZ', fonction: 'Référente pédagogique', email: 'gonzalez.pedagogie@disciplina.re', tel: '0692 23 22 98' },
      { nom: 'Amanda SINAMAN', fonction: 'Commerciale', email: 'sinaman.commercial@disciplina.re', tel: '0693 00 76 91' },
    ],
  },
  {
    label: 'DISCIPLINA Ouest',
    adresse: '14 rue Jules Thirel, 97460 Saint-Paul',
    personnes: [
      { nom: 'Séverine DUGAIN', fonction: 'Assistante de direction', email: 'dugain.administration@disciplina.re', tel: '0693 88 80 21' },
      { nom: 'Alice NATIVEL', fonction: 'Chargée de recrutement', email: 'nativel.rh@disciplina.re', tel: '0692 44 37 99' },
    ],
  },
  {
    label: 'DISCIPLINA Sud',
    adresse: '249 avenue du Général de Gaulle, 97410 Saint-Pierre',
    personnes: [
      { nom: 'Céline BOYER', fonction: 'Chargé de recrutement', email: 'boyer.rh@disciplina.re', tel: '0693 88 80 23' },
    ],
  },
]
