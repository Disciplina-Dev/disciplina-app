import {
    NeedsAnalysisWriteInput,
    NeedsAnalysis as NeedsAnalysisDocument,
    CompanyInfos,
    Referents,
    Position,
    PositionTp,
    OfferCriteria,
    ScheduleSlot,
    CompanyRegion,
    NeedsAnalysisStatus,
} from '../../types/needsAnalysisNoSql.types';
import { Companies } from '../../types/company.types';
import { ZONE_TO_COMMUNES, Zone } from './abToOffer';

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

// Créneaux horaires saisis dans le formulaire (camelCase GraphQL) → forme Mongo (snake_case).
// Un slot hérité en chaîne brute (ancien format `string[]`) est conservé tel quel.
function toScheduleSlot(slot: any): ScheduleSlot {
    if (typeof slot === 'string') return slot as unknown as ScheduleSlot;
    return {
        day: slot.day ?? null,
        start_hour: slot.start_hour ?? slot.startHour ?? null,
        end_hour: slot.end_hour ?? slot.endHour ?? null,
    };
}

// Forme Mongo → camelCase GraphQL pour la lecture (gère l'héritage `string[]`).
export function toScheduleSlotGql(slot: any) {
    if (typeof slot === 'string') return { day: null, startHour: slot, endHour: null };
    return {
        day: slot?.day ?? null,
        startHour: slot?.start_hour ?? null,
        endHour: slot?.end_hour ?? null,
    };
}

function buildPositionTp(tp: any): PositionTp {
    return {
        tp_type: tp.tp_type ?? tp.tpType ?? null,
        missions: tp.missions ?? [],
        description_missions: tp.description_missions ?? tp.descriptionMissions ?? [],
        other_missions: tp.other_missions ?? tp.otherMissions ?? null,
        other_description_missions: tp.other_description_missions ?? tp.otherDescriptionMissions ?? null,
    };
}

function buildPosition(position: Position): Position {
    const c = position.criteria ?? {};
    const trainingDomain =
        position.training_domain ??
        (position as any).trainingDomain ??
        c.training_domain ??
        (c as any).trainingDomain ??
        null;
    const criteria: OfferCriteria = {
        education_level: c.education_level ?? (c as any).educationLevel ?? null,
        driving_license: c.driving_license ?? (c as any).drivingLicense ?? false,
        has_vehicle: c.has_vehicle ?? (c as any).hasVehicle ?? false,
        experience_required: c.experience_required ?? (c as any).experienceRequired ?? false,
        training_domain: trainingDomain,
        age_min: c.age_min ?? (c as any).ageMin ?? null,
        age_max: c.age_max ?? (c as any).ageMax ?? null,
        desired_sex: c.desired_sex ?? (c as any).desiredSex ?? null,
        soft_skills: c.soft_skills ?? (c as any).softSkills ?? null,
        schedule_options: (c.schedule_options ?? (c as any).scheduleOptions ?? []).map(toScheduleSlot),
        conditions: c.conditions ?? null,
        additional_comments: c.additional_comments ?? (c as any).additionalComments ?? null,
    };

    return {
        localisation: position.localisation ?? [],
        desired_tp: (position.desired_tp ?? (position as any).desiredTp ?? []).map(buildPositionTp),
        training_domain: trainingDomain,
        job_role: position.job_role ?? (position as any).jobRole ?? null,
        title: position.title,
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
    const legalName = company.legalReferent ?? null;
    const legalPhone = company.phone ?? null;
    const legalEmail = company.email ?? null;
    const recName = data.recruitmentResponsibleName ?? null;
    const recPhone = data.recruitmentResponsiblePhone ?? null;
    const recEmail = data.recruitmentResponsibleEmail ?? null;
    const recFunction = data.recruitmentResponsibleFunction ?? null;
    // is_same true only when every recruitment field is empty or exactly equals the legal referent.
    // A single differing field (name, phone, email or function) means the recruitment contact is distinct
    // and both contacts should be displayed on the offer.
    const isSame =
        (recName == null || recName === legalName) &&
        (recPhone == null || recPhone === legalPhone) &&
        (recEmail == null || recEmail === legalEmail) &&
        (recFunction == null || recFunction === (data.legalRepFunction ?? null));
    return {
        is_same: isSame,
        legal_referents: {
            name: legalName,
            phone: legalPhone,
            email: legalEmail,
            function: data.legalRepFunction ?? null,
        },
        recruitment_referents: {
            name: recName,
            phone: recPhone,
            email: recEmail,
            function: recFunction,
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
        tags: data.tags ?? [],
        created_at: data.createdAt ? new Date(data.createdAt) : now,
        updated_at: now,
    };
}

function toGqlPositionTp(tp: PositionTp) {
    return {
        tpType: tp.tp_type ?? null,
        missions: tp.missions ?? [],
        descriptionMissions: tp.description_missions ?? [],
        otherDescriptionMissions: tp.other_description_missions ?? null,
        otherMissions: tp.other_missions ?? null,
    };
}

function toGqlPosition(p: Position) {
    const c = p.criteria ?? {};
    return {
        localisation: p.localisation ?? [],
        desiredTp: (p.desired_tp ?? []).map(toGqlPositionTp),
        trainingDomain: p.training_domain ?? null,
        jobRole: p.job_role ?? null,
        title: p.title ?? '',
        count: p.count ?? 1,
        criteria: p.criteria
            ? {
                  educationLevel: c.education_level ?? null,
                  drivingLicense: c.driving_license ?? false,
                  hasVehicle: (c as any).has_vehicle ?? (c as any).hasVehicle ?? false,
                  experienceRequired: c.experience_required ?? false,
                  trainingDomain: c.training_domain ?? null,
                  ageMin: c.age_min ?? null,
                  ageMax: c.age_max ?? null,
                  desiredSex: c.desired_sex ?? null,
                  softSkills: c.soft_skills ?? null,
                  scheduleOptions: (c.schedule_options ?? []).map(toScheduleSlotGql),
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
            ? (() => {
                  const legal = doc.referents.legal_referents
                      ? {
                            name: doc.referents.legal_referents.name ?? null,
                            phone: doc.referents.legal_referents.phone ?? null,
                            email: doc.referents.legal_referents.email ?? null,
                            function: doc.referents.legal_referents.function ?? null,
                        }
                      : null
                  const recruit = doc.referents.recruitment_referents
                      ? {
                            name: doc.referents.recruitment_referents.name ?? null,
                            phone: doc.referents.recruitment_referents.phone ?? null,
                            email: doc.referents.recruitment_referents.email ?? null,
                            function: doc.referents.recruitment_referents.function ?? null,
                        }
                      : null
                  const hasRecruit = !!(recruit?.name || recruit?.phone || recruit?.email || recruit?.function)
                  const actuallySame = !hasRecruit || (
                      (recruit?.name ?? null) === (legal?.name ?? null) &&
                      (recruit?.phone ?? null) === (legal?.phone ?? null) &&
                      (recruit?.email ?? null) === (legal?.email ?? null) &&
                      (recruit?.function ?? null) === (legal?.function ?? null)
                  )
                  const isSame = actuallySame ? (doc.referents.is_same ?? actuallySame) : false
                  return {
                      isSame,
                      legalReferents: legal,
                      recruitmentReferents: recruit,
                  }
              })()
            : null,
        positionsCount: positions.reduce((sum, p) => sum + (p.count ?? 1), 0),
        positions,
        recruitmentMethod: doc.recruitment_method ?? null,
        immersionPeriod: doc.immersion_period ?? null,
        trainingDays: doc.training_days ?? '{}',
        yousignSignatureRequestID: doc.signature_request_id ?? null,
        status: doc.status ?? NeedsAnalysisStatus.BROUILLON,
        tags: doc.tags ?? [],
        createdAt: doc.created_at ? new Date(doc.created_at).toISOString() : undefined,
        updatedAt: doc.updated_at ? new Date(doc.updated_at).toISOString() : undefined,
    };
}

export type NeedsAnalysisGql = ReturnType<typeof toNeedsAnalysis>;
