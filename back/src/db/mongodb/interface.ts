
export enum TitleProfessionalType {
    AD = "AD",       // Administrateur
    CC = "CC",       // Chef de projet
    NTC = "NTC",     // Négociation, Technico-Commercial
    REM = "REM",     // Responsable d'Établissement Médico-Social
    SA = "SA"        // Secrétaire d'Administration
}

export enum CandidateStatus {
    DRAFT = "DRAFT",       // Profil en cours de remplissage
    ACTIVE = "ACTIVE",     // Prêt pour le matching entreprise
    MATCHED = "MATCHED",   // Associé à une entreprise
    CLOSED = "CLOSED"      // Dossier clôturé
}

export interface Identity {
    full_name: string;                    // Nom complet du candidat
    date_of_birth?: Date;                 // Date de naissance (optionnel)
    place_of_birth?: string;              // Lieu de naissance
    age?: number;                         // Âge actuel (calculé ou fourni)
    postal_code?: string;                 // Code postal
    city?: string;                        // Ville
    email: string;                        // Adresse email (requis, unique)
    phone: string;                        // Téléphone (requis)
    driving_license_b?: boolean;          // Permis de conduire catégorie B
    transport_means?: string;             // Moyens de transport habituels
    psh_referral_request?: boolean;       // Demande d'accompagnement PSH
}

export interface Candidate {
    // Identifiants
    _id: string;                          // MongoDB ObjectId (string)

    // Titre Professionnel visé
    tp_type: TitleProfessionalType;       // Type de formation apprentissage

    // Identité du candidat
    identity: Identity;

    // Métadonnées d'audit
    status: CandidateStatus;              // État du candidat dans le pipeline
    // created_at: Date;                     // Timestamp de création
    // created_by: string;                   // UUID du recruteur qui a créé le profil
}