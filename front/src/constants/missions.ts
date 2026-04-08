export type Domaine = 'secretariat' | 'vente'
export type Niveau  = 'bac' | 'bac2' | 'bac3'

export const MISSIONS: Record<Domaine, Record<string, string[]>> = {
  secretariat: {
    secretaire: [
      'Accueil physique et téléphonique',
      'Gestion du courrier entrant et sortant',
      'Rédaction et mise en forme de courriers simples et documents administratifs',
      'Prise de rendez-vous et gestion du planning',
      'Préparation logistique et suivi des réunions',
      'Classement, organisation et archivage des documents',
      'Saisie et mise à jour de données dans les outils bureautiques',
      'Communication interne et externe',
      'Gestion administrative générale',
    ],
    assistante_direction: [
      'Accueil physique et téléphonique',
      'Gestion du courrier entrant et sortant',
      'Rédaction de courriers, e-mails et comptes rendus complexes',
      'Organisation de l\'agenda et gestion des priorités de la direction',
      'Prise de rendez-vous et coordination des plannings',
      'Organisation et préparation de réunions stratégiques',
      'Classement, archivage et gestion documentaire',
      'Communication interne et externe',
      'Suivi de dossiers confidentiels et sensibles',
      'Utilisation avancée des outils bureautiques',
      'Réalisation de synthèses, tableaux et reporting',
      'Suivi de projets et coordination transversale',
      'Gestion administrative générale en appui de la direction',
    ],
  },
  vente: {
    conseiller_commercial: [
      'Accueil physique, téléphonique et digital',
      'Identifier les besoins du client par questionnement et écoute active',
      'Présenter et mettre en valeur les produits ou services',
      'Conseiller le client et proposer des solutions adaptées',
      'Argumenter et répondre aux objections',
      'Réaliser des ventes et conclure les transactions',
      'Élaborer des devis et assurer le suivi client',
      'Mettre en place des actions de prospection',
      'Participer aux actions de fidélisation',
      'Suivre ses ventes et ses objectifs commerciaux',
      'Organiser et valoriser l\'espace de vente',
      'Participer à la mise en œuvre d\'actions promotionnelles',
      'Suivre les stocks et approvisionnements',
      'Respecter les règles d\'hygiène et de sécurité',
      'Contribuer à la valorisation de l\'image de l\'entreprise',
    ],
    negociateur: [
      'Accueil et orientation client',
      'Rechercher et collecter des informations sur les clients et marchés',
      'Identifier de nouveaux prospects',
      'Planifier et préparer les rendez-vous clients',
      'Réaliser des entretiens commerciaux BtoB',
      'Élaborer des offres commerciales chiffrées',
      'Négocier les conditions de vente',
      'Conclure les ventes et formaliser les accords',
      'Assurer le suivi client après la vente',
      'Développer la relation de confiance et fidéliser',
      'Participer à la mise en œuvre du plan d\'actions commerciales',
      'Suivre et analyser ses résultats commerciaux',
      'Coordonner avec les équipes techniques et logistiques',
      'Respecter les règles d\'hygiène et de sécurité',
    ],
    technico_commercial: [
      'Accueil, information et orientation client',
      'Vente de produits et services / négociation commerciale',
      'Élaboration de devis et suivi client',
      'Suivi et fidélisation de la clientèle',
      'Analyse des besoins clients et suivi des objectifs',
      'Mise en œuvre d\'actions commerciales et promotionnelles',
      'Organisation et valorisation de l\'espace de vente',
      'Coordination des équipes techniques, logistiques et commerciales',
      'Encadrement et animation d\'équipe',
      'Ouverture et fermeture du point de vente',
      'Analyse des indicateurs de performance commerciale',
      'Suivi budgétaire et optimisation des marges',
      'Gestion administrative et organisationnelle',
      'Communication interne et externe',
      'Respect des règles d\'hygiène, de sécurité et de la politique commerciale',
    ],
  },
}

export function getMissionsKey(domaine: Domaine, niveau: Niveau): string {
  if (domaine === 'secretariat') {
    return niveau === 'bac' ? 'secretaire' : 'assistante_direction'
  }
  // vente
  if (niveau === 'bac')  return 'conseiller_commercial'
  if (niveau === 'bac2') return 'negociateur'
  return 'technico_commercial'
}

export function getMissionLabel(domaine: Domaine, niveau: Niveau): string {
  if (domaine === 'secretariat') {
    return niveau === 'bac' ? 'Secrétaire (Bac)' : 'Assistante de Direction (Bac+2)'
  }
  if (niveau === 'bac')  return 'Conseiller Commercial (Bac)'
  if (niveau === 'bac2') return 'Négociateur (Bac+2)'
  return 'Technico-Commercial / Resp. Établissement Marchand (Bac+3)'
}
