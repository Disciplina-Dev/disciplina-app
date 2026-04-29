import { authGuard } from '../authGuard';
import { Role } from '../../services/interfaces';
import { CandidateService } from '../../services/CandidateService';
import { randomUUID } from 'crypto';
import {
    TitleProfessionalType,
    CandidateStatus,
    SchoolLevel,
    TrainingSite,
    Candidate,
} from '../../db/mongodb/interface';
import { UserService } from '../../services/UserService';
import { PdfService } from '../../services/PdfService';
import { DriveService } from '../../rest/google/service/DriveService';

const candidateService = new CandidateService();
const userService = new UserService();

interface CreateCandidateInput {
    status: CandidateStatus;
    tpType: TitleProfessionalType;
    identity: { fullName: string; email: string; phone: string; [key: string]: any };
    [key: string]: any;
}

interface UpdateCandidateInput {
    [key: string]: any;
}

function camelToSnakeCase(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(camelToSnakeCase);

    const result: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            result[snakeKey] = camelToSnakeCase(obj[key]);
        }
    }
    return result;
}

function snakeToCamelCase(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(snakeToCamelCase);

    const result: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const camelKey = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
            result[camelKey] = snakeToCamelCase(obj[key]);
        }
    }
    return result;
}

function toGql(candidate: Candidate): any {
    return {
        id: candidate._id,
        status: candidate.status,
        tpType: candidate.tp_type,
        trainingSite: candidate.training_site,
        immersionAgreement: candidate.immersion_agreement,
        desiredSectors: candidate.desired_sectors,
        expectedCompanySkills: candidate.expected_company_skills,
        identity: candidate.identity ? snakeToCamelCase(candidate.identity) : null,
        education: candidate.education ? snakeToCamelCase(candidate.education) : null,
        support: candidate.support ? snakeToCamelCase(candidate.support) : null,
        background: candidate.background ? snakeToCamelCase(candidate.background) : null,
        profile: candidate.profile ? snakeToCamelCase(candidate.profile) : null,
        professionalProjects: candidate.professional_projects
            ? snakeToCamelCase(candidate.professional_projects)
            : null,
        skillsAssessment: candidate.skills_assessment
            ? candidate.skills_assessment.map((s) => snakeToCamelCase(s))
            : null,
        jobInfo: candidate.job_info ? snakeToCamelCase(candidate.job_info) : null,
        synthesis: candidate.synthesis ? snakeToCamelCase(candidate.synthesis) : null,
        pdfLink: candidate.pdf_link || null,
    };
}

export const resolvers = {
    Query: {
        candidates: async (_: unknown, __: unknown, context: any) => {
            authGuard(context.user, [Role.RH]);
            const candidates = await candidateService.findAll();
            return candidates.map(toGql);
        },
        candidate: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuard(context.user, [Role.RH]);
            const candidate = await candidateService.findById(id);
            return candidate ? toGql(candidate) : null;
        },
    },
    Mutation: {
        createCandidate: async (_: unknown, { input }: { input: CreateCandidateInput }, context: any) => {
            authGuard(context.user, [Role.RH]);
            const id = randomUUID();
            const snakeInput = camelToSnakeCase(input);

            let newCandidate = await candidateService.create({
                _id: id,
                candidate_id: id,
                ...snakeInput,
            });

            try {
                const user = await userService.findById(context.user.id);
                if (user && user.oauthToken) {
                    const pdfBuffer = await PdfService.generateCandidatePdf(newCandidate);
                    
                    const driveService = DriveService.fromTokens({
                        access_token: user.oauthToken,
                        refresh_token: user.refreshToken || undefined,
                    });
                    
                    const folderName = `${newCandidate.identity.full_name} - ${id.substring(0, 8)}`;
                    const folderId = await driveService.createFolder(folderName);
                    const pdfLink = await driveService.uploadFile(`Dossier_${newCandidate.identity.full_name}.pdf`, 'application/pdf', pdfBuffer, folderId);
                    
                    await candidateService.update(id, { pdf_link: pdfLink });
                    newCandidate.pdf_link = pdfLink;
                }
            } catch (error) {
                console.error("Erreur lors de la création du PDF ou de l'upload vers Drive :", error);
            }

            return toGql(newCandidate);
        },

        updateCandidate: async (
            _: unknown,
            { id, input }: { id: string; input: UpdateCandidateInput },
            context: any
        ) => {
            authGuard(context.user, [Role.RH]);
            const snakeInput = camelToSnakeCase(input);
            const updated = await candidateService.update(id, snakeInput);

            if (!updated) {
                throw new Error(`Candidate with id ${id} not found`);
            }

            return toGql(updated);
        },

        deleteCandidate: async(_: unknown, { id }: { id: string }) => {
            return candidateService.delete(id);
        }
    },
};
