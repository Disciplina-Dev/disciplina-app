import { authGuard } from '../authGuard';
import { Role } from '../../types/user.types';
import { TodoService } from '../../services/TodoService';

const todoService = new TodoService();

const ALLOWED_ROLES = [Role.ADMIN, Role.RESPONSABLE, Role.COMMERCIAL, Role.RH];

export const todoResolvers = {
    Query: {
        myTodos: async (_: unknown, __: unknown, context: any) => {
            authGuard(context.user, ALLOWED_ROLES);
            return todoService.listForUser(context.user.id);
        },
    },
    Mutation: {
        createTodo: async (_: unknown, { input }: { input: any }, context: any) => {
            authGuard(context.user, ALLOWED_ROLES);
            return todoService.create(context.user.id, input);
        },
        updateTodo: async (_: unknown, { id, input }: { id: number; input: any }, context: any) => {
            authGuard(context.user, ALLOWED_ROLES);
            return todoService.update(context.user.id, id, input);
        },
        reorderTodos: async (_: unknown, { orderedIds }: { orderedIds: number[] }, context: any) => {
            authGuard(context.user, ALLOWED_ROLES);
            return todoService.reorder(context.user.id, orderedIds);
        },
        deleteTodo: async (_: unknown, { id }: { id: number }, context: any) => {
            authGuard(context.user, ALLOWED_ROLES);
            return todoService.delete(context.user.id, id);
        },
    },
};
