import { Candidate, CandidateStatus, normalizeTpCode, normalizeTpCodes } from '../../types/candidate.types';
import { Offer } from '../../types/offer.types';
import { FilizStudentInfos } from '../../external/filiz/type';
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
        immersionSchedule: ((candidate as any).immersion_schedule ?? []).map((s: any) =>
            typeof s === 'string'
                ? { day: null, startHour: s, endHour: null }
                : {
                      day: s?.day ?? null,
                      startHour: s?.start_hour ?? (s as any)?.startHour ?? null,
                      endHour: s?.end_hour ?? (s as any)?.endHour ?? null,
                  },
        ),
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

// Champs que Filiz exige et qu'on ne peut pas deviner : mieux vaut refuser que d'envoyer une valeur inventée.
export function missingFilizStudentFields(candidate: Candidate): string[] {
    const identity = candidate.identity ?? ({} as Candidate['identity']);
    const missing: string[] = [];
    if (!identity.full_name?.trim()) missing.push('full_name');
    if (!identity.email) missing.push('email');
    if (!identity.date_of_birth || Number.isNaN(new Date(identity.date_of_birth).getTime()))
        missing.push('date_of_birth');
    if (!identity.place_of_birth) missing.push('place_of_birth');
    if (identity.sex !== 'F' && identity.sex !== 'M') missing.push('sex');
    return missing;
}

export function mapCandidateToFilizStudent(candidate: Candidate): FilizStudentInfos {
    const { firstName, lastName } = splitFullName(candidate.identity.full_name ?? '');

    // Date en MM/DD/YYYY (format attendu par Filiz), en UTC pour ne pas dépendre du fuseau du serveur.
    const dob = candidate.identity.date_of_birth ? new Date(candidate.identity.date_of_birth) : null;
    const birthDate =
        dob && !Number.isNaN(dob.getTime())
            ? `${String(dob.getUTCMonth() + 1).padStart(2, '0')}/${String(dob.getUTCDate()).padStart(2, '0')}/${dob.getUTCFullYear()}`
            : '';

    return {
        firstName,
        lastName,
        mailAddress: candidate.identity.email,
        address: {
            street: candidate.identity.address ?? '',
            city: candidate.identity.city ?? '',
            country: 'France',
            postcode: candidate.identity.postal_code ?? '',
        },
        birthDate,
        cityOfBirth: candidate.identity.place_of_birth ?? '',
        departmentOfBirth: candidate.identity.department_of_birth ?? '97400',
        nationality: 1,
        phoneNumber: parseFilizPhone(candidate.identity.phone ?? ''),
        sexe: candidate.identity.sex === 'F' ? 2 : 1,
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
