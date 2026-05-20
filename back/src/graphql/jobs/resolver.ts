import { authGuard } from '../authGuard';
import { Role } from '../../types/user.types';
import { JobService } from '../../services/JobService';
import { Job, JobStatus } from '../../types/job.types';

const jobService = new JobService();

export const resolvers = {
    Query: {
        jobs: async (_: unknown, __: unknown, context: any) => {
            authGuard(context.user, [Role.RH]);
            return jobService.findAll();
        },
        matchJob: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuard(context.user, [Role.RH]);
            return jobService.find(id);
        },
    },
    Mutation: {
        updateJob: async (_: unknown, { id, job }: { id: string; job: Job }, context: any) => {
            authGuard(context.user, [Role.RH]);
            return jobService.update(id, job);
        },
        unmatch: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuard(context.user, [Role.RH]);
            const job = (await jobService.find(id)) as Job | null;
            if (job) {
                job.status = JobStatus.NOT_MATCHED;
                return jobService.update(id, job);
            }
            return null;
        },
    },
};
