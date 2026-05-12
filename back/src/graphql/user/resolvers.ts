import { UserService } from '../../services/UserService';
import { Role } from '../../types/user.types';
import { createOAuth2Client } from '../../rest/google/client';
import { env } from '../../config/env';

const userService = new UserService();

export const resolvers = {
    Query: {
        me: async (_: unknown, __: unknown, context: any) => {
            if (!context.user) return null;
            return userService.findById(context.user.id);
        },
    },
    Mutation: {
        register: async (_: unknown, { email, name, passwordPlain, role, sectors }: {
            email: string;
            name: string;
            passwordPlain: string;
            role: Role;
            sectors?: string[];
        }) => {
            return userService.register(email, name, passwordPlain, role, sectors);
        },
        login: async (_: unknown, { email, passwordPlain }: { email: string; passwordPlain: string }) => {
            const { token, user } = await userService.login(email, passwordPlain);
            return { token, user };
        },
        linkGoogleDrive: async (_: unknown, { code }: { code: string }, context: any) => {
            if (!context.user) throw new Error('Unauthorized');

            const oauth2Client = createOAuth2Client({
                clientId: env.GOOGLE_CLIENT_ID || '',
                clientSecret: env.GOOGLE_CLIENT_SECRET || '',
                redirectUri: 'postmessage',
            });

            const { tokens } = await oauth2Client.getToken(code);

            await userService.updateDriveTokens(
                context.user.id,
                tokens.access_token || null,
                tokens.refresh_token || null
            );

            return userService.findById(context.user.id);
        },
    },
};
