import { OfferRepository } from '../repositories/mongo/OfferRepository';
import { CandidateRepository } from '../repositories/mongo/CandidateRepository';
import { Offer } from '../types/offer.types';
import { CompaniesService } from './CompaniesService';
import { CandidateService } from './CandidateService';
import { Candidate, CandidateHistoryType, CandidateStatus } from '../types/candidate.types';
import { CandidateHistoryService } from './CandidateHistoryService';
import { OfferHistoryService } from './OfferHistoryService';
import {
    InterviewConclusion,
    ImmersionConclusion,
    Localisation,
    OfferStatus,
    MatchedCandidateStatus,
    MatchingCandidate,
    Sex,
} from '../types/matching.types';
import { signMatchUrl } from '../external/crypto';
import { env } from '../config/env';
import { isInterviewDatePast } from '../utils/interview';
import { NotificationService } from './NotificationService';
import { UserRepository } from '../repositories/mysql/UserRepository';
import { regionFromSector } from '../utils/sector';
import { ZONE_TO_COMMUNES } from './mappers/abToOffer';
import { offerTpCodes, positionTpToGql } from './mappers/offer.mapper';
import type { DriveRegion } from './DriveFolderConfigService';
import { buildMatchingLink } from '../utils/matchingLink';

// Statuts d'un candidat déjà transmis à l'entreprise (vue « proposés »).
const PROPOSED_STATUSES = [
    MatchedCandidateStatus.SEND,
    MatchedCandidateStatus.REFUSED,
    MatchedCandidateStatus.CONTRACT,
    MatchedCandidateStatus.INTERVIEW,
    MatchedCandidateStatus.IMMERSING,
];

const INTERVIEW_CONCLUSION_TO_CANDIDATE_STATUS: Record<InterviewConclusion, CandidateStatus> = {
    [InterviewConclusion.REJECTED]: CandidateStatus.SEEKING,
    [InterviewConclusion.IMMERSING]: CandidateStatus.IMMERSING,
    [InterviewConclusion.CONTRACT]: CandidateStatus.CONTRACT,
};

const IMMERSION_CONCLUSION_TO_CANDIDATE_STATUS: Record<ImmersionConclusion, CandidateStatus> = {
    [ImmersionConclusion.REJECTED]: CandidateStatus.SEEKING,
    [ImmersionConclusion.CONTRACT]: CandidateStatus.CONTRACT,
};

const MATCHED_STATUS_LABELS: Partial<Record<MatchedCandidateStatus, string>> = {
    [MatchedCandidateStatus.PRE_SELECTED]: 'pré-sélectionné',
    [MatchedCandidateStatus.PRE_SELECTED_MAIL_SEND]: 'proposition envoyée au candidat',
    [MatchedCandidateStatus.DECLINED]: 'proposition déclinée par le candidat',
    [MatchedCandidateStatus.ACCEPTED]: 'proposition acceptée par le candidat',
    [MatchedCandidateStatus.SEND]: 'CV transmis à l’entreprise',
    [MatchedCandidateStatus.REFUSED]: 'refusé par l’entreprise',
    [MatchedCandidateStatus.INTERVIEW]: 'retenu pour un entretien',
    [MatchedCandidateStatus.IMMERSING]: 'en immersion',
    [MatchedCandidateStatus.CONTRACT]: 'embauché',
};

function matchingCandidateToGql(mc: MatchingCandidate, cvById?: Record<string, boolean>): object {
    return {
        id: mc.id,
        fullName: mc.full_name,
        age: mc.age,
        sex: mc.sex,
        city: mc.city,
        email: mc.email,
        phone: mc.phone,
        status: mc.status,
        description: mc.description,
        identityDescription: mc.identity_description,
        comment: mc.comment,
        cvWebview: mc.cv_webview,
        hasCv: cvById?.[mc.id ?? ''] ?? Boolean(mc.has_cv),
        interviewLocation: mc.interview_location,
        bookedInterviewSlot: mc.booked_interview_slot,
        interviewConclusion: mc.interview_conclusion,
        immersionStartDate: mc.immersion_start_date,
        immersionEndDate: mc.immersion_end_date,
        immersionLocation: mc.immersion_location,
        immersionConclusion: mc.immersion_conclusion,
    };
}

function proposedCandidateToGql(pc: MatchingCandidate, cvById?: Record<string, boolean>): object {
    return {
        ...matchingCandidateToGql(pc, cvById),
        description: pc.description,
        comment: pc.comment,
        interviewLocation: pc.interview_location,
        bookedInterviewSlot: pc.booked_interview_slot,
        interviewConclusion: pc.interview_conclusion,
        immersionStartDate: pc.immersion_start_date,
        immersionEndDate: pc.immersion_end_date,
        immersionLocation: pc.immersion_location,
        immersionConclusion: pc.immersion_conclusion,
    };
}

function toGql(offer: Offer, suggestedCandidates?: MatchingCandidate[], cvById?: Record<string, boolean>): object {
    const ageMin = offer.criteria?.age_min;
    const ageMax = offer.criteria?.age_max;
    const ageRange = ageMin != null && ageMax != null ? `${ageMin}-${ageMax}` : undefined;
    const candidates = offer.matching?.candidates ?? [];

    return {
        id: offer._id,
        needsAnalysisId: offer.needs_analysis_id,
        companyName: offer.company_infos?.name,
        ageRange,
        desiredTp: (offer.desired_tp ?? []).map(positionTpToGql),
        desiredSex: offer.criteria?.desired_sex ?? 'MIXTE',
        drivingLicencseB: offer.criteria?.driving_license ?? false,
        professionalExperience: offer.criteria?.experience_required ?? false,
        status: offer.matching?.status ?? OfferStatus.NOT_MATCHED,
        localisation: offer.localisation,
        sector: null,
        matched: false,
        matchedCandidate: candidates.map((mc) => matchingCandidateToGql(mc, cvById)),
        suggestedCandidates: suggestedCandidates?.map((mc) => matchingCandidateToGql(mc, cvById)),
        proposedCandidate: candidates
            .filter((c) => c.status && PROPOSED_STATUSES.includes(c.status))
            .map((pc) => proposedCandidateToGql(pc, cvById)),
        interviewSlots: offer.matching?.interview_slots,
        interviewLocation: offer.matching?.interview_location,
        salerInfo: offer.saler_info,
        referents: offer.referents
            ? {
                  isSame: offer.referents.is_same,
                  legalReferents: offer.referents.legal_referents,
                  recruitmentReferents: offer.referents.recruitment_referents,
              }
            : undefined,
        softSkills: offer.criteria?.soft_skills,
        schedule: (offer.criteria?.schedule_options ?? []).map((slot) => ({
            day: slot.day ?? null,
            startHour: slot.start_hour ?? null,
            endHour: slot.end_hour ?? null,
        })),
        companyInfos: offer.company_infos
            ? { id: offer.company_infos.id, name: offer.company_infos.name, activities: offer.company_infos.activities }
            : null,
        title: offer.title,
        jobRole: offer.job_role,
    };
}

function candidateToMatchingCandidate(c: Candidate): MatchingCandidate {
    return {
        id: c._id,
        full_name: c.identity.full_name,
        age: c.identity.age,
        city: c.identity.city,
        email: c.identity.email,
        phone: c.identity.phone,
        sex: c.identity.sex as Sex,
        status: MatchedCandidateStatus.PRE_SELECTED,
        identity_description: c.identity.description,
        has_cv: Boolean(c.cv_link),
    };
}

function deriveOfferStatus(matchedCandidates: MatchingCandidate[], currentStatus?: OfferStatus): OfferStatus {
    if (matchedCandidates.length === 0) return OfferStatus.NOT_MATCHED;

    const manualStages = [OfferStatus.CV_SEND, OfferStatus.IMMERSING, OfferStatus.CONTRACT];
    if (currentStatus && manualStages.includes(currentStatus)) return currentStatus;

    const hasAccepted = matchedCandidates.some((c) => c.status === MatchedCandidateStatus.ACCEPTED);
    return hasAccepted ? OfferStatus.MATCHED : OfferStatus.NOT_MATCHED;
}

export class OfferService {
    private offerRepository = new OfferRepository();
    private candidateRepository = new CandidateRepository();
    private candidateService = new CandidateService();
    private candidateHistoryService = new CandidateHistoryService();
    private offerHistoryService = new OfferHistoryService();
    private companiesService = new CompaniesService();
    private notificationService = new NotificationService();
    private userRepository = new UserRepository();

    async findAll(): Promise<object[]> {
        const offers = await this.offerRepository.listMatchingOffers();
        return offers.map((offer) => toGql(offer));
    }

    async getCompanyInfo(offerId: string): Promise<object | null> {
        const offer = await this.offerRepository.findById(offerId);
        if (!offer) return null;

        const companyId = offer.company_infos?.id;
        const companyName = offer.company_infos?.name;
        const company = companyId ? await this.companiesService.findById(companyId) : null;

        return { companyName: companyName ?? company?.name ?? null, company };
    }

    async find(id: string, userId?: number): Promise<object | null> {
        const offer = await this.offerRepository.findById(id);
        if (!offer) return null;

        const buildFilter = async (includeSectors: boolean): Promise<Record<string, any>> => {
            const filter: Record<string, any> = {};
            filter['status'] = CandidateStatus.SEEKING;

            const tps = offerTpCodes(offer);
            if (tps.length) filter['$or'] = [{ tp_types: { $in: tps } }, { tp_type: { $in: tps } }];
            if (offer.criteria?.driving_license) filter['identity.driving_license_b'] = true;

            if (offer.criteria?.age_min != null && offer.criteria?.age_max != null) {
                filter['identity.age'] = { $gte: offer.criteria.age_min, $lte: offer.criteria.age_max };
            }

            // Le secteur d'activité est un critère de matching relâchable : si les
            // seuls secteurs portés par l'offre sont des secteurs libres (saisis à
            // la main dans l'AB, donc inconnus du référentiel candidat), aucun
            // candidat ne peut correspondre. Dans ce cas on relance la recherche
            // sans ce critère plutôt que de renvoyer une liste vide.
            if (includeSectors && offer.company_infos?.activities?.length) {
                filter['desired_sectors'] = { $in: offer.company_infos.activities };
            }

            let geoFilter: Localisation[] = [];
            if (offer.localisation?.length) geoFilter = [...offer.localisation];

            if (userId) {
                const user = await this.userRepository.findById(userId);
                const userSectors = user?.sectors ?? null;
                const sectors =
                    typeof userSectors === 'string'
                        ? (() => {
                              try {
                                  return JSON.parse(userSectors);
                              } catch {
                                  return [];
                              }
                          })()
                        : userSectors;
                if (sectors?.length) {
                    const userCommunes = (sectors as string[])
                        .map((s) => regionFromSector(s))
                        .filter((r): r is DriveRegion => r !== undefined)
                        .flatMap((r: DriveRegion) => ZONE_TO_COMMUNES[r]);
                    if (userCommunes.length) {
                        geoFilter = geoFilter.length ? geoFilter.filter((c) => userCommunes.includes(c)) : userCommunes;
                    }
                }
            }

            if (geoFilter.length) {
                filter['job_info.geographic_mobility'] = { $in: geoFilter };
            }
            return filter;
        };

        const hasSectors = Boolean(offer.company_infos?.activities?.length);
        let sectorRelaxed = false;
        let candidates = await this.candidateRepository.findByfilter(await buildFilter(true));

        // Secteurs portés par l'offre mais sans aucun candidat correspondant
        // (typiquement des secteurs libres non référencés) → on relâche le critère.
        if (hasSectors && candidates.length === 0) {
            candidates = await this.candidateRepository.findByfilter(await buildFilter(false));
            sectorRelaxed = true;
        }

        const suggestedCandidates = candidates.map(candidateToMatchingCandidate);

        // Statut CV en direct (source de vérité = fiche candidat) pour les
        // candidats déjà retenus, même si le snapshot de matching est plus ancien.
        const matchedIds = (offer.matching?.candidates ?? []).map((c) => c.id).filter(Boolean);
        const cvDocs = matchedIds.length ? await this.candidateRepository.findCvLinksByIds(matchedIds) : [];
        const cvById = Object.fromEntries(cvDocs.map((d) => [String(d._id), Boolean(d.cv_link)]));

        const result = toGql(offer, suggestedCandidates, cvById) as Record<string, unknown>;
        result.relaxedCriteria = sectorRelaxed ? ['sector'] : [];

        const companyId = offer.company_infos?.id;
        if (companyId) {
            const company = await this.companiesService.findById(companyId);
            if (company && result.companyInfos) {
                const ci = result.companyInfos as Record<string, unknown>;
                if (company.address) ci.address = company.address;
                if (company.email) ci.email = company.email;
            }
        }

        return result;
    }

    async update(id: string, data: any): Promise<object | null> {
        if (data.status) {
            const offer = await this.offerRepository.setOfferStatus(id, data.status as OfferStatus);
            return offer ? toGql(offer) : null;
        }
        return null;
    }

    async delete(id: string): Promise<boolean> {
        return this.offerRepository.deleteById(id);
    }

    async deleteByNeedsAnalysisId(needsAnalysisId: string): Promise<number> {
        return this.offerRepository.deleteByNeedsAnalysisId(needsAnalysisId);
    }

    async findByNeedsAnalysisId(needsAnalysisId: string): Promise<object[]> {
        const offers = await this.offerRepository.findByNeedsAnalysisId(needsAnalysisId);
        return offers.map((o) => toGql(o));
    }

    async addCandidate(offerId: string, candidateId: string): Promise<object | null> {
        const candidate = await this.candidateRepository.findById(candidateId);
        if (!candidate) throw new Error('Candidat introuvable');

        const matchingCandidate = candidateToMatchingCandidate(candidate);
        const offer = await this.offerRepository.addMatchedCandidate(offerId, matchingCandidate);
        if (!offer) return null;

        await this.candidateHistoryService.recordAuto(
            candidateId,
            CandidateHistoryType.RH,
            `Le candidat a été pré-sélectionné pour l'entreprise ${offer.company_infos?.name ?? ''}`,
        );

        await this.offerHistoryService.recordAuto(offerId, `Candidat ${candidate.identity.full_name} ajouté à l'offre`);

        const synced = await this.syncDerivedStatus(offerId, offer);
        return toGql(synced);
    }

    async removeCandidate(offerId: string, candidateId: string): Promise<object | null> {
        const candidate = await this.candidateRepository.findById(candidateId);
        const name = candidate?.identity?.full_name ?? candidateId;
        const offer = await this.offerRepository.removeMatchedCandidate(offerId, candidateId);
        if (!offer) return null;

        await this.offerHistoryService.recordAuto(offerId, `Candidat ${name} retiré de l'offre`);

        const synced = await this.syncDerivedStatus(offerId, offer);
        return toGql(synced);
    }

    async unmatchAll(offerId: string): Promise<object | null> {
        const offer = await this.offerRepository.clearMatchedCandidates(offerId);
        if (offer) {
            await this.offerHistoryService.recordAuto(offerId, "Tous les candidats ont été retirés de l'offre");
        }
        return offer ? toGql(offer) : null;
    }

    async getMatchedOfferIds(candidateId: string): Promise<string[]> {
        return this.offerRepository.findOfferIdsWithCandidate(candidateId);
    }

    async getCandidatePlacement(candidateId: string): Promise<object | null> {
        const placements = await this.offerRepository.findPlacementOffers(candidateId);

        let contract: { offer: Offer; pc: MatchingCandidate } | null = null;
        let immersion: { offer: Offer; pc: MatchingCandidate } | null = null;
        for (const offer of placements) {
            const pc = offer.matching?.candidates?.find((c) => c.id === candidateId);
            if (!pc) continue;
            if (
                pc.interview_conclusion === InterviewConclusion.CONTRACT ||
                pc.immersion_conclusion === ImmersionConclusion.CONTRACT
            ) {
                contract = { offer, pc };
            } else if (
                pc.interview_conclusion === InterviewConclusion.IMMERSING &&
                pc.immersion_conclusion !== ImmersionConclusion.REJECTED
            ) {
                immersion = { offer, pc };
            }
        }

        const hit = contract ?? immersion;
        if (!hit) return null;

        const kind = contract ? 'CONTRACT' : 'IMMERSING';
        let since: string | null = null;
        if (kind === 'IMMERSING') {
            since = hit.pc.immersion_start_date ?? null;
        } else {
            const entries = await this.candidateHistoryService.findByCandidate(candidateId);
            const company = hit.offer.company_infos?.name;
            const entry = company ? entries.find((e) => e.description?.includes(`contrat avec ${company}`)) : undefined;
            since = entry?.created_at ? new Date(entry.created_at).toISOString() : null;
        }

        return {
            companyName: hit.offer.company_infos?.name ?? null,
            kind,
            since,
            immersionEndDate: kind === 'IMMERSING' ? (hit.pc.immersion_end_date ?? null) : null,
        };
    }

    async updateMatchedCandidateStatus(offerId: string, candidateId: string, status: string): Promise<object | null> {
        const offer = await this.offerRepository.setMatchedCandidateStatus(
            offerId,
            candidateId,
            status as MatchedCandidateStatus,
        );
        if (!offer) return null;

        const entry = this.candidateHistoryService.buildMatchedStatusHistoryEntry(
            status as MatchedCandidateStatus,
            offer.company_infos?.name,
        );
        if (entry) await this.candidateHistoryService.recordAuto(candidateId, entry.type, entry.description);

        const candidate = offer.matching?.candidates?.find((c) => c.id === candidateId);
        const statusLabel = MATCHED_STATUS_LABELS[status as MatchedCandidateStatus] ?? status;
        await this.offerHistoryService.recordAuto(offerId, `${candidate?.full_name ?? candidateId} : ${statusLabel}`);

        if (status === MatchedCandidateStatus.ACCEPTED || status === MatchedCandidateStatus.DECLINED) {
            await this.notifyRhCandidateAnswer(
                status as MatchedCandidateStatus,
                offerId,
                candidate?.full_name,
                offer.company_infos?.name,
                offer.needs_analysis_id,
            );
        }

        const synced = await this.syncDerivedStatus(offerId, offer);
        return toGql(synced);
    }

    // Le candidat a répondu au mail de proposition : on prévient les RH.
    private async notifyRhCandidateAnswer(
        status: MatchedCandidateStatus,
        offerId: string,
        candidateName?: string,
        companyName?: string,
        needsAnalysisId?: string,
    ): Promise<void> {
        const rhUsers = (await this.userRepository.findByRoleIds([2, 4, 5])) ?? [];
        const name = candidateName ?? 'Un candidat';
        const company = companyName ?? "l'entreprise";
        const accepted = status === MatchedCandidateStatus.ACCEPTED;
        await Promise.all(
            rhUsers.map((user) =>
                this.notificationService.create({
                    userId: user.id,
                    type: 'candidate_offer_answer',
                    category: 'candidate',
                    level: accepted ? 'success' : 'info',
                    title: accepted ? 'Offre acceptée' : 'Offre déclinée',
                    message: `${name} a ${accepted ? 'accepté' : 'refusé'} l'offre de ${company}`,
                    link: buildMatchingLink(offerId, needsAnalysisId),
                }),
            ),
        );
    }

    private async notifyContractSigned(
        salerInfo: { id?: number } | undefined,
        candidateName: string | undefined,
        companyName: string | undefined,
        offerId: string,
        needsAnalysisId?: string,
    ): Promise<void> {
        const name = candidateName ?? 'Un candidat';
        const company = companyName ?? "l'entreprise";
        const type = 'contract_signed';
        const category = 'company' as const;
        const level = 'success' as const;
        const title = 'Contrat signé';
        const message = `${name} a signé un contrat avec ${company}`;
        const link = buildMatchingLink(offerId, needsAnalysisId);

        if (salerInfo?.id) {
            await this.notificationService.create({
                userId: salerInfo.id,
                type,
                category,
                level,
                title,
                message,
                link,
            });
        } else {
            const responsables = await this.userRepository.findByRoleIdAndPermissionId(1, 2);
            await Promise.all(
                responsables.map((user) =>
                    this.notificationService.create({ userId: user.id, type, category, level, title, message, link }),
                ),
            );
        }
    }

    async addManualProposedCandidate(
        offerId: string,
        candidateId: string,
        interviewDate: string,
        interviewHour: string,
        interviewLocation: string,
        ownerEmail: string,
    ): Promise<object | null> {
        const offer = await this.offerRepository.findById(offerId);
        if (!offer) return null;

        const candidate = await this.candidateRepository.findById(candidateId);
        if (!candidate) throw new Error('Candidat introuvable');

        const proposed: MatchingCandidate = {
            ...candidateToMatchingCandidate(candidate),
            status: MatchedCandidateStatus.INTERVIEW,
            booked_interview_slot: new Date(`${interviewDate}T${interviewHour}`).toISOString(),
            interview_location: interviewLocation,
        };

        const updated = await this.offerRepository.addProposedCandidate(offerId, proposed);
        if (!updated) return null;

        await this.candidateHistoryService.recordManual(
            candidateId,
            `Le candidat.e a un entretien avec ${
                offer.company_infos?.name ?? ''
            } le ${interviewDate} à ${interviewLocation}`,
            ownerEmail,
        );

        await this.offerHistoryService.recordAuto(
            offerId,
            `Entretien programmé pour ${candidate.identity.full_name} le ${interviewDate}`,
        );

        return toGql(updated);
    }

    async addManualProposedCandidateForImmersion(
        offerId: string,
        candidateId: string,
        immersionStartDate: string,
        immersionEndDate: string,
        immersionLocation: string,
        ownerEmail: string,
    ): Promise<object | null> {
        const offer = await this.offerRepository.findById(offerId);
        if (!offer) return null;

        const candidate = await this.candidateRepository.findById(candidateId);
        if (!candidate) throw new Error('Candidat introuvable');

        const proposed: MatchingCandidate = {
            ...candidateToMatchingCandidate(candidate),
            status: MatchedCandidateStatus.IMMERSING,
            immersion_start_date: immersionStartDate,
            immersion_end_date: immersionEndDate,
            immersion_location: immersionLocation,
        };

        const updated = await this.offerRepository.addProposedCandidate(offerId, proposed);
        if (!updated) return null;

        await this.candidateService.update(candidateId, { status: CandidateStatus.IMMERSING });

        await this.candidateHistoryService.recordManual(
            candidateId,
            `Le candidat.e est en immersion chez ${
                offer.company_infos?.name ?? ''
            } du ${immersionStartDate} au ${immersionEndDate}`,
            ownerEmail,
        );

        await this.offerHistoryService.recordAuto(
            offerId,
            `Immersion programmée pour ${candidate.identity.full_name} du ${immersionStartDate} au ${immersionEndDate}`,
        );

        return toGql(updated);
    }

    async setInterviewConclusion(
        offerId: string,
        candidateId: string,
        conclusion: InterviewConclusion,
        immersionStartDate: string | undefined,
        immersionEndDate: string | undefined,
        ownerEmail: string,
    ): Promise<object | null> {
        const offer = await this.offerRepository.findById(offerId);
        if (!offer) return null;

        const proposed = offer.matching?.candidates?.find((c) => c.id === candidateId);
        if (!proposed) throw new Error('Candidat proposé introuvable');

        if (!isInterviewDatePast(proposed.booked_interview_slot)) {
            throw new Error("L'entretien n'a pas encore eu lieu");
        }

        if (conclusion === InterviewConclusion.IMMERSING && (!immersionStartDate || !immersionEndDate)) {
            throw new Error("Les dates d'immersion sont requises pour cette conclusion");
        }

        const status =
            conclusion === InterviewConclusion.IMMERSING
                ? MatchedCandidateStatus.IMMERSING
                : conclusion === InterviewConclusion.REJECTED
                  ? MatchedCandidateStatus.REFUSED
                  : conclusion === InterviewConclusion.CONTRACT
                    ? MatchedCandidateStatus.CONTRACT
                    : undefined;
        const updated = await this.offerRepository.setProposedCandidateConclusion(
            offerId,
            candidateId,
            conclusion,
            immersionStartDate,
            immersionEndDate,
            status,
        );
        if (!updated) return null;

        await this.candidateService.update(candidateId, {
            status: INTERVIEW_CONCLUSION_TO_CANDIDATE_STATUS[conclusion],
        });

        const description = this.buildInterviewConclusionHistoryEntry(
            conclusion,
            proposed.full_name,
            offer.company_infos?.name,
            immersionStartDate,
            immersionEndDate,
        );
        await this.candidateHistoryService.recordManual(candidateId, description, ownerEmail);

        await this.offerHistoryService.recordAuto(
            offerId,
            this.buildInterviewConclusionOfferHistoryEntry(
                conclusion,
                proposed.full_name,
                immersionStartDate,
                immersionEndDate,
            ),
        );

        if (conclusion === InterviewConclusion.CONTRACT) {
            await this.notifyContractSigned(
                offer.saler_info,
                proposed.full_name,
                offer.company_infos?.name,
                offerId,
                offer.needs_analysis_id,
            );
        }

        return toGql(updated);
    }

    async setImmersionConclusion(
        offerId: string,
        candidateId: string,
        conclusion: ImmersionConclusion,
        ownerEmail: string,
    ): Promise<object | null> {
        const offer = await this.offerRepository.findById(offerId);
        if (!offer) return null;

        const proposed = offer.matching?.candidates?.find((c) => c.id === candidateId);
        if (!proposed) throw new Error('Candidat proposé introuvable');

        if (proposed.interview_conclusion !== InterviewConclusion.IMMERSING) {
            throw new Error("Ce candidat n'est pas en immersion");
        }

        const updated = await this.offerRepository.setProposedCandidateImmersionConclusion(
            offerId,
            candidateId,
            conclusion,
            conclusion === ImmersionConclusion.REJECTED
                ? MatchedCandidateStatus.REFUSED
                : conclusion === ImmersionConclusion.CONTRACT
                  ? MatchedCandidateStatus.CONTRACT
                  : undefined,
        );
        if (!updated) return null;

        await this.candidateService.update(candidateId, {
            status: IMMERSION_CONCLUSION_TO_CANDIDATE_STATUS[conclusion],
        });

        const description = this.buildImmersionConclusionHistoryEntry(
            conclusion,
            proposed.full_name,
            offer.company_infos?.name,
        );
        await this.candidateHistoryService.recordManual(candidateId, description, ownerEmail);

        await this.offerHistoryService.recordAuto(
            offerId,
            this.buildImmersionConclusionOfferHistoryEntry(conclusion, proposed.full_name),
        );

        if (conclusion === ImmersionConclusion.CONTRACT) {
            await this.notifyContractSigned(
                offer.saler_info,
                proposed.full_name,
                offer.company_infos?.name,
                offerId,
                offer.needs_analysis_id,
            );
        }

        return toGql(updated);
    }

    private buildImmersionConclusionHistoryEntry(
        conclusion: ImmersionConclusion,
        candidateName?: string,
        companyName?: string,
    ): string {
        switch (conclusion) {
            case ImmersionConclusion.REJECTED:
                return `L'immersion c'est soldée par un rejet entre ${candidateName} et ${companyName}`;
            case ImmersionConclusion.CONTRACT:
                return `L'immersion c'est soldée par un contrat avec ${companyName}`;
        }
    }

    private buildImmersionConclusionOfferHistoryEntry(conclusion: ImmersionConclusion, candidateName?: string): string {
        switch (conclusion) {
            case ImmersionConclusion.REJECTED:
                return `Immersion de ${candidateName} conclue : candidat non retenu`;
            case ImmersionConclusion.CONTRACT:
                return `Immersion de ${candidateName} conclue : embauche`;
        }
    }

    private buildInterviewConclusionOfferHistoryEntry(
        conclusion: InterviewConclusion,
        candidateName?: string,
        immersionStartDate?: string,
        immersionEndDate?: string,
    ): string {
        switch (conclusion) {
            case InterviewConclusion.REJECTED:
                return `Entretien de ${candidateName} conclu : candidat non retenu`;
            case InterviewConclusion.IMMERSING:
                return `Entretien de ${candidateName} conclu : immersion du ${immersionStartDate} au ${immersionEndDate}`;
            case InterviewConclusion.CONTRACT:
                return `Entretien de ${candidateName} conclu : embauche`;
        }
    }

    private buildInterviewConclusionHistoryEntry(
        conclusion: InterviewConclusion,
        candidateName?: string,
        companyName?: string,
        immersionStartDate?: string,
        immersionEndDate?: string,
    ): string {
        switch (conclusion) {
            case InterviewConclusion.REJECTED:
                return `L'entretien c'est soldé par un rejet entre ${candidateName} et ${companyName}`;
            case InterviewConclusion.IMMERSING:
                return `L'entretien c'est soldé par une immersion du ${immersionStartDate} au ${immersionEndDate} avec ${companyName}`;
            case InterviewConclusion.CONTRACT:
                return `L'entretien c'est soldé par un contrat avec ${companyName}`;
        }
    }

    private async syncDerivedStatus(offerId: string, offer: Offer): Promise<Offer> {
        const candidates = offer.matching?.candidates ?? [];
        const derived = deriveOfferStatus(candidates, offer.matching?.status);
        if (derived === offer.matching?.status) return offer;
        const updated = await this.offerRepository.setOfferStatus(offerId, derived);
        return updated ?? offer;
    }

    offerResponseLinks(offerId: string, candidateId: string): { ouiUrl: string; nonUrl: string } {
        const oui = signMatchUrl(offerId, candidateId, 'oui');
        const non = signMatchUrl(offerId, candidateId, 'non');
        const base = `${env.APP_BASE_URL}/api/matching/response?offerId=${offerId}&candidateId=${candidateId}`;
        return {
            ouiUrl: `${base}&answer=oui&sig=${oui.sig}&ts=${oui.ts}`,
            nonUrl: `${base}&answer=non&sig=${non.sig}&ts=${non.ts}`,
        };
    }
}
