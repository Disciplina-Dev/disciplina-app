import { CandidateService } from '../../services/CandidateService';

const candidateService = new CandidateService();

export const resolvers = {
    Query: {
        candidates: async () => {
            const candidates = await candidateService.findAll();
            return candidates.map(c => ({
                id: c._id,
                status: c.status,
                tpType: c.tp_type,
                identity: {
                    fullName: c.identity.full_name,
                    email: c.identity.email,
                    phone: c.identity.phone,
                },
                schoolLevel: c.education?.school_level ?? null,
            }));
        },
    },
};
