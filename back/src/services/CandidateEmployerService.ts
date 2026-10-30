import { Candidate, CandidateStatus } from '../types/candidate.types';
import { Offer } from '../types/offer.types';
import { NeedsAnalysis, ReferentDetails } from '../types/needsAnalysisNoSql.types';
import { CandidateService } from './CandidateService';
import { CompanyRepository } from '../repositories/mysql/CompanyRepository';
import { OfferRepository } from '../repositories/mongo/OfferRepository';
import { NeedsAnalysisRepository } from '../repositories/mongo/NeedsAnalysisRepository';

// Valeur posée par ContractModal quand le contrat n'a pas d'entreprise.
const NOT_SPECIFIED = 'Non renseigné';

export interface ContractSources {
    offer: Offer | null;
    needsAnalysis: NeedsAnalysis | null;
}

export interface CandidateEmployer {
    name: string | null;
    siret: string | null;
    opco: string | null;
    address: string | null;
    mentorName: string | null;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    startDate: Date | null;
    sessionId: string | null;
}

// Le contact de recrutement prime sur le représentant légal, comme pour le dossier Filiz.
function pickReferent(needsAnalysis: NeedsAnalysis | null, offer: Offer | null): ReferentDetails | undefined {
    const referents = needsAnalysis?.referents ?? offer?.referents;
    return [referents?.recruitment_referents, referents?.legal_referents].find((r) => r?.name || r?.email);
}

export class CandidateEmployerService {
    private offerRepository = new OfferRepository();
    private needsAnalysisRepository = new NeedsAnalysisRepository();
    private companyRepository = new CompanyRepository();
    private candidateService = new CandidateService();

    // Contrat du candidat : offre → besoin entreprise. Vide tant qu'aucun contrat n'est enregistré.
    async loadContractSources(candidate: Candidate): Promise<ContractSources> {
        if (!candidate.contract_offer_id) return { offer: null, needsAnalysis: null };
        const offer = await this.offerRepository.findById(candidate.contract_offer_id);
        const needsAnalysis = offer?.needs_analysis_id
            ? await this.needsAnalysisRepository.findById(offer.needs_analysis_id)
            : null;
        return { offer, needsAnalysis };
    }

    async findByCandidateId(candidateId: string): Promise<CandidateEmployer | null> {
        const candidate = await this.candidateService.findByIdReadOnly(candidateId);
        if (!candidate || candidate.status !== CandidateStatus.CONTRACT) return null;
        const { offer, needsAnalysis } = await this.loadContractSources(candidate);
        const companyId = candidate.contract_company_id ?? offer?.company_infos?.id;
        const company = companyId ? await this.companyRepository.findById(companyId) : null;
        const snapshotName = candidate.contract_company_name;
        const infos = needsAnalysis?.company_infos;
        const referent = pickReferent(needsAnalysis, offer);
        const siret = (infos?.siret ?? company?.siret)?.replace(/\s/g, '');
        const validSiret = siret && /^\d{14}$/.test(siret) ? siret : null;
        const name = infos?.name ?? company?.name ?? (snapshotName !== NOT_SPECIFIED ? snapshotName : null) ?? null;
        if (!name && !validSiret) return null;
        return {
            name,
            siret: validSiret,
            opco: infos?.opco ?? null,
            address: company?.address ?? null,
            mentorName: referent?.name ?? null,
            contactName: referent?.name ?? null,
            contactEmail: referent?.email ?? null,
            contactPhone: referent?.phone ?? null,
            startDate: candidate.contract_start_date ?? null,
            sessionId: candidate.contract_session_id ?? null,
        };
    }
}
