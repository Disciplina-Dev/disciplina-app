import { UserService } from '../../services/UserService';
import { Role } from '../../services/interfaces';

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
  },
};
