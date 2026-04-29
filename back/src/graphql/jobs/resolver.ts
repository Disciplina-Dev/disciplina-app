import { authGuard } from "../authGuard";
import { Role } from "../../services/interfaces";
import { JobService, toGql } from "../../services/JobService";
const jobService = new JobService();

export const resolvers = {
    Query: {
        jobs: async (_: unknown, __: unknown, context: any) => {
            // authGuard(context.user, [Role.RH])
            return await jobService.findAll();
        },

        matchJob: async (_: unknown, { id }: { id: string}, context: any) => {
            // authGuard(context.user, [Role.RH]);
            return await jobService.find(id);
        }
    }
}