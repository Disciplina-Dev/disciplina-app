import { NeedsAnalysis, NeedsAnalysisPosition } from '../../types/needsAnalysis.types';
import {
    NeedsAnalysis as NeedsAnalysisDocument,
    CompanyInfos,
    Referents,
    Position,
    OfferCriteria,
    CompanyRegion,
} from '../../types/needsAnalysisNoSql.types';
import { Companies } from '../../types/company.types';
import { ZONE_TO_COMMUNES, DOMAIN_TO_TP, Zone } from './abToJob';

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

function buildPosition(position: NeedsAnalysisPosition, analysis: Partial<NeedsAnalysis>): Position {
    const criteria: OfferCriteria = {
        education_level: (analysis.educationLevel ?? null) as unknown as OfferCriteria['education_level'],
        driving_license: analysis.drivingLicense === 'OUI',
        experience_required: analysis.experienceRequired === 'OBLIGATOIRE',
        training_domain: position.trainingDomain as unknown as OfferCriteria['training_domain'],
        age_min: analysis.ageMin ?? null,
        age_max: analysis.ageMax ?? null,
        soft_skills: analysis.softSkills ?? null,
        schedule_options: analysis.scheduleOptions ?? [],
        conditions: analysis.conditions ?? null,
        additional_comments: analysis.additionalComments ?? null,
    };

    return {
        localisation: position.localisation ?? [],
        tp_type: DOMAIN_TO_TP[position.trainingDomain] ?? null,
        training_domain: position.trainingDomain as unknown as Position['training_domain'],
        title: position.jobTitle,
        missions: position.selectedMissions ?? [],
        description_missions: analysis.jobDescriptionMissions ?? [],
        other_description_missions: analysis.jobDescriptionOther ?? null,
        other_missions: analysis.otherMissions ?? null,
        criteria,
    };
}

export function resolvePositions(analysis: Partial<NeedsAnalysis>): NeedsAnalysisPosition[] {
    if (analysis.positions && analysis.positions.length > 0) {
        return analysis.positions;
    }
    if (!analysis.jobTitle) {
        return [];
    }
    return [
        {
            trainingDomain: analysis.trainingDomain ?? 'SECRETARIAT',
            jobTitle: analysis.jobTitle,
            selectedMissions: analysis.selectedMissions ?? [],
            localisation: analysis.localisation ? [analysis.localisation] : [],
        },
    ];
}

function buildCompanyInfos(analysis: Partial<NeedsAnalysis>, company: Companies, region: Zone): CompanyInfos {
    return {
        id: company.id,
        name: company.name ?? undefined,
        ape: company.ape ?? null,
        idcc: company.idcc ?? null,
        siret: company.siret ?? undefined,
        main_activity: company.mainActivity ?? null,
        opco: (analysis.opco ?? null) as unknown as CompanyInfos['opco'],
        referral_source: (analysis.referralSource ?? null) as unknown as CompanyInfos['referral_source'],
        sector: region as unknown as CompanyRegion,
        activities: analysis.companySectors ?? [],
        description: analysis.companyDescription ?? null,
    };
}

export function buildReferents(analysis: Partial<NeedsAnalysis>, company: Companies): Referents {
    return {
        is_same: (analysis.recruitmentResponsibleEmail ?? null) === (company.email ?? null),
        legal_referents: {
            name: company.legalReferent ?? null,
            phone: company.phone ?? null,
            email: company.email ?? null,
            function: analysis.legalRepFunction ?? null,
        },
        recruitment_referents: {
            name: analysis.recruitmentResponsibleName ?? null,
            phone: analysis.recruitmentResponsiblePhone ?? null,
            email: analysis.recruitmentResponsibleEmail ?? null,
            function: analysis.recruitmentResponsibleFunction ?? null,
        },
    };
}

export function toNeedsAnalysisDocument(
    analysis: Partial<NeedsAnalysis>,
    company: Companies,
    saler: Saler,
): NeedsAnalysisDocument {
    const positions = resolvePositions(analysis);
    const region = zoneFromCommunes(positions[0]?.localisation, 'NORD');
    const now = new Date();

    return {
        _id: analysis.id,
        company_infos: buildCompanyInfos(analysis, company, region),
        saler_info: { id: analysis.userID, email: saler?.email ?? undefined },
        referents: buildReferents(analysis, company),
        positions: positions.map((position) => buildPosition(position, analysis)),
        recruitment_method: (analysis.recruitmentMethod ??
            undefined) as unknown as NeedsAnalysisDocument['recruitment_method'],
        immersion_period: (analysis.immersionPeriod ??
            undefined) as unknown as NeedsAnalysisDocument['immersion_period'],
        training_days: analysis.trainingDays,
        signature_request_id: analysis.yousignSignatureRequestID ?? null,
        status: (analysis.status ?? 'BROUILLON') as unknown as NeedsAnalysisDocument['status'],
        created_at: analysis.createdAt ? new Date(analysis.createdAt) : now,
        updated_at: now,
    };
}

export function toNeedsAnalysis(doc: NeedsAnalysisDocument): NeedsAnalysis {
    const positions = doc.positions ?? [];
    const first = positions[0];
    const criteria = first?.criteria ?? {};

    const gqlPositions: NeedsAnalysisPosition[] = positions.map((position) => ({
        trainingDomain: (position.training_domain ??
            'SECRETARIAT') as unknown as NeedsAnalysisPosition['trainingDomain'],
        jobTitle: position.title ?? '',
        selectedMissions: position.missions ?? [],
        localisation: position.localisation ?? [],
    }));

    return {
        id: String(doc._id),
        companyID: doc.company_infos?.id ?? 0,
        userID: doc.saler_info?.id ?? 0,
        legalRepFunction: doc.referents?.legal_referents?.function ?? null,
        recruitmentResponsibleName: doc.referents?.recruitment_referents?.name ?? null,
        recruitmentResponsiblePhone: doc.referents?.recruitment_referents?.phone ?? null,
        recruitmentResponsibleEmail: doc.referents?.recruitment_referents?.email ?? null,
        recruitmentResponsibleFunction: doc.referents?.recruitment_referents?.function ?? null,
        companySectors: doc.company_infos?.activities ?? [],
        companyDescription: doc.company_infos?.description ?? null,
        opco: (doc.company_infos?.opco ?? null) as unknown as NeedsAnalysis['opco'],
        referralSource: (doc.company_infos?.referral_source ?? null) as unknown as NeedsAnalysis['referralSource'],
        positionsCount: gqlPositions.length,
        positions: gqlPositions,
        localisation: gqlPositions[0]?.localisation?.[0] ?? null,
        trainingDomain: (first?.training_domain ?? 'SECRETARIAT') as unknown as NeedsAnalysis['trainingDomain'],
        jobTitle: first?.title ?? '',
        selectedMissions: first?.missions ?? [],
        otherMissions: first?.other_missions ?? null,
        jobDescriptionMissions: first?.description_missions ?? [],
        jobDescriptionOther: first?.other_description_missions ?? null,
        educationLevel: (criteria.education_level ?? null) as unknown as NeedsAnalysis['educationLevel'],
        drivingLicense: criteria.driving_license ? 'OUI' : 'OPTIONNEL',
        experienceRequired: criteria.experience_required ? 'OBLIGATOIRE' : 'DEBUTANT',
        ageRequirements: [],
        ageMin: criteria.age_min ?? null,
        ageMax: criteria.age_max ?? null,
        softSkills: criteria.soft_skills ?? null,
        scheduleOptions: criteria.schedule_options ?? [],
        conditions: criteria.conditions ?? null,
        additionalComments: criteria.additional_comments ?? null,
        recruitmentMethod: (doc.recruitment_method ?? 'ALL_CV') as unknown as NeedsAnalysis['recruitmentMethod'],
        immersionPeriod: (doc.immersion_period ?? 'NON') as unknown as NeedsAnalysis['immersionPeriod'],
        trainingDays: doc.training_days ?? '{}',
        yousignSignatureRequestID: doc.signature_request_id ?? null,
        status: (doc.status ?? 'BROUILLON') as unknown as NeedsAnalysis['status'],
        createdAt: doc.created_at ? new Date(doc.created_at).toISOString() : undefined,
        updatedAt: doc.updated_at ? new Date(doc.updated_at).toISOString() : undefined,
    };
}
