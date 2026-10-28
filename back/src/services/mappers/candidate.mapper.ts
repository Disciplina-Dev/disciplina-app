import {
    Candidate,
    CandidateStatus,
    NationalityCode,
    normalizeTpCode,
    normalizeTpCodes,
} from '../../types/candidate.types';
import { Offer } from '../../types/offer.types';
import { FilizPersonInfos, FilizStudentInfos } from '../../external/filiz/type';
import { MASKED_SSN } from '../../external/crypto/ssn-cipher';

export function camelToSnakeCase(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(camelToSnakeCase);
    const result: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            result[snakeKey] = camelToSnakeCase(obj[key]);
        }
    }
    return result;
}

export function snakeToCamelCase(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) return obj.map(snakeToCamelCase);
    const result: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const camelKey = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
            result[camelKey] = snakeToCamelCase(obj[key]);
        }
    }
    return result;
}

export function candidateToGql(candidate: Candidate): any {
    return {
        id: candidate._id,
        owner: candidate.owner
            ? {
                  userId: candidate.owner.user_id,
                  name: candidate.owner.name,
                  sector: candidate.owner.sector ?? null,
              }
            : null,
        // Rétro-compat : le statut "MATCHED" a été retiré ; les fiches legacy le portant
        // sont ramenées à "SEEKING" à la lecture (l'enum GraphQL ne l'accepte plus).
        status: (candidate.status as string) === 'MATCHED' ? CandidateStatus.SEEKING : candidate.status,
        writtenTestScore: candidate.written_test_score ?? null,
        testAverage: candidate.test_average ?? null,
        testFailurePending: candidate.test_failure_pending ?? null,
        // Rétro-compat : les fiches écrites avant le renommage portent encore « SA ».
        tpTypes: normalizeTpCodes(candidate.tp_types ?? []),
        trainingSite: candidate.training_site,
        trainingSites: candidate.training_sites ?? (candidate.training_site ? [candidate.training_site] : []),
        immersionAgreement: candidate.immersion_agreement,
        immersionStartDate: candidate.immersion_start_date
            ? new Date(candidate.immersion_start_date).toISOString()
            : null,
        immersionEndDate: candidate.immersion_end_date ? new Date(candidate.immersion_end_date).toISOString() : null,
        immersionCompanyId: candidate.immersion_company_id ?? null,
        immersionCompanyName: candidate.immersion_company_name ?? null,
        immersionConventionNumber: (candidate as any).immersion_convention_number ?? null,
        // Legacy : un créneau continu (`start_hour`/`end_hour`) devient
        // « matin début → après-midi fin » sans heure de coupure, ce qui reste
        // un horaire continu côté affichage.
        immersionSchedule: ((candidate as any).immersion_schedule ?? []).map((s: any) => {
            if (typeof s === 'string') {
                return {
                    day: null,
                    morningStartHour: s,
                    morningEndHour: null,
                    afternoonStartHour: null,
                    afternoonEndHour: null,
                };
            }
            const legacyStart = s?.start_hour ?? s?.startHour ?? null;
            const legacyEnd = s?.end_hour ?? s?.endHour ?? null;
            return {
                day: s?.day ?? null,
                morningStartHour: s?.morning_start_hour ?? s?.morningStartHour ?? legacyStart,
                morningEndHour: s?.morning_end_hour ?? s?.morningEndHour ?? null,
                afternoonStartHour: s?.afternoon_start_hour ?? s?.afternoonStartHour ?? null,
                afternoonEndHour: s?.afternoon_end_hour ?? s?.afternoonEndHour ?? legacyEnd,
            };
        }),
        contractOfferId: candidate.contract_offer_id ?? null,
        contractCompanyId: candidate.contract_company_id ?? null,
        contractCompanyName: candidate.contract_company_name ?? null,
        contractStartDate: candidate.contract_start_date ? new Date(candidate.contract_start_date).toISOString() : null,
        contractTrialEndDate: candidate.contract_trial_end_date
            ? new Date(candidate.contract_trial_end_date).toISOString()
            : null,
        contractSessionId: candidate.contract_session_id ?? null,
        contractSessionName: candidate.contract_session_name ?? null,
        desiredSectors: candidate.desired_sectors,
        expectedCompanySkills: candidate.expected_company_skills,
        identity: candidate.identity
            ? {
                  ...snakeToCamelCase(candidate.identity),
                  socialSecurityNumber: candidate.identity.social_security_number ? MASKED_SSN : undefined,
              }
            : null,
        emergencyContact: candidate.emergency_contact ? snakeToCamelCase(candidate.emergency_contact) : null,
        consentments: candidate.consentments
            ? {
                  ...snakeToCamelCase(candidate.consentments),
                  // fiches legacy sans date/version : les champs GraphQL sont non-null
                  consentDate: candidate.consentments.consent_date
                      ? new Date(candidate.consentments.consent_date).toISOString()
                      : '',
                  consentVersion: candidate.consentments.consent_version ?? '',
              }
            : null,
        education: candidate.education ? snakeToCamelCase(candidate.education) : null,
        support: candidate.support ? snakeToCamelCase(candidate.support) : null,
        background: candidate.background ? snakeToCamelCase(candidate.background) : null,
        profile: candidate.profile ? snakeToCamelCase(candidate.profile) : null,
        professionalProjects: candidate.professional_projects
            ? snakeToCamelCase(candidate.professional_projects)
            : null,
        skillsAssessment: candidate.skills_assessment
            ? candidate.skills_assessment.map((s) => snakeToCamelCase(s))
            : null,
        jobInfo: candidate.job_info ? snakeToCamelCase(candidate.job_info) : null,
        synthesis: candidate.synthesis ? snakeToCamelCase(candidate.synthesis) : null,
        pdfLink: candidate.pdf_link || null,
        cvLink: candidate.cv_link || null,
        driveFolderId: candidate.drive_folder_id || null,
        driveFolderLink: candidate.drive_folder_link || null,
        filizFolderId: candidate.filiz_folder_id || null,
        photoLink: candidate.photo_link || null,
        createdAt: candidate.created_at ? new Date(candidate.created_at).toISOString() : null,
        lastRelanceAt: candidate.last_relance_at ? new Date(candidate.last_relance_at).toISOString() : null,
        relanceResponseAt: candidate.relance_response_at ? new Date(candidate.relance_response_at).toISOString() : null,
        // Compteur : champ dédié, avec repli sur l'historique puis sur l'ancien
        // horodatage seul (fiches relancées avant l'introduction du compteur).
        relanceCount:
            candidate.relance_count ?? candidate.relance_history?.length ?? (candidate.last_relance_at ? 1 : 0),
        relanceHistory: (candidate.relance_history ?? []).map((e) => ({
            sentAt: e.sent_at ? new Date(e.sent_at).toISOString() : null,
            kind: e.kind ?? null,
            templateId: e.template_id ?? null,
            subject: e.subject ?? null,
            sentBy: e.sent_by ?? null,
            responseAt: e.response_at ? new Date(e.response_at).toISOString() : null,
            answer: e.answer ?? null,
        })),
    };
}

// Indicatifs à 3 chiffres (DOM-TOM) ; tout autre indicatif international est lu sur 2 chiffres.
const THREE_DIGIT_DIAL_CODES = new Set(['262', '508', '590', '594', '596', '681', '687', '689']);

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
    const tokens = fullName.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return { firstName: '', lastName: '' };
    // Convention « Prénom(s) NOM(S) » : le nom commence au premier mot entièrement en majuscules.
    const lastNameStart = tokens.findIndex(
        (t, i) => i > 0 && t.length > 1 && t === t.toUpperCase() && t !== t.toLowerCase(),
    );
    const split = lastNameStart > 0 ? lastNameStart : 1;
    return { firstName: tokens.slice(0, split).join(' '), lastName: tokens.slice(split).join(' ') };
}

export function parseFilizPhone(rawPhone: string): { dialCode: string; number: string } {
    const compact = rawPhone.replace(/[\s.\-()]/g, '');
    const international = compact.match(/^(?:\+|00)(\d+)$/);
    if (international) {
        const digits = international[1];
        const dialCode = THREE_DIGIT_DIAL_CODES.has(digits.slice(0, 3)) ? digits.slice(0, 3) : digits.slice(0, 2);
        return { dialCode, number: digits.slice(dialCode.length).replace(/^0/, '') };
    }
    // Numéro local : indicatif Réunion pour les préfixes 0262/0692/0693, France métropolitaine sinon.
    const dialCode = /^0(262|692|693)/.test(compact) ? '262' : '33';
    return { dialCode, number: compact };
}

const isValidDate = (d: unknown): boolean => !!d && !Number.isNaN(new Date(d as string).getTime());

// Sexe saisi dans la fiche (FILLE/GARCON) ou hérité d'anciens imports (F/M) → code Filiz (1 homme, 2 femme).
function filizSex(sex: string | undefined): 1 | 2 | null {
    if (sex === 'GARCON' || sex === 'M') return 1;
    if (sex === 'FILLE' || sex === 'F') return 2;
    return null;
}

// Majorité à la date `now` ; null si la date de naissance est absente ou invalide.
export function isAdult(candidate: Candidate, now = new Date()): boolean | null {
    const dob = candidate.identity?.date_of_birth;
    if (!isValidDate(dob)) return null;
    const birth = new Date(dob as Date);
    let age = now.getUTCFullYear() - birth.getUTCFullYear();
    const beforeBirthday =
        now.getUTCMonth() < birth.getUTCMonth() ||
        (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
    if (beforeBirthday) age--;
    return age >= 18;
}

// Champs exigés quelle que soit l'étape : mieux vaut refuser que d'envoyer une valeur inventée.
export function missingFilizBasicFields(candidate: Candidate): string[] {
    const identity = candidate.identity ?? ({} as Candidate['identity']);
    const missing: string[] = [];
    const { firstName, lastName } = splitFullName(identity.full_name ?? '');
    if (!firstName || !lastName) missing.push('full_name');
    if (!identity.email) missing.push('email');
    if (!isValidDate(identity.date_of_birth)) missing.push('date_of_birth');
    return missing;
}

// Filiz attend le code du département (974, 2A…), pas son nom : un ancien nom saisi à la main compte comme manquant.
const FILIZ_DEPARTMENT_CODE = /^(\d{2,3}|2[AB])$/;

// Champs supplémentaires exigés pour démarrer aux étapes 3 et 4 (identité complète de l'étudiant).
export function missingFilizStudentFields(candidate: Candidate): string[] {
    const identity = candidate.identity ?? ({} as Candidate['identity']);
    const missing = missingFilizBasicFields(candidate);
    if (!identity.place_of_birth) missing.push('place_of_birth');
    if (!FILIZ_DEPARTMENT_CODE.test(identity.department_of_birth ?? '')) missing.push('department_of_birth');
    if (identity.born_in_france == null) missing.push('born_in_france');
    if (identity.nationality == null) missing.push('nationality');
    if (identity.nationality === 3 && identity.residence_permit == null) missing.push('residence_permit');
    if (filizSex(identity.sex) == null) missing.push('sex');
    if (!identity.phone || parseFilizPhone(identity.phone).number.replace(/\D/g, '') === '') missing.push('phone');
    if (!identity.address) missing.push('address');
    if (!identity.postal_code) missing.push('postal_code');
    if (!identity.city) missing.push('city');
    if (!identity.country) missing.push('country');
    return missing;
}

export function mapCandidateToFilizBasics(candidate: Candidate): FilizPersonInfos {
    const { firstName, lastName } = splitFullName(candidate.identity.full_name ?? '');
    return { firstName, lastName, mailAddress: candidate.identity.email };
}

// À n'appeler que si `missingFilizStudentFields` est vide.
export function mapCandidateToFilizStudent(candidate: Candidate): FilizStudentInfos {
    const identity = candidate.identity;

    // Date en MM/DD/YYYY (format attendu par Filiz), en UTC pour ne pas dépendre du fuseau du serveur.
    const dob = identity.date_of_birth ? new Date(identity.date_of_birth) : null;
    const birthDate =
        dob && !Number.isNaN(dob.getTime())
            ? `${String(dob.getUTCMonth() + 1).padStart(2, '0')}/${String(dob.getUTCDate()).padStart(2, '0')}/${dob.getUTCFullYear()}`
            : '';

    return {
        ...mapCandidateToFilizBasics(candidate),
        address: {
            street: identity.address ?? '',
            city: identity.city ?? '',
            country: identity.country ?? '',
            postcode: identity.postal_code ?? '',
        },
        birthDate,
        bornInFrance: identity.born_in_france as boolean,
        cityOfBirth: identity.place_of_birth ?? '',
        departmentOfBirth: identity.department_of_birth ?? '',
        nationality: identity.nationality as NationalityCode,
        ...(identity.nationality === 3 ? { residencePermit: identity.residence_permit } : {}),
        phoneNumber: parseFilizPhone(identity.phone ?? ''),
        sexe: filizSex(identity.sex) as number,
    };
}

export function offerToMatchedOfferGql(offer: Offer, candidateId?: string): object {
    const ageMin = offer.criteria?.age_min;
    const ageMax = offer.criteria?.age_max;
    const ageRange = ageMin != null && ageMax != null ? `${ageMin}-${ageMax}` : undefined;

    let status: string | undefined | null = offer.matching?.status;
    if (candidateId && offer.matching?.candidates) {
        const candidateEntry = offer.matching.candidates.find((mc) => mc.id === candidateId);
        if (candidateEntry?.status) {
            status = candidateEntry.status;
        }
    }

    return {
        id: offer._id,
        needsAnalysisId: offer.needs_analysis_id,
        companyName: offer.company_infos?.name,
        sector: null,
        localisation: offer.localisation,
        desiredTp: (offer.desired_tp ?? []).map((tp) => ({
            tpType: tp.tp_type ? normalizeTpCode(tp.tp_type) : null,
            missions: tp.missions ?? [],
            descriptionMissions: tp.description_missions ?? [],
        })),
        ageRange,
        status,
        title: offer.title,
        jobRole: offer.job_role,
    };
}
