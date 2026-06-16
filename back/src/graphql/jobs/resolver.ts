import { authGuard } from '../authGuard';
import { Role } from '../../types/user.types';
import { JobService } from '../../services/JobService';

const jobService = new JobService();

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
    },
};
