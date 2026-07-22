import { authGuard, authGuardRole } from '../authGuard';
import { JobRole, Permission } from '../../types/user.types';
import { InterviewConclusion, ImmersionConclusion } from '../../types/matching.types';
import { OfferService } from '../../services/OfferService';
import { MatchLinkService } from '../../services/MatchLinkService';
import { MatchMailService } from '../../services/MatchMailService';

const offerService = new OfferService();
const matchLinkService = new MatchLinkService();
const matchMailService = new MatchMailService();

export const resolvers = {
    Query: {
        offers: async (_: unknown, __: unknown, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            return await offerService.findAll();
        },
        matchOffer: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            return await offerService.find(id);
        },
        offerCompanyInfo: async (_: unknown, { offerId }: { offerId: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            return await offerService.getCompanyInfo(offerId);
        },
        offerResponseLinks: (
            _: unknown,
            { offerId, candidateId }: { offerId: string; candidateId: string },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            return offerService.offerResponseLinks(offerId, candidateId);
        },
        candidateMatchedOfferIds: async (_: unknown, { candidateId }: { candidateId: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            return offerService.getMatchedOfferIds(candidateId);
        },
        candidatePlacement: async (_: unknown, { candidateId }: { candidateId: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            return offerService.getCandidatePlacement(candidateId);
        },
        offersByNeedsAnalysis: async (_: unknown, { needsAnalysisId }: { needsAnalysisId: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            return offerService.findByNeedsAnalysisId(needsAnalysisId);
        },
    },
    Mutation: {
        updateOffer: async (_: unknown, { id, offer }: { id: string; offer: any }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            return await offerService.update(id, offer);
        },
        unmatchOffer: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            return offerService.unmatchAll(id);
        },
        addCandidateToOffer: async (
            _: unknown,
            { offerId, candidateId }: { offerId: string; candidateId: string },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            return await offerService.addCandidate(offerId, candidateId);
        },
        removeCandidateFromOffer: async (
            _: unknown,
            { offerId, candidateId }: { offerId: string; candidateId: string },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            return offerService.removeCandidate(offerId, candidateId);
        },
        updateMatchedCandidateStatus: async (
            _: unknown,
            { offerId, candidateId, status }: { offerId: string; candidateId: string; status: string },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            return offerService.updateMatchedCandidateStatus(offerId, candidateId, status);
        },
        addManualProposedCandidate: async (
            _: unknown,
            {
                offerId,
                candidateId,
                interviewDate,
                interviewHour,
                interviewLocation,
            }: {
                offerId: string;
                candidateId: string;
                interviewDate: string;
                interviewHour: string;
                interviewLocation: string;
            },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            return await offerService.addManualProposedCandidate(
                offerId,
                candidateId,
                interviewDate,
                interviewHour,
                interviewLocation,
                context.user.email,
            );
        },
        addManualProposedCandidateForImmersion: async (
            _: unknown,
            {
                offerId,
                candidateId,
                immersionStartDate,
                immersionEndDate,
                immersionLocation,
            }: {
                offerId: string;
                candidateId: string;
                immersionStartDate: string;
                immersionEndDate: string;
                immersionLocation: string;
            },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            return await offerService.addManualProposedCandidateForImmersion(
                offerId,
                candidateId,
                immersionStartDate,
                immersionEndDate,
                immersionLocation,
                context.user.email,
            );
        },
        setInterviewConclusion: async (
            _: unknown,
            {
                offerId,
                candidateId,
                conclusion,
                immersionStartDate,
                immersionEndDate,
            }: {
                offerId: string;
                candidateId: string;
                conclusion: string;
                immersionStartDate?: string;
                immersionEndDate?: string;
            },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            return await offerService.setInterviewConclusion(
                offerId,
                candidateId,
                conclusion as InterviewConclusion,
                immersionStartDate,
                immersionEndDate,
                context.user.email,
            );
        },
        setImmersionConclusion: async (
            _: unknown,
            { offerId, candidateId, conclusion }: { offerId: string; candidateId: string; conclusion: string },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            return await offerService.setImmersionConclusion(
                offerId,
                candidateId,
                conclusion as ImmersionConclusion,
                context.user.email,
            );
        },
        deleteOffer: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.RESPONSABLE, [JobRole.RH]);
            return offerService.delete(id);
        },
        deleteOffersByNeedsAnalysis: async (
            _: unknown,
            { needsAnalysisId }: { needsAnalysisId: string },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.RESPONSABLE, [JobRole.RH]);
            return offerService.deleteByNeedsAnalysisId(needsAnalysisId);
        },
        createMatchSession: async (
            _: unknown,
            {
                offerId,
                companyEmail,
                candidates,
            }: { offerId: string; companyEmail: string; candidates: { id: string; description?: string }[] },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            const credentials = await matchLinkService.createSession({
                offerId,
                rhEmail: context.user.email,
                companyEmail,
                candidates,
            });
            await matchMailService.sendInvitation(credentials);
            return credentials.signature;
        },
    },
};
