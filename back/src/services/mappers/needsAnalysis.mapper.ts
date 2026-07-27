import {
    NeedsAnalysisWriteInput,
    NeedsAnalysis as NeedsAnalysisDocument,
    CompanyInfos,
    Referents,
    Position,
    OfferCriteria,
    CompanyRegion,
    NeedsAnalysisStatus,
    TrainingDomain,
} from '../../types/needsAnalysisNoSql.types';
import { Companies } from '../../types/company.types';
import { ZONE_TO_COMMUNES, DOMAIN_TO_TP, TITLE_TO_TP, Zone } from './abToOffer';

type Saler = { id?: number; email?: string | null } | null | undefined;

// Domaine (unions de string) et document Mongo (enums) partagent des valeurs identiques :
// les casts `as unknown as` traversent la frontière sans conversion de valeur.

const COMMUNE_TO_ZONE = new Map<string, Zone>();
for (const [zone, communes] of Object.entries(ZONE_TO_COMMUNES)) {
    for (const commune of communes) {
        COMMUNE_TO_ZONE.set(commune, zone as Zone);
    }
}

export function zoneFromCommunes(communes: string[] | undefined, fallback: Zone): Zone {
    const first = communes?.[0];
    return (first && COMMUNE_TO_ZONE.get(first)) || fallback;
}

function buildPosition(position: Position): Position {
    const c = position.criteria ?? {};
    const trainingDomain =
        position.training_domain ??
        (position as any).trainingDomain ??
        c.training_domain ??
        (c as any).trainingDomain ??
        null;
    const tDomain = trainingDomain as TrainingDomain | null;
    const criteria: OfferCriteria = {
        education_level: c.education_level ?? (c as any).educationLevel ?? null,
        driving_license: c.driving_license ?? (c as any).drivingLicense ?? false,
        experience_required: c.experience_required ?? (c as any).experienceRequired ?? false,
        training_domain: trainingDomain,
        age_min: c.age_min ?? (c as any).ageMin ?? null,
        age_max: c.age_max ?? (c as any).ageMax ?? null,
        desired_sex: c.desired_sex ?? (c as any).desiredSex ?? null,
        soft_skills: c.soft_skills ?? (c as any).softSkills ?? null,
        schedule_options: c.schedule_options ?? (c as any).scheduleOptions ?? [],
        conditions: c.conditions ?? null,
        additional_comments: c.additional_comments ?? (c as any).additionalComments ?? null,
    };

    return {
        localisation: position.localisation ?? [],
        tp_type: TITLE_TO_TP[position.title ?? ''] ?? (tDomain && DOMAIN_TO_TP[tDomain]) ?? null,
        training_domain: trainingDomain,
        job_role: position.job_role ?? (position as any).jobRole ?? null,
        title: position.title,
        missions: position.missions ?? [],
        description_missions: position.description_missions ?? (position as any).descriptionMissions ?? [],
        other_description_missions:
            position.other_description_missions ?? (position as any).otherDescriptionMissions ?? null,
        other_missions: position.other_missions ?? (position as any).otherMissions ?? null,
        count: position.count ?? 1,
        criteria,
    };
}

function buildCompanyInfos(data: NeedsAnalysisWriteInput, company: Companies, region: Zone): CompanyInfos {
    return {
        id: company.id,
        name: company.name ?? undefined,
        ape: company.ape ?? null,
        idcc: company.idcc ?? null,
        siret: company.siret ?? undefined,
        main_activity: company.mainActivity ?? null,
        opco: data.opco ?? null,
        referral_source: data.referralSource ?? null,
        sector: region as unknown as CompanyRegion,
        activities: data.companySectors ?? [],
        description: data.companyDescription ?? null,
        postal_code: data.postalCode ?? null,
        commune: data.commune ?? null,
    };
}

export function buildReferents(data: NeedsAnalysisWriteInput, company: Companies): Referents {
    return {
        is_same: (data.recruitmentResponsibleEmail ?? null) === (company.email ?? null),
        legal_referents: {
            name: company.legalReferent ?? null,
            phone: company.phone ?? null,
            email: company.email ?? null,
            function: data.legalRepFunction ?? null,
        },
        recruitment_referents: {
            name: data.recruitmentResponsibleName ?? null,
            phone: data.recruitmentResponsiblePhone ?? null,
            email: data.recruitmentResponsibleEmail ?? null,
            function: data.recruitmentResponsibleFunction ?? null,
        },
    };
}

export function toNeedsAnalysisDocument(
    data: NeedsAnalysisWriteInput,
    company: Companies,
    saler: Saler,
): NeedsAnalysisDocument {
    const positions = data.positions ?? [];
    const region = zoneFromCommunes(positions[0]?.localisation, 'NORD');
    const now = new Date();

    return {
        _id: data.id,
        company_infos: buildCompanyInfos(data, company, region),
        saler_info: { id: data.userID, email: saler?.email ?? undefined },
        referents: buildReferents(data, company),
        positions: positions.map(buildPosition),
        recruitment_method: data.recruitmentMethod,
        immersion_period: data.immersionPeriod,
        training_days: data.trainingDays,
        signature_request_id: data.yousignSignatureRequestID ?? null,
        status: data.status ?? NeedsAnalysisStatus.BROUILLON,
        created_at: data.createdAt ? new Date(data.createdAt) : now,
        updated_at: now,
    };
}

function toGqlPosition(p: Position) {
    const c = p.criteria ?? {};
    return {
        localisation: p.localisation ?? [],
        tpType: p.tp_type ?? null,
        trainingDomain: p.training_domain ?? null,
        jobRole: p.job_role ?? null,
        title: p.title ?? '',
        missions: p.missions ?? [],
        descriptionMissions: p.description_missions ?? [],
        otherDescriptionMissions: p.other_description_missions ?? null,
        otherMissions: p.other_missions ?? null,
        count: p.count ?? 1,
        criteria: p.criteria
            ? {
                  educationLevel: c.education_level ?? null,
                  drivingLicense: c.driving_license ?? false,
                  experienceRequired: c.experience_required ?? false,
                  trainingDomain: c.training_domain ?? null,
                  ageMin: c.age_min ?? null,
                  ageMax: c.age_max ?? null,
                  desiredSex: c.desired_sex ?? null,
                  softSkills: c.soft_skills ?? null,
                  scheduleOptions: c.schedule_options ?? [],
                  conditions: c.conditions ?? null,
                  additionalComments: c.additional_comments ?? null,
              }
            : null,
    };
}

export function toNeedsAnalysis(doc: NeedsAnalysisDocument) {
    const positions = (doc.positions ?? []).map(toGqlPosition);

    return {
        id: String(doc._id),
        companyInfos: doc.company_infos
            ? {
                  id: doc.company_infos.id ?? null,
                  name: doc.company_infos.name ?? null,
                  ape: doc.company_infos.ape ?? null,
                  idcc: doc.company_infos.idcc ?? null,
                  siret: doc.company_infos.siret ?? null,
                  mainActivity: doc.company_infos.main_activity ?? null,
                  opco: doc.company_infos.opco ?? null,
                  referralSource: doc.company_infos.referral_source ?? null,
                  sector: doc.company_infos.sector ?? null,
                  activities: doc.company_infos.activities ?? [],
                  description: doc.company_infos.description ?? null,
                  postalCode: doc.company_infos.postal_code ?? null,
                  commune: doc.company_infos.commune ?? null,
              }
            : null,
        salerInfo: doc.saler_info ? { id: doc.saler_info.id ?? null, email: doc.saler_info.email ?? null } : null,
        referents: doc.referents
            ? {
                  isSame: doc.referents.is_same ?? false,
                  legalReferents: doc.referents.legal_referents
                      ? {
                            name: doc.referents.legal_referents.name ?? null,
                            phone: doc.referents.legal_referents.phone ?? null,
                            email: doc.referents.legal_referents.email ?? null,
                            function: doc.referents.legal_referents.function ?? null,
                        }
                      : null,
                  recruitmentReferents: doc.referents.recruitment_referents
                      ? {
                            name: doc.referents.recruitment_referents.name ?? null,
                            phone: doc.referents.recruitment_referents.phone ?? null,
                            email: doc.referents.recruitment_referents.email ?? null,
                            function: doc.referents.recruitment_referents.function ?? null,
                        }
                      : null,
              }
            : null,
        positionsCount: positions.reduce((sum, p) => sum + (p.count ?? 1), 0),
        positions,
        recruitmentMethod: doc.recruitment_method ?? null,
        immersionPeriod: doc.immersion_period ?? null,
        trainingDays: doc.training_days ?? '{}',
        yousignSignatureRequestID: doc.signature_request_id ?? null,
        status: doc.status ?? NeedsAnalysisStatus.BROUILLON,
        createdAt: doc.created_at ? new Date(doc.created_at).toISOString() : undefined,
        updatedAt: doc.updated_at ? new Date(doc.updated_at).toISOString() : undefined,
    };
}

export type NeedsAnalysisGql = ReturnType<typeof toNeedsAnalysis>;
