import { CandidateService } from '../../services/CandidateService';
import { randomUUID } from 'crypto';
import {
    TitleProfessionalType,
    CandidateStatus,
    SchoolLevel,
    TrainingSite,
} from '../../db/mongodb/interface';

const candidateService = new CandidateService();

interface CreateCandidateIdentityInput {
    fullName: string;
    email: string;
    phone: string;
}

interface CreateCandidateInput {
    status: CandidateStatus;
    tpType: TitleProfessionalType;
    identity: CreateCandidateIdentityInput;
    schoolLevel?: SchoolLevel | null;
    trainingSite?: TrainingSite | null;
}

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
    Mutation: {
        createCandidate: async (_: unknown, { input }: { input: CreateCandidateInput }) => {
            const id = randomUUID();
            const newCandidate = await candidateService.create({
                _id: id,
                tp_type: input.tpType,
                status: input.status,
                identity: {
                    full_name: input.identity.fullName,
                    email: input.identity.email,
                    phone: input.identity.phone,
                },
                education: input.schoolLevel
                    ? { school_level: input.schoolLevel }
                    : undefined,
                training_site: input.trainingSite ?? undefined,
            });

            return {
                id: newCandidate._id,
                status: newCandidate.status,
                tpType: newCandidate.tp_type,
                identity: {
                    fullName: newCandidate.identity.full_name,
                    email: newCandidate.identity.email,
                    phone: newCandidate.identity.phone,
                },
                schoolLevel: newCandidate.education?.school_level ?? null,
            };
        },
    },
};
