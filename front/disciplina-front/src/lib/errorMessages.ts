/**
 * Traduction des erreurs serveur en messages français lisibles.
 *
 * Le back-end renvoie des messages techniques, majoritairement en anglais
 * (`Company not found`, `Forbidden: Insufficient permissions`, …). Plutôt que
 * de les afficher tels quels, on les fait passer par cette table avant tout
 * rendu à l'écran.
 *
 * Deux niveaux de correspondance :
 *  1. `EXACT_MESSAGES` — message serveur connu, traduction directe ;
 *  2. `PATTERN_MESSAGES` — expression régulière, pour les messages qui
 *     contiennent des valeurs interpolées (identifiants, codes HTTP, …).
 *
 * Tout message inconnu retombe sur `FALLBACK_MESSAGE` : on n'expose jamais un
 * texte technique brut à l'utilisateur final.
 */

export const FALLBACK_MESSAGE =
  "Une erreur est survenue. Réessayez dans un instant ; si le problème persiste, contactez le support."

export const NETWORK_MESSAGE =
  "Connexion au serveur impossible. Vérifiez votre connexion internet puis réessayez."

const EXACT_MESSAGES: Record<string, string> = {
  // --- Authentification / session ---
  'Authentication required': 'Vous devez être connecté pour effectuer cette action.',
  'Unauthorized: No valid session found':
    'Votre session a expiré. Reconnectez-vous pour continuer.',
  'Invalid email or password': 'Adresse e-mail ou mot de passe incorrect.',
  'Invalid or missing CSRF token':
    'Votre session a expiré. Rechargez la page puis réessayez.',
  'Mot de passe actuel incorrect': 'Le mot de passe actuel est incorrect.',
  'Le nouveau mot de passe doit contenir au moins 8 caractères':
    'Le nouveau mot de passe doit contenir au moins 8 caractères.',
  'Rate limit exceeded':
    'Trop de tentatives. Patientez quelques instants avant de réessayer.',

  // --- Permissions ---
  'Forbidden: Insufficient permissions':
    "Vous n'avez pas les droits nécessaires pour effectuer cette action.",
  'Forbidden: You can only edit your own companies':
    'Vous ne pouvez modifier que les entreprises de votre portefeuille.',
  'Forbidden: You can only edit your own needs analyses':
    "Vous ne pouvez modifier que vos propres analyses de besoins.",
  'Forbidden: You can only delete your own needs analyses':
    "Vous ne pouvez supprimer que vos propres analyses de besoins.",
  'Forbidden: You can only change relance on your own needs analyses':
    "Vous ne pouvez relancer que vos propres analyses de besoins.",
  'Only the owner can delete this history entry':
    "Seul l'auteur de cet historique peut le supprimer.",
  'Cannot delete an automatic history entry':
    "Cet historique a été généré automatiquement et ne peut pas être supprimé.",

  // --- Utilisateurs ---
  'User not found': 'Utilisateur introuvable.',
  'Unknown user': 'Utilisateur introuvable.',
  'Target user not found': 'Utilisateur introuvable.',
  'Assigned user not found': "L'utilisateur assigné est introuvable.",
  'User already exists': 'Un compte existe déjà avec ces informations.',
  'User already deleted': 'Ce compte a déjà été supprimé.',
  'Email already in use': 'Cette adresse e-mail est déjà utilisée.',
  'Failed to create user': "La création du compte a échoué.",
  'User ID is required': "L'identifiant de l'utilisateur est manquant.",

  // --- Entreprises / portefeuille ---
  'Company not found': 'Entreprise introuvable.',
  'Company not found after update':
    "L'entreprise est introuvable après la mise à jour.",
  'Company creation failed': "La création de l'entreprise a échoué.",
  'Failed to retrieve created company':
    "L'entreprise a été créée mais n'a pas pu être rechargée. Actualisez la page.",
  'Company ID is required': "L'identifiant de l'entreprise est manquant.",
  'Company has no SIRET': "Cette entreprise n'a pas de numéro SIRET.",
  'A company with this SIRET already exists in the portfolio':
    'Une entreprise avec ce SIRET est déjà présente dans le portefeuille.',
  'Ce SIRET est déjà dans le portefeuille':
    'Ce SIRET est déjà présent dans le portefeuille.',
  'Plusieurs commerciaux sont déjà rattachés à ce SIREN : contactez un responsable.':
    'Plusieurs commerciaux sont déjà rattachés à ce SIREN. Contactez un responsable.',
  'Company conflict entry not found': 'Ce conflit est introuvable.',

  // --- SIRET / INSEE ---
  'SIRET is required': 'Le numéro SIRET est obligatoire.',
  'SIRET must be 14 characters': 'Le numéro SIRET doit comporter 14 chiffres.',
  'SIRET must be a 14-digit string': 'Le numéro SIRET doit comporter 14 chiffres.',
  'SIRET not found': 'Aucun établissement ne correspond à ce SIRET.',
  'Invalid INSEE API key':
    "L'accès à l'annuaire des entreprises est indisponible. Contactez un administrateur.",
  'No establishments found for the given criteria':
    'Aucun établissement ne correspond à ces critères.',
  'At least one search criterion is required':
    'Renseignez au moins un critère de recherche.',

  // --- Liste noire ---
  'A reason is required to blacklist a company':
    'Un motif est obligatoire pour mettre une entreprise en liste noire.',
  'Blacklisted company not found':
    'Cette entreprise est introuvable dans la liste noire.',

  // --- Candidats ---
  'Candidat introuvable': 'Candidat introuvable.',
  'Candidat proposé introuvable': 'Le candidat proposé est introuvable.',
  'Erreur lors de la mise à jour du candidat':
    'La mise à jour du candidat a échoué.',
  'Unknown candidate in answers':
    'Un candidat de cette sélection est introuvable.',
  'Le consentement au traitement des données est obligatoire.':
    'Le consentement au traitement des données est obligatoire.',

  // --- Offres / matching ---
  'Offer not found': 'Offre introuvable.',
  'Job title is required': "L'intitulé du poste est obligatoire.",
  'Invalid answer status': 'Ce statut de réponse est invalide.',
  'Session introuvable': 'Session de sélection introuvable.',
  'Session not found': 'Session de sélection introuvable.',
  'Session non conforme': 'Cette session de sélection est invalide.',
  'Session de sélection non créée': 'La session de sélection n’a pas pu être créée.',

  // --- Analyses de besoins ---
  'Needs analysis not found': 'Analyse de besoins introuvable.',
  'Needs analysis not found after update':
    "L'analyse de besoins est introuvable après la mise à jour.",
  'Cannot change relance on a deleted needs analysis':
    'Impossible de relancer une analyse de besoins supprimée.',
  'History entry not found': 'Cet élément d’historique est introuvable.',
  'Failed to retrieve created contact log':
    "L'échange a été enregistré mais n'a pas pu être rechargé. Actualisez la page.",

  // --- Tâches ---
  'Todo not found': 'Tâche introuvable.',
  'Todo not found after update': 'La tâche est introuvable après la mise à jour.',
  'Failed to retrieve created todo':
    "La tâche a été créée mais n'a pas pu être rechargée. Actualisez la page.",

  // --- Groupes ---
  'Group not found': 'Groupe introuvable.',
  'Group name cannot be empty': 'Le nom du groupe est obligatoire.',
  'Group name too long': 'Le nom du groupe est trop long.',
  'Failed to create group': 'La création du groupe a échoué.',
  'Group does not belong to the user': "Ce groupe ne vous appartient pas.",
  'Group does not belong to the assignee':
    "Ce groupe n'appartient pas à la personne assignée.",
  'Provide either groupId or groupName, not both':
    'Choisissez un groupe existant ou saisissez un nouveau nom, pas les deux.',
  'Only one FAVORITE allowed': 'Un seul favori est autorisé.',

  // --- Google / Drive ---
  'Google account not connected':
    'Votre compte Google n’est pas connecté. Connectez-le depuis votre profil.',
  'Compte Google non connecté. Veuillez connecter votre compte Google.':
    'Votre compte Google n’est pas connecté. Connectez-le depuis votre profil.',
  'Google Drive non connecté pour cet utilisateur':
    'Google Drive n’est pas connecté pour cet utilisateur.',
  'Saler Google account not connected':
    'Le compte Google du commerciale rattaché n’est pas connecté.',
  'Invalid encrypted token format':
    'La connexion Google est corrompue. Reconnectez votre compte Google.',

  // --- Signature électronique (DocuSeal) ---
  'DocuSeal did not return a signing link; cannot send the signature email':
    "Le lien de signature n'a pas pu être généré. L'e-mail n'a pas été envoyé.",
  'DocuSeal submission created but no submission id was returned':
    "La demande de signature a été créée mais son identifiant est manquant. Contactez le support.",
  'No signable document found in signature request':
    'Aucun document signable dans cette demande de signature.',
  'No signed document URL found in DocuSeal submission':
    'Le document signé est introuvable.',
  'No stored signature link to build the relance':
    "Aucun lien de signature n'est enregistré : la relance est impossible.",
  'No recruitment responsible email to send the signature request to':
    "Aucune adresse e-mail de responsable recrutement : la demande de signature ne peut pas être envoyée.",
  'No recruitment responsible email to send the relance to':
    "Aucune adresse e-mail de responsable recrutement : la relance ne peut pas être envoyée.",
  'No saler attached to the AB': "Aucun commercial n'est rattaché à cette AB.",

  // --- Mail ---
  'Modèle de mail introuvable.': 'Modèle de mail introuvable.',
  'Aucune entreprise sélectionnée.': 'Aucune entreprise sélectionnée.',
  'Aucune entreprise valide avec une adresse email.':
    'Aucune des entreprises sélectionnées ne possède une adresse e-mail valide.',

  // --- Commentaires ---
  'Le commentaire est obligatoire': 'Le commentaire est obligatoire.',

  // --- KPI ---
  'Invalid year': 'Année invalide.',
  'Invalid month (1-12)': 'Mois invalide (1 à 12).',
  'Invalid week (0 = monthly, 1-53)': 'Semaine invalide (1 à 53, ou 0 pour le mois).',
}

const PATTERN_MESSAGES: Array<{ pattern: RegExp; message: string | ((m: RegExpMatchArray) => string) }> = [
  // Champs obligatoires interpolés : `${field} is required`
  { pattern: /^(.+) is required$/i, message: 'Ce champ est obligatoire.' },

  // Ressources introuvables avec identifiant : `Candidate 42 not found`
  { pattern: /^candidate .* (is )?not (found|an accepted)/i, message: 'Candidat introuvable.' },
  { pattern: /^company with id .* not found$/i, message: 'Entreprise introuvable.' },

  // Validation
  { pattern: /^SIRET invalide/i, message: 'Numéro SIRET invalide.' },
  { pattern: /^invalid site/i, message: 'Site invalide.' },
  { pattern: /^invalid .*: must be a non-negative integer$/i, message: 'Cette valeur doit être un nombre positif.' },
  {
    pattern: /^le commentaire ne doit pas dépasser (\d+) caractères$/i,
    message: (m) => `Le commentaire ne doit pas dépasser ${m[1]} caractères.`,
  },
  { pattern: /^mot de passe trop faible/i, message: 'Mot de passe trop faible : choisissez un mot de passe plus complexe.' },
  { pattern: /^candidate does not consent to/i, message: "Le candidat n'a pas donné son consentement pour cette action." },
  { pattern: /^unsupported search parameter/i, message: 'Ce critère de recherche n’est pas pris en charge.' },

  // Services externes indisponibles
  { pattern: /^INSEE API error/i, message: "L'annuaire des entreprises est momentanément indisponible. Réessayez plus tard." },
  { pattern: /^failed to (create|activate|fetch) (docuseal|signature)/i, message: 'Le service de signature électronique est momentanément indisponible. Réessayez plus tard.' },
  { pattern: /^failed to (upload|download|list) (document|signed)/i, message: 'Le transfert du document a échoué. Réessayez plus tard.' },
  { pattern: /^failed to add signer/i, message: "L'ajout du signataire a échoué. Réessayez plus tard." },
  { pattern: /^search failed/i, message: 'La recherche a échoué. Réessayez plus tard.' },

  // Filets de sécurité génériques, en dernier recours
  { pattern: /not found$/i, message: 'Élément introuvable.' },
  { pattern: /^forbidden/i, message: "Vous n'avez pas les droits nécessaires pour effectuer cette action." },
  { pattern: /^unauthorized/i, message: 'Votre session a expiré. Reconnectez-vous pour continuer.' },
]

/** Traduit un message serveur brut. Renvoie `null` si aucune règle ne matche. */
export function translateServerMessage(raw: string): string | null {
  const message = raw.trim()
  if (!message) return null

  const exact = EXACT_MESSAGES[message]
  if (exact) return exact

  for (const { pattern, message: translation } of PATTERN_MESSAGES) {
    const match = message.match(pattern)
    if (match) return typeof translation === 'function' ? translation(match) : translation
  }

  return null
}

type GraphQLLikeError = {
  graphQLErrors?: ReadonlyArray<{ message: string }>
  networkError?: unknown
  message?: string
}

function isGraphQLLikeError(error: unknown): error is GraphQLLikeError {
  return typeof error === 'object' && error !== null && ('graphQLErrors' in error || 'networkError' in error)
}

/**
 * Point d'entrée unique : transforme n'importe quelle erreur (CombinedError
 * urql, Error REST, chaîne, inconnu) en un message français affichable.
 */
export function toFrenchError(error: unknown): string {
  if (error == null) return FALLBACK_MESSAGE

  if (typeof error === 'string') {
    return translateServerMessage(error) ?? FALLBACK_MESSAGE
  }

  if (isGraphQLLikeError(error)) {
    // Une erreur GraphQL métier est toujours plus parlante qu'une erreur réseau.
    const first = error.graphQLErrors?.[0]?.message
    if (first) return translateServerMessage(first) ?? FALLBACK_MESSAGE
    if (error.networkError) return NETWORK_MESSAGE
  }

  if (error instanceof Error) {
    if (error.name === 'TypeError' && /fetch|network/i.test(error.message)) return NETWORK_MESSAGE
    return translateServerMessage(error.message) ?? FALLBACK_MESSAGE
  }

  return FALLBACK_MESSAGE
}
