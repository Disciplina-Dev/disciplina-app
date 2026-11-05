import { getRegion } from '../db/tenant';
import type { Region } from '../types/tenant';

/**
 * Contenu des documents PDF par tenant (AB, mandat, catalogue).
 *
 * Même société, établissement distinct : l'identité légale et les contacts
 * changent d'un tenant à l'autre. Centraliser ces valeurs ici évite qu'une
 * coordonnée Réunion fuite sur un document Annemasse (cf.
 * AUDIT_MULTITENANT.md, `ID-01`, `ID-02`, `ID-05`, `ID-06`).
 *
 * Les chemins sont relatifs à `back/assets/`. Pour faire diverger un document,
 * il suffit d'ajouter le PDF dans ce dossier puis de changer le nom ci-dessous.
 */

export interface TenantLegalIdentity {
    /** Raison sociale affichée en pied de page. */
    companyName: string;
    /** Adresse du siège, telle qu'elle doit apparaître sur les documents. */
    address: string;
    siret: string;
    /** Phrase complète de déclaration d'activité (numéro + autorité + mention). */
    activityDeclaration: string;
    /** Date de dernière mise à jour, au format JJ/MM/AAAA. */
    updatedAt: string;
}

export interface TenantContactGroup {
    /** Titre du bloc (ex. « DISCIPLINA Annemasse : 6 rue du Parc… »). */
    title: string;
    /** Une ligne par contact, déjà rédigée (nom, fonction, coordonnées). */
    people: readonly string[];
}

export interface TenantSignatureAssetConfig {
    /** PDF du mandat de publication, relatif à `back/assets/`. */
    mandatFile: string;
    /** PDF du catalogue, relatif à `back/assets/`. */
    catalogueFile: string;
    /** Nom du catalogue dans DocuSeal (sans extension). */
    catalogueName: string;
}

export interface TenantDocumentConfig {
    /** Couleur de marque, utilisée par les documents générés. */
    brandColor: string;
    legal: TenantLegalIdentity;
    contacts: readonly TenantContactGroup[];
    signatureAssets: TenantSignatureAssetConfig;
}

export const TENANT_DOCUMENTS: Record<Region, TenantDocumentConfig> = {
    reunion: {
        brandColor: '#1130A7',
        legal: {
            companyName: 'DISCIPLINA',
            address: '71 rue Roger Payet, Sainte-Marie 97438',
            siret: '97828986600011',
            activityDeclaration:
                "Déclaration d'activité enregistrée sous le n° 04973484197 auprès du Préfet de région de Réunion. Cet enregistrement ne vaut pas agrément de l'Etat",
            updatedAt: '25/02/2026',
        },
        contacts: [
            {
                title: 'Fonction centrale : 8 rue Pondichéry, ZI La Mare, 97438 Ste Marie',
                people: ['Lorenzo ENCATASSAMY en qualité de Directeur : direction@disciplina.re / 0693 85 59 91'],
            },
            {
                title: 'DISCIPLINA Nord : 8 rue Pondichéry, ZI La Mare, 97438 Ste Marie',
                people: [
                    'Amanda SINAMAN en qualité de Responsable Commerciale : sinaman.commercial@disciplina.re / 0693 00 76 91',
                    'Brandon GALMAR en qualité de Commercial : galmar.commercial@disciplina.re / 0693 39 52 07',
                    'Emile LEBON en qualité de Commercial : lebon.commercial@disciplina.re / 0692 39 66 29',
                    'Loïc GRONDIN en qualité de Responsable de recrutement : grondin.rh@disciplina.re / 0693 88 00 20',
                    "Marion GOUARD en qualité d'Assistante de recrutement : gouard.rh@disciplina.re / 0692 44 37 99",
                    'Séverine DUGAIN en qualité de Responsable administrative : dugain.administration@disciplina.re / 0693 88 00 20',
                    'Sébastien COUVIN en qualité de Responsable pédagogique CFA et OF : couvin.pedagogie@disciplina.re / 0692 23 22 98',
                    'Emmanuella MAONDA en qualité de Coordinatrice pédagogique CFA : maonda.pedagogie@disciplina.re / 0692 40 42 93',
                    "Samantha BERTILLE en qualité d'Assistante pédagogique CFA : bertille.pedagogie@disciplina.re / 0692 52 38 75",
                    "Rachelle ADAVAMIS en qualité d'Assistante pédagogique OF : adavamis.of@disciplina.re / 0693 06 23 12",
                ],
            },
            {
                title: 'DISCIPLINA Ouest : 14 rue Jules Thirel, 97460 Saint-Paul',
                people: [
                    'Marion LAURET en qualité de Responsable Commerciale : lauret.commercial@disciplina.re / 0693 06 92 01',
                    'Martin HARDIER en qualité de Commercial : hardier.commercial@disciplina.re / 0693 06 92 04',
                    'Lucas MADELEINE en qualité de Commercial : madeleine.commercial@disciplina.re / 0693 06 92 03',
                    'Célia GALAIS en qualité de Responsable de recrutement : galais.rh@disciplina.re / 0693 06 92 20',
                    "Alice NATIVEL en qualité d'Assistante de recrutement : nativel.rh@disciplina.re / 0692 44 37 99",
                    "Mayli ARMOUET en qualité d'Assistante de recrutement : armouet.rh@disciplina.re / 0693 06 92 21",
                    'Alexia TURPIN en qualité de Responsable administrative : turpin.administration@disciplina.re / 06 93 06 92 13',
                    'Emma NIRLO en qualité de Coordinatrice pédagogique CFA : nirlo.pedagogie@disciplina.re / 0693 06 92 17',
                    "Nolwenn ALEX en qualité d'Assistante pédagogique CFA : alex.pedagogie@disciplina.re / 0692 51 78 51",
                ],
            },
            {
                title: 'DISCIPLINA Sud : 249 avenue du Général de Gaulle, 97410 Saint-Pierre',
                people: [
                    'Céline BOYER en qualité de Responsable de recrutement : boyer.rh@disciplina.re / 0693 88 80 23',
                ],
            },
        ],
        signatureAssets: {
            mandatFile: 'Mandat pour la publication d’une offre d’emploi (1).pdf',
            catalogueFile: 'Catalogue Disciplina.pdf',
            catalogueName: 'Catalogue Disciplina',
        },
    },
    annemasse: {
        brandColor: '#60207E',
        legal: {
            companyName: 'DISCIPLINA ANNEMASSE',
            address: '6 rue du Parc, Blue Business Building, 74100 Annemasse',
            siret: '13037296400010',
            activityDeclaration:
                "Déclaration d'activité enregistrée sous le n° 84740586174. Cet enregistrement ne vaut pas agrément de l'Etat",
            updatedAt: '05/11/2026',
        },
        // Contacts repris du catalogue et du mandat Annemasse fournis dans
        // assets/. À compléter avec les commerciaux / RH du tenant quand la
        // liste nominative sera disponible.
        contacts: [
            {
                title: 'DISCIPLINA Annemasse : 6 rue du Parc, Blue Business Building, 74100 Annemasse',
                people: [
                    'Lorenzo ENCATASSAMY en qualité de Responsable',
                    'Contact : contact@disciplina-annemasse.fr / 06 73 57 02 44',
                    'Céline Boyer en qualité de Responsable : boyer.responsable@disciplina-annemasse.fr / 0673 57 02 44'
                ],
            },
        ],
        signatureAssets: {
            mandatFile: 'Mandat pour la publication d’une offre d’emploi (Annemasse).pdf',
            catalogueFile: 'Catalogue Disciplina Annemasse.pdf',
            catalogueName: 'Catalogue Disciplina Annemasse',
        },
    },
};

/** Contenu documentaire du tenant courant (résolu via l'ALS de `db/tenant`). */
export function tenantDocuments(region: Region = getRegion()): TenantDocumentConfig {
    return TENANT_DOCUMENTS[region];
}
