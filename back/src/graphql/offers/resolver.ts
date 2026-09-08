import { authGuardRole } from '../authGuard';
import { JobRole, Permission } from '../../types/user.types';
import { InterviewConclusion, ImmersionConclusion } from '../../types/matching.types';
import { OfferService } from '../../services/OfferService';
import { OfferHistoryService } from '../../services/OfferHistoryService';
import { UserService } from '../../services/UserService';
import { MatchAccessService } from '../../services/MatchAccessService';
import { MatchMailService } from '../../services/MatchMailService';

const offerService = new OfferService();
const offerHistoryService = new OfferHistoryService();
const userService = new UserService();
const matchAccessService = new MatchAccessService();
const matchMailService = new MatchMailService();

export const resolvers = {
    Query: {
        offers: async (_: unknown, __: unknown, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            return await offerService.findAll();
        },
        matchOffer: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            return await offerService.find(id, context.user.id);
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
        offerHistory: async (_: unknown, { offerId }: { offerId: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            const entries = await offerHistoryService.findByOffer(offerId);
            return entries.map((e) => ({
                id: e._id,
                firstName: e.first_name,
                lastName: e.last_name,
                text: e.text,
                ownerEmail: e.owner_email,
                createdAt: e.created_at.toISOString(),
            }));
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
        addOfferHistoryEntry: async (
            _: unknown,
            { offerId, text }: { offerId: string; text: string },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            const user = await userService.findById(context.user.id);
            const entry = await offerHistoryService.recordManual(
                offerId,
                user!.firstName,
                user!.lastName,
                text,
                context.user.email,
            );
            return {
                id: entry._id,
                firstName: entry.first_name,
                lastName: entry.last_name,
                text: entry.text,
                ownerEmail: entry.owner_email,
                createdAt: entry.created_at.toISOString(),
            };
        },
        deleteOfferHistoryEntry: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            return offerHistoryService.deleteOwnedEntry(id, context.user.email);
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
                templateId,
            }: {
                offerId: string;
                companyEmail: string;
                candidates: { id: string; description?: string }[];
                templateId?: string;
            },
            context: any,
        ) => {
            authGuardRole(context.user, Permission.EMPLOYEE, [JobRole.RH]);
            const invitation = await matchAccessService.createSession({
                offerId,
                rhUserId: context.user.id,
                rhEmail: context.user.email,
                companyEmail,
                candidates,
            });
            await matchMailService.sendInvitation(invitation, templateId ?? undefined);
            return invitation.signature;
        },
    },
};
