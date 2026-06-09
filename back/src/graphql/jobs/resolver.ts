import { authGuard } from '../authGuard';
import { Role } from '../../types/user.types';
import { JobService } from '../../services/JobService';
import { Job, JobStatus } from '../../types/job.types';

const jobService = new JobService();

export const resolvers = {
    Query: {
        jobs: async (_: unknown, __: unknown, context: any) => {
<<<<<<< Updated upstream
            authGuard(context.user, [Role.RH]);
            return jobService.findAll();
        },
        matchJob: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuard(context.user, [Role.RH]);
            return jobService.find(id);
        },
=======
            // authGuard(context.user, [Role.RH])
            return await jobService.findAll();
        },

        matchJob: async (_: unknown, { id }: { id: string}, context: any) => {
            // authGuard(context.user, [Role.RH]);
            return await jobService.find(id);
        }
>>>>>>> Stashed changes
    },
    Mutation: {
<<<<<<< Updated upstream
        updateJob: async (_: unknown, { id, job }: { id: string; job: Job }, context: any) => {
            authGuard(context.user, [Role.RH]);
            return jobService.update(id, job);
        },
        unmatch: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuard(context.user, [Role.RH]);
            const job = (await jobService.find(id)) as Job | null;
=======
        updateJob: async (_: unknown, { job }: { job: Job }, context: any) => {
            // authGuard(context.user, [Role.RH]);
            const id: string = job._id;
            job.status = JobStatus.MATCHED;
            return await jobService.update(id, job)
        },

        unmatch: async (_: unknown, { id }: { id: string}, context: any) => {
            // authGuard(context.user, [Role.RH]);
            const job: Job = jobService.find(id);

>>>>>>> Stashed changes
            if (job) {
                job.status = JobStatus.NOT_MATCHED;
                return jobService.update(id, job);
            }
            return null;
        },
    },
};
