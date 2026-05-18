import { authGuard } from '../authGuard';
import { Role } from '../../types/user.types';
import { CandidateService } from '../../services/CandidateService';
import { randomUUID } from 'crypto';
import { TitleProfessionalType, CandidateStatus } from '../../types/candidate.types';
import { UserService } from '../../services/UserService';
import { PdfService } from '../../services/PdfService';
import { GoogleDriveService } from '../../external/google/drive.service';
import { GoogleTokens } from '../../external/google/types';
import { camelToSnakeCase, candidateToGql } from '../../services/mappers/candidate.mapper';

const candidateService = new CandidateService();
const userService = new UserService();

const persistRefreshedTokens = (userId: number) => (refreshed: GoogleTokens) =>
    userService.updateGoogleTokens(userId, refreshed.access_token ?? null, refreshed.refresh_token ?? null);

interface CreateCandidateInput {
    status: CandidateStatus;
    tpType: TitleProfessionalType;
    identity: { fullName: string; email: string; phone: string; [key: string]: any };
    [key: string]: any;
}

interface UpdateCandidateInput {
    [key: string]: any;
}

export const resolvers = {
    Query: {
        candidates: async (_: unknown, __: unknown, context: any) => {
            authGuard(context.user, [Role.RH]);
            const candidates = await candidateService.findAll();
            return candidates.map(candidateToGql);
        },
        candidate: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuard(context.user, [Role.RH]);
            const candidate = await candidateService.findById(id);
            console.log('[candidate resolver] id:', id, '| found:', !!candidate);
            if (!candidate) return null;
            try {
                return candidateToGql(candidate);
            } catch (err) {
                console.error('[candidate resolver] candidateToGql failed for id:', id, err);
                throw err;
            }
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

                    const driveService = GoogleDriveService.fromTokens(
                        { access_token: user.oauthToken, refresh_token: user.refreshToken ?? undefined },
                        persistRefreshedTokens(user.id),
                    );

                    const folderName = `${newCandidate.identity.full_name} - ${id.substring(0, 8)}`;
                    const folderId = await driveService.createFolder(folderName);
                    const pdfLink = await driveService.uploadFile(
                        `Dossier_${newCandidate.identity.full_name}.pdf`,
                        'application/pdf',
                        pdfBuffer,
                        folderId,
                    );

                    await candidateService.update(id, { pdf_link: pdfLink });
                    newCandidate.pdf_link = pdfLink;
                }
            } catch (error) {
                console.error("Erreur lors de la création du PDF ou de l'upload vers Drive :", error);
            }

            return candidateToGql(newCandidate);
        },

        updateCandidate: async (
            _: unknown,
            { id, input }: { id: string; input: UpdateCandidateInput },
            context: any,
        ) => {
            authGuard(context.user, [Role.RH]);
            const snakeInput = camelToSnakeCase(input);
            const updated = await candidateService.update(id, snakeInput);

            if (!updated) {
                throw new Error(`Candidate with id ${id} not found`);
            }

            return candidateToGql(updated);
        },

        deleteCandidate: async (_: unknown, { id }: { id: string }, context: any) => {
            authGuard(context.user, [Role.RH]);
            return candidateService.delete(id);
        },
    },
};
