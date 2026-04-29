import { UserService } from '../../services/UserService';
import { Role } from '../../services/interfaces';
import { createOAuth2Client } from '../../rest/google/client';

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
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirectUri: 'postmessage', // Requis pour le flux côté client (popup)
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
