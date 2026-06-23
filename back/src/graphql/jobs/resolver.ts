import { authGuard } from '../authGuard';
import { Role } from '../../types/user.types';
import { JobService } from '../../services/JobService';
import { MatchLinkService } from '../../services/MatchLinkService';
import { MatchMailService } from '../../services/MatchMailService';

const jobService = new JobService();
const matchLinkService = new MatchLinkService();
const matchMailService = new MatchMailService();

export const resolvers = {
    Query: {
        jobs: async (_: unknown, __: unknown, context: any) => {
            authGuard(context.user, [Role.RH, Role.RESPONSABLE]);
            return await jobService.findAll();
        },
        matchJob: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuard(context.user, [Role.RH, Role.RESPONSABLE]);
            return await jobService.find(id);
        },
        offerResponseLinks: (
            _: unknown,
            { jobId, candidateId }: { jobId: string; candidateId: string },
            context: any,
        ) => {
            authGuard(context.user, [Role.RH, Role.RESPONSABLE]);
            return jobService.offerResponseLinks(jobId, candidateId);
        },
        candidateMatchedJobIds: async (_: unknown, { candidateId }: { candidateId: string }, context: any) => {
            authGuard(context.user, [Role.RH, Role.RESPONSABLE]);
            return jobService.getMatchedJobIds(candidateId);
        },
    },
    Mutation: {
        updateJob: async (_: unknown, { id, job }: { id: string; job: any }, context: any) => {
            authGuard(context.user, [Role.RH, Role.RESPONSABLE]);
            return await jobService.update(id, job);
        },
        unmatchJob: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuard(context.user, [Role.RH, Role.RESPONSABLE]);
            return jobService.unmatchAll(id);
        },
        addCandidateToJob: async (
            _: unknown,
            { jobId, candidateId }: { jobId: string; candidateId: string },
            context: any,
        ) => {
            authGuard(context.user, [Role.RH, Role.RESPONSABLE]);
            return await jobService.addCandidate(jobId, candidateId);
        },
        removeCandidateFromJob: async (
            _: unknown,
            { jobId, candidateId }: { jobId: string; candidateId: string },
            context: any,
        ) => {
            authGuard(context.user, [Role.RH, Role.RESPONSABLE]);
            return jobService.removeCandidate(jobId, candidateId);
        },
        updateMatchedCandidateStatus: async (
            _: unknown,
            { jobId, candidateId, status }: { jobId: string; candidateId: string; status: string },
            context: any,
        ) => {
            authGuard(context.user, [Role.RH, Role.RESPONSABLE]);
            return jobService.updateMatchedCandidateStatus(jobId, candidateId, status);
        },
        addManualProposedCandidate: async (
            _: unknown,
            {
                jobId,
                candidateId,
                interviewDate,
                interviewHour,
                interviewLocation,
            }: {
                jobId: string;
                candidateId: string;
                interviewDate: string;
                interviewHour: string;
                interviewLocation: string;
            },
            context: any,
        ) => {
            authGuard(context.user, [Role.RH, Role.RESPONSABLE]);
            return await jobService.addManualProposedCandidate(
                jobId,
                candidateId,
                interviewDate,
                interviewHour,
                interviewLocation,
                context.user.email,
            );
        },
        createMatchSession: async (
            _: unknown,
            {
                jobId,
                companyEmail,
                candidates,
            }: { jobId: string; companyEmail: string; candidates: { id: string; description?: string }[] },
            context: any,
        ) => {
            authGuard(context.user, [Role.RH, Role.RESPONSABLE]);
            const credentials = await matchLinkService.createSession({
                jobId,
                rhEmail: context.user.email,
                companyEmail,
                candidates,
            });
            await matchMailService.sendInvitation(credentials);
            return credentials.signature;
        },
    },
};
