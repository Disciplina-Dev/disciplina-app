import { authGuard } from "../authGuard";
import { Role } from "../../services/interfaces";
import { JobService, toGql } from "../../services/JobService";
import { Job, JobStatus } from "../../db/mongodb/interface";
const jobService = new JobService();

export const resolvers = {
    Query: {
        jobs: async (_: unknown, __: unknown, context: any) => {
            authGuard(context.user, [Role.RH])
            return await jobService.findAll();
        },

        matchJob: async (_: unknown, { id }: { id: string}, context: any) => {
            authGuard(context.user, [Role.RH]);
            return await jobService.find(id);
        }
    },

    Mutation: {
        updateJob: async (_: unknown, { job }: { job: Job }, context: any) => {
            authGuard(context.user, [Role.RH]);
            const id: string = job._id;
            job.status = JobStatus.MATCHED;
            return await jobService.update(id, job)
        },

        unmatch: async (_: unknown, { id }: { id: string}, context: any) => {
            authGuard(context.user, [Role.RH]);
            const job: Job = jobService.find(id);

            if (job) {
                job.matched_candidate = [];
                job.status = JobStatus.NOT_MATCHED;
                return jobService.update(id, job);
            }
            return null
        }
    }
}